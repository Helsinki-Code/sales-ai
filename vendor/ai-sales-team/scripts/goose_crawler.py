#!/usr/bin/env python3
"""
Goose crawler for managed lead discovery.
Primary fetch runtime: browser-harness (when available).
"""

import argparse
import html
import json
import re
import shutil
import subprocess
import sys
import time
from urllib.parse import parse_qs, quote_plus, unquote, urljoin, urlparse
from urllib.request import Request, urlopen


INTERNAL_PROTOCOLS = ("mailto:", "javascript:", "tel:", "#")
EMAIL_REGEX = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
LINK_REGEX = re.compile(r'href=["\']([^"\']+)["\']', re.IGNORECASE)
TITLE_REGEX = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
META_DESC_REGEX = re.compile(
    r'<meta[^>]+name=["\']description["\'][^>]*content=["\'](.*?)["\']',
    re.IGNORECASE | re.DOTALL,
)
TAG_REGEX = re.compile(r"<[^>]+>")
SPACE_REGEX = re.compile(r"\s+")


def _safe_text(value: str) -> str:
    return SPACE_REGEX.sub(" ", TAG_REGEX.sub(" ", html.unescape(value or ""))).strip()


def _normalize_url(url: str) -> str:
    parsed = urlparse(url if url.startswith("http") else f"https://{url}")
    path = parsed.path.rstrip("/")
    if not path:
        path = ""
    normalized = f"{parsed.scheme}://{parsed.netloc}{path}"
    return normalized


def _domain(url: str) -> str:
    return urlparse(_normalize_url(url)).netloc.lower().removeprefix("www.")


def _fetch_url_direct(url: str, timeout: float) -> str:
    request = Request(
        _normalize_url(url),
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; GooseCrawler/1.0)",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def _fetch_url_browser_harness(url: str, timeout: float) -> str | None:
    command = shutil.which("browser-harness")
    if not command:
        return None

    script = f"""
import json
try:
    page = http_get({json.dumps(_normalize_url(url))}, timeout={float(timeout)})
    print(json.dumps({{"ok": True, "html": page}}))
except Exception as exc:
    print(json.dumps({{"ok": False, "error": str(exc)}}))
"""
    try:
        run = subprocess.run(
            [command],
            input=script,
            text=True,
            capture_output=True,
            timeout=max(int(timeout) + 15, 20),
            check=False,
        )
    except Exception:
        return None

    if run.returncode != 0:
        return None

    for line in reversed(run.stdout.splitlines()):
        line = line.strip()
        if not line.startswith("{") or not line.endswith("}"):
            continue
        try:
            payload = json.loads(line)
        except Exception:
            continue
        if payload.get("ok") and isinstance(payload.get("html"), str):
            return payload["html"]
        break

    return None


def fetch_url(url: str, timeout: float) -> tuple[str, bool]:
    html_text = _fetch_url_browser_harness(url, timeout)
    if html_text is not None:
        return html_text, True
    return _fetch_url_direct(url, timeout), False


def extract_links(base_url: str, html_text: str, max_links: int) -> list[str]:
    found: list[str] = []
    seen = set()
    for raw in LINK_REGEX.findall(html_text):
        href = raw.strip()
        if not href or href.lower().startswith(INTERNAL_PROTOCOLS):
            continue
        absolute = urljoin(base_url, href)
        if not absolute.startswith("http"):
            continue
        normalized = _normalize_url(absolute)
        if normalized in seen:
            continue
        seen.add(normalized)
        found.append(normalized)
        if len(found) >= max_links:
            break
    return found


