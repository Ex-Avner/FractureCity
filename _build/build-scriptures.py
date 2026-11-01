#!/usr/bin/env python3
"""Build the Church of Omnism's scripture library.

Reads the raw public-domain sources (downloaded once into a working folder,
see SOURCES below) and writes compact per-book JSON files the game loads on
demand, plus one index.json that is the whole table of contents.

    python3 _build/build-scriptures.py /path/to/raw

Output: apps/fracture-city-game/scriptures/
  index.json                         every work, edition and book, with verse counts
  <work>/<edition>/<book>.json       {"c": [[verse, verse, ...], ...]}  ("" = no such verse)

Nothing here is fetched at play time from a third party; the files ship with
the game and are served by whatever hosts it.
"""
import json, re, sys, os, glob, html
from pathlib import Path

RAW = Path(sys.argv[1] if len(sys.argv) > 1 else '/root/scrip/raw')
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'apps/fracture-city-game/scriptures'

SOURCES = {
 'bible': 'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/{KJV,DRC,VulgClementine,Byz,WLC,JPS}.json',
 'quran': 'https://raw.githubusercontent.com/fawazahmed0/quran-api/1/editions/{ara-quransimple,eng-mohammedmarmadu}.json',
 'gita': 'https://raw.githubusercontent.com/vedicscriptures/bhagavad-gita-data/main/slok/bhagavadgita_chapter_C_slok_V.json',
 'mormon': 'https://raw.githubusercontent.com/bcbooks/scriptures-json/master/book-of-mormon.json',
 'daodejing': 'https://raw.githubusercontent.com/openbilly/daodejing_json/master/daodejing.json',
 'gutenberg': 'https://raw.githubusercontent.com/GITenberg/<repo>/master/<id>.txt  (2017, 216, 2388, 3283, 3330, 16941, 16983)',
}

def write(work, ed, i, chapters):
    # Trailing empty verses are alignment padding in some sources; drop them.
    ch = []
    for c in chapters:
        c = list(c)
        while c and not c[-1]: c.pop()
        ch.append(c)
    p = OUT / work / ed / f'{i}.json'
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps({'c': ch}, ensure_ascii=False, separators=(',', ':')))
    return ch

def chapters_of(book):
    out = []
    for c in book['chapters']:
        vs = {v['verse']: v['text'].strip() for v in c['verses']}
        n = max(vs) if vs else 0
        out.append([vs.get(k, '') for k in range(1, n + 1)])
    return out

def load_bible(name):
    d = json.loads((RAW / f'{name}.json').read_text())
    return {b['name']: chapters_of(b) for b in d['books']}

def pretty(name):
    return re.sub(r'^(I{1,3}) ', lambda m: str(len(m.group(1))) + ' ', name).replace('Revelation of John', 'Revelation')

WORKS = []

# ── Tanakh ─────────────────────────────────────────────────────────────────
#  Jewish order and Hebrew names; Hebrew (Westminster Leningrad Codex) and the
#  1917 Jewish Publication Society translation, both in Hebrew versification.
TANAKH = [
 ('Torah', [('Genesis','Bereshit','בראשית'),('Exodus','Shemot','שמות'),('Leviticus','Vayikra','ויקרא'),('Numbers','Bamidbar','במדבר'),('Deuteronomy','Devarim','דברים')]),
 ("Nevi'im · Prophets", [('Joshua','Yehoshua','יהושע'),('Judges','Shoftim','שופטים'),('I Samuel','Shmuel I','שמואל א'),('II Samuel','Shmuel II','שמואל ב'),('I Kings','Melakhim I','מלכים א'),('II Kings','Melakhim II','מלכים ב'),('Isaiah','Yeshayahu','ישעיהו'),('Jeremiah','Yirmeyahu','ירמיהו'),('Ezekiel','Yechezkel','יחזקאל'),('Hosea','Hoshea','הושע'),('Joel','Yoel','יואל'),('Amos','Amos','עמוס'),('Obadiah','Ovadyah','עובדיה'),('Jonah','Yonah','יונה'),('Micah','Mikhah','מיכה'),('Nahum','Nachum','נחום'),('Habakkuk','Chavakuk','חבקוק'),('Zephaniah','Tzefanyah','צפניה'),('Haggai','Chaggai','חגי'),('Zechariah','Zekharyah','זכריה'),('Malachi','Malakhi','מלאכי')]),
 ("Ketuvim · Writings", [('Psalms','Tehillim','תהלים'),('Proverbs','Mishlei','משלי'),('Job','Iyov','איוב'),('Song of Solomon','Shir HaShirim','שיר השירים'),('Ruth','Rut','רות'),('Lamentations','Eikhah','איכה'),('Ecclesiastes','Kohelet','קהלת'),('Esther','Ester','אסתר'),('Daniel','Daniel','דניאל'),('Ezra','Ezra','עזרא'),('Nehemiah','Nechemyah','נחמיה'),('I Chronicles','Divrei HaYamim I','דברי הימים א'),('II Chronicles','Divrei HaYamim II','דברי הימים ב')]),
]

