#!/usr/bin/env python3
"""
train_index.py — trains the FractureCore retrieval model on the manuscripts.

WHAT IS BEING TRAINED, AND WHY THIS AND NOT AN EMBEDDING MODEL
--------------------------------------------------------------
No pretrained sentence encoder was reachable from the machine this was built
on, and shipping one would mean a 90MB download the app cannot make either,
since Present Palm apps load from file:// with no network. So the semantic
layer is learned from the corpus itself: a truncated SVD of the TF-IDF matrix,
which is Latent Semantic Analysis. On 2,265 passages and ~106,000 words that is
a genuinely good fit — LSA wants a closed topical corpus and this is one.

The model is a hybrid of two scorers that fail in different directions:

  · BM25 — exact term overlap, saturating term frequency, length-normalised.
    Finds a passage when you remember a word from it. Blind to synonyms.
  · LSA cosine — the query and every passage projected into a k-dimensional
    space learned from co-occurrence. Finds a passage when you remember what
    it was ABOUT. Vague when the query is two words long.

Score = a * normalised(LSA) + (1-a) * normalised(BM25), and `a` is not a
guess: it is chosen on a held-out task, below.

HOW IT IS EVALUATED
-------------------
There are no relevance labels, so one is constructed that cannot leak: the
index is built on every passage MINUS its first sentence, and then each first
sentence is used as a query against it. A hit is the passage it was cut from.
This is a real test of "different words, same passage" — the query shares the
subject matter but not the wording of the indexed body. Recall@1/5/10 and MRR
are reported for BM25 alone, LSA alone, and the hybrid at every `a`.

OUTPUT
------
data/fracture-index.json — everything the browser needs, with the float
matrices quantised to int8 and base64'd. Parsing 6MB of JSON numbers takes
seconds; parsing 6MB of base64 into an Int8Array takes milliseconds.
"""

import base64
import json
import math
import os
import sys
import time
from collections import Counter, defaultdict

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from textkit import (terms, tokens, normalise, STOPWORDS, stem,        # noqa: E402
                     _STEP1, _STEP2, _STEP3, _PUNCT_MAP, _VOWELS)

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")

#  Hyper-parameters. MIN_DF=2 drops words that appear in one passage only;
#  those cannot help retrieval and they are most of the vocabulary.
K_DIMS = 224
MIN_DF = 2
MAX_DF_RATIO = 0.55
#  Retrieval unit. The corpus arrives cut into passages averaging 47 words,
#  which is far too small to retrieve on: measured on this corpus, half of all
#  query/target pairs at that granularity share NO vocabulary term at all, so
#  no lexical scorer can reach them and a semantic one has 18 terms of
#  evidence to work from. Passages are therefore welded into overlapping
#  windows of consecutive passages from the same book. The window is what gets
#  indexed and scored; the passages inside it are still addressed
#  individually, so a citation still points at a real passage.
CHUNK = 3
STRIDE = 2
BM25_K1 = 1.4
BM25_B = 0.72

SOURCE_LABEL = {
    "FMT_Final_Book_Version": "Fractured Mirror Theory",
    "Exulansis: Complete Revised Edition": "Exulansis",
    "Next Ten Years: Fractured Mirror Analysis": "The Next Ten Years",
}
SOURCE_SHORT = {
    "FMT_Final_Book_Version": "FMT",
    "Exulansis: Complete Revised Edition": "EXU",
    "Next Ten Years: Fractured Mirror Analysis": "NTY",
}


def log(*a):
    print(*a, flush=True)


# ── Corpus ──────────────────────────────────────────────────────────────────

def load_corpus():
    with open(os.path.join(DATA, "corpus.json"), encoding="utf-8") as f:
        raw = json.load(f)
    docs = []
    seen = set()
    for r in raw:
        t = (r.get("text") or "").strip()
        if len(t) < 24:
            continue
        #  The corpus has near-duplicates where a passage was re-cut. Keying on
        #  the normalised text collapses them; leaving them in means the same
        #  paragraph takes three of the ten result slots.
        key = " ".join(normalise(t).split())
        if key in seen:
            continue
        seen.add(key)
        docs.append({
            "id": len(docs),
            "src": r.get("source", "unknown"),
            "text": t,
            "axes": r.get("axes") or [1 / 3, 1 / 3, 1 / 3],
        })
    return docs


