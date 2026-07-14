from __future__ import annotations

import csv
import shutil
from pathlib import Path
from typing import Iterable

from PIL import Image


SUCCESS_STATUSES = {"converted", "skipped_existing", "converted_larger_than_png", "skipped_existing_larger_than_png"}


def convert_one_headshot(player_id: str, source_dir: Path, webp_dir: Path, site_headshot_dir: Path, quality: int = 85) -> dict:
    source_file = source_dir / f"{player_id}.png"
    output_file = webp_dir / f"{player_id}.webp"
    site_file = site_headshot_dir / f"{player_id}.webp"

    row = {
        "player_id": player_id,
        "source_file": str(source_file),
        "output_file": str(output_file),
        "site_file": str(site_file),
        "source_size_bytes": "",
        "output_size_bytes": "",
        "compression_ratio": "",
        "width": "",
        "height": "",
        "status": "",
        "error": "",
    }

    if not player_id:
        row["status"] = "missing_player_id"
        return row

    if not source_file.exists():
        row["status"] = "missing_headshot"
        return row

    try:
        source_size = source_file.stat().st_size
        row["source_size_bytes"] = source_size
        needs_convert = True
        if output_file.exists() and output_file.stat().st_mtime >= source_file.stat().st_mtime:
            needs_convert = False

        if needs_convert:
            with Image.open(source_file) as im:
                im.load()
                row["width"] = im.width
                row["height"] = im.height
                if im.mode not in ("RGBA", "LA"):
                    im = im.convert("RGBA")
                output_file.parent.mkdir(parents=True, exist_ok=True)
                im.save(output_file, "WEBP", quality=quality, method=6, lossless=False)
            status_prefix = "converted"
        else:
            with Image.open(output_file) as im:
                im.load()
                row["width"] = im.width
                row["height"] = im.height
            status_prefix = "skipped_existing"

        output_size = output_file.stat().st_size
        row["output_size_bytes"] = output_size
        row["compression_ratio"] = round(output_size / source_size, 4) if source_size else ""
        larger = output_size > source_size
        row["status"] = f"{status_prefix}_larger_than_png" if larger else status_prefix

        site_file.parent.mkdir(parents=True, exist_ok=True)
        if not site_file.exists() or site_file.stat().st_mtime < output_file.stat().st_mtime or site_file.stat().st_size != output_size:
            shutil.copy2(output_file, site_file)

        with Image.open(site_file) as check:
            check.load()
            if check.mode not in ("RGBA", "LA"):
                # WebP transparency usually reloads as RGBA. Keep this as a diagnostic guard.
                row["status"] = "converted_no_alpha"
                row["error"] = f"unexpected mode {check.mode}"
    except Exception as exc:  # noqa: BLE001 - report and continue per data pipeline requirement.
        row["status"] = "headshot_conversion_failed"
        row["error"] = str(exc)

    return row


def convert_headshots(player_ids: Iterable[str], source_dir: Path, webp_dir: Path, site_headshot_dir: Path, report_path: Path) -> list[dict]:
    source_dir = Path(source_dir)
    webp_dir = Path(webp_dir)
    site_headshot_dir = Path(site_headshot_dir)
    report_path = Path(report_path)

    rows = [
        convert_one_headshot(str(player_id).strip(), source_dir, webp_dir, site_headshot_dir)
        for player_id in player_ids
    ]

    report_path.parent.mkdir(parents=True, exist_ok=True)
    with report_path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "player_id",
                "source_file",
                "output_file",
                "site_file",
                "source_size_bytes",
                "output_size_bytes",
                "compression_ratio",
                "width",
                "height",
                "status",
                "error",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)

    return rows


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Convert selected NBA player headshots from PNG to WebP.")
    parser.add_argument("--player-ids", nargs="+", required=True)
    parser.add_argument("--source-dir", default=r"D:\nba\headshot")
    parser.add_argument("--webp-dir", default=r"D:\nba\headshot(webp)")
    parser.add_argument("--site-headshot-dir", default=r"D:\nba\salary_scatter_site\assets\headshots")
    parser.add_argument("--report-path", default=r"D:\nba\salary_scatter_site\headshot_conversion_report.csv")
    args = parser.parse_args()

    result = convert_headshots(
        args.player_ids,
        Path(args.source_dir),
        Path(args.webp_dir),
        Path(args.site_headshot_dir),
        Path(args.report_path),
    )
    ok = sum(row["status"] in SUCCESS_STATUSES for row in result)
    print(f"Converted/verified {ok} of {len(result)} headshots.")