def jps_restore(t):
    #  This transcription of the 1917 JPS substitutes HaShem / G-d / L-rd for the
    #  divine names. The printed 1917 edition reads LORD, God and Lord.
    t = re.sub(r'\b([Tt])he HaShem\b', lambda m: m.group(1) + 'he LORD', t)
    t = re.sub(r'\bO HaShem\b', 'O LORD', t)
    t = re.sub(r'(^|[.!?:;]\s+|[\'"‘“(]\s*)HaShem\b', lambda m: m.group(1) + 'The LORD', t)
    t = re.sub(r'\bHaShem\b', 'the LORD', t)
    t = t.replace('G-d', 'God').replace('G-D', 'GOD').replace('L-rd', 'Lord')
    return t

def build_tanakh():
    he, en = load_bible('WLC'), load_bible('JPS')
    books = []; i = 0
    for group, items in TANAKH:
        for eng, translit, heb in items:
            h = write('tanakh', 'he', i, he[eng])
            e = write('tanakh', 'en', i, [[jps_restore(v) for v in c] for c in en[eng]])
            books.append({'n': pretty(eng), 'alt': translit + ' · ' + heb, 'g': group, 'v': [max(len(a), len(b)) for a, b in zip(h, e)]})
            i += 1
    WORKS.append({
     'id': 'tanakh', 'title': 'The Tanakh', 'sub': 'Torah, Prophets and Writings', 'tradition': 'Judaism', 'mark': '✡',
     'blurb': 'The Hebrew Bible: the Torah (the five books of Moses), the Prophets and the Writings, in the Jewish order of books. Read it in the original Hebrew with vowels and cantillation marks, or in the 1917 Jewish Publication Society translation, or both side by side.',
     'aligned': True,
     'editions': [
      {'id': 'he', 'label': 'Hebrew · Westminster Leningrad Codex', 'short': 'עברית', 'lang': 'he', 'dir': 'rtl', 'source': 'Westminster Leningrad Codex, via scrollmapper/bible_databases', 'license': 'Public domain'},
      {'id': 'en', 'label': 'English · JPS 1917', 'short': 'JPS 1917', 'lang': 'en', 'dir': 'ltr', 'source': 'The Holy Scriptures According to the Masoretic Text (Jewish Publication Society, 1917), via scrollmapper/bible_databases; divine names restored to the 1917 printing', 'license': 'Public domain'},
     ],
     'books': books, 'unit': 'Chapter', 'verse': 'Verse'})

