#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import re
import textwrap
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BLOGS_DIR = ROOT / "blogs"
PUBLIC_BLOG_DIR = ROOT / "apps" / "web" / "public" / "blog"
CONTENT_DIR = ROOT / "apps" / "web" / "content"
MANIFEST_PATH = CONTENT_DIR / "blog-image-manifest.json"
STATUS_PATH = CONTENT_DIR / "blog-image-generation-status.json"

STOP_WORDS = {
    "the",
    "and",
    "with",
    "for",
    "that",
    "this",
    "from",
    "showing",
    "dark",
    "mode",
    "background",
    "clean",
    "professional",
    "style",
    "people",
    "charcoal",
    "illustration",
    "diagram",
    "show",
    "layout",
    "card",
    "cards",
    "wide",
    "format",
    "ultra",
    "detailed",
}


def slugify(value: str) -> str:
    value = re.sub(r"[^a-z0-9\s-]", "", value.lower().strip())
    value = re.sub(r"\s+", "-", value)
    value = re.sub(r"-+", "-", value)
    return value


def clean_block_value(value: str) -> str:
    lines = []
    for raw_line in value.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if re.fullmatch(r"=+", line):
            continue
        if re.fullmatch(r"-{3,}", line):
            continue
        if re.match(r"^FEATURED IMAGE$", line, flags=re.I):
            continue
        if re.match(r"^IMAGE\s+\d+", line, flags=re.I):
            continue
        lines.append(line)
    return " ".join(lines).strip()


def read_json(path: Path, fallback: dict) -> dict:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def extract_slug(raw: str, file_name: str) -> str:
    match = re.search(r"URL slug:\s*/blog/([a-z0-9-]+)", raw, flags=re.I)
    if match:
        return match.group(1).strip()
    return slugify(file_name.replace(".md", ""))


def extract_title(raw: str, fallback: str) -> str:
    match = re.search(r"^#\s+(.+)$", raw, flags=re.M)
    return (match.group(1).strip() if match else fallback).strip()


def extract_image_blocks(raw: str) -> list[dict]:
    blocks: list[dict] = []
    for match in re.finditer(r"<!--([\s\S]*?)-->", raw):
        body = match.group(1)
        if "Image gen prompt:" not in body:
            continue
        prompt_raw = re.search(r"Image gen prompt:\s*([\s\S]*?)\nAlt tag:", body, flags=re.I)
        alt_raw = re.search(r"Alt tag:\s*([\s\S]*?)$", body, flags=re.I)
        prompt = clean_block_value(prompt_raw.group(1) if prompt_raw else "")
        alt = clean_block_value(alt_raw.group(1) if alt_raw else "") or "Blog illustration"
        blocks.append({"prompt": prompt, "alt": alt})
    return blocks


def extract_tags(prompt: str) -> list[str]:
    words = re.sub(r"[^a-z0-9\s]", " ", prompt.lower()).split()
    dedup = []
    for word in words:
        if len(word) < 4 or word in STOP_WORDS:
            continue
        if word not in dedup:
            dedup.append(word)
    return [w.capitalize() for w in dedup[:4]]


def load_font(size: int, kind: str = "body") -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = {
        "display": [
            Path("C:/Windows/Fonts/georgiab.ttf"),
            Path("C:/Windows/Fonts/timesbd.ttf"),
            Path("C:/Windows/Fonts/segoeuib.ttf"),
        ],
        "body": [
            Path("C:/Windows/Fonts/segoeui.ttf"),
            Path("C:/Windows/Fonts/arial.ttf"),
        ],
        "bold": [
            Path("C:/Windows/Fonts/segoeuib.ttf"),
            Path("C:/Windows/Fonts/arialbd.ttf"),
        ],
    }

    for font_path in candidates.get(kind, []):
        if font_path.exists():
            try:
                return ImageFont.truetype(str(font_path), size=size)
            except Exception:
                continue
    return ImageFont.load_default()


