import datetime as dt
import json

import pytest

from science.acquire_firms import acquire, count_csv_rows, date_windows, request_url


def test_firms_api_uses_bounded_date_windows():
    windows = list(date_windows(
        dt.date(2018, 1, 1),
        dt.date(2018, 1, 7),
        5,
    ))
    assert windows == [
        (dt.date(2018, 1, 1), dt.date(2018, 1, 5)),
        (dt.date(2018, 1, 6), dt.date(2018, 1, 7)),
    ]


def test_firms_api_rejects_invalid_window_size():
    with pytest.raises(ValueError, match="between 1 and 5"):
        list(date_windows(
            dt.date(2018, 1, 1),
            dt.date(2018, 1, 1),
            6,
        ))


def test_firms_response_requires_firms_schema():
    payload = b"latitude,longitude,acq_date\n37.2,-119.7,2018-01-01\n"
    assert count_csv_rows(payload) == 1
    with pytest.raises(ValueError, match="latitude CSV header"):
        count_csv_rows(b"message\nunauthorized\n")


def test_firms_request_url_contains_no_secret():
    url = request_url("MODIS_SP", "-124.4,32.5,-114.1,42.0", dt.date(2018, 1, 1), 5)
    assert "[MAP_KEY]" not in url
    assert "MODIS_SP/-124.4,32.5,-114.1,42.0/5/2018-01-01" in url


def test_failed_batch_is_recorded_without_persisting_map_key(tmp_path, monkeypatch):
    import science.acquire_firms as acquisition

    def fail_request(*args, **kwargs):
        raise RuntimeError("request failed for secret-key")

    monkeypatch.setattr(acquisition, "fetch_with_retries", fail_request)
    manifest_path = tmp_path / "MODIS_SP_2018-01-01_2018-01-01.manifest.json"

    with pytest.raises(RuntimeError):
        acquire(
            map_key="secret-key",
            source="MODIS_SP",
            area="-124.4,32.5,-114.1,42.0",
            start=dt.date(2018, 1, 1),
            end=dt.date(2018, 1, 1),
            output_dir=tmp_path,
        )

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["complete"] is False
    assert manifest["requests"][0]["status"] == "failed"
    assert "secret-key" not in manifest_path.read_text(encoding="utf-8")


def test_acquisition_strips_map_key_whitespace(tmp_path, monkeypatch):
    import science.acquire_firms as acquisition

    captured = {}

    def fake_request(url, **kwargs):
        captured["url"] = url
        return b"latitude,longitude,acq_date\n37.2,-119.7,2018-01-01\n"

    monkeypatch.setattr(acquisition, "fetch_with_retries", fake_request)
    acquire(
        map_key="  private-key  ",
        source="MODIS_SP",
        area="-124.4,32.5,-114.1,42.0",
        start=dt.date(2018, 1, 1),
        end=dt.date(2018, 1, 1),
        output_dir=tmp_path,
    )
    assert "/private-key/" in captured["url"]
    assert "  " not in captured["url"]
