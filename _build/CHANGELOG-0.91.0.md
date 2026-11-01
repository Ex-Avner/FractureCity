# Fracture City 0.91.0: The Church of Omnism

A domed limestone hall on the city blocks west of Common Ground (chunks 3..4 × 0..1). Inside, ten lecterns stand around the walls, one for each scripture, and the round table at the centre holds the Guide. Walk up to any of them and press E, or tap the prompt.

## The library

Complete texts, each in its original language where the source allows, with public-domain translations. They ship with the game and load one book at a time:

| Tradition | Work | Editions |
|---|---|---|
| Judaism | The Tanakh: Torah, Prophets, Writings, in Jewish order | Hebrew (Westminster Leningrad Codex), English (JPS 1917) |
| Christianity | The Holy Bible, 73 books including the Deuterocanon | King James, Douay-Rheims, Latin Vulgate, Greek New Testament (Byzantine) |
| Islam | The Qur'an, 114 surahs | Arabic (Tanzil), English (Pickthall 1930) |
| Hinduism | The Bhagavad Gita | Sanskrit in Devanagari and in transliteration, English (Arnold 1885) |
| Hinduism | The Upanishads: Isa, Katha, Kena | English (Paramananda 1919) |
| Buddhism | The Dhammapada | English (Müller 1881) |
| Taoism | The Tao Te Ching | Chinese (Wang Bi text), English (Legge 1891) |
| Confucianism | The Analects | English (Legge) |
| Latter-day Saints | The Book of Mormon | English |
| Bahá'í Faith | The Hidden Words; the Kitáb-i-Íqán | English (Shoghi Effendi) |

- **The reader.** Choose a book and chapter. Pick a main text and, optionally, a second text beside it: Hebrew with English, Arabic with English, Latin or Greek with the King James, and so on. Right-to-left scripts are set right to left. Arrow keys turn the chapter, and the library remembers where you stopped. On a phone it fills the screen.
- **The Guide.** The centre table opens the full table of contents: every book of every work, each a link straight into the reader. It also has a card for each tradition, notes on how to read, and the source and licence of every edition.
- **Divine names in the JPS.** The JPS 1917 transcription used here wrote HaShem, G-d and L-rd. These are restored to the 1917 printing's LORD, God and Lord.
- **Not yet on the shelves.** No complete public-domain text in a usable form could be sourced for:
  - the Sri Guru Granth Sahib
  - the Avesta
  - the Jain Agamas
  - the Kojiki

  The Guide lists them as missing.
- **The data.** About 28 MB of JSON in `apps/fracture-city-game/scriptures/`, built by `_build/build-scriptures.py` from the sources named in that file.

## Also

- **The Seam's almanac works again.** Since 0.89 renamed the daily hues to weathers, every day had fallen back to Quiet Haze, which meant no crop rush and no raids. Each weather now carries its old hue's event.

## Tests

New: `_test/omnism.test.cjs`. It checks:
- famous verses in their own scripts;
- that every edition names its source and licence;
- the hall's walls, door, lecterns and table;
- walking in through the door to a lectern;
- the prompt, and that E opens the right book;
- Arabic beside English;
- the Guide's links, Psalm 23 in English beside the Hebrew, and turning chapters;
- Escape and remembering the reader's place;
- the phone layout.