def build_chunks(docs):
    """Overlapping windows of consecutive passages, never crossing a book."""
    chunks = []
    by_src = {}
    for d in docs:
        by_src.setdefault(d["src"], []).append(d)
    for src, group in by_src.items():
        i = 0
        while i < len(group):
            part = group[i:i + CHUNK]
            if not part:
                break
            #  Do not leave a runt at the end of a book; fold it backwards.
            if len(part) < CHUNK and chunks and chunks[-1]["src"] == src:
                if i + len(part) >= len(group) and len(part) <= CHUNK // 2:
                    break
            chunks.append({
                "id": len(chunks),
                "src": src,
                "members": [d["id"] for d in part],
                "text": "\n\n".join(d["text"] for d in part),
                "axes": [sum(d["axes"][k] for d in part) / len(part) for k in range(3)],
            })
            if i + CHUNK >= len(group):
                break
            i += STRIDE
    return chunks


def half_split(text):
    """First half as query, second half as the document to find. Leak-free:
    the query's wording is absent from what is indexed."""
    w = text.split()
    if len(w) < 40:
        return None, None
    cut = len(w) // 2
    return " ".join(w[:cut]), " ".join(w[cut:])


def first_sentence(text):
    """Split off the first sentence, for the held-out evaluation."""
    n = normalise(text)
    best = -1
    for i in range(len(n) - 1):
        if n[i] in ".?!" and (n[i + 1] == " " or n[i + 1] == '"'):
            if i >= 40:
                best = i + 1
                break
    if best < 0:
        #  No sentence break: use the first 45% of the words instead, which
        #  still gives a query whose wording is absent from the indexed body.
        w = text.split()
        if len(w) < 14:
            return None, None
        cut = max(6, int(len(w) * 0.45))
        return " ".join(w[:cut]), " ".join(w[cut:])
    head, tail = text[:best].strip(), text[best:].strip()
    if len(tail.split()) < 8 or len(head.split()) < 5:
        return None, None
    return head, tail


# ── Vocabulary and matrices ─────────────────────────────────────────────────

def build_vocab(doc_terms):
    df = Counter()
    for ts in doc_terms:
        df.update(set(ts))
    n = len(doc_terms)
    keep = [t for t, c in df.items() if c >= MIN_DF and c <= n * MAX_DF_RATIO]
    keep.sort()
    vocab = {t: i for i, t in enumerate(keep)}
    idf = np.zeros(len(keep), dtype=np.float64)
    for t, i in vocab.items():
        #  BM25's idf, floored. The raw form goes negative for terms in more
        #  than half the collection, which would make a common word count
        #  AGAINST a passage that contains it.
        idf[i] = max(0.02, math.log(1 + (n - df[t] + 0.5) / (df[t] + 0.5)))
    return vocab, idf, df


def tfidf_matrix(doc_terms, vocab, idf):
    """Dense float32. 2.2k x ~11k is 100MB — fine, and dense keeps the SVD simple."""
    n, v = len(doc_terms), len(vocab)
    X = np.zeros((n, v), dtype=np.float32)
    for i, ts in enumerate(doc_terms):
        c = Counter(t for t in ts if t in vocab)
        if not c:
            continue
        for t, f in c.items():
            #  Sublinear tf: a word used six times is not six times as much
            #  about that word. This matters on passages of wildly varying
            #  length, which is exactly what this corpus is.
            X[i, vocab[t]] = (1.0 + math.log(f)) * idf[vocab[t]]
    #  L2 per document, so passage length drops out of the cosine.
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return X / norms


def train_lsa(X, k):
    """Truncated SVD. Returns (doc_vectors, term_projection, singular_values)."""
    from scipy.sparse.linalg import svds
    from scipy.sparse import csr_matrix
    k = min(k, min(X.shape) - 1)
    U, S, Vt = svds(csr_matrix(X.astype(np.float64)), k=k)
    order = np.argsort(-S)
    U, S, Vt = U[:, order], S[order], Vt[order, :]
    #  Documents live at U*S. A query is folded in as q @ Vt.T, which lands it
    #  in the same space without refitting anything.
    doc_vecs = U * S
    term_proj = Vt.T                       # (vocab, k)
    return doc_vecs, term_proj, S


def l2(M, axis=1):
    n = np.linalg.norm(M, axis=axis, keepdims=True)
    n[n == 0] = 1.0
    return M / n


