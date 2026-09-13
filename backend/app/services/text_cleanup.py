"""
text_cleanup.py — best-effort normalisation of disfluent speech transcripts
(stammering, slow/drawn-out speech, filler words) before they're sent to the
LLM for intent classification.

None of this is a substitute for a real speech-disfluency model — it's a set
of conservative, high-precision regex heuristics that only collapse obvious
repetition/noise and never touch anything that could plausibly be intended
by the speaker. When in doubt, a rule leaves the text alone.

Three patterns are handled:
  1. Whole-word repetition   — "I I I want want water"      -> "I want water"
  2. Hyphenated fragment stammers — "s-s-sorry", "w-water"   -> "sorry", "water"
  3. Filler words            — "um", "uh", "erm"...          -> removed
  4. Letter elongation from slow/drawn-out speech — "sooo"   -> "so"
"""
import re

_FILLER_WORDS = {
    "um", "umm", "ummm", "uh", "uhh", "uhm", "erm", "err",
    "hmm", "hm", "ah", "aah",
}

# Immediate repeats of the same whole word ("I I I", "want want") — a comma
# or run of spaces may sit between repeats (transcripts sometimes punctuate
# the pause a stammer leaves).
_WORD_REPEAT_RE = re.compile(r"\b(\w+)(?:[\s,]+\1\b)+", re.IGNORECASE)

# A short 1-3 letter fragment immediately followed by a hyphen and a longer
# word that starts with the same letters — the classic "s-s-sorry" /
# "w-water" stammer transcription. Restricting the fragment to 1-3 letters
# and requiring the following word to start with it keeps this from
# touching genuine hyphenated compounds ("co-worker", "twenty-two") since
# their second half essentially never starts with the same letters.
_FRAGMENT_WORD_RE = re.compile(r"\b([A-Za-z]{1,3})-([A-Za-z]{2,})\b")

# 3+ of the same letter in a row ("soooo", "yesss") — genuine English words
# essentially never triple a letter, so this only ever fires on elongation.
_ELONGATION_RE = re.compile(r"(\w)\1{2,}")

_MULTI_SPACE_RE = re.compile(r"\s+")
_MAX_PASSES = 5  # handles chained repeats like "s-s-s-sorry" or "I I I I"


def _collapse_fragment(match: re.Match) -> str:
    frag, word = match.group(1), match.group(2)
    if word.lower().startswith(frag.lower()):
        return word
    return match.group(0)  # doesn't look like a stammer — leave untouched


def clean_stammered_text(text: str) -> str:
    """
    Normalise a raw ASR transcript that may contain stammering, filler
    words, or drawn-out/elongated speech, so intent classification sees a
    clean, well-formed sentence instead of noisy repetition.

    Safe to call on any text — returns the original text unchanged if
    nothing looks like a disfluency, and never returns an empty string.
    """
    if not text or not text.strip():
        return text

    cleaned = text

    # Hyphenated fragment stammers, iterated to unwind chained repeats
    # ("s-s-sorry" needs two passes: "s-s-sorry" -> "s-sorry" -> "sorry").
    prev = None
    passes = 0
    while prev != cleaned and passes < _MAX_PASSES:
        prev = cleaned
        cleaned = _FRAGMENT_WORD_RE.sub(_collapse_fragment, cleaned)
        passes += 1

    # Whole-word immediate repeats
    cleaned = _WORD_REPEAT_RE.sub(lambda m: m.group(1), cleaned)

    # Standalone filler words
    tokens = cleaned.split()
    tokens = [t for t in tokens if re.sub(r"[^a-zA-Z]", "", t).lower() not in _FILLER_WORDS]
    cleaned = " ".join(tokens)

    # Elongated letters from slow/drawn-out speech
    cleaned = _ELONGATION_RE.sub(lambda m: m.group(1), cleaned)

    cleaned = _MULTI_SPACE_RE.sub(" ", cleaned).strip()

    return cleaned or text