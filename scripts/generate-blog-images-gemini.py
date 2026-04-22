#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import time
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "apps" / "web" / "content" / "blog-image-manifest.json"
STATUS_PATH = ROOT / "apps" / "web" / "content" / "blog-image-generation-status.json"
PUBLIC_ROOT = ROOT / "apps" / "web" / "public"


def read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def extract_inline_image_bytes(response_stream: Any) -> tuple[bytes, str]:
    for chunk in response_stream:
        if not chunk.parts:
            continue
        for part in chunk.parts:
            if part.inline_data and part.inline_data.data:
                mime_type = part.inline_data.mime_type or "image/png"
                return part.inline_data.data, mime_type
    raise RuntimeError("No inline image data returned from Gemini.")


def write_temp_image(image_bytes: bytes, mime_type: str, target_base: Path) -> Path:
    ext = mimetypes.guess_extension(mime_type) or ".png"
    temp_path = target_base.with_suffix(ext)
    temp_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path.write_bytes(image_bytes)
    return temp_path


def convert_to_webp(source_path: Path, dest_path: Path) -> None:
    with Image.open(source_path) as img:
        rgb = img.convert("RGB")
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        rgb.save(dest_path, format="WEBP", quality=90, method=6)


def generate_image_for_prompt(
    client: genai.Client,
    model: str,
    prompt: str,
    person_generation: str | None,
) -> tuple[bytes, str]:
    image_config_kwargs: dict[str, Any] = {
        "aspect_ratio": "16:9",
        "image_size": "1K",
    }
    if person_generation:
        image_config_kwargs["person_generation"] = person_generation

    config = types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="MINIMAL"),
        image_config=types.ImageConfig(**image_config_kwargs),
        response_modalities=["IMAGE", "TEXT"],
    )

    contents = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=prompt)],
        )
    ]

    stream = client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=config,
    )
    return extract_inline_image_bytes(stream)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate blog images from prompts using Gemini image model.")
    parser.add_argument("--model", default="gemini-3.1-flash-image-preview")
    parser.add_argument("--force", action="store_true", help="Regenerate even if file already exists and status is completed.")
    parser.add_argument("--max-retries", type=int, default=3)
    parser.add_argument("--delay-seconds", type=float, default=1.0)
    parser.add_argument(
        "--person-generation",
        default="",
        help="Optional Gemini person_generation value. Empty by default.",
    )
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise SystemExit(
            "GEMINI_API_KEY is not set in this environment. Set it first, then rerun this script."
        )

    manifest = read_json(MANIFEST_PATH, {})
    if not manifest:
        raise SystemExit(f"Manifest is missing or invalid: {MANIFEST_PATH}")

    existing_status = read_json(STATUS_PATH, {})
    next_status: dict[str, list[dict[str, Any]]] = {}

    client = genai.Client(api_key=api_key)

    total = 0
    written = 0
    skipped = 0
    failed = 0

    for slug, items in manifest.items():
        next_status[slug] = []
        existing_items = existing_status.get(slug, [])

        for item in items:
            total += 1
            image_id = str(item["id"])
            index = int(item["index"])
            prompt = str(item["prompt"])
            src = str(item["src"])
            target_path = PUBLIC_ROOT / src.lstrip("/")
            target_path = target_path.with_suffix(".webp")

            prev = next((x for x in existing_items if x.get("id") == image_id), None)
            already_done = (
                not args.force
                and target_path.exists()
                and target_path.stat().st_size > 0
                and prev
                and prev.get("status") == "completed"
                and prev.get("model") == args.model
            )

            if already_done:
                skipped += 1
                next_status[slug].append(
                    {
                        "id": image_id,
                        "index": index,
                        "status": "completed",
                        "model": args.model,
                        "path": str(target_path),
                        "mimeType": prev.get("mimeType", "image/webp"),
                        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "attempts": prev.get("attempts", 1),
                    }
                )
                continue

            success = False
            last_error = ""
            attempts = 0

            for attempt in range(1, args.max_retries + 1):
                attempts = attempt
                try:
                    image_bytes, mime_type = generate_image_for_prompt(
                        client=client,
                        model=args.model,
                        prompt=prompt,
                        person_generation=args.person_generation.strip() or None,
                    )
                    tmp_base = target_path.with_suffix("")
                    temp_path = write_temp_image(image_bytes, mime_type, tmp_base)
                    convert_to_webp(temp_path, target_path)
                    if temp_path.exists() and temp_path != target_path:
                        temp_path.unlink(missing_ok=True)

                    success = True
                    written += 1
                    next_status[slug].append(
                        {
                            "id": image_id,
                            "index": index,
                            "status": "completed",
                            "model": args.model,
                            "path": str(target_path),
                            "mimeType": mime_type,
                            "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                            "attempts": attempts,
                        }
                    )
                    print(f"[OK] {slug} #{index:02d} -> {target_path}")
                    break
                except Exception as exc:  # noqa: BLE001
                    last_error = str(exc)
                    sleep_s = args.delay_seconds * attempt
                    time.sleep(sleep_s)

            if not success:
                failed += 1
                next_status[slug].append(
                    {
                        "id": image_id,
                        "index": index,
                        "status": "failed",
                        "model": args.model,
                        "path": str(target_path),
                        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "attempts": attempts,
                        "error": last_error,
                    }
                )
                print(f"[FAIL] {slug} #{index:02d} -> {last_error}")

            time.sleep(args.delay_seconds)

    STATUS_PATH.write_text(json.dumps(next_status, indent=2) + "\n", encoding="utf-8")

    print("Gemini image generation completed.")
    print(f"Total prompts: {total}")
    print(f"Written: {written}")
    print(f"Skipped: {skipped}")
    print(f"Failed: {failed}")
    print(f"Status file: {STATUS_PATH}")


if __name__ == "__main__":
    main()