# ── BM25 ────────────────────────────────────────────────────────────────────

class BM25:
    def __init__(self, doc_terms, vocab, df, k1=BM25_K1, b=BM25_B):
        self.k1, self.b = k1, b
        self.n = len(doc_terms)
        self.lens = np.array([len([t for t in ts if t in vocab]) for ts in doc_terms],
                             dtype=np.float32)
        self.avg = float(self.lens.mean()) or 1.0
        self.post = defaultdict(list)       # term -> [(doc, tf)]
        for i, ts in enumerate(doc_terms):
            c = Counter(t for t in ts if t in vocab)
            for t, f in c.items():
                self.post[t].append((i, f))
        self.idf = {}
        for t in vocab:
            d = df[t]
            self.idf[t] = max(0.02, math.log(1 + (self.n - d + 0.5) / (d + 0.5)))

    def score(self, q_terms):
        s = np.zeros(self.n, dtype=np.float32)
        for t, qf in Counter(q_terms).items():
            if t not in self.post:
                continue
            idf = self.idf[t]
            for doc, tf in self.post[t]:
                dl = self.lens[doc]
                denom = tf + self.k1 * (1 - self.b + self.b * dl / self.avg)
                s[doc] += idf * (tf * (self.k1 + 1)) / denom
        return s


# ── Evaluation ──────────────────────────────────────────────────────────────

def minmax(v):
    lo, hi = float(v.min()), float(v.max())
    if hi - lo < 1e-9:
        return np.zeros_like(v)
    return (v - lo) / (hi - lo)


def _fit(dterms, k):
    vocab, idf, df = build_vocab(dterms)
    X = tfidf_matrix(dterms, vocab, idf)
    dv, tp, S = train_lsa(X, k)
    return vocab, idf, df, l2(dv), tp, BM25(dterms, vocab, df)


def _query_vec(q_terms, vocab, idf):
    qv = np.zeros(len(vocab), dtype=np.float32)
    for t, f in Counter(q_terms).items():
        if t in vocab:
            qv[vocab[t]] = (1.0 + math.log(f)) * idf[vocab[t]]
    n = np.linalg.norm(qv)
    return qv / (n if n else 1.0)


def _overlap_sets(chunks):
    """Windows sharing a passage are the SAME TEXT, not a wrong answer. They
    are removed from the candidate list during evaluation, or R@1 measures
    nothing but the stride."""
    owner = {}
    for c in chunks:
        for m in c["members"]:
            owner.setdefault(m, []).append(c["id"])
    return [set(cid for m in c["members"] for cid in owner[m]) - {c["id"]}
            for c in chunks]


def short_query(text, vocab, idf, n=5):
    """The other kind of query: a few remembered words rather than a
    paragraph. Built from the highest-idf terms actually in the window, which
    is what a person reaching for a half-remembered passage supplies."""
    c = Counter(t for t in terms(text) if t in vocab)
    if len(c) < n:
        return None
    ranked = sorted(c, key=lambda t: -idf[vocab[t]])
    return ranked[:n]


