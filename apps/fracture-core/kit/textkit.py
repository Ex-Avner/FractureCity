"""
textkit — the tokeniser, the stemmer and the stop list.

This file exists so that ONE definition of "a word" is used in three places
that must agree exactly or retrieval silently degrades:

    1. here, when the index is trained
    2. here again, when the index is evaluated
    3. in the browser, in fracture-core.js, when a query is typed

The JavaScript port at the bottom of build_index.py is generated FROM this
file's constants, not written by hand, because a stop list that drifts between
the trainer and the client is the kind of bug that never throws and only ever
makes the results slightly worse.
"""

import re
import unicodedata

# ── Normalisation ───────────────────────────────────────────────────────────
#  The manuscripts are full of typographic punctuation: curly quotes, em
#  dashes, ellipsis characters. Left alone, "don’t" and "don't" are two words
#  and an em dash glues "collapse—the" into one token.

_PUNCT_MAP = {
    "‘": "'", "’": "'", "‚": "'", "‛": "'",
    "“": '"', "”": '"', "„": '"', "‟": '"',
    "–": " ", "—": " ", "―": " ", "−": " ",
    "…": " ", " ": " ", "​": "", "﻿": "",
}

_TOKEN_RE = re.compile(r"[a-z][a-z']*")


def normalise(s: str) -> str:
    s = unicodedata.normalize("NFKC", s)
    for a, b in _PUNCT_MAP.items():
        s = s.replace(a, b)
    return s.lower()


# ── Stop list ───────────────────────────────────────────────────────────────
#  Deliberately conservative. An aggressive stop list is wrong for this corpus:
#  "the mirror", "not", "between", "self" and "other" are load-bearing words in
#  these books, and half of them appear on a standard English stop list. What
#  is removed here is only the machinery of the sentence.

STOPWORDS = set("""
a an the and or but if then than that this these those there here
is are was were be been being am
do does did doing done
have has had having
i me my mine myself you your yours yourself we us our ours ourselves
he him his she her hers it its they them their theirs
what which who whom whose
of to in for on at by with from as into onto about over under again
so too very just also only even still yet
can could will would shall should may might must
s t d ll m re ve
""".split())


# ── Stemmer ─────────────────────────────────────────────────────────────────
#  A trimmed Porter: the suffix rules that matter for matching an English
#  query against English prose, and none of the ones that cost accuracy on a
#  corpus this size. Porter proper would need a measure function and five more
#  steps to gain, in testing on this corpus, nothing measurable.
#
#  It is intentionally SHORT because it has to be reimplemented character for
#  character in JavaScript. Every rule here is a rule that has to be ported.

_STEP1 = [
    ("sses", "ss"), ("ies", "i"), ("ss", "ss"), ("s", ""),
]
_STEP2 = [
    ("ational", "ate"), ("tional", "tion"), ("fulness", "ful"),
    ("ousness", "ous"), ("iveness", "ive"), ("ization", "ize"),
    ("ation", "ate"), ("ement", "e"), ("ments", "ment"), ("ment", ""),
    ("ness", ""), ("ities", "ity"), ("ity", ""), ("ically", "ic"),
    ("ally", "al"), ("fully", "ful"), ("ously", "ous"), ("ly", ""),
    ("ingly", ""), ("edly", ""),
]
_STEP3 = [("ing", ""), ("edly", ""), ("ed", ""), ("est", ""), ("er", "")]

_VOWELS = set("aeiouy")


def _has_vowel(s: str) -> bool:
    return any(c in _VOWELS for c in s)


def stem(w: str) -> str:
    if len(w) <= 3:
        return w
    for suf, rep in _STEP1:
        if w.endswith(suf):
            cand = w[: len(w) - len(suf)] + rep
            if len(cand) >= 2:
                w = cand
            break
    for suf, rep in _STEP2:
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            stem_part = w[: len(w) - len(suf)]
            if _has_vowel(stem_part):
                w = stem_part + rep
                break
    for suf, rep in _STEP3:
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            stem_part = w[: len(w) - len(suf)]
            if _has_vowel(stem_part):
                w = stem_part + rep
                #  "hop" + "ing" -> "hopp"; undo the doubled consonant so it
                #  meets "hop" from the query side.
                if len(w) >= 2 and w[-1] == w[-2] and w[-1] not in "lsz" \
                        and w[-1] not in _VOWELS:
                    w = w[:-1]
                elif w.endswith(("at", "bl", "iz")):
                    w += "e"
                break
    if w.endswith("i") and len(w) > 3:
        w = w[:-1] + "y"
    return w


def tokens(text: str, keep_stop: bool = False):
    """Raw surface tokens, normalised, stop words optionally kept."""
    out = []
    for m in _TOKEN_RE.finditer(normalise(text)):
        t = m.group(0).strip("'")
        if len(t) < 2:
            continue
        if not keep_stop and t in STOPWORDS:
            continue
        out.append(t)
    return out


def terms(text: str):
    """The indexing unit: stemmed, stopped tokens."""
    return [stem(t) for t in tokens(text)]