def color_from_hash(hash_value: str, start: int) -> tuple[int, int, int]:
    chunk = hash_value[start : start + 6]
    return tuple(int(chunk[i : i + 2], 16) for i in (0, 2, 4))


def draw_gradient(image: Image.Image, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> None:
    draw = ImageDraw.Draw(image)
    width, height = image.size
    for y in range(height):
        ratio = y / max(1, height - 1)
        color = (
            int(top[0] * (1 - ratio) + bottom[0] * ratio),
            int(top[1] * (1 - ratio) + bottom[1] * ratio),
            int(top[2] * (1 - ratio) + bottom[2] * ratio),
        )
        draw.line([(0, y), (width, y)], fill=color)


def create_image(
    *,
    title: str,
    slug: str,
    index: int,
    prompt: str,
    output_path: Path,
) -> None:
    hash_value = hashlib.sha256(f"{slug}-{index}-{prompt}".encode("utf-8")).hexdigest()
    accent_a = color_from_hash(hash_value, 0)
    accent_b = color_from_hash(hash_value, 6)
    accent_c = color_from_hash(hash_value, 12)
    accent_d = color_from_hash(hash_value, 18)

    image = Image.new("RGB", (1600, 900), color=(15, 23, 42))
    draw_gradient(image, (15, 23, 42), (17, 24, 39))
    draw = ImageDraw.Draw(image)

    for x in range(0, 1600, 24):
        for y in range(0, 900, 24):
            draw.ellipse((x + 2, y + 2, x + 4, y + 4), fill=(30, 41, 59))

    draw.rounded_rectangle((74, 74, 1526, 826), radius=24, fill=(11, 18, 32), outline=(30, 41, 59), width=2)

    draw.ellipse((1100, 60, 1420, 380), fill=(*accent_a, 56))
    draw.ellipse((1220, 170, 1480, 430), fill=(*accent_b, 64))
    draw.ellipse((1070, 250, 1230, 410), fill=(*accent_c, 76))

    font_badge = load_font(22, "bold")
    font_display = load_font(52, "display")
    font_body = load_font(24, "body")
    font_small = load_font(18, "body")

    draw.rounded_rectangle((104, 104, 318, 148), radius=22, fill=(17, 24, 39), outline=(51, 65, 85))
    draw.text((132, 116), f"VISUAL {index:02d}", font=font_badge, fill=(226, 232, 240))

    title_lines = textwrap.wrap(title, width=52)[:2]
    for idx, line in enumerate(title_lines):
        draw.text((104, 188 + idx * 58), line, font=font_display, fill=(248, 250, 252))

    draw.line((104, 332, 860, 332), fill=(51, 65, 85), width=2)

    tags = extract_tags(prompt) or ["Sales", "Automation", "API", "Workflow"]
    for tag_idx, tag in enumerate(tags[:4]):
        x = 104 + tag_idx * 182
        draw.rounded_rectangle((x, 368, x + 162, 410), radius=21, fill=(17, 24, 39), outline=(51, 65, 85))
        draw.text((x + 20, 382), tag, font=font_body, fill=(203, 213, 225))

    draw.rounded_rectangle((980, 450, 1410, 700), radius=18, fill=(15, 23, 42), outline=accent_a, width=2)
    draw.rounded_rectangle((1010, 490, 1190, 508), radius=9, fill=accent_a)
    draw.rounded_rectangle((1010, 526, 1300, 540), radius=7, fill=(51, 65, 85))
    draw.rounded_rectangle((1010, 554, 1254, 568), radius=7, fill=(51, 65, 85))
    draw.rounded_rectangle((1010, 582, 1330, 596), radius=7, fill=(51, 65, 85))
    draw.rounded_rectangle((1010, 626, 1172, 660), radius=10, fill=accent_b)

    draw.rounded_rectangle((104, 450, 924, 700), radius=18, fill=(15, 23, 42), outline=accent_c, width=2)
    draw.line((146, 650, 882, 650), fill=(51, 65, 85), width=2)
    draw.line((146, 588, 882, 588), fill=(30, 41, 59), width=2)
    draw.line((146, 526, 882, 526), fill=(30, 41, 59), width=2)
    draw.line((156, 620, 266, 602), fill=accent_d, width=5)
    draw.line((266, 602, 356, 566), fill=accent_d, width=5)
    draw.line((356, 566, 476, 558), fill=accent_d, width=5)
    draw.line((476, 558, 576, 542), fill=accent_d, width=5)
    draw.line((576, 542, 686, 552), fill=accent_d, width=5)
    draw.line((686, 552, 760, 522), fill=accent_d, width=5)
    draw.line((760, 522, 872, 478), fill=accent_d, width=5)
    draw.ellipse((566, 532, 586, 552), fill=(11, 18, 32), outline=accent_d, width=3)

    draw.rounded_rectangle((104, 694, 964, 786), radius=14, fill=(15, 23, 42), outline=(51, 65, 85))
    draw.text((132, 726), "Sales AI Editorial Image Asset", font=font_body, fill=(226, 232, 240))
    draw.text((132, 758), slug, font=font_small, fill=(148, 163, 184))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, format="WEBP", quality=88, method=6)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate deterministic blog images from prompt blocks.")
    parser.add_argument("--force", action="store_true", help="Regenerate all images even if unchanged.")
    args = parser.parse_args()

    PUBLIC_BLOG_DIR.mkdir(parents=True, exist_ok=True)
    CONTENT_DIR.mkdir(parents=True, exist_ok=True)

    existing_status = read_json(STATUS_PATH, {})
    manifest: dict[str, list[dict]] = {}
    next_status: dict[str, list[dict]] = {}

    files = sorted([path for path in BLOGS_DIR.glob("*.md")])
    total_prompts = 0
    written = 0
    reused = 0

    for source_path in files:
        raw = source_path.read_text(encoding="utf-8")
        slug = extract_slug(raw, source_path.name)
        title = extract_title(raw, slug.replace("-", " "))
        blocks = extract_image_blocks(raw)
        total_prompts += len(blocks)

        manifest[slug] = []
        next_status[slug] = []
        post_dir = PUBLIC_BLOG_DIR / slug
        post_dir.mkdir(parents=True, exist_ok=True)

        for idx, block in enumerate(blocks, start=1):
            image_id = f"{slug}-img-{idx:02d}"
            file_name = f"img-{idx:02d}.webp"
            output_path = post_dir / file_name
            src = f"/blog/{slug}/{file_name}"
            prompt_hash = hashlib.sha256(block["prompt"].encode("utf-8")).hexdigest()

            previous = next(
                (item for item in existing_status.get(slug, []) if item.get("id") == image_id),
                None,
            )
            already_ready = (
                not args.force
                and output_path.exists()
                and output_path.stat().st_size > 0
                and previous
                and previous.get("promptHash") == prompt_hash
            )

            if already_ready:
                reused += 1
            else:
                create_image(
                    title=title,
                    slug=slug,
                    index=idx,
                    prompt=block["prompt"],
                    output_path=output_path,
                )
                written += 1

            manifest[slug].append(
                {
                    "id": image_id,
                    "index": idx,
                    "prompt": block["prompt"],
                    "alt": block["alt"],
                    "src": src,
                }
            )
            next_status[slug].append(
                {
                    "id": image_id,
                    "index": idx,
                    "promptHash": prompt_hash,
                    "path": str(output_path),
                    "status": "completed" if output_path.exists() and output_path.stat().st_size > 0 else "failed",
                    "updatedAt": datetime.now(timezone.utc).isoformat(),
                }
            )

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    STATUS_PATH.write_text(json.dumps(next_status, indent=2) + "\n", encoding="utf-8")

    print("Blog image generation completed.")
    print(f"Prompt blocks discovered: {total_prompts}")
    print(f"Assets written: {written}")
    print(f"Assets reused: {reused}")
    print(f"Manifest: {MANIFEST_PATH}")
    print(f"Status: {STATUS_PATH}")


if __name__ == "__main__":
    main()