# ── The Holy Bible ─────────────────────────────────────────────────────────
DEUTERO = ['Tobit', 'Judith', 'Wisdom', 'Sirach', 'Baruch', 'I Maccabees', 'II Maccabees']
def build_bible():
    kjv, drc, vul, byz = load_bible('KJV'), load_bible('DRC'), load_bible('VulgClementine'), load_bible('Byz')
    order = [n for n in kjv]          # 66 in Protestant order
    ot, nt = order[:39], order[39:]
    plan = [('Old Testament', ot), ('Deuterocanon · Catholic and Orthodox', DEUTERO), ('New Testament', nt)]
    eds = [('kjv', kjv), ('drc', drc), ('la', vul), ('grc', byz)]
    books = []; i = 0
    for group, names in plan:
        for name in names:
            counts = []
            for ed, src in eds:
                ch = src.get(name)
                if ed == 'grc' and group != 'New Testament': ch = None
                if ch and any(any(v for v in c) for c in ch):
                    ch = write('bible', ed, i, ch)
                    for k, c in enumerate(ch):
                        if k >= len(counts): counts.append(0)
                        counts[k] = max(counts[k], len(c))
            have = [ed for ed, src in eds if (OUT / 'bible' / ed / f'{i}.json').exists()]
            books.append({'n': pretty(name), 'g': group, 'v': counts, 'in': have})
            i += 1
    WORKS.append({
     'id': 'bible', 'title': 'The Holy Bible', 'sub': 'Old and New Testaments, with the Deuterocanon', 'tradition': 'Christianity', 'mark': '✝',
     'blurb': 'The Christian scriptures. The King James Version (1769) is the Protestant canon; the Douay-Rheims (Challoner) and the Latin Vulgate add the deuterocanonical books read by Catholic and Orthodox churches; the New Testament is also here in its original Greek, Byzantine Textform. Psalm numbers follow each edition, so the Douay-Rheims and Vulgate psalms run one behind the King James from Psalm 10 to 147.',
     'aligned': True,
     'editions': [
      {'id': 'kjv', 'label': 'English · King James Version', 'short': 'KJV', 'lang': 'en', 'dir': 'ltr', 'source': 'King James Version, 1769 Oxford text, via scrollmapper/bible_databases', 'license': 'Public domain (outside the UK, where Crown letters patent apply)'},
      {'id': 'drc', 'label': 'English · Douay-Rheims (Challoner)', 'short': 'Douay-Rheims', 'lang': 'en', 'dir': 'ltr', 'source': 'Douay-Rheims Bible, Challoner revision (1752), via scrollmapper/bible_databases', 'license': 'Public domain'},
      {'id': 'la', 'label': 'Latin · Clementine Vulgate', 'short': 'Vulgata', 'lang': 'la', 'dir': 'ltr', 'source': 'Biblia Sacra Vulgata, Clementine edition (1592), via scrollmapper/bible_databases', 'license': 'Public domain'},
      {'id': 'grc', 'label': 'Greek · New Testament, Byzantine Textform', 'short': 'Ἑλληνικά', 'lang': 'grc', 'dir': 'ltr', 'source': 'The New Testament in the Original Greek: Byzantine Textform 2013 (Robinson and Pierpont), via scrollmapper/bible_databases', 'license': 'Public domain'},
     ],
     'books': books, 'unit': 'Chapter', 'verse': 'Verse'})