def extract_search_results(html_text: str, limit: int) -> list[dict]:
    results: list[dict] = []
    seen_domains = set()
    pattern = re.compile(
        r'<a[^>]+class=["\'][^"\']*result__a[^"\']*["\'][^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',
        re.IGNORECASE | re.DOTALL,
    )
    for href, raw_title in pattern.findall(html_text):
        href = html.unescape(href)
        parsed = urlparse(href)
        if "duckduckgo.com" in parsed.netloc and parsed.path.startswith("/l/"):
            query = parse_qs(parsed.query)
            redirect = query.get("uddg", [])
            if redirect:
                href = unquote(redirect[0])
        if not href.startswith("http"):
            continue
        domain = _domain(href)
        if not domain or domain in seen_domains:
            continue
        seen_domains.add(domain)
        title = _safe_text(raw_title)
        results.append({"url": _normalize_url(href), "title": title})
        if len(results) >= limit:
            break
    return results


def build_queries(icp: dict, seller_url: str) -> list[str]:
    industries = [x for x in icp.get("industry_taxonomy", []) if isinstance(x, str)][:3]
    use_cases = [x for x in icp.get("must_have_use_case_signals", []) if isinstance(x, str)][:3]
    geos = [x for x in icp.get("geo_hints", []) if isinstance(x, str)][:2]

    seed_domain = _domain(seller_url)
    query_set = set()

    for industry in industries or ["b2b software"]:
        query_set.add(f"{industry} companies")
        for use_case in use_cases or ["platform"]:
            query_set.add(f"{industry} {use_case} companies")
        for geo in geos:
            query_set.add(f"{industry} companies {geo}")

    query_set.add(f"companies similar to {seed_domain}")
    return list(query_set)[:8]


def extract_company_name(url: str, html_text: str) -> str:
    title_match = TITLE_REGEX.search(html_text)
    if title_match:
        cleaned = _safe_text(title_match.group(1))
        if cleaned:
            return cleaned.split("|")[0].split("-")[0].strip()
    return _domain(url).split(".")[0].replace("-", " ").title()


def extract_description(html_text: str) -> str:
    match = META_DESC_REGEX.search(html_text)
    if match:
        return _safe_text(match.group(1))[:500]
    text = _safe_text(html_text)
    return text[:500]


def crawl_company(root_url: str, icp: dict, max_pages: int, timeout: float) -> tuple[dict, bool]:
    root_url = _normalize_url(root_url)
    primary_html, used_harness = fetch_url(root_url, timeout)
    links = extract_links(root_url, primary_html, max_links=max_pages * 2)
    focus_keywords = ("about", "team", "leadership", "contact", "company", "careers", "jobs", "blog", "press")
    focus_pages = [url for url in links if any(keyword in url.lower() for keyword in focus_keywords)]
    pages = [root_url] + focus_pages[: max(0, max_pages - 1)]

    combined_text = []
    evidence_urls = []
    email_hits = {}
    linkedin_url = ""
    page_count = 0

    for page_url in pages:
        try:
            html_text, page_used_harness = fetch_url(page_url, timeout)
            used_harness = used_harness or page_used_harness
        except Exception:
            continue
        page_count += 1
        evidence_urls.append(page_url)
        text = _safe_text(html_text)
        if text:
            combined_text.append(text[:3000])

        for match in EMAIL_REGEX.findall(html_text):
            email_value = match.lower()
            if email_value.endswith((".png", ".jpg", ".jpeg", ".svg")):
                continue
            email_hits[email_value] = page_url

        if not linkedin_url:
            link_match = re.search(r"https?://(?:www\.)?linkedin\.com/company/[A-Za-z0-9._%+-/]+", html_text, re.IGNORECASE)
            if link_match:
                linkedin_url = link_match.group(0)

    keywords = [
        x.lower()
        for key in ("industry_taxonomy", "must_have_use_case_signals", "strict_must_match")
        for x in icp.get(key, [])
        if isinstance(x, str)
    ][:20]
    text_blob = " ".join(combined_text).lower()
    intent_signals = [keyword for keyword in keywords if keyword and keyword in text_blob][:12]

    email_candidates = [
        {
            "email": email_value,
            "source_url": source_url,
            "confidence": "pattern_derived",
        }
        for email_value, source_url in email_hits.items()
    ]

    contact_candidates = []
    for entry in email_candidates[:8]:
        local = entry["email"].split("@")[0]
        if "." in local:
            parts = [part for part in local.replace("_", ".").split(".") if part]
            if 1 < len(parts) <= 3:
                full_name = " ".join(part.capitalize() for part in parts)
                contact_candidates.append(
                    {
                        "name": full_name,
                        "title": "",
                        "email": entry["email"],
                        "source_url": entry["source_url"],
                    }
                )

    candidate = {
        "company_name": extract_company_name(root_url, primary_html),
        "company_website": root_url,
        "company_description": extract_description(primary_html),
        "company_linkedin": linkedin_url,
        "evidence_urls": evidence_urls[:20],
        "intent_signals": intent_signals,
        "email_candidates": email_candidates,
        "contact_candidates": contact_candidates,
        "pages_crawled": page_count,
    }
    return candidate, used_harness


