# Fracture City 0.68.0 · The Reading Garden

## Added
- The Reading Garden (reading-garden.js) fills the middle of Common Ground.
  An ivy-covered arbour between the theory library and the listening booth
  opens onto two reflecting pools, lawns, four voxel trees, flower beds, path
  lanterns and benches. Fireflies come out at night; loose pages drift
  around the wall. Lawn, pools, trees, benches and the wall are real blocks.
- The Reading Wall at the garden's centre: a walnut-and-brass bookcase whose
  spines carry the real titles on the shelf, a lit title band, two reading
  lamps, and the Line of the Day: a passage from a classic, the same for
  everyone on the same date, readable from across the garden.
- The reader (press E at the wall, or tap): the line of the day with a jump
  to its chapter, five shelves, the big books, and search. Chapters, A−/A+
  text size, arrow keys to turn chapters. Works on phones.
- Starter shelf: 49 public-domain classics bundled with the game
  (apps/fracture-city-game/classics/, about 23 MB) in Novels, Gothic and
  strange, Adventure and wonder, Philosophy and ideas, Poetry and plays.
  Downloaded once from a Project Gutenberg mirror and processed by
  _build/build-classics.cjs: licence header and footer removed, paragraphs
  rejoined, chapters found. Each file is checked against its expected title,
  and texts Gutenberg marks as still copyrighted are refused (this removed
  Kafka's Metamorphosis, whose translation is in copyright).
- The online library (server/classics.cjs): search across the whole Project
  Gutenberg catalogue and read any public-domain text. The server reads
  Gutenberg's machine-readable catalogue file (refreshed weekly) and fetches
  books from the mirrors, one at a time with an identifying user agent, and
  caches them on the Render disk (capped at 150 MB). New endpoints:
  GET /api/classics/search?q=…  and  GET /api/classics/book/<id>.
- "The big ones": War and Peace, Anna Karenina, The Count of Monte Cristo,
  Les Misérables, Don Quixote, The Brothers Karamazov, Middlemarch and the
  complete Shakespeare, read through the online library.

## Changed
- The People's Gallery's eight displays moved from the middle of the plaza
  (z 36) to its south edge (z 44), facing the garden. Each display keeps its
  slot and its work. The first-walk tour points to the new spots.
- Common Ground's three planter rooms and the floor guides across the plaza
  were removed to make room for the garden.

## Notes
- Each book shows "Public domain in the USA" and a link to its page at
  gutenberg.org as the source. The Project Gutenberg header, footer and
  licence are stripped. Check Gutenberg's trademark and permission pages
  before selling or relicensing this content.
- Offline, Netlify and Mac editions have the starter shelf; search and the
  big books need the online game.

## Tests
- server/classics.test.cjs: CSV, author names, mirror paths, licence
  stripping, chapters, passage, catalogue search, mirror fetch with caching,
  shelf books never fetched, restart without network.
- _test/reading-garden.test.cjs: solid garden and clear lanes, gallery reach
  from the new lane, line of the day on the wall, E to read, chapters, search
  and an online book, Escape, phone fit.
- Gallery, news hub and social tests updated to the gallery's new row.
