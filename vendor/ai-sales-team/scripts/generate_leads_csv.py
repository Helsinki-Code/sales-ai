#!/usr/bin/env python3
"""
Leads CSV Generator — AI Sales Team for Claude Code

Converts enriched lead JSON data to a formatted, sortable CSV file.
Accepts lead data via stdin or file argument, validates and normalizes rows,
writes a properly-escaped CSV with 20 columns sorted by icp_score descending.

Usage:
    python3 generate_leads_csv.py --output leads-company-2026-04-17.csv
    cat leads.json | python3 generate_leads_csv.py --output leads-company-2026-04-17.csv
    python3 generate_leads_csv.py --output leads-company-2026-04-17.csv leads-input.json
"""

import argparse
import csv
import json
import sys
from datetime import datetime

# ---------------------------------------------------------------------------
# Column Definitions
# ---------------------------------------------------------------------------

CSV_COLUMNS = [
    # Company Info (7 columns)
    "company_name",
    "company_website",
    "company_industry",
    "company_size",
    "company_location",
    "company_funding",
    "company_linkedin",
    # Contact Details (6 columns)
    "contact_name",
    "contact_title",
    "contact_email",
    "contact_linkedin",
    "contact_phone",
    "email_confidence",
    # ICP Scoring (4 columns)
    "icp_score",
    "icp_grade",
    "matched_signals",
    "qualification_reason",
    # Outreach Ready (3 columns)
    "personalization_hook",
    "suggested_subject",
    "best_channel",
]

GRADE_BANDS = [
    (80, "A"),
    (60, "B"),
    (40, "C"),
    (0,  "D"),
]

EMAIL_CONFIDENCE_VALID = ["confirmed", "pattern_derived", "unknown"]
BEST_CHANNEL_VALID = ["email", "linkedin", "both", "phone"]
GRADE_VALID = ["A", "B", "C", "D"]

# ---------------------------------------------------------------------------
# Normalization & Validation Helpers
# ---------------------------------------------------------------------------

def compute_grade(score):
    """Determine letter grade from numeric score (0-100)."""
    try:
        score = int(score)
    except (ValueError, TypeError):
        score = 0

    for threshold, grade in GRADE_BANDS:
        if score >= threshold:
            return grade
    return "D"


def normalize_string(value):
    """Normalize string fields: strip whitespace, convert to string."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def normalize_email(value):
    """Normalize email: lowercase, strip, validate format."""
    if not value:
        return ""
    email = normalize_string(value).lower()
    # Basic email validation
    if "@" in email and "." in email:
        return email
    return ""


def normalize_url(value):
    """Normalize URL: ensure https://, strip trailing slash."""
    if not value:
        return ""
    url = normalize_string(value)
    if not url.startswith("http"):
        url = "https://" + url
    # Remove trailing slash but preserve root
    if url.endswith("/") and url.count("/") > 3:
        url = url.rstrip("/")
    return url


def normalize_lead(raw):
    """
    Normalize and validate a raw lead dictionary.
    Ensures all CSV_COLUMNS are present and properly formatted.
    """
    # Extract icp_score, compute grade if needed
    try:
        score = int(raw.get("icp_score", 0))
    except (ValueError, TypeError):
        score = 0
    score = max(0, min(100, score))  # Clamp to 0-100

    grade = raw.get("icp_grade")
    if grade not in GRADE_VALID:
        grade = compute_grade(score)

    # Normalize email_confidence
    email_confidence = raw.get("email_confidence", "unknown")
    if email_confidence not in EMAIL_CONFIDENCE_VALID:
        email_confidence = "unknown"

    # Normalize best_channel
    best_channel = raw.get("best_channel", "email")
    if best_channel not in BEST_CHANNEL_VALID:
        best_channel = "email"

    return {
        "company_name":         normalize_string(raw.get("company_name", "")),
        "company_website":      normalize_url(raw.get("company_website", "")),
        "company_industry":     normalize_string(raw.get("company_industry", "")),
        "company_size":         normalize_string(raw.get("company_size", "")),
        "company_location":     normalize_string(raw.get("company_location", "")),
        "company_funding":      normalize_string(raw.get("company_funding", "")),
        "company_linkedin":     normalize_url(raw.get("company_linkedin", "")),
        "contact_name":         normalize_string(raw.get("contact_name", "")),
        "contact_title":        normalize_string(raw.get("contact_title", "")),
        "contact_email":        normalize_email(raw.get("contact_email", "")),
        "contact_linkedin":     normalize_url(raw.get("contact_linkedin", "")),
        "contact_phone":        normalize_string(raw.get("contact_phone", "")),
        "email_confidence":     email_confidence,
        "icp_score":            score,
        "icp_grade":            grade,
        "matched_signals":      normalize_string(raw.get("matched_signals", "")),
        "qualification_reason": normalize_string(raw.get("qualification_reason", "")),
        "personalization_hook": normalize_string(raw.get("personalization_hook", "")),
        "suggested_subject":    normalize_string(raw.get("suggested_subject", "")),
        "best_channel":         best_channel,
    }


