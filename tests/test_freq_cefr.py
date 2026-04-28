"""Unit tests for the build_freq_tiers and compute_cefr functions."""
import pytest
from unittest.mock import patch

from app.services.translator import build_freq_tiers, compute_cefr


# ── build_freq_tiers ────────────────────────────────────────────────────────

class TestBuildFreqTiers:
    def test_returns_dict(self):
        result = build_freq_tiers("the cat sat", "en")
        assert isinstance(result, dict)

    def test_very_common_word(self):
        # "the" has very high zipf frequency in English (> 5.5)
        result = build_freq_tiers("the", "en")
        assert result.get("the") == "freq-very-common"

    def test_rare_word(self):
        # A very uncommon word should be classified as rare
        result = build_freq_tiers("xylophone", "en")
        # xylophone is not a very common word
        assert "xylophone" in result
        assert result["xylophone"] in {"freq-uncommon", "freq-rare"}

    def test_all_tiers_are_valid_classes(self):
        valid = {"freq-very-common", "freq-common", "freq-uncommon", "freq-rare"}
        result = build_freq_tiers("the cat sat on a mat occasionally xylophone", "en")
        for val in result.values():
            assert val in valid

    def test_empty_text_returns_empty_dict(self):
        result = build_freq_tiers("", "en")
        assert result == {}

    def test_short_words_excluded(self):
        # Single-character words should be excluded (MIN_WORD_LENGTH == 2)
        result = build_freq_tiers("a b c", "en")
        assert len(result) == 0

    def test_min_length_boundary(self):
        # Two-character word should be included
        result = build_freq_tiers("to", "en")
        assert "to" in result

    def test_case_normalization(self):
        # "The" and "the" should map to the same key
        result = build_freq_tiers("The the", "en")
        assert "the" in result
        assert len(result) == 1


# ── compute_cefr ────────────────────────────────────────────────────────────

class TestComputeCefr:
    def test_returns_dict_with_required_keys(self):
        result = compute_cefr("the cat sat on the mat", "en")
        assert {"level", "score", "rare_pct", "detail"} <= result.keys()

    def test_level_is_valid_cefr(self):
        result = compute_cefr("the cat sat on the mat", "en")
        assert result["level"] in {"A1", "A2", "B1", "B2", "C1", "C2"}

    def test_empty_text_returns_a1(self):
        result = compute_cefr("", "en")
        assert result["level"] == "A1"
        assert result["score"] == 0.0

    def test_common_english_text_is_easy(self):
        # Very high-frequency words should score A1 or A2
        result = compute_cefr("the the the the the the is is is a a a", "en")
        assert result["level"] in {"A1", "A2"}

    def test_score_is_rounded_float(self):
        result = compute_cefr("the cat sat", "en")
        assert isinstance(result["score"], float)

    def test_rare_pct_is_between_0_and_100(self):
        result = compute_cefr("the cat sat", "en")
        assert 0.0 <= result["rare_pct"] <= 100.0

    def test_detail_contains_buckets(self):
        result = compute_cefr("the cat sat", "en")
        detail = result["detail"]
        assert {"very_common", "common", "uncommon", "rare"} <= detail.keys()

    def test_detail_values_sum_to_roughly_100(self):
        result = compute_cefr("the cat sat on a mat", "en")
        total = sum(result["detail"].values())
        assert abs(total - 100.0) < 1.0  # allow rounding error