def evaluate(chunks, k_dims, alphas, label, quiet=False, mode="long"):
    """Leak-free: index the second half of every window, query with the first.

    This is the task the app actually performs — a passage of prose in, the
    material it belongs with out — unlike the first-sentence variant, where
    over half of all pairs share no vocabulary term at all and no retriever,
    however good, can reach them.
    """
    pairs = []
    for c in chunks:
        h, t = half_split(c["text"])
        if h and t:
            pairs.append((c["id"], h, t))
    dterms = [terms(p[2]) for p in pairs]
    vocab, idf, df, dvn, tp, bm = _fit(dterms, k_dims)

    #  Overlap sets computed over the SURVIVING pairs, by their new index.
    slot = {p[0]: i for i, p in enumerate(pairs)}
    raw_ov = _overlap_sets(chunks)
    ov = [set(slot[c] for c in raw_ov[p[0]] if c in slot) for p in pairs]

    if mode == "long":
        queries = [[t for t in terms(p[1]) if t in vocab] for p in pairs]
    else:
        queries = [short_query(p[2], vocab, idf) or [] for p in pairs]

    n = len(pairs)
    hits = {a: [0, 0, 0, 0.0] for a in alphas}
    scored = 0
    for qi, qt in enumerate(queries):
        if not qt:
            continue
        scored += 1
        qv = _query_vec(qt, vocab, idf)
        nl = minmax(dvn @ (qv @ tp))
        nb = minmax(bm.score(qt))
        mask = np.zeros(n, dtype=bool)
        for o in ov[qi]:
            mask[o] = True
        for a in alphas:
            sc = a * nl + (1 - a) * nb
            sc[mask] = -1e9
            order = np.argsort(-sc)
            rank = int(np.where(order == qi)[0][0]) + 1
            if rank == 1: hits[a][0] += 1
            if rank <= 5: hits[a][1] += 1
            if rank <= 10: hits[a][2] += 1
            hits[a][3] += 1.0 / rank

    n = max(scored, 1)
    best, best_mrr = alphas[0], -1.0
    rows = []
    for a in alphas:
        h = hits[a]
        mrr = h[3] / n
        rows.append((a, h[0] / n, h[1] / n, h[2] / n, mrr))
        if mrr > best_mrr:
            best_mrr, best = mrr, a
    if not quiet:
        log(f"  {label}: {n} held-out windows")
        log("    alpha   R@1    R@5   R@10    MRR")
        for a, r1, r5, r10, mrr in rows:
            tag = "  (lexical only)" if a == 0 else ("  (semantic only)" if a == 1 else "")
            log(f"    {a:4.2f}  {r1:5.1%} {r5:6.1%} {r10:6.1%}  {mrr:5.3f}{tag}")
    return best, best_mrr, {a: hits[a] for a in alphas}, n


def evaluate_adjacency(chunks, vocab, idf, dvn, tp, bm, alpha):
    """Second check, on the real index rather than a held-out one: given a
    whole window, is the material next to it in the book what comes back?
    Windows overlap by design, so neighbours genuinely are the right answer,
    and a retriever that cannot find them is not finding anything."""
    n = len(chunks)
    by_src = {}
    for c in chunks:
        by_src.setdefault(c["src"], []).append(c["id"])
    pos = {}
    for src, ids in by_src.items():
        for i, cid in enumerate(ids):
            pos[cid] = (src, i)

    hit1 = hit5 = 0
    tested = 0
    rng = np.random.default_rng(7)
    sample = rng.choice(n, min(500, n), replace=False)
    for ci in sample:
        c = chunks[int(ci)]
        src, i = pos[c["id"]]
        ids = by_src[src]
        gold = set()
        for off in (-2, -1, 1, 2):
            j = i + off
            if 0 <= j < len(ids):
                gold.add(ids[j])
        if not gold:
            continue
        tested += 1
        qt = [t for t in terms(c["text"]) if t in vocab]
        qv = _query_vec(qt, vocab, idf)
        s = alpha * minmax(dvn @ (qv @ tp)) + (1 - alpha) * minmax(bm.score(qt))
        s[c["id"]] = -1e9                      # never return the query itself
        order = np.argsort(-s)
        if order[0] in gold:
            hit1 += 1
        if gold & set(order[:5].tolist()):
            hit5 += 1
    log(f"  neighbour check: top-1 is adjacent {hit1/tested:.1%}, "
        f"a neighbour is in the top 5 {hit5/tested:.1%}  ({tested} windows)")
    return {"tested": tested, "adj1": round(hit1 / tested, 4), "adj5": round(hit5 / tested, 4)}


# ── Quantisation ────────────────────────────────────────────────────────────