# ---------------------------------------------------------------------------
# CSV Generation Pipeline
# ---------------------------------------------------------------------------

def generate_csv(leads, output_path):
    """
    Write leads to CSV file.
    - Normalizes each lead
    - Sorts by icp_score descending (Grade A first)
    - Writes with proper CSV escaping
    - Returns summary dictionary
    """
    if not leads:
        leads = []

    # Normalize all leads
    normalized = []
    for lead in leads:
        if isinstance(lead, dict):
            normalized.append(normalize_lead(lead))

    # Sort by icp_score descending
    normalized.sort(key=lambda x: -x["icp_score"])

    # Write CSV
    try:
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(normalized)
    except IOError as e:
        return {
            "status": "error",
            "message": f"Failed to write CSV: {str(e)}",
            "output_file": None,
            "total_leads": 0,
        }

    # Compute summary statistics
    grade_counts = {"A": 0, "B": 0, "C": 0, "D": 0}
    signal_counts = {
        "recent_funding": 0,
        "hiring_signals": 0,
        "tech_stack_match": 0,
        "growth_signal": 0,
    }

    for row in normalized:
        grade = row.get("icp_grade", "D")
        if grade in grade_counts:
            grade_counts[grade] += 1

        signals = row.get("matched_signals", "")
        if "recent_funding" in signals:
            signal_counts["recent_funding"] += 1
        if "hiring" in signals:
            signal_counts["hiring_signals"] += 1
        if "tech_stack" in signals:
            signal_counts["tech_stack_match"] += 1
        if "growth_signal" in signals:
            signal_counts["growth_signal"] += 1

    contact_coverage = 0
    if normalized:
        contacts_with_email = sum(
            1 for row in normalized
            if row.get("email_confidence") in ["confirmed", "pattern_derived"]
        )
        contact_coverage = int(100 * contacts_with_email / len(normalized))

    return {
        "status": "success",
        "output_file": output_path,
        "total_leads": len(normalized),
        "grade_counts": grade_counts,
        "signal_counts": signal_counts,
        "contact_coverage_percent": contact_coverage,
        "top_lead": normalized[0]["company_name"] if normalized else None,
        "timestamp": datetime.now().isoformat(),
    }


# ---------------------------------------------------------------------------
# CLI & Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Leads CSV Generator — Convert enriched lead JSON to CSV.",
        epilog="Example: python3 generate_leads_csv.py --output leads.csv input.json",
    )
    parser.add_argument(
        "input_file",
        nargs="?",
        help="JSON input file (reads stdin if omitted)",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output CSV file path (required)",
    )
    args = parser.parse_args()

    # Read input data
    try:
        if args.input_file:
            with open(args.input_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            # Read from stdin
            if sys.stdin.isatty():
                print(
                    "Error: No input provided. Pass JSON via stdin or as file argument.",
                    file=sys.stderr,
                )
                sys.exit(1)
            data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {str(e)}", file=sys.stderr)
        sys.exit(1)
    except IOError as e:
        print(f"Error: Failed to read input: {str(e)}", file=sys.stderr)
        sys.exit(1)

    # Extract leads list from envelope or assume data is array
    if isinstance(data, dict):
        if "leads" in data:
            leads = data["leads"]
        else:
            print(
                "Error: JSON object must contain 'leads' key with array value.",
                file=sys.stderr,
            )
            sys.exit(1)
    elif isinstance(data, list):
        leads = data
    else:
        print(
            "Error: Input must be JSON array or object with 'leads' key.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Generate CSV
    result = generate_csv(leads, args.output)

    # Output result as JSON
    print(json.dumps(result, indent=2, ensure_ascii=False))

    # Exit with error if CSV generation failed
    if result.get("status") == "error":
        sys.exit(1)


if __name__ == "__main__":
    main()