# ── The Qur'an ─────────────────────────────────────────────────────────────
SURAS = """Al-Fatihah|The Opening;Al-Baqarah|The Cow;Al Imran|The Family of Imran;An-Nisa|The Women;Al-Ma'idah|The Table Spread;Al-An'am|The Cattle;Al-A'raf|The Heights;Al-Anfal|The Spoils of War;At-Tawbah|The Repentance;Yunus|Jonah;Hud|Hud;Yusuf|Joseph;Ar-Ra'd|The Thunder;Ibrahim|Abraham;Al-Hijr|The Rocky Tract;An-Nahl|The Bee;Al-Isra|The Night Journey;Al-Kahf|The Cave;Maryam|Mary;Ta-Ha|Ta-Ha;Al-Anbiya|The Prophets;Al-Hajj|The Pilgrimage;Al-Mu'minun|The Believers;An-Nur|The Light;Al-Furqan|The Criterion;Ash-Shu'ara|The Poets;An-Naml|The Ant;Al-Qasas|The Stories;Al-'Ankabut|The Spider;Ar-Rum|The Romans;Luqman|Luqman;As-Sajdah|The Prostration;Al-Ahzab|The Combined Forces;Saba|Sheba;Fatir|Originator;Ya-Sin|Ya-Sin;As-Saffat|Those Who Set the Ranks;Sad|The Letter Sad;Az-Zumar|The Troops;Ghafir|The Forgiver;Fussilat|Explained in Detail;Ash-Shura|The Consultation;Az-Zukhruf|The Ornaments of Gold;Ad-Dukhan|The Smoke;Al-Jathiyah|The Crouching;Al-Ahqaf|The Wind-Curved Sandhills;Muhammad|Muhammad;Al-Fath|The Victory;Al-Hujurat|The Rooms;Qaf|The Letter Qaf;Adh-Dhariyat|The Winnowing Winds;At-Tur|The Mount;An-Najm|The Star;Al-Qamar|The Moon;Ar-Rahman|The Beneficent;Al-Waqi'ah|The Inevitable;Al-Hadid|The Iron;Al-Mujadila|The Pleading Woman;Al-Hashr|The Exile;Al-Mumtahanah|She That Is to Be Examined;As-Saff|The Ranks;Al-Jumu'ah|The Congregation, Friday;Al-Munafiqun|The Hypocrites;At-Taghabun|The Mutual Disillusion;At-Talaq|The Divorce;At-Tahrim|The Prohibition;Al-Mulk|The Sovereignty;Al-Qalam|The Pen;Al-Haqqah|The Reality;Al-Ma'arij|The Ascending Stairways;Nuh|Noah;Al-Jinn|The Jinn;Al-Muzzammil|The Enshrouded One;Al-Muddaththir|The Cloaked One;Al-Qiyamah|The Resurrection;Al-Insan|Man;Al-Mursalat|The Emissaries;An-Naba|The Tidings;An-Nazi'at|Those Who Drag Forth;'Abasa|He Frowned;At-Takwir|The Overthrowing;Al-Infitar|The Cleaving;Al-Mutaffifin|The Defrauding;Al-Inshiqaq|The Sundering;Al-Buruj|The Mansions of the Stars;At-Tariq|The Nightcomer;Al-A'la|The Most High;Al-Ghashiyah|The Overwhelming;Al-Fajr|The Dawn;Al-Balad|The City;Ash-Shams|The Sun;Al-Layl|The Night;Ad-Duha|The Morning Hours;Ash-Sharh|The Relief;At-Tin|The Fig;Al-'Alaq|The Clot;Al-Qadr|The Power;Al-Bayyinah|The Clear Proof;Az-Zalzalah|The Earthquake;Al-'Adiyat|The Courser;Al-Qari'ah|The Calamity;At-Takathur|The Rivalry in World Increase;Al-'Asr|The Declining Day;Al-Humazah|The Traducer;Al-Fil|The Elephant;Quraysh|Quraysh;Al-Ma'un|The Small Kindnesses;Al-Kawthar|The Abundance;Al-Kafirun|The Disbelievers;An-Nasr|The Divine Support;Al-Masad|The Palm Fiber;Al-Ikhlas|The Sincerity;Al-Falaq|The Daybreak;An-Nas|Mankind""".split(';')
def build_quran():
    ar = json.loads((RAW / 'q-ara-quransimple.json').read_text())['quran']
    en = json.loads((RAW / 'q-eng-mohammedmarmadu.json').read_text())['quran']
    assert len(SURAS) == 114
    def by(rows):
        s = {}
        for r in rows: s.setdefault(r['chapter'], {})[r['verse']] = r['text'].strip()
        return s
    A, E = by(ar), by(en)
    books = []
    for k in range(1, 115):
        a = [A[k][v] for v in sorted(A[k])]; e = [E[k][v] for v in sorted(E[k])]
        write('quran', 'ar', k - 1, [a]); write('quran', 'en', k - 1, [e])
        tr, mean = SURAS[k - 1].split('|')
        lo = (k - 1) // 10 * 10 + 1
        books.append({'n': f'{k}. {tr}', 'alt': mean, 'g': f'Surahs {lo}–{min(114, lo + 9)}', 'v': [len(a)]})
    WORKS.append({
     'id': 'quran', 'title': "The Qur'an", 'sub': 'القرآن الكريم', 'tradition': 'Islam', 'mark': '☪',
     'blurb': "The holy book of Islam, 114 surahs. The Arabic is the Tanzil simple text with full vowel marks; the English is Marmaduke Pickthall's The Meaning of the Glorious Koran (1930), the first complete English translation by a Muslim. Muslims hold that only the Arabic is the Qur'an itself; a translation conveys its meaning.",
     'aligned': True, 'single': True,
     'editions': [
      {'id': 'ar', 'label': 'Arabic · Tanzil simple text', 'short': 'العربية', 'lang': 'ar', 'dir': 'rtl', 'source': 'Tanzil Quran Text (Simple, with diacritics), tanzil.net, via fawazahmed0/quran-api. Copyright (C) 2007-2026 Tanzil Project; verbatim copying permitted with this notice.', 'license': 'Tanzil terms: verbatim, attributed'},
      {'id': 'en', 'label': 'English · Pickthall (1930)', 'short': 'Pickthall', 'lang': 'en', 'dir': 'ltr', 'source': 'Marmaduke Pickthall, The Meaning of the Glorious Koran (1930), via Tanzil and fawazahmed0/quran-api', 'license': 'Public domain in the United States'},
     ],
     'books': books, 'unit': 'Surah', 'verse': 'Ayah'})

# ── Gutenberg helpers ──────────────────────────────────────────────────────
def pg(id_):
    t = (RAW / f'pg{id_}.txt').read_text(encoding='utf-8', errors='replace').replace('\r', '')
    a = re.search(r'\*\*\* ?START OF[^\n]*\n', t); b = re.search(r'\*\*\* ?END OF', t)
    return t[a.end() if a else 0: b.start() if b else None]
