// =============================================================================
//  retrieval.js — the search side of FractureCore.
//
//  This is the client half of a model trained in train_index.py. The scoring
//  is a hybrid of two things that fail differently:
//
//    BM25   exact term overlap. Finds a passage when you remember a word from
//           it. Blind to paraphrase.
//    LSA    the query and every window projected into a 96-dimensional space
//           learned from the corpus's own co-occurrence. Finds a passage when
//           you remember what it was about. Vague on a two-word query.
//
//  The blend is not a constant. Measured on held-out windows from the books:
//
//    long query  (a paragraph in)   0.60 semantic — MRR 0.206 vs 0.167 lexical
//    short query (a few words in)   0.15 semantic — R@1 99.5%
//
//  Those want opposite weights, and shipping one number for both is what makes
//  a search box feel broken in whichever mode it was not tuned for. The blend
//  is interpolated on query length instead.
//
//  The tokeniser below is driven by tables shipped inside the index, not by
//  constants written here, so it cannot drift away from the one the index was
//  built with. parity_test.js checks the two agree on all 2,265 passages.
// =============================================================================

(function (root) {
  'use strict';

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  class Retrieval {
    constructor(model) {
      this.m = model;
      const tk = model.tokeniser || {};
      this.punct = tk.punct || {};
      this.vowels = new Set((tk.vowels || 'aeiouy').split(''));
      this.step1 = tk.step1 || [];
      this.step2 = tk.step2 || [];
      this.step3 = tk.step3 || [];
      this.stop = new Set(model.stopwords || []);

      this.vocab = new Map();
      model.vocab.forEach((t, i) => this.vocab.set(t, i));
      this.idf = Float32Array.from(model.idf);

      const dv = model.docVecs;
      this.k = dv.shape[1];
      this.nDocs = dv.shape[0];
      this.docVecs = this._deq(dv);
      this.termProj = this._deq(model.termProj);

      this.docLens = Float32Array.from(model.docLens);
      this.postDocs = new Uint16Array(b64ToBytes(model.postings.docs).buffer);
      this.postTfs = b64ToBytes(model.postings.tfs);
      this.postOff = new Uint32Array(b64ToBytes(model.postings.off).buffer);

      this.k1 = model.bm25.k1;
      this.b = model.bm25.b;
      this.avgLen = model.bm25.avgLen;

      this.aLong = model.alphaLong != null ? model.alphaLong : 0.6;
      this.aShort = model.alphaShort != null ? model.alphaShort : 0.15;

      this.passages = model.passages;
      this.windows = model.windows;
      this.sources = model.sources;

      //  Scratch buffers, allocated once. A search that allocates three
      //  Float32Arrays of length 1,132 per keystroke is a search that stutters
      //  on a laptop that is also running an 8B model.
      this._lsa = new Float32Array(this.nDocs);
      this._lex = new Float32Array(this.nDocs);
      this._qv = new Float32Array(this.k);
    }

    _deq(q) {
      const bytes = b64ToBytes(q.b64);
      const signed = new Int8Array(bytes.buffer);
      const out = new Float32Array(signed.length);
      const s = q.scale / 127.0;
      for (let i = 0; i < signed.length; i++) out[i] = signed[i] * s;
      out.rows = q.shape[0];
      out.cols = q.shape[1];
      return out;
    }

    // ── Tokenising ─────────────────────────────────────────────────────────

    normalise(s) {
      s = s.normalize('NFKC');
      for (const a in this.punct) {
        if (Object.prototype.hasOwnProperty.call(this.punct, a)) {
          s = s.split(a).join(this.punct[a]);
        }
      }
      return s.toLowerCase();
    }

    hasVowel(s) {
      for (let i = 0; i < s.length; i++) if (this.vowels.has(s[i])) return true;
      return false;
    }

    stem(w) {
      if (w.length <= 3) return w;
      for (let i = 0; i < this.step1.length; i++) {
        const suf = this.step1[i][0], rep = this.step1[i][1];
        if (w.endsWith(suf)) {
          const cand = w.slice(0, w.length - suf.length) + rep;
          if (cand.length >= 2) w = cand;
          break;
        }
      }
      for (let i = 0; i < this.step2.length; i++) {
        const suf = this.step2[i][0], rep = this.step2[i][1];
        if (w.endsWith(suf) && w.length - suf.length >= 3) {
          const part = w.slice(0, w.length - suf.length);
          if (this.hasVowel(part)) { w = part + rep; break; }
        }
      }
      for (let i = 0; i < this.step3.length; i++) {
        const suf = this.step3[i][0], rep = this.step3[i][1];
        if (w.endsWith(suf) && w.length - suf.length >= 3) {
          const part = w.slice(0, w.length - suf.length);
          if (this.hasVowel(part)) {
            w = part + rep;
            const n = w.length;
            if (n >= 2 && w[n - 1] === w[n - 2] && 'lsz'.indexOf(w[n - 1]) < 0
                && !this.vowels.has(w[n - 1])) {
              w = w.slice(0, -1);
            } else if (w.endsWith('at') || w.endsWith('bl') || w.endsWith('iz')) {
              w += 'e';
            }
            break;
          }
        }
      }
      if (w.endsWith('i') && w.length > 3) w = w.slice(0, -1) + 'y';
      return w;
    }

    tokens(text, keepStop) {
      const out = [];
      const norm = this.normalise(text);
      const re = /[a-z][a-z']*/g;
      let m;
      while ((m = re.exec(norm)) !== null) {
        let t = m[0].replace(/^'+|'+$/g, '');
        if (t.length < 2) continue;
        if (!keepStop && this.stop.has(t)) continue;
        out.push(t);
      }
      return out;
    }

    terms(text) {
      const raw = this.tokens(text, false);
      const out = new Array(raw.length);
      for (let i = 0; i < raw.length; i++) out[i] = this.stem(raw[i]);
      return out;
    }

    // ── Scoring ────────────────────────────────────────────────────────────

    _minmax(v, n) {
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < n; i++) { const x = v[i]; if (x < lo) lo = x; if (x > hi) hi = x; }
      const d = hi - lo;
      if (!(d > 1e-9)) { v.fill(0, 0, n); return; }
      for (let i = 0; i < n; i++) v[i] = (v[i] - lo) / d;
    }

    /**
     * @param {string} query
     * @param {object} opts  { limit, sources:Set|null, alpha:number|null }
     * @returns {{hits:Array, terms:Array, alpha:number}}
     */
    search(query, opts) {
      opts = opts || {};
      const limit = opts.limit || 12;
      const qTermsAll = this.terms(query || '');
      const qTerms = [];
      const counts = new Map();
      for (const t of qTermsAll) {
        if (!this.vocab.has(t)) continue;
        qTerms.push(t);
        counts.set(t, (counts.get(t) || 0) + 1);
      }
      if (!qTerms.length) {
        return { hits: [], terms: [], alpha: 0, empty: true, coverage: 0,
                 unknown: qTermsAll.length > 0 };
      }

      //  The share of what was typed that the corpus has any word for, weighted
      //  by how distinctive those words are. A question about linked lists
      //  scores near zero here even though "list" and "in" are in the
      //  vocabulary, because the words that carry the question are not.
      let haveIdf = 0, allIdf = 0;
      for (const t of new Set(qTermsAll)) {
        const w = this.vocab.has(t) ? this.idf[this.vocab.get(t)] : 3.2;
        allIdf += w;
        if (this.vocab.has(t)) haveIdf += w;
      }
      const coverage = allIdf > 0 ? haveIdf / allIdf : 0;

      //  Interpolate the blend on how much the query gives us to work with.
      //  Two terms is a lookup; twenty is a description.
      const n = counts.size;
      let alpha;
      if (opts.alpha != null) alpha = opts.alpha;
      else {
        const t = Math.max(0, Math.min(1, (n - 3) / 17));
        alpha = this.aShort + (this.aLong - this.aShort) * t;
      }

      // ── query vector in LSA space ──
      const qs = new Float32Array(this.vocab.size);
      let norm = 0;
      for (const [t, f] of counts) {
        const i = this.vocab.get(t);
        const w = (1 + Math.log(f)) * this.idf[i];
        qs[i] = w;
        norm += w * w;
      }
      norm = Math.sqrt(norm) || 1;

      const k = this.k, qv = this._qv;
      qv.fill(0);
      //  Only the query's own terms contribute, so this walks the handful of
      //  non-zero rows of termProj rather than all 5,569 of them.
      for (const [t] of counts) {
        const i = this.vocab.get(t);
        const w = qs[i] / norm;
        const base = i * k;
        for (let d = 0; d < k; d++) qv[d] += w * this.termProj[base + d];
      }

      const nDocs = this.nDocs, lsa = this._lsa, lex = this._lex;
      //  Kept before normalisation. The normalised scores answer "which of
      //  these is best", which is all ranking needs; they cannot answer "is
      //  any of this actually about the question", because min-max makes the
      //  top hit 1.0 whether it is a perfect match or the least bad of 1,132
      //  irrelevant ones. The raw cosine is an absolute number and comparable
      //  across queries, so that is what a relevance gate has to look at.
      const rawL = new Float32Array(nDocs), rawX = new Float32Array(nDocs);
      for (let doc = 0; doc < nDocs; doc++) {
        const base = doc * k;
        let s = 0;
        for (let d = 0; d < k; d++) s += this.docVecs[base + d] * qv[d];
        lsa[doc] = s;
        rawL[doc] = s;
      }

      // ── BM25 ──
      lex.fill(0);
      for (const [t] of counts) {
        const ti = this.vocab.get(t);
        const idf = this.idf[ti];
        const from = this.postOff[ti], to = this.postOff[ti + 1];
        for (let p = from; p < to; p++) {
          const doc = this.postDocs[p];
          const tf = this.postTfs[p];
          const dl = this.docLens[doc];
          lex[doc] += idf * (tf * (this.k1 + 1))
                    / (tf + this.k1 * (1 - this.b + this.b * dl / this.avgLen));
        }
      }

      rawX.set(lex.subarray(0, nDocs));
      //  How much of the query's total idf mass the best passage actually
      //  matched. Absolute, and it is the rare words that move it: a question
      //  whose distinctive term is "exulansis" scores high when a passage
      //  contains it and near zero when nothing does.
      let qIdf = 0;
      for (const [t] of counts) qIdf += this.idf[this.vocab.get(t)];
      for (const t of qTermsAll) if (!this.vocab.has(t)) qIdf += 3.4;
      this._minmax(lsa, nDocs);
      this._minmax(lex, nDocs);

      // ── combine, filter, rank ──
      const srcFilter = opts.sources && opts.sources.size ? opts.sources : null;
      const scored = [];
      for (let doc = 0; doc < nDocs; doc++) {
        const w = this.windows[doc];
        if (srcFilter && !srcFilter.has(w.s)) continue;
        const s = alpha * lsa[doc] + (1 - alpha) * lex[doc];
        if (s <= 0) continue;
        scored.push([s, doc]);
      }
      scored.sort((a, b) => b[0] - a[0]);

      //  Windows overlap by one passage. Without this, positions 1 and 2 are
      //  routinely the same paragraph shown twice, which reads as a bug.
      const hits = [];
      const used = new Set();
      for (const [s, doc] of scored) {
        const w = this.windows[doc];
        let overlap = 0;
        for (const m of w.m) if (used.has(m)) overlap++;
        if (overlap > w.m.length / 2) continue;
        for (const m of w.m) used.add(m);
        hits.push({
          window: doc, score: s, lsa: lsa[doc], lex: lex[doc],
          //  Absolute: a true cosine in [-1,1] against the query, plus how
          //  much of the query the corpus even has words for.
          cos: rawL[doc], cover: coverage,
          bm: rawX[doc], bmFrac: qIdf > 0 ? rawX[doc] / qIdf : 0,
          source: w.s, members: w.m,
          text: w.m.map(i => this.passages[i].t).join('\n\n'),
        });
        if (hits.length >= limit) break;
      }
      return { hits, terms: [...counts.keys()], alpha, empty: false, coverage };
    }

    /** Passages nearest a given window in meaning — "more like this". */
    similar(windowId, limit) {
      const k = this.k, base = windowId * k;
      const out = [];
      for (let doc = 0; doc < this.nDocs; doc++) {
        if (doc === windowId) continue;
        let s = 0;
        const b2 = doc * k;
        for (let d = 0; d < k; d++) s += this.docVecs[base + d] * this.docVecs[b2 + d];
        out.push([s, doc]);
      }
      out.sort((a, b) => b[0] - a[0]);
      const seen = new Set(this.windows[windowId].m);
      const hits = [];
      for (const [s, doc] of out) {
        const w = this.windows[doc];
        if (w.m.some(m => seen.has(m))) continue;
        w.m.forEach(m => seen.add(m));
        hits.push({ window: doc, score: s, source: w.s, members: w.m,
                    text: w.m.map(i => this.passages[i].t).join('\n\n') });
        if (hits.length >= (limit || 6)) break;
      }
      return hits;
    }

    /** Every occurrence of a phrase, with its surroundings. */
    concordance(phrase, limit) {
      const needle = this.normalise(phrase).replace(/\s+/g, ' ').trim();
      if (needle.length < 2) return [];
      const out = [];
      for (let i = 0; i < this.passages.length; i++) {
        const hay = this.normalise(this.passages[i].t).replace(/\s+/g, ' ');
        let at = hay.indexOf(needle);
        while (at >= 0) {
          out.push({
            passage: i, source: this.passages[i].s, at,
            before: this.passages[i].t.slice(Math.max(0, at - 90), at),
            match: this.passages[i].t.substr(at, needle.length),
            after: this.passages[i].t.slice(at + needle.length,
                                            at + needle.length + 110),
          });
          if (out.length >= (limit || 200)) return out;
          at = hay.indexOf(needle, at + needle.length);
        }
      }
      return out;
    }

    stats() {
      return {
        passages: this.passages.length,
        windows: this.windows.length,
        vocab: this.vocab.size,
        dims: this.k,
        sources: this.sources,
        eval: this.m.eval,
        builtAt: this.m.builtAt,
      };
    }
  }

  root.FractureRetrieval = Retrieval;
})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Retrieval: (typeof window !== 'undefined' ? window : globalThis).FractureRetrieval };
}
