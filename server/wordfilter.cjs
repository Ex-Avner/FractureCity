'use strict';
// Public text filter: slurs and "kill yourself" style harassment are refused
// everywhere residents write for others (posts, replies, boards, profiles,
// chat, NPC names and stories). Ordinary swearing is allowed: it is a punk
// city. Text is normalised first (case, leetspeak, separators, repeated
// letters) so "n.1.g.g" style dodges are caught; short stems only match as
// whole words so place names and ordinary words survive.
const LEET = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g' };
//  Matched inside squashed text (separators removed): long and unambiguous.
const SQUASHED = ['nigger', 'nigga', 'niggah', 'faggot', 'faggit', 'wetback', 'sandnigger', 'kikes', 'chinks', 'trannies', 'beaner', 'raghead', 'towelhead', 'killyourself', 'killurself', 'kysnow'];
//  Matched as whole words only.
const WORDS = ['fag', 'fags', 'kike', 'spic', 'spics', 'chink', 'gook', 'gooks', 'tranny', 'retard', 'retards', 'retarded', 'coon', 'coons', 'kys', 'nigs'];
function normal(s){
 return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[0-9!|@$+]/g, c => LEET[c] || c)
  .replace(/(.)\1{2,}/g, '$1$1');
}
function offending(text){
 const n = normal(text), words = n.replace(/[^a-z]+/g, ' ').trim(), squashed = n.replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1$1');
 const vowels = squashed.replace(/([aeiouy])\1+/g, '$1');
 for (const w of SQUASHED) if (squashed.includes(w) || vowels.includes(w)) return w;
 const set = new Set(words.split(' '));
 for (const w of WORDS) if (set.has(w)) return w;
 return null;
}
function check(...texts){
 for (const t of texts) if (offending(t)) throw Object.assign(Error('That language is not allowed on this server. Rewrite it and try again.'), { status: 400 });
}
module.exports = { check, offending, normal };