def paras(block):
    out = []
    for p in re.split(r'\n\s*\n', block):
        p = re.sub(r'[ \t]*\n[ \t]*', ' ', p.strip())
        p = re.sub(r'\s+', ' ', p)
        p = re.sub(r'(^|\s)_+|_+($|[\s.,;:!?])', lambda m: (m.group(1) or '') + (m.group(2) or ''), p)
        if p: out.append(p)
    return out
def verse_lines(block):
    # Poetry: keep line breaks inside a stanza.
    out = []
    for p in re.split(r'\n\s*\n', block):
        lines = [l.strip() for l in p.strip().split('\n') if l.strip()]
        if lines: out.append('\n'.join(lines))
    return out
ROMAN = {v: i for i, v in enumerate('I II III IV V VI VII VIII IX X XI XII XIII XIV XV XVI XVII XVIII XIX XX XXI XXII XXIII XXIV XXV XXVI XXVII XXVIII XXIX XXX'.split(), 1)}

# ── Bhagavad Gita ──────────────────────────────────────────────────────────
GITA = ['The Distress of Arjuna', 'The Book of Doctrines', 'Virtue in Work', 'The Religion of Knowledge', 'Religion of Renouncing Works', 'Religion by Self-Restraint', 'Religion by Discernment', 'Religion by Service of the Supreme', 'Religion by the Kingly Knowledge and the Kingly Mystery', 'Religion by the Heavenly Perfections', 'The Manifesting of the One and Manifold', 'Religion of Faith', 'Religion by Separation of Matter and Spirit', 'Religion by Separation from the Qualities', 'Religion by Attaining the Supreme', 'The Separateness of the Divine and Undivine', 'Religion by the Threefold Faith', 'Religion by Deliverance and Renunciation']
def build_gita():
    sl = {}
    for f in glob.glob(str(RAW / 'gita' / '*.json')):
        d = json.loads(open(f).read()); sl.setdefault(d['chapter'], {})[d['verse']] = d
    t = pg(2388)
    parts = re.split(r'\n\s*CHAPTER ([IVXL]+)\s*\n', t)
    arnold = {}
    for k in range(1, len(parts), 2):
        body = re.split(r'HERE END(?:ETH|S) CHAPTER', parts[k + 1])[0]
        arnold[ROMAN[parts[k]]] = verse_lines(body)
    books = []
    for c in range(1, 19):
        vs = [sl[c][v] for v in sorted(sl[c])]
        sa = [re.sub(r'\|\|[\d\-]+\|\|', '', v['slok']).replace('|', '।').strip() for v in vs]
        tr = [re.sub(r'\s*\|\|[\d\-]+\|\|', '', v['transliteration']).strip() for v in vs]
        write('gita', 'sa', c - 1, [sa]); write('gita', 'iast', c - 1, [tr]); write('gita', 'en', c - 1, [arnold[c]])
        books.append({'n': f'Chapter {c}', 'alt': GITA[c - 1], 'g': 'Bhagavad Gita', 'v': [len(vs)], 've': {'en': [len(arnold[c])]}})
    WORKS.append({
     'id': 'gita', 'title': 'The Bhagavad Gita', 'sub': 'भगवद्गीता · The Song of God', 'tradition': 'Hinduism', 'mark': 'ॐ',
     'blurb': "Seven hundred verses from the Mahabharata: on the eve of battle, Krishna answers the prince Arjuna's despair with a teaching on duty, devotion, knowledge and the self. Read the Sanskrit in Devanagari or in transliteration verse by verse, or Edwin Arnold's verse translation, The Song Celestial (1885), chapter by chapter.",
     'aligned': False, 'single': True,
     'editions': [
      {'id': 'sa', 'label': 'Sanskrit · Devanagari', 'short': 'संस्कृतम्', 'lang': 'sa', 'dir': 'ltr', 'source': 'Sanskrit text via vedicscriptures/bhagavad-gita-data', 'license': 'Public domain text'},
      {'id': 'iast', 'label': 'Sanskrit · transliteration', 'short': 'IAST', 'lang': 'sa-Latn', 'dir': 'ltr', 'source': 'Transliteration via vedicscriptures/bhagavad-gita-data', 'license': 'Public domain text'},
      {'id': 'en', 'label': 'English · Edwin Arnold, The Song Celestial (1885)', 'short': 'Arnold', 'lang': 'en', 'dir': 'ltr', 'source': 'Project Gutenberg #2388', 'license': 'Public domain', 'stanzas': True},
     ],
     'books': books, 'unit': 'Chapter', 'verse': 'Verse'})

