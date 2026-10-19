'use strict';
// The Reading Wall's library: the whole Project Gutenberg catalogue, searched
// here, and books fetched on demand and cached on disk.
//
// Gutenberg's own rules shape this. The website is for people, so machines use
// the machine-readable catalogue file (refreshed weekly at most) and the
// mirrors for texts, one book at a time, each book fetched once and kept.
// Books bundled with the game (the starter shelf) are served from disk and
// never fetched.
const fs = require('node:fs'), path = require('node:path');
const { parse } = require('./classics-text.cjs');

const CATALOG_URL = 'https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv';
const UA = 'FractureCity/0.68 (Reading Wall; +https://github.com/Ex-Avner/FractureCity)';
const WEEK = 7 * 864e5, MAX_RAW = 15e6, CACHE_CAP = 150e6;

function mirrorUrls(id){
 const s = String(id), p = s.length === 1 ? '0/' + s : s.slice(0, -1).split('').join('/') + '/' + s;
 return [
  'https://gutenberg.pglaf.org/' + p + '/' + s + '-0.txt',
  'https://gutenberg.pglaf.org/' + p + '/' + s + '.txt',
  'https://aleph.gutenberg.org/' + p + '/' + s + '-0.txt',
  'https://www.gutenberg.org/cache/epub/' + s + '/pg' + s + '.txt',
 ];
}

//  RFC 4180 CSV, fields may hold quotes, commas and newlines.
function parseCsv(text){
 const rows = []; let row = [], f = '', q = false;
 for (let i = 0; i < text.length; i++){
  const c = text[i];
  if (q){ if (c === '"'){ if (text[i + 1] === '"'){ f += '"'; i++; } else q = false; } else f += c; continue; }
  if (c === '"') q = true;
  else if (c === ','){ row.push(f); f = ''; }
  else if (c === '\n'){ row.push(f); rows.push(row); row = []; f = ''; }
  else if (c !== '\r') f += c;
 }
 if (f || row.length){ row.push(f); rows.push(row); }
 return rows;
}
//  "Austen, Jane, 1775-1817; Shelley, Mary" → "Jane Austen, Mary Shelley"
function authors(s){
 return String(s || '').split(';').map(a => {
  const parts = a.replace(/\[[^\]]*\]/g, '').split(',').map(x => x.trim()).filter(x => x && !/^\d|^-?\d{1,4}\??-|BCE|CE$|^fl\.|^active/i.test(x));
  return parts.length >= 2 ? parts[1] + ' ' + parts[0] : parts[0] || '';
 }).filter(Boolean).join(', ');
}
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

