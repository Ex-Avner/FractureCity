'use strict';
// Turns a Project Gutenberg plain-text file into a readable book: the
// licence header and footer removed, metadata read from the header, wrapped
// lines joined into paragraphs, and the text divided into chapters.
// Used by the server (books fetched on demand) and by the build script that
// makes the bundled starter shelf, so both read the same.

const START = /^\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG E-?BOOK[^\n]*$/im;
const END = /^\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG E-?BOOK[^\n]*$/im;
const HEADING = /^(?:(?:CHAPTER|Chapter|BOOK|Book|PART|Part|ACT|Act|SCENE|Scene|STAVE|Stave|LETTER|Letter|CANTO|Canto|SECTION|Section|VOLUME|Volume)\b[\s.:]*[A-Za-z0-9IVXLCDM.,'’ -]{0,60}|[IVXLC]{1,8}\.?|[IVXLC]{1,8}\.\s+[A-Z][^\n]{0,60}|\d{1,3}\.?)$/;
const MAX_CHAPTER_WORDS = 9000;

function meta(head, key){
 const m = head.match(new RegExp('^' + key + ':\\s*(.+(?:\\n[ \\t]+.+)*)', 'im'));
 return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

//  Split the file at the Project Gutenberg markers. Files without markers are
//  used whole.
function strip(raw){
 const text = String(raw).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
 const s = text.match(START), e = text.match(END);
 const head = s ? text.slice(0, s.index) : text.slice(0, 3000);
 let body = s ? text.slice(s.index + s[0].length) : text;
 if (e){ const at = body.search(END); if (at >= 0) body = body.slice(0, at); }
 //  Production credits sometimes sit just inside the start marker.
 body = body.replace(/^\s*(?:Produced by|E-?text prepared by|Transcribed (?:from|by))[^\n]*(?:\n[^\n]+)*\n/i, '');
 return { head, body };
}

function paragraphs(block){
 return block.split(/\n[ \t]*\n+/).map(p => {
  const lines = p.split('\n');
  //  Verse and tables keep their line breaks; prose is joined.
  const verse = lines.length > 1 && lines.every(l => l.length < 62) && lines.filter(l => /^\s{2,}/.test(l)).length >= lines.length / 2;
  const t = verse ? lines.map(l => l.trim()).join('\n') : lines.map(l => l.trim()).join(' ');
  return t.replace(/\[Illustration[^\]]*\]/gi, '').replace(/^\[Illustration[^\]]*$/i, '').replace(/^([^\[\]]{0,70})\]$/, '$1').replace(/[ \t]+/g, ' ').replace(/_([^_\n]+)_/g, '$1').trim();
 }).filter(p => p && !/^[*\s.]+$/.test(p));
}

const words = s => (s.match(/\S+/g) || []).length;

function chapters(body){
 const paras = paragraphs(body);
 const out = [];
 let cur = { title: '', paras: [] };
 //  A heading is a short paragraph matching the pattern. Contents lists are a
 //  run of headings with nothing between them; those collapse away.
 for (const p of paras){
  if (p.length < 70 && !p.includes('\n') && HEADING.test(p.replace(/\s+/g, ' '))){
   const h = p.replace(/\s+/g, ' ');
   //  "ACT I" then "SCENE I": one title. Other empty headings (contents lists) are dropped.
   if (!cur.paras.length && /^(ACT|Act|BOOK|Book|PART|Part|VOLUME|Volume)\b/.test(cur.title) && cur.title.length < 40){ cur.title += ' · ' + h; continue; }
   if (cur.paras.length) out.push(cur);
   cur = { title: h, paras: [] };
   continue;
  }
  if (!cur.paras.length && cur.title && p.length < 90 && !/[.!?,;]$/.test(p) && !/\n/.test(p) && cur.title.length < 40) { cur.title += ': ' + p; continue; }
  cur.paras.push(p);
 }
 if (cur.paras.length) out.push(cur);
 //  Contents lists: paragraphs that are runs of headings, and chapters that hold
 //  only a few words of them, are not part of the text.
 const tocish = p => p.length < 600 && (p.match(/\b(?:CHAPTER|Chapter|SCENE|Scene|BOOK|Book|LETTER|Letter|PART|Part)\b/g) || []).length >= 2;
 for (const c of out) c.paras = c.paras.filter(p => !tocish(p));
 let list = out.filter(c => c.paras.length && (c.paras.reduce((n, p) => n + words(p), 0) >= 40 || c === out[out.length - 1]));
 //  A heading that appears again later was a contents entry: what follows it
 //  is front matter, not that chapter.
 const key = t => t.toLowerCase().replace(/[^a-z0-9]/g, '');
 for (let i = 0; i < list.length; i++) if (list[i].title && list.slice(i + 1).some(c => key(c.title) === key(list[i].title))) list[i].title = '';
 const merged = [];
 for (const c of list){ const prev = merged[merged.length - 1]; if (prev && !prev.title && !c.title) prev.paras.push(...c.paras); else merged.push(c); }
 list = merged;
 //  Too few headings found: cut the text into even parts instead.
 if (list.length < 3){
  list = [];
  let part = { title: '', paras: [] }, n = 0;
  for (const p of paras){ part.paras.push(p); n += words(p); if (n > 5000){ list.push(part); part = { title: '', paras: [] }; n = 0; } }
  if (part.paras.length) list.push(part);
 }
 //  Very long chapters are split so a page never has to hold a whole book.
 const final = [];
 for (const c of list){
  let n = 0, piece = { title: c.title, paras: [] }, k = 1;
  for (const p of c.paras){
   piece.paras.push(p); n += words(p);
   if (n > MAX_CHAPTER_WORDS){ final.push(piece); k++; piece = { title: (c.title || 'Part') + ' (' + k + ')', paras: [] }; n = 0; }
  }
  if (piece.paras.length) final.push(piece);
 }
 const titled = final.some(c => c.title);
 return final.map((c, i) => ({ title: c.title || (titled && i === 0 ? 'Opening' : final.length > 1 ? 'Part ' + (i + 1) : 'Text'), paras: c.paras }));
}

function parse(raw, id){
 const { head, body } = strip(raw);
 const ch = chapters(body);
 const total = ch.reduce((n, c) => n + c.paras.reduce((m, p) => m + words(p), 0), 0);
 return {
  id: Number(id) || null,
  title: meta(head, 'Title'),
  author: meta(head, 'Author') || meta(head, 'Editor') || 'Anonymous',
  translator: meta(head, 'Translator'),
  language: meta(head, 'Language') || 'English',
  source: id ? 'https://www.gutenberg.org/ebooks/' + Number(id) : '',
  rights: 'Public domain in the USA.',
  words: total,
  chapters: ch,
 };
}

//  A passage for the reading wall: a single prose paragraph of a readable
//  length, chosen by a seed so everyone sees the same one on the same day.
function passage(book, seed){
 const pool = [];
 for (const c of book.chapters || []) for (const p of c.paras){
  if (p.length < 120 || p.length > 360 || p.includes('\n') || /^[“"'‘]/.test(p) && /[”"'’]$/.test(p) && p.length < 160) continue;
  if (/\bCHAPTER\b/.test(p) || /gutenberg|copyright|illustration/i.test(p) || /[\[\]{}|]/.test(p) || !/[.!?][”’"']?$/.test(p) || !/^[“"'‘A-Z]/.test(p)) continue;
  pool.push({ text: p, chapter: c.title });
 }
 if (!pool.length) return null;
 return pool[(seed >>> 0) % pool.length];
}

module.exports = { parse, strip, chapters, paragraphs, passage, words };