# ── The Principal Upanishads (Paramananda) ─────────────────────────────────
def build_upanishads():
    t = pg(3283)
    names = ['Isa-Upanishad', 'Katha-Upanishad', 'Kena-Upanishad']
    books = []
    for i, n in enumerate(names):
        heads = [m for m in re.finditer(r'\n[ \t]{8,}' + n + r'[ \t]*\n', t)]
        start = heads[-1].end()
        end = t.find('Here ends this Upanishad', start)
        ps = [p for p in paras(t[start:end]) if not re.fullmatch(r'(Part \w+|[IVXL]+)\.?', p)]
        write('upanishads', 'en', i, [ps])
        books.append({'n': n.replace('-', ' '), 'g': 'Upanishads', 'v': [len(ps)]})
    WORKS.append({
     'id': 'upanishads', 'title': 'The Upanishads', 'sub': 'Isa, Katha and Kena', 'tradition': 'Hinduism', 'mark': 'ॐ',
     'blurb': 'The philosophical close of the Vedas: the teaching that the self within, Atman, is one with Brahman, the ground of all being. Three principal Upanishads in Swami Paramananda\'s translation with his commentary (1919).',
     'aligned': False, 'single': True,
     'editions': [{'id': 'en', 'label': 'English · Swami Paramananda (1919)', 'short': 'Paramananda', 'lang': 'en', 'dir': 'ltr', 'source': 'Project Gutenberg #3283', 'license': 'Public domain'}],
     'books': books, 'unit': 'Upanishad', 'verse': 'Passage'})

# ── Dhammapada (Müller) ────────────────────────────────────────────────────
def build_dhammapada():
    t = pg(2017)
    body = t[t.rfind('Chapter I. The Twin-Verses'):]
    parts = re.split(r'\n\s*Chapter ([IVXL]+)\.? ?([^\n]*)\n', '\n' + body)
    books = []
    for k in range(1, len(parts), 3):
        num, title, text = ROMAN[parts[k]], parts[k + 1].strip().rstrip('.'), parts[k + 2]
        found = {}
        for m in re.finditer(r'(?ms)^\s*(\d+(?:,\s*\d+)*)\.\s+(.*?)(?=^\s*\d+(?:,\s*\d+)*\.\s+|\Z)', text):
            nums = [int(x) for x in re.findall(r'\d+', m.group(1))]
            v = re.sub(r'\s+', ' ', m.group(2)).strip()
            found[nums[0]] = v
            for extra in nums[1:]: found[extra] = ''
        first, last = min(found), max(found)
        vs = [(n, found.get(n, '')) for n in range(first, last + 1)]
        write('dhammapada', 'en', num - 1, [[v for _, v in vs]])
        books.append({'n': f'Chapter {num}', 'alt': title, 'g': 'Dhammapada', 'v': [len(vs)], 'start': first})
    WORKS.append({
     'id': 'dhammapada', 'title': 'The Dhammapada', 'sub': 'The Path of the Dhamma', 'tradition': 'Buddhism', 'mark': '☸',
     'blurb': 'Four hundred and twenty-three verses attributed to the Buddha, the most widely read text of the Pali Canon: on the mind, on craving and its ending, on the path. Translated by F. Max Müller (1881).',
     'aligned': False, 'single': True,
     'editions': [{'id': 'en', 'label': 'English · F. Max Müller (1881)', 'short': 'Müller', 'lang': 'en', 'dir': 'ltr', 'source': 'Project Gutenberg #2017', 'license': 'Public domain'}],
     'books': books, 'unit': 'Chapter', 'verse': 'Verse'})