function createClassics(opts = {}){
 const dir = opts.dir, now = opts.now || Date.now, fetcher = opts.fetcher || ((u, o) => fetch(u, o));
 const shelfDir = opts.shelfDir;
 const books = path.join(dir, 'books');
 fs.mkdirSync(books, { recursive: true });
 let catalog = null, loading = null, catalogAt = 0, catalogError = '';
 const inflight = new Map(), failed = new Map();
 let active = 0; const queue = [];
 const slot = () => new Promise(r => { if (active < 2){ active++; r(); } else queue.push(r); });
 const release = () => { const n = queue.shift(); if (n) n(); else active--; };

 async function get(url, limit){
  const r = await fetcher(url, { headers: { 'User-Agent': UA, Accept: 'text/plain, text/csv' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw Object.assign(new Error('status ' + r.status), { status: r.status });
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > limit) throw new Error('too large');
  return buf;
 }
 function decode(buf){ try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e){ return buf.toString('latin1'); } }

 function ingest(text){
  const rows = parseCsv(text), head = rows.shift() || [];
  const ix = k => head.findIndex(h => h.trim().toLowerCase() === k);
  const I = { id: ix('text#'), type: ix('type'), title: ix('title'), lang: ix('language'), auth: ix('authors'), subj: ix('subjects'), shelf: ix('bookshelves') };
  if (I.id < 0 || I.title < 0) throw new Error('catalogue format changed');
  const out = [];
  for (const r of rows){
   if (I.type >= 0 && r[I.type] !== 'Text') continue;
   const id = Number(r[I.id]); if (!id) continue;
   const title = String(r[I.title] || '').replace(/\s+/g, ' ').trim(); if (!title) continue;
   const author = authors(r[I.auth]);
   out.push({ id, title, author, language: String(r[I.lang] || 'en').split(';')[0].trim(), key: norm(title), akey: norm(author), skey: norm((r[I.subj] || '') + ' ' + (r[I.shelf] || '')) });
  }
  return out;
 }
 async function loadCatalog(){
  if (catalog && now() - catalogAt < WEEK) return catalog;
  if (loading) return loading;
  loading = (async () => {
   const file = path.join(dir, 'pg_catalog.csv');
   try {
    const st = fs.existsSync(file) && fs.statSync(file);
    let text;
    if (st && now() - st.mtimeMs < WEEK) text = fs.readFileSync(file, 'utf8');
    else {
     try { text = decode(await get(CATALOG_URL, 80e6)); fs.writeFileSync(file, text); }
     catch (e){ if (st) text = fs.readFileSync(file, 'utf8'); else throw e; }
    }
    catalog = ingest(text); catalogAt = now(); catalogError = '';
   } catch (e){ catalogError = 'The full library could not be reached. The starter shelf still works.'; if (!catalog) catalog = null; }
   finally { loading = null; }
   return catalog;
  })();
  return loading;
 }

 async function search(q, lang = 'en', limit = 30){
  const cat = await loadCatalog();
  if (!cat) return { ready: false, error: catalogError, results: [], total: 0 };
  const terms = norm(q).split(' ').filter(t => t.length > 1).slice(0, 8);
  if (!terms.length) return { ready: true, results: [], total: cat.length };
  const scored = [];
  const phrase = terms.join(' ');
  for (const b of cat){
   if (lang && lang !== 'any' && b.language !== lang) continue;
   let s = 0, all = true;
   for (const t of terms){
    const inT = b.key.includes(t), inA = b.akey.includes(t), inS = b.skey.includes(t);
    if (!inT && !inA && !inS){ all = false; break; }
    s += inT ? 3 : inA ? 2 : 0.5;
   }
   if (!all) continue;
   if (b.key === phrase) s += 12; else if (b.key.startsWith(phrase)) s += 6; else if (b.key.includes(phrase)) s += 3;
   if (b.akey.includes(phrase)) s += 4;
   //  Older catalogue numbers are, overwhelmingly, the famous books.
   s += Math.max(0, 2 - Math.log10(b.id) / 2.5);
   scored.push([s, b]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].id - b[1].id);
  return { ready: true, total: scored.length, results: scored.slice(0, limit).map(([, b]) => ({ id: b.id, title: b.title, author: b.author, language: b.language })) };
 }

 function trim(){
  try {
   const files = fs.readdirSync(books).map(f => { const p = path.join(books, f), s = fs.statSync(p); return { p, size: s.size, t: s.mtimeMs }; }).sort((a, b) => a.t - b.t);
   let total = files.reduce((n, f) => n + f.size, 0);
   for (const f of files){ if (total <= CACHE_CAP) break; fs.unlinkSync(f.p); total -= f.size; }
  } catch (e){}
 }
 async function book(id){
  id = Number(id);
  if (!Number.isInteger(id) || id < 1 || id > 999999) throw Object.assign(new Error('No such book.'), { status: 404 });
  if (shelfDir){ const p = path.join(shelfDir, id + '.json'); if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8')); }
  const file = path.join(books, id + '.json');
  if (fs.existsSync(file)){ const t = new Date(); try { fs.utimesSync(file, t, t); } catch (e){} return JSON.parse(fs.readFileSync(file, 'utf8')); }
  const f = failed.get(id); if (f && now() - f < 600000) throw Object.assign(new Error('That book could not be fetched just now. Try again in a few minutes.'), { status: 502 });
  if (inflight.has(id)) return inflight.get(id);
  const job = (async () => {
   await slot();
   try {
    let raw = null, last;
    for (const url of mirrorUrls(id)){ try { raw = decode(await get(url, MAX_RAW)); break; } catch (e){ last = e; if (e.message === 'too large') break; } }
    if (!raw) throw last || new Error('unavailable');
    //  A handful of Gutenberg texts are still under copyright and say so up top.
    if (/COPYRIGHTED Project Gutenberg/i.test(raw.slice(0, 3000))) throw new Error('copyrighted');
    const b = parse(raw, id);
    if (!b.chapters.length || b.words < 200) throw new Error('empty');
    //  Mirror files often carry no header; the catalogue knows the title and author.
    const c = catalog && catalog.find(x => x.id === id);
    if (!b.title) b.title = c ? c.title : 'Book ' + id;
    if (!b.author || b.author === 'Anonymous') b.author = c?.author || b.author || '';
    fs.writeFileSync(file, JSON.stringify(b)); trim();
    return b;
   } catch (e){ failed.set(id, now()); throw Object.assign(new Error(e.message === 'copyrighted' ? 'That edition is still under copyright, so the wall cannot show it.' : e.message === 'too large' ? 'That book is too large for the reading wall.' : 'That book could not be fetched just now. Try again in a few minutes.'), { status: 502 }); }
   finally { release(); inflight.delete(id); }
  })();
  inflight.set(id, job);
  return job;
 }
 return { search, book, loadCatalog, mirrorUrls, get status(){ return { catalog: catalog ? catalog.length : 0, error: catalogError }; } };
}
module.exports = { createClassics, parseCsv, authors, mirrorUrls };