def discover_candidates(url: str, count: int, icp: dict, max_pages: int, timeout: float) -> dict:
    seller_domain = _domain(url)
    queries = build_queries(icp, url)
    candidate_urls = []
    used_harness_any = False

    for query in queries:
        search_url = f"https://duckduckgo.com/html/?q={quote_plus(query)}"
        try:
            html_text, used_harness = fetch_url(search_url, timeout)
            used_harness_any = used_harness_any or used_harness
        except Exception:
            continue
        for result in extract_search_results(html_text, limit=max(count * 6, 40)):
            domain = _domain(result["url"])
            if not domain or domain == seller_domain:
                continue
            candidate_urls.append(result["url"])
        if len(candidate_urls) >= count * 8:
            break

    deduped_urls = []
    seen_domains = set()
    for candidate_url in candidate_urls:
        domain = _domain(candidate_url)
        if domain in seen_domains:
            continue
        seen_domains.add(domain)
        deduped_urls.append(candidate_url)
        if len(deduped_urls) >= count * 6:
            break

    companies = []
    total_pages = 0

    for company_url in deduped_urls:
        try:
            company, used_harness = crawl_company(company_url, icp, max_pages=max_pages, timeout=timeout)
            used_harness_any = used_harness_any or used_harness
        except Exception:
            continue
        total_pages += int(company.get("pages_crawled", 0))
        companies.append(company)

    def company_rank(item: dict) -> tuple:
        signals = len(item.get("intent_signals", []))
        emails = len(item.get("email_candidates", []))
        evidence = len(item.get("evidence_urls", []))
        return (signals, emails, evidence)

    companies.sort(key=company_rank, reverse=True)

    return {
        "runtime": "browser_harness_primary",
        "used_browser_harness": used_harness_any,
        "queries": queries,
        "company_candidates": companies[: count * 4],
        "crawl_stats": {
            "search_results": len(deduped_urls),
            "pages_crawled": total_pages,
            "companies_crawled": len(companies),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Discover lead candidates with Goose crawler.")
    parser.add_argument("--url", required=True, help="Seller website URL")
    parser.add_argument("--count", type=int, default=10, help="Requested lead count")
    parser.add_argument("--icp-json", default="{}", help="Extracted ICP JSON string")
    parser.add_argument("--max-pages", type=int, default=25, help="Per-company max pages to crawl")
    parser.add_argument("--timeout", type=float, default=12.0, help="HTTP timeout in seconds")
    args = parser.parse_args()

    try:
        icp = json.loads(args.icp_json) if args.icp_json else {}
        if not isinstance(icp, dict):
            icp = {}
    except Exception:
        icp = {}

    result = discover_candidates(
        url=args.url,
        count=max(1, int(args.count)),
        icp=icp,
        max_pages=max(1, int(args.max_pages)),
        timeout=max(3.0, float(args.timeout)),
    )
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