# ── Tao Te Ching ───────────────────────────────────────────────────────────
def build_tao():
    t = pg(216)
    t = t[t.find('PART 1.'):]
    starts = {}
    for n in range(1, 82):
        m = re.compile(r'(?m)^(?:Ch\. )?' + str(n) + r'\.(?: |[ \t]*\n\s*)(?=1\.)').search(t)
        if m: starts[n] = m.start()
    for n in range(1, 82):
        if n in starts: continue
        lo = max([v for k, v in starts.items() if k < n] or [0])
        hi = min([v for k, v in starts.items() if k > n] or [len(t)])
        m = re.compile(r'(?m)^(?:Ch\. )?' + str(n) + r'\.(?: (?!\d)|[ \t]*\n)').search(t, lo + 1, hi)
        if m: starts[n] = m.start()
    legge = {}
    keys = sorted(starts)
    for j, n in enumerate(keys):
        body = t[starts[n]:starts[keys[j + 1]] if j + 1 < len(keys) else len(t)]
        body = re.sub(r'^(?:Ch\. )?\d+\.\s*', '', body)
        body = re.split(r'\n\s*PART I+\.', body)[0]
        legge[n] = [re.sub(r'^\d+\.\s*', '', p) for p in paras(body) if p.strip() and not re.fullmatch(r'\d+\.', p.strip())]
    zh = json.loads((RAW / 'ddj.json').read_text())[0]['paragraphs']
    zh = [re.sub(r'`[^`]*`', '', p) for p in zh]
    books = []
    for n in range(1, 82):
        write('tao', 'zh', n - 1, [[zh[n - 1]]]); write('tao', 'en', n - 1, [legge.get(n, [])])
        books.append({'n': f'Chapter {n}', 'g': 'Part I · Tao' if n <= 37 else 'Part II · Te', 'v': [1], 've': {'en': [len(legge.get(n, []))]}})
    WORKS.append({
     'id': 'tao', 'title': 'The Tao Te Ching', 'sub': '道德經 · The Way and Its Virtue', 'tradition': 'Taoism', 'mark': '☯',
     'blurb': "Eighty-one short chapters attributed to Laozi: on the Tao, the way that cannot be named, and on yielding, simplicity and action without force. The Chinese is the Wang Bi recension; the English is James Legge's translation (1891).",
     'aligned': False, 'single': True,
     'editions': [
      {'id': 'zh', 'label': 'Chinese · Wang Bi text', 'short': '中文', 'lang': 'zh-Hant', 'dir': 'ltr', 'source': 'Wang Bi recension (Zhengtong Daozang), via openbilly/daodejing_json', 'license': 'Public domain text'},
      {'id': 'en', 'label': 'English · James Legge (1891)', 'short': 'Legge', 'lang': 'en', 'dir': 'ltr', 'source': 'Project Gutenberg #216', 'license': 'Public domain'},
     ],
     'books': books, 'unit': 'Chapter', 'verse': 'Passage'})

# ── Analects (Legge) ───────────────────────────────────────────────────────
def build_analects():
    t = pg(3330)
    t = t[t.find('BOOK I.'):]
    end = t.find('THE GREAT LEARNING')
    if end > 0: t = t[:end]
    parts = re.split(r'\n\s*BOOK ([IVXL]+)\.\s*([^\n]*)\n', '\n' + t)
    books = []
    for k in range(1, len(parts), 3):
        num, title, body = ROMAN[parts[k]], parts[k + 1].strip().rstrip('.'), parts[k + 2]
        chs = re.split(r'\n?\s*(?:CHAPTER|CHAP\.) [IVXL]+\.\s*', '\n' + body)
        vs = [re.sub(r'\s+', ' ', c).strip() for c in chs if c.strip()]
        write('analects', 'en', num - 1, [vs])
        books.append({'n': f'Book {num}', 'alt': title.title(), 'g': 'Analects', 'v': [len(vs)]})
    WORKS.append({
     'id': 'analects', 'title': 'The Analects', 'sub': '論語 · Sayings of Confucius', 'tradition': 'Confucianism', 'mark': '儒',
     'blurb': 'The sayings and conversations of Confucius, gathered by his followers: on learning, ritual, humaneness (ren), family and the conduct of a good ruler. Twenty books in James Legge\'s translation.',
     'aligned': False, 'single': True,
     'editions': [{'id': 'en', 'label': 'English · James Legge', 'short': 'Legge', 'lang': 'en', 'dir': 'ltr', 'source': 'Project Gutenberg #3330', 'license': 'Public domain'}],
     'books': books, 'unit': 'Book', 'verse': 'Chapter'})

