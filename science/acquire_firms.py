"""
Download NASA FIRMS standard-processing area data with reproducible provenance.

The FIRMS Area API requires a user-owned MAP_KEY. This module never accepts a
key on the command line and never writes it to a manifest or log. It stores
each successful response unchanged, records its SHA-256 hash, and fails
explicitly when a request cannot be completed.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import os
import time
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import quote


API_ROOT = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
DEFAULT_USER_AGENT = "IGNIS-Atlas-FireTruth/1.0 (reproducible research client)"
STANDARD_SOURCES = (
    "MODIS_SP",
    "VIIRS_SNPP_SP",
    "VIIRS_NOAA20_SP",
    "VIIRS_NOAA21_SP",
)


def parse_date(value: str) -> dt.date:
    try:
        return dt.date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            f"Expected an ISO date (YYYY-MM-DD), received {value!r}."
        ) from exc


def date_windows(start: dt.date, end: dt.date, window_days: int) -> Iterable[tuple[dt.date, dt.date]]:
    if start > end:
        raise ValueError("start date must be on or before end date")
    if not 1 <= window_days <= 5:
        raise ValueError("FIRMS Area API windows must contain between 1 and 5 days")
    cursor = start
    while cursor <= end:
        window_end = min(cursor + dt.timedelta(days=window_days - 1), end)
        yield cursor, window_end
        cursor = window_end + dt.timedelta(days=1)


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def count_csv_rows(payload: bytes) -> int:
    text = payload.decode("utf-8-sig")
    rows = list(csv.reader(text.splitlines()))
    if not rows or "latitude" not in {column.strip().lower() for column in rows[0]}:
        raise ValueError("NASA FIRMS response did not contain a latitude CSV header")
    return max(0, len(rows) - 1)


def request_url(source: str, area: str, start: dt.date, window_days: int) -> str:
    return (
        f"{API_ROOT}/{quote(source, safe='')}/{quote(area, safe=',')}/"
        f"{window_days}/{start.isoformat()}"
    )


def fetch_with_retries(
    url: str,
    retries: int,
    timeout_seconds: int,
    user_agent: str,
) -> bytes:
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        request = Request(url, headers={"User-Agent": user_agent, "Accept": "text/csv"})
        try:
            with urlopen(request, timeout=timeout_seconds) as response:
                payload = response.read()
            count_csv_rows(payload)
            return payload
        except HTTPError as exc:
            last_error = exc
            retryable = exc.code == 429 or 500 <= exc.code <= 599
            if not retryable or attempt == retries:
                raise RuntimeError(f"NASA FIRMS request failed with HTTP {exc.code}.") from exc
        except (URLError, TimeoutError, ValueError) as exc:
            last_error = exc
            if attempt == retries:
                raise RuntimeError(f"NASA FIRMS request failed: {exc}") from exc
        time.sleep(min(2 ** attempt, 30))
    raise RuntimeError(f"NASA FIRMS request failed: {last_error}")


def acquire(
    map_key: str,
    source: str,
    area: str,
    start: dt.date,
    end: dt.date,
    output_dir: Path,
    window_days: int = 5,
    retries: int = 3,
    timeout_seconds: int = 120,
) -> Path:
    map_key = map_key.strip()
    if not map_key:
        raise ValueError("A non-empty FIRMS MAP_KEY is required.")
    if source not in STANDARD_SOURCES:
        raise ValueError(f"Unsupported standard source: {source}")
    output_dir.mkdir(parents=True, exist_ok=True)
    requests: list[dict[str, object]] = []

    manifest_path = output_dir / f"{source}_{start.isoformat()}_{end.isoformat()}.manifest.json"

    def write_manifest() -> None:
        manifest = {
            "manifest_version": "1.1.0",
            "data_status": "NASA_FIRMS_STANDARD_PROCESSING",
            "source": source,
            "area": area,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "api_url_template": f"{API_ROOT}/[MAP_KEY]/{source}/{area}/{window_days}/[DATE]",
            "acquired_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
            "requests": requests,
            "complete": all(request["status"] in {"downloaded", "existing_verified"} for request in requests)
                and len(requests) == len(list(date_windows(start, end, window_days))),
            "credentials": "MAP_KEY supplied through FIRMS_MAP_KEY; not persisted",
        }
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    for window_start, window_end in date_windows(start, end, window_days):
        filename = f"{source}_{window_start.isoformat()}_{window_end.isoformat()}.csv"
        target = output_dir / filename
        if target.exists():
            payload = target.read_bytes()
            row_count = count_csv_rows(payload)
            requests.append({
                "start_date": window_start.isoformat(),
                "end_date": window_end.isoformat(),
                "status": "existing_verified",
                "file": str(target),
                "sha256": sha256_bytes(payload),
                "row_count": row_count,
            })
            continue

        url = request_url(source, area, window_start, window_days)
        try:
            payload = fetch_with_retries(
                url.replace("/csv/", f"/csv/{quote(map_key, safe='')}/", 1),
                retries=retries,
                timeout_seconds=timeout_seconds,
                user_agent=DEFAULT_USER_AGENT,
            )
        except Exception as exc:
            error_text = str(exc).replace(map_key, "[REDACTED_MAP_KEY]")
            requests.append({
                "start_date": window_start.isoformat(),
                "end_date": window_end.isoformat(),
                "status": "failed",
                "error_type": type(exc).__name__,
                "error": error_text,
            })
            write_manifest()
            raise
        target.write_bytes(payload)
        requests.append({
            "start_date": window_start.isoformat(),
            "end_date": window_end.isoformat(),
            "status": "downloaded",
            "file": str(target),
            "sha256": sha256_bytes(payload),
            "row_count": count_csv_rows(payload),
        })

    write_manifest()
    return manifest_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Acquire standard NASA FIRMS area CSV files with SHA-256 provenance."
    )
    parser.add_argument("--source", choices=STANDARD_SOURCES, required=True)
    parser.add_argument("--start-date", type=parse_date, required=True)
    parser.add_argument("--end-date", type=parse_date, required=True)
    parser.add_argument("--area", default="-124.4,32.5,-114.1,42.0",
                        help="west,south,east,north; defaults to California")
    parser.add_argument("--output-dir", default="data/nasa_firms/raw")
    parser.add_argument("--window-days", type=int, default=5)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--timeout-seconds", type=int, default=120)
    args = parser.parse_args()

    map_key = os.environ.get("FIRMS_MAP_KEY", "")
    manifest_path = acquire(
        map_key=map_key,
        source=args.source,
        area=args.area,
        start=args.start_date,
        end=args.end_date,
        output_dir=Path(args.output_dir),
        window_days=args.window_days,
        retries=args.retries,
        timeout_seconds=args.timeout_seconds,
    )
    print(f"NASA FIRMS acquisition complete. Provenance manifest: {manifest_path}")


if __name__ == "__main__":
    main()
