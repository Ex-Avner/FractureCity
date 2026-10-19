// Builds the Reading Wall's starter shelf from Project Gutenberg plain-text
// files: node _build/build-classics.cjs <folder of <id>.txt files>
// Writes apps/fracture-city-game/classics/<id>.json and shelf.json. Each file
// is checked against the title it should be, so a wrong number never ships.
'use strict';
const fs = require('node:fs'), path = require('node:path'), { parse } = require('../server/classics-text.cjs');
const SHELVES = [
 ['Novels', [[1342, 'pride and prejudice', 'Pride and Prejudice', 'Jane Austen'], [98, 'tale of two cities', 'A Tale of Two Cities', 'Charles Dickens'], [1400, 'great expectations', 'Great Expectations', 'Charles Dickens'], [1260, 'jane eyre', 'Jane Eyre', 'Charlotte Brontë'], [768, 'wuthering heights', 'Wuthering Heights', 'Emily Brontë'], [158, 'emma', 'Emma', 'Jane Austen'], [64317, 'great gatsby', 'The Great Gatsby', 'F. Scott Fitzgerald'], [76, 'huckleberry finn', 'Adventures of Huckleberry Finn', 'Mark Twain'], [33, 'scarlet letter', 'The Scarlet Letter', 'Nathaniel Hawthorne'], [2554, 'crime and punishment', 'Crime and Punishment', 'Fyodor Dostoyevsky'], [4300, 'ulysses', 'Ulysses', 'James Joyce'], [113, 'secret garden', 'The Secret Garden', 'Frances Hodgson Burnett']]],
 ['Gothic and strange', [[84, 'frankenstein', 'Frankenstein', 'Mary Wollstonecraft Shelley'], [345, 'dracula', 'Dracula', 'Bram Stoker'], [174, 'dorian gray', 'The Picture of Dorian Gray', 'Oscar Wilde'], [43, 'jekyll', 'The Strange Case of Dr. Jekyll and Mr. Hyde', 'Robert Louis Stevenson'], [7849, 'trial', 'The Trial', 'Franz Kafka'], [1952, 'yellow wallpaper', 'The Yellow Wallpaper', 'Charlotte Perkins Gilman'], [2852, 'baskervilles', 'The Hound of the Baskervilles', 'Arthur Conan Doyle']]],
 ['Adventure and wonder', [[2701, 'moby', 'Moby Dick', 'Herman Melville'], [11, 'alice', "Alice's Adventures in Wonderland", 'Lewis Carroll'], [1661, 'sherlock holmes', 'The Adventures of Sherlock Holmes', 'Arthur Conan Doyle'], [120, 'treasure island', 'Treasure Island', 'Robert Louis Stevenson'], [35, 'time machine', 'The Time Machine', 'H. G. Wells'], [36, 'war of the worlds', 'The War of the Worlds', 'H. G. Wells'], [215, 'call of the wild', 'The Call of the Wild', 'Jack London'], [829, 'gulliver', "Gulliver's Travels", 'Jonathan Swift'], [55, 'wizard of oz', 'The Wonderful Wizard of Oz', 'L. Frank Baum'], [16, 'peter pan', 'Peter Pan', 'J. M. Barrie'], [219, 'heart of darkness', 'Heart of Darkness', 'Joseph Conrad']]],
 ['Philosophy and ideas', [[1232, 'prince', 'The Prince', 'Niccolò Machiavelli'], [132, 'art of war', 'The Art of War', 'Sunzi'], [2680, 'meditations', 'Meditations', 'Marcus Aurelius'], [1497, 'republic', 'The Republic', 'Plato'], [4363, 'beyond good and evil', 'Beyond Good and Evil', 'Friedrich Nietzsche'], [1998, 'zarathustra', 'Thus Spake Zarathustra', 'Friedrich Nietzsche'], [205, 'walden', 'Walden', 'Henry David Thoreau'], [2500, 'siddhartha', 'Siddhartha', 'Hermann Hesse'], [19942, 'candide', 'Candide', 'Voltaire'], [600, 'underground', 'Notes from the Underground', 'Fyodor Dostoyevsky'], [23, 'frederick douglass', 'Narrative of the Life of Frederick Douglass', 'Frederick Douglass'], [408, 'souls of black folk', 'The Souls of Black Folk', 'W. E. B. Du Bois']]],
 ['Poetry and plays', [[1322, 'leaves of grass', 'Leaves of Grass', 'Walt Whitman'], [1524, 'hamlet', 'Hamlet', 'William Shakespeare'], [1533, 'macbeth', 'Macbeth', 'William Shakespeare'], [844, 'importance of being earnest', 'The Importance of Being Earnest', 'Oscar Wilde'], [1001, 'divine comedy', 'The Divine Comedy: Inferno', 'Dante Alighieri'], [1727, 'odyssey', 'The Odyssey', 'Homer'], [1065, 'raven', 'The Raven', 'Edgar Allan Poe']]],
];
//  Too large to bundle; the wall lists them and the server fetches them online.
const GIANTS = [[2600, 'War and Peace', 'Leo Tolstoy'], [1399, 'Anna Karenina', 'Leo Tolstoy'], [1184, 'The Count of Monte Cristo', 'Alexandre Dumas'], [135, 'Les Misérables', 'Victor Hugo'], [996, 'Don Quixote', 'Miguel de Cervantes Saavedra'], [28054, 'The Brothers Karamazov', 'Fyodor Dostoyevsky'], [145, 'Middlemarch', 'George Eliot'], [100, 'The Complete Works of William Shakespeare', 'William Shakespeare']];
if (require.main === module){
 const src = process.argv[2], out = path.join(__dirname, '..', 'apps', 'fracture-city-game', 'classics');
 if (!src) { console.error('usage: node _build/build-classics.cjs <raw folder>'); process.exit(2); }
 fs.mkdirSync(out, { recursive: true });
 const shelves = [], problems = [];
 for (const [name, list] of SHELVES){
  const books = [];
  for (const [id, expect, title, author] of list){
   const f = path.join(src, id + '.txt');
   if (!fs.existsSync(f)){ problems.push(id + ' missing'); continue; }
   const raw = fs.readFileSync(f, 'utf8'), b = parse(raw, id);
   //  Gutenberg marks the few texts still under copyright. Those never ship.
   if (/COPYRIGHTED Project Gutenberg/i.test(raw.slice(0, 3000))){ problems.push(id + ' is marked copyrighted; skipped'); continue; }
   //  Mirror files often have no header; the title must still be in the text.
   const flat = s => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ');
   if (!flat((b.title || '') + ' ' + raw.slice(0, 40000)).includes(flat(expect).trim())){ problems.push(id + ' does not look like ' + expect); continue; }
   b.title = title; b.author = author;
   if (b.chapters.length < 1 || b.words < 1000){ problems.push(id + ' too short'); continue; }
   fs.writeFileSync(path.join(out, id + '.json'), JSON.stringify(b));
   books.push({ id, title: b.title, author: b.author, words: b.words, chapters: b.chapters.length });
  }
  shelves.push({ name, books });
 }
 const giants = GIANTS.map(([id, title, author]) => ({ id, title, author, online: true }));
 fs.writeFileSync(path.join(out, 'shelf.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), shelves, giants }, null, 1));
 const n = shelves.reduce((s, x) => s + x.books.length, 0);
 console.log('shelf:', n, 'books');
 if (problems.length){ console.log('problems:\n ' + problems.join('\n ')); }
}
module.exports = { SHELVES, GIANTS };