# ── Book of Mormon ─────────────────────────────────────────────────────────
def build_mormon():
    d = json.loads((RAW / 'book-of-mormon.json').read_text())
    books = []
    for i, b in enumerate(d['books']):
        ch = [[v['text'].strip() for v in c['verses']] for c in b['chapters']]
        write('mormon', 'en', i, ch)
        books.append({'n': b['book'], 'g': 'Book of Mormon', 'v': [len(c) for c in ch]})
    WORKS.append({
     'id': 'mormon', 'title': 'The Book of Mormon', 'sub': 'Another Testament of Jesus Christ', 'tradition': 'Latter-day Saints', 'mark': '✦',
     'blurb': 'Scripture of the Latter-day Saint movement, first published by Joseph Smith in 1830: an account of peoples of the ancient Americas and of Christ\'s visit to them. Fifteen books, verse by verse.',
     'aligned': False, 'single': True,
     'editions': [{'id': 'en', 'label': 'English · scripture text', 'short': 'English', 'lang': 'en', 'dir': 'ltr', 'source': 'Verse text via bcbooks/scriptures-json (chapter headings omitted)', 'license': 'Public domain text'}],
     'books': books, 'unit': 'Chapter', 'verse': 'Verse'})

# ── Bahá'í writings ────────────────────────────────────────────────────────
def build_bahai():
    hw = pg(16941)
    a = hw.find('PART I.--FROM THE ARABIC'); p = hw.find('PART II--FROM THE PERSIAN')
    def hidden(block):
        items = re.split(r'\n\s*"\d+:[^"]*"\s*\n', block)
        head, rest = items[0], items[1:]
        rest = [re.sub(r'\s+', ' ', x).strip() for x in rest]
        return [re.sub(r'\s+', ' ', x).strip() for x in paras(head) if x not in ('Preamble',)], [x for x in rest if x]
    pre, arabic = hidden(hw[a:p].split('\n', 1)[1])
    _, persian = hidden(hw[p:].split('\n', 1)[1])
    iq = pg(16983)
    s1 = iq.find('IN THE NAME OF OUR LORD'); m1 = iq.find('END OF PART ONE'); s2 = iq.find('PART TWO', m1); e = iq.rfind('FOOTNOTES')
    one = paras(iq[s1:m1]); two = [x for x in paras(iq[s2 + 8:e]) if x != 'END']
    write('bahai', 'en', 0, [pre, arabic, persian]); write('bahai', 'en', 1, [one, two])
    WORKS.append({
     'id': 'bahai', 'title': "Writings of Bahá'u'lláh", 'sub': 'The Hidden Words · The Kitáb-i-Íqán', 'tradition': "Bahá'í Faith", 'mark': '✶',
     'blurb': "Two works by Bahá'u'lláh, founder of the Bahá'í Faith, which teaches the oneness of God, of religion and of humanity. The Hidden Words are short counsels, from the Arabic and from the Persian; the Kitáb-i-Íqán, the Book of Certitude, reads the scriptures of earlier faiths as one unfolding revelation.",
     'aligned': False, 'single': True,
     'editions': [{'id': 'en', 'label': 'English · Shoghi Effendi', 'short': 'English', 'lang': 'en', 'dir': 'ltr', 'source': "Project Gutenberg #16941 and #16983, from the Bahá'í Reference Library. Copyright Bahá'í International Community; reproduced unaltered for non-commercial use under its terms.", 'license': "Bahá'í International Community terms: unaltered, attributed, non-commercial"}],
     'books': [
      {'n': 'The Hidden Words', 'g': "Bahá'u'lláh", 'v': [len(pre), len(arabic), len(persian)], 'parts': ['Preamble', 'From the Arabic', 'From the Persian']},
      {'n': 'The Kitáb-i-Íqán', 'alt': 'The Book of Certitude', 'g': "Bahá'u'lláh", 'v': [len(one), len(two)], 'parts': ['Part One', 'Part Two']}],
     'unit': 'Part', 'verse': 'Paragraph'})

if __name__ == '__main__':
    import shutil
    if OUT.exists(): shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    for f in [build_tanakh, build_bible, build_quran, build_gita, build_upanishads, build_dhammapada, build_tao, build_analects, build_mormon, build_bahai]:
        f(); w = WORKS[-1]
        print(f"{w['id']:12} {len(w['books']):3} books  {sum(sum(b['v']) for b in w['books']):6} units")
    index = {'v': 1, 'name': 'The Library of the Church of Omnism', 'works': WORKS,
             'missing': ['Sri Guru Granth Sahib (Sikhism)', 'The Avesta (Zoroastrianism)', 'The Agamas (Jainism)', 'The Kojiki (Shinto)']}
    (OUT / 'index.json').write_text(json.dumps(index, ensure_ascii=False, separators=(',', ':')))
    total = sum(p.stat().st_size for p in OUT.rglob('*.json'))
    print('files', len(list(OUT.rglob('*.json'))), 'bytes', total)
