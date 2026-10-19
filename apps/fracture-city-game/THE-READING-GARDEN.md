# The Reading Garden · 0.68

Common Ground, between the theory library and the listening booth. Walk
through the arbour to the Reading Wall and press E (or tap the prompt).

- Starter shelf: classics/shelf.json and classics/<id>.json, built by
  `node _build/build-classics.cjs <folder of Gutenberg .txt files>`. The list
  of books, their shelves and expected titles live in that script.
- To refresh the raw texts, download them from a Gutenberg mirror (the
  _to_delete/fetch-classics.command used for 0.68 did this with curl, one
  book every two seconds). Never fetch from the main site in bulk.
- Online library: server/classics.cjs (catalogue + mirror fetch + disk cache)
  and server/classics-text.cjs (shared text cleaning, chapters, passages).
- Layout constants (wall, pools, trees, benches, lawn) are at the top of
  reading-garden.js. The gallery's anchors are in social-city.js.
