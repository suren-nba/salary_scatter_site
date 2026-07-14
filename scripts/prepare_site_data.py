from __future__ import annotations

import csv
import json
import shutil
from datetime import datetime
from pathlib import Path

from convert_headshots import SUCCESS_STATUSES, convert_headshots


ROOT = Path(r"D:\nba")
SOURCE_JSON = ROOT / "salary_scatter_web.json"
SOURCE_HEADSHOTS = ROOT / "headshot"
SOURCE_LOGO = ROOT / "www" / "sr_logo_nav_white.png"
WEBP_HEADSHOTS = ROOT / "headshot(webp)"
SITE_DIR = ROOT / "salary_scatter_site"
SITE_DATA_DIR = SITE_DIR / "data"
SITE_HEADSHOTS = SITE_DIR / "assets" / "headshots"
SITE_BRAND = SITE_DIR / "assets" / "brand"

SALARY_FIELDS = [
    "epm_expected_salary_m",
    "darko_expected_salary_m",
    "average_expected_salary_m",
    "last_season_value_salary_m",
    "actual_salary_m",
    "expected_minus_actual_m",
]

WEB_FIELDS = [
    "player_id",
    "player_name",
    "team_name",
    "team_abbreviation",
    *SALARY_FIELDS,
    "headshot_file",
]


def load_source_data() -> list[dict]:
    with SOURCE_JSON.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError("Source JSON must be a records array.")
    return data


def valid_record(row: dict) -> bool:
    if not isinstance(row, dict):
        return False
    if row.get("player_id") in (None, ""):
        return False
    if not str(row.get("player_id")).isdigit():
        return False
    if not row.get("player_name"):
        return False
    return True


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2, allow_nan=False)
        handle.write("\n")


def main() -> None:
    for directory in [SITE_DATA_DIR, SITE_HEADSHOTS, SITE_BRAND, WEBP_HEADSHOTS]:
        directory.mkdir(parents=True, exist_ok=True)

    data = load_source_data()
    seen: set[str] = set()
    valid_rows: list[dict] = []
    excluded: list[dict] = []

    for row in data:
        player_id = "" if not isinstance(row, dict) or row.get("player_id") is None else str(row.get("player_id")).strip()
        base_excluded = {
            "player_id": player_id,
            "player_name": row.get("player_name", "") if isinstance(row, dict) else "",
            "team_abbreviation": row.get("team_abbreviation", "") if isinstance(row, dict) else "",
            "reason": "",
        }
        if not valid_record(row):
            base_excluded["reason"] = "missing_player_id" if not player_id else "invalid_record"
            excluded.append(base_excluded)
            continue
        if player_id in seen:
            base_excluded["reason"] = "duplicate_player_id"
            excluded.append(base_excluded)
            continue
        seen.add(player_id)
        valid_rows.append(row)

    conversion_report = SITE_DIR / "headshot_conversion_report.csv"
    conversion_rows = convert_headshots(
        [str(row["player_id"]) for row in valid_rows],
        SOURCE_HEADSHOTS,
        WEBP_HEADSHOTS,
        SITE_HEADSHOTS,
        conversion_report,
    )
    conversion_by_id = {str(row["player_id"]): row for row in conversion_rows}

    final_rows: list[dict] = []
    for row in valid_rows:
        player_id = str(row["player_id"])
        conversion = conversion_by_id.get(player_id)
        reason = None
        if conversion is None:
            reason = "headshot_conversion_failed"
        elif conversion["status"] == "missing_headshot":
            reason = "missing_headshot"
        elif conversion["status"] not in SUCCESS_STATUSES:
            reason = "headshot_conversion_failed"

        if reason:
            excluded.append({
                "player_id": player_id,
                "player_name": row.get("player_name", ""),
                "team_abbreviation": row.get("team_abbreviation", ""),
                "reason": reason,
            })
            continue

        cleaned = {field: row.get(field) for field in WEB_FIELDS}
        cleaned["player_id"] = int(player_id)
        cleaned["headshot_file"] = f"assets/headshots/{player_id}.webp"
        for field in SALARY_FIELDS:
            value = cleaned.get(field)
            cleaned[field] = None if value is None else round(float(value), 1)
        final_rows.append(cleaned)

    final_rows.sort(key=lambda x: (x["average_expected_salary_m"] is None, -(x["average_expected_salary_m"] or -10**9), x["player_name"]))

    if SOURCE_LOGO.exists():
        shutil.copy2(SOURCE_LOGO, SITE_BRAND / "sr-logo.png")
    else:
        raise FileNotFoundError(f"Selected logo is missing: {SOURCE_LOGO}")

    metadata = {
        "dataset_name": "NBA Salary Value Explorer",
        "version": "1.0.0",
        "updated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "source_data": str(SOURCE_JSON),
        "player_count": len(final_rows),
        "original_player_count": len(data),
        "excluded_player_count": len(excluded),
        "salary_unit": "million_usd",
        "expected_minus_actual_label": "合同价值差",
        "expected_minus_actual_definition": "average_expected_salary_m - actual_salary_m",
        "headshot_format": "webp",
        "headshot_source_dir": str(SOURCE_HEADSHOTS),
        "headshot_webp_dir": str(WEBP_HEADSHOTS),
        "logo_source": str(SOURCE_LOGO),
    }

    write_json(SITE_DATA_DIR / "salary_scatter_web.json", final_rows)
    write_json(SITE_DATA_DIR / "metadata.json", metadata)
    write_csv(
        SITE_DIR / "excluded_players.csv",
        excluded,
        ["player_id", "player_name", "team_abbreviation", "reason"],
    )

    total_png = sum(int(row["source_size_bytes"] or 0) for row in conversion_rows if row["status"] in SUCCESS_STATUSES)
    total_webp = sum(int(row["output_size_bytes"] or 0) for row in conversion_rows if row["status"] in SUCCESS_STATUSES)
    print("Source JSON:", SOURCE_JSON)
    print("Original rows:", len(data))
    print("Final website rows:", len(final_rows))
    print("Excluded rows:", len(excluded))
    print("PNG total bytes:", total_png)
    print("WebP total bytes:", total_webp)
    print("WebP/PNG ratio:", round(total_webp / total_png, 4) if total_png else "NA")
    print("Conversion report:", conversion_report)
    print("Website data:", SITE_DATA_DIR / "salary_scatter_web.json")
    print("Metadata:", SITE_DATA_DIR / "metadata.json")
    print("Excluded:", SITE_DIR / "excluded_players.csv")


if __name__ == "__main__":
    main()
