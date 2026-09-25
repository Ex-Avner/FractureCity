# The FractureCore kit

Everything the app needs on disk, and everything needed to rebuild the part of
it that was trained.

◆

## Two models, which is the thing to keep straight

**The retrieval model** was trained here, on these manuscripts, and ships
inside the app at `../data/fracture-index.js`. It knows where everything in
the three books is. It cannot write a sentence.

**The language model** runs on this Mac, outside the app, and supplies every
word of generated prose. Its reasoning and its English are its own. The
manuscripts steer what it talks about and how it sounds.

Neither substitutes for the other. With no language model running the app
still answers, with passages, and says plainly that nothing wrote them.

◆

## The data

| | |
|---|---|
| `data/train.jsonl` | 2,038 passages, one per line, `{"text": …}` |
| `data/valid.jsonl` | 227 held back, so validation loss means something |
| `data/corpus.json` | the attributed source corpus, 2,265 passages with their TOT axes |

From *Fractured Mirror Theory*, *Exulansis*, and *The Next Ten Years*. About
96,000 words of training text.

The manuscript text is P. R. Erickson's work. It is here so the trainer can
reach it on disk. Do not hand it to a service that keeps what it is sent.

◆

## Rebuilding the retrieval model

    pip3 install numpy scipy
    python3 train_index.py

Writes `data/fracture-index.json` and `data/fracture-index.js`. Copy the `.js`
to `../data/` and the app picks it up on next open.

It ships as a script rather than as JSON because the app is a `file://` page,
and Chromium forbids a `file://` page from fetching a `file://` URL. A
`<script>` tag is exempt. This is not a setting that can be changed.

What it does, in order:

1. Loads the corpus and drops near-duplicate passages.
2. Welds passages into overlapping windows of three. The passages average 47
   words, which is far too small to retrieve on: at that size, half of all
   query/target pairs share *no* vocabulary term at all, so no lexical scorer
   can reach them. Windows average 141 words.
3. Builds a vocabulary and a TF-IDF matrix, then a truncated SVD of it. That
   is Latent Semantic Analysis, and on a closed topical corpus of this size it
   is a genuinely good fit. No pretrained encoder is used, because the app
   cannot download one and neither could the machine this was built on.
4. **Sweeps its own hyper-parameters on held-out material.** Nothing below is
   a guessed constant.
5. Quantises the matrices to int8 and writes them base64'd, because parsing
   six megabytes of JSON numbers takes seconds and parsing the same as base64
   takes milliseconds.

## How it was measured

There are no relevance labels for these books, so one was built that cannot
leak. Every window was cut in half; the second halves were indexed and the
first halves became the queries. A hit is the window a query was cut from, and
the query's wording is absent from what was indexed.

Windows that share a passage are the *same text*, not a wrong answer, so they
are removed from the candidate list during scoring. Without that, the metric
measures the stride and nothing else.

There are two kinds of query and they want opposite settings:

| | a paragraph in | a few remembered words |
|---|---|---|
| found first | 10.1% | 99.6% |
| in the top five | 31.3% | 100% |
| in the top ten | 43.8% | 100% |
| MRR | 0.206 | 0.998 |
| exact matching alone | 0.167 | 0.997 |
| meaning alone | 0.203 | 0.988 |
| blend chosen | 0.60 meaning | 0.15 meaning |

Finding one specific seventy-word passage out of 1,105 near-identical ones
from different wording is genuinely hard, and 10% first-try is the honest
number for it. The measure that matters more in use is the neighbour check:
given a whole window, **91% of the time the top result is the passage next to
it in the book**, and a neighbour is in the top five 100% of the time. The
model reliably finds the right region.

The client interpolates between the two blends on query length, because
shipping one number for both is what makes a search box feel broken in
whichever mode it was not tuned for.

## The tokeniser

`textkit.py` defines what a word is. The app runs the same algorithm over
tables shipped inside the index rather than over constants of its own, so the
two cannot drift apart — a stop list that differs between trainer and client
never throws, it just quietly stops matching. `parity_test.js` checks that all
2,265 passages tokenise identically in both. They do.

◆

## The fine-tune

That is the app's Train screen, which writes the exact commands for this
machine and checks the result. The short version:

    pip3 install -U mlx-lm
    mlx_lm.lora --model mlx-community/Qwen3-8B-4bit --train \
      --data data --iters 600 --batch-size 2 --num-layers 16 \
      --adapter-path adapters

Then fuse it into a standalone model and serve it, and the app will find it:

    mlx_lm.fuse --model mlx-community/Qwen3-8B-4bit \
      --adapter-path adapters --save-path fused_model
    mlx_lm.server --model fused_model --port 8080

Pick the base model by this Mac's memory: 4B at 16 GB, 8B at 32 GB, 32B at
64 GB or more. A model that does not fit does not run.

The fine-tuned model is the base model's intelligence wearing the manuscripts'
voice. It will also reproduce the manuscripts' claims, including the
speculative scientific ones, with the base model's fluency. Fluency does not
make a claim true.
