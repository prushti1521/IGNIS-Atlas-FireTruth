from datetime import date

from science.generate_spatial_artifact import one_to_one_window_matches


def test_temporal_window_matching_is_one_to_one():
    modis = [date(2020, 8, 1), date(2020, 8, 2)]
    viirs = [date(2020, 8, 2)]
    matches = one_to_one_window_matches(modis, viirs, 1)
    assert len(matches) == 1
    assert matches[0] == (date(2020, 8, 1), date(2020, 8, 2))


def test_same_day_is_a_strict_temporal_match():
    matches = one_to_one_window_matches(
        [date(2020, 8, 1)],
        [date(2020, 8, 2)],
        0,
    )
    assert matches == []