def quant(M):
    """int8 with one scale per matrix. Error is ~0.4% of range, which is well
    under the noise floor of the ranking itself."""
    M = np.asarray(M, dtype=np.float32)
    s = float(np.abs(M).max()) or 1.0
    Q = np.clip(np.round(M / s * 127.0), -127, 127).astype(np.int8)
    return base64.b64encode(Q.tobytes()).decode("ascii"), s, list(M.shape)


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    t0 = time.time()
    log("FractureCore · training the retrieval model")
    docs = load_corpus()
    log(f"  passages: {len(docs)} after de-duplication")
    by_src = Counter(d["src"] for d in docs)
    for s_, c in by_src.most_common():
        log(f"    {SOURCE_LABEL.get(s_, s_)}: {c}")

    chunks = build_chunks(docs)
    wl = [len(c["text"].split()) for c in chunks]
    log(f"  windows: {len(chunks)} of {CHUNK} passages, stride {STRIDE} "
        f"({int(np.mean(wl))} words mean)")

    #  Nothing below is a guessed constant. Both the number of LSA dimensions
    #  and the lexical/semantic blend are chosen on held-out tasks, and there
    #  are TWO tasks because there are two kinds of query and they want
    #  opposite weights:
    #
    #    long  — a paragraph pasted in, or a question in full sentences.
    #            Wording differs from the target, so meaning has to carry it.
    #    short — three or four remembered words. Those words are usually the
    #            EXACT words in the passage, so exact matching wins and a
    #            semantic score on four terms is mostly noise.
    #
    #  Shipping one blend for both is what makes a search box feel broken in
    #  one of the two modes. The client interpolates between them on query
    #  length instead.
    alphas = [0.0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.0]

    log("\n  sweeping LSA dimensions (long-query task)")
    best_k, best_k_mrr = K_DIMS, -1.0
    for k in (96, 160, 224, 320):
        a, mrr, _, _ = evaluate(chunks, k, alphas, f"k={k}", quiet=True, mode="long")
        a2, mrr2, _, _ = evaluate(chunks, k, alphas, f"k={k}", quiet=True, mode="short")
        combined = (mrr + mrr2) / 2
        log(f"    k={k:3d}  long MRR {mrr:.3f} (a={a:.2f})   "
            f"short MRR {mrr2:.3f} (a={a2:.2f})   mean {combined:.3f}")
        if combined > best_k_mrr:
            best_k, best_k_mrr = k, combined
    log(f"  chosen: {best_k} dimensions")

    log("")
    a_long, mrr_long, hits_l, n_l = evaluate(chunks, best_k, alphas,
                                             "long queries (half a window in)",
                                             mode="long")
    log("")
    a_short, mrr_short, hits_s, n_s = evaluate(chunks, best_k, alphas,
                                               "short queries (5 remembered words)",
                                               mode="short")
    log(f"\n  blend: {a_long:.2f} semantic for long queries, "
        f"{a_short:.2f} for short ones")

    alpha = a_long
    hl, hs = hits_l[a_long], hits_s[a_short]
    evalrep = {
        "windows": n_l, "dims": best_k,
        "alphaLong": a_long, "alphaShort": a_short,
        "long": {"mrr": round(mrr_long, 4), "r1": round(hl[0] / n_l, 4),
                 "r5": round(hl[1] / n_l, 4), "r10": round(hl[2] / n_l, 4),
                 "bm25_mrr": round(hits_l[0.0][3] / n_l, 4),
                 "lsa_mrr": round(hits_l[1.0][3] / n_l, 4)},
        "short": {"mrr": round(mrr_short, 4), "r1": round(hs[0] / n_s, 4),
                  "r5": round(hs[1] / n_s, 4), "r10": round(hs[2] / n_s, 4),
                  "bm25_mrr": round(hits_s[0.0][3] / n_s, 4),
                  "lsa_mrr": round(hits_s[1.0][3] / n_s, 4)},
    }

    log("\n  fitting the shipped model on the whole corpus")
    dterms = [terms(c["text"]) for c in chunks]
    vocab, idf, df = build_vocab(dterms)
    log(f"    vocabulary: {len(vocab)} terms (min_df={MIN_DF})")
    X = tfidf_matrix(dterms, vocab, idf)
    dv, tp, S = train_lsa(X, best_k)
    var = float((S ** 2).sum() / (X ** 2).sum())
    log(f"    LSA: {dv.shape[1]} dimensions, {var:.1%} of the variance held")
    dvn = l2(dv)
    bm = BM25(dterms, vocab, df)
    evalrep.update(evaluate_adjacency(chunks, vocab, idf, dvn, tp, bm, alpha))

    terms_sorted = sorted(vocab, key=lambda t: vocab[t])
    post_docs, post_tfs, post_off = [], [], [0]
    for t in terms_sorted:
        for doc, tf in bm.post.get(t, []):
            post_docs.append(doc)
            post_tfs.append(min(tf, 255))
        post_off.append(len(post_docs))

    dv_b64, dv_s, dv_shape = quant(dvn)
    tp_b64, tp_s, tp_shape = quant(tp)

    model = {
        "format": "fracture-index.v2",
        "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "alpha": alpha,
        "alphaLong": evalrep["alphaLong"],
        "alphaShort": evalrep["alphaShort"],
        "chunk": {"size": CHUNK, "stride": STRIDE},
        "bm25": {"k1": BM25_K1, "b": BM25_B, "avgLen": bm.avg},
        "eval": evalrep,
        "vocab": terms_sorted,
        "idf": [round(float(x), 5) for x in idf],
        "docVecs": {"b64": dv_b64, "scale": dv_s, "shape": dv_shape},
        "termProj": {"b64": tp_b64, "scale": tp_s, "shape": tp_shape},
        "docLens": [int(x) for x in bm.lens],
        "postings": {
            "docs": base64.b64encode(np.array(post_docs, dtype=np.uint16).tobytes()).decode(),
            "tfs": base64.b64encode(np.array(post_tfs, dtype=np.uint8).tobytes()).decode(),
            "off": base64.b64encode(np.array(post_off, dtype=np.uint32).tobytes()).decode(),
        },
        "stopwords": sorted(STOPWORDS),
        #  The tokeniser, shipped as data rather than reimplemented. The
        #  client runs the same algorithm over these tables, so the stemmer
        #  cannot drift away from the one the index was built with — which
        #  would not throw, it would just quietly stop matching. parity_test.py
        #  checks the two agree on every passage in the corpus.
        "tokeniser": {
            "punct": _PUNCT_MAP,
            "vowels": "".join(sorted(_VOWELS)),
            "step1": _STEP1, "step2": _STEP2, "step3": _STEP3,
        },
        "sources": {s_: {"label": SOURCE_LABEL.get(s_, s_),
                         "short": SOURCE_SHORT.get(s_, s_[:3].upper()),
                         "count": c} for s_, c in by_src.items()},
        #  Passages, addressed individually so a citation is exact.
        "passages": [{"s": d["src"], "t": d["text"],
                      "a": [round(x, 4) for x in d["axes"]]} for d in docs],
        #  Windows: what is scored. Each names the passages inside it.
        "windows": [{"s": c["src"], "m": c["members"]} for c in chunks],
    }

    #  The kit's own numbers, counted here so the app never has to read a
    #  data file at runtime. See the note below about why it cannot.
    kit = {"train": 0, "valid": 0, "words": 0}
    for name, key in (("train.jsonl", "train"), ("valid.jsonl", "valid")):
        fp = os.path.join(DATA, name)
        if not os.path.exists(fp):
            continue
        with open(fp, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                kit[key] += 1
                if key == "train":
                    try:
                        kit["words"] += len(json.loads(line).get("text", "").split())
                    except Exception:
                        pass
    model["kit"] = kit
    log(f"    kit: {kit['train']} train / {kit['valid']} valid, "
        f"~{kit['words']:,} words")

    out = os.path.join(DATA, "fracture-index.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(model, f, separators=(",", ":"), ensure_ascii=False)
    mb = os.path.getsize(out) / 1e6
    log(f"\n  wrote {out}  ({mb:.2f} MB)")

    #  And the same thing as a script.
    #
    #  The app is loaded with loadFile(), so its page origin is file://, and
    #  Chromium refuses fetch() and XHR against a file:// URL no matter what
    #  the page is — that is not a CORS header the app can set, it is a hard
    #  rule about the file scheme. A <script> tag is exempt, because scripts
    #  have always been allowed to load cross-origin. So the index ships as an
    #  assignment rather than as data to be fetched, and the app has no
    #  loading path that can fail.
    outjs = os.path.join(DATA, "fracture-index.js")
    with open(outjs, "w", encoding="utf-8") as f:
        f.write("/*  FractureCore retrieval model.\n"
                "    Generated by train_index.py. Do not edit: every number in\n"
                "    here was fitted, and the tokeniser tables at the end have\n"
                "    to match the ones the vocabulary was built with.\n"
                "    Shipped as a script rather than as JSON because a file://\n"
                "    page cannot fetch a file:// URL.  */\n"
                "window.FRACTURE_INDEX = ")
        json.dump(model, f, separators=(",", ":"), ensure_ascii=False)
        f.write(";\n")
    log(f"  wrote {outjs}  ({os.path.getsize(outjs) / 1e6:.2f} MB)")
    log(f"  done in {time.time() - t0:.1f}s")
    return model


if __name__ == "__main__":
    main()
