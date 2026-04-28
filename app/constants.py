"""Shared application constants — centralises magic numbers and patterns."""

import re

# ── Word frequency tiers (Zipf scale) ────────────────────────────────────
FREQ_VERY_COMMON: float = 5.5
FREQ_COMMON: float = 4.0
FREQ_UNCOMMON: float = 2.5

# ── Word analysis ─────────────────────────────────────────────────────────
MIN_WORD_LENGTH: int = 2
WORD_PATTERN: re.Pattern = re.compile(r"[\w]+", re.UNICODE)

# ── File upload ───────────────────────────────────────────────────────────
MAX_WORD_LENGTH: int = 200  # single-word translation endpoint
