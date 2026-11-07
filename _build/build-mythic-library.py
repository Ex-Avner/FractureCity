#!/usr/bin/env python3
"""Add complete selected poems to Omnism. Supply Greek/Norse Gutenberg HTML in RAW.
Download URLs and edition attribution are recorded in the generated index.
python3 _build/build-mythic-library.py /path/to/raw [scriptures-output]
"""
from pathlib import Path
from html.parser import HTMLParser
import re,json,sys,hashlib
ROOT=Path(__file__).resolve().parents[1]
class Text(HTMLParser):
    def __init__(self):super().__init__();self.parts=[]
    def handle_data(self,s):self.parts.append(s)
def plain(s):
    s=re.sub(r'<a\b[^>]*(?:href="#linknote-|class="noteRef")[^>]*>.*?</a>','',s,flags=re.S)
    s=re.sub(r'<span\b[^>]*class="pageNum"[^>]*>.*?</span>','',s,flags=re.S)
    p=Text();p.feed(s);return re.sub(r'\s+',' ',''.join(p.parts)).strip()
def build(raw,out):
    greek=(raw/'greek.html').read_text();norse=(raw/'norse.html').read_text()
    def greek_poem(start,end):
        part=greek.split('<a name="'+start+'"></a>',1)[1].split('<a name="'+end+'"></a>',1)[0]
        return [plain(p) for p in re.findall(r'<p\b[^>]*>(.*?)</p>',part,re.S) if plain(p)]
    def norse_poem(number):
        section=norse.split('id="ch1.'+str(number)+'"',1)[1].split('id="ch1.'+str(number+1)+'"',1)[0]
        rawblocks=re.findall(r'<div[^>]*class="lgouter"[^>]*>(.*?)</div>',section,re.S)
        blocks=[]
        for b in rawblocks:
            match=re.search(r'class="verseNum">\s*<a[^>]*>(\d+)</a>',b)
            if match:blocks.append((int(match.group(1)),b))
        numbers=[n for n,_ in blocks];assert numbers==list(range(1,len(numbers)+1)),numbers
        return ['\n'.join(plain(p) for p in re.findall(r'<p\b[^>]*>(.*?)</p>',body,re.S)) for _,body in blocks]
    texts=[greek_poem('chap26','chap27'),greek_poem('chap37','chap38'),norse_poem(1),norse_poem(2)]
    assert '(ll. 1-25)' in texts[0][0] and '1022' in texts[0][-1]
    assert '495' in texts[1][-1]
    assert len(texts[2])==66 and len(texts[3])==165,[len(t) for t in texts]
    works=[]
    for id,title,trad,mark,translator,source,blurb,names,group,poems in [
        ('greek-myths','Greek Mythic Poetry','Ancient Greek traditions','Ω','Hugh G. Evelyn-White (1914)','https://www.gutenberg.org/ebooks/348','Complete English translations of Hesiod’s Theogony and the Homeric Hymn to Demeter: the births of the gods, Persephone’s descent, and Demeter’s search. These ancient poems are distinct from Fracture City’s fictional Ashbound.', ['Theogony','Homeric Hymn to Demeter'],'Greek mythic poetry',texts[:2]),
        ('norse-myths','Norse Mythic Poetry','Old Norse traditions','ᚱ','Henry Adams Bellows (1923)','https://www.gutenberg.org/ebooks/73533','Two complete poems from the Poetic Edda in English: Völuspá, the seeress’s account of the world’s beginning and end, and Hávamál, counsels and the sayings of the High One. Selected poems, not the complete Edda.', ['Völuspá · The Wise-Woman’s Prophecy','Hávamál · The Ballad of the High One'],'Poetic Edda · selected complete poems',texts[2:])]:
        books=[]
        for i,(name,units) in enumerate(zip(names,poems)):
            chapters=[units[j:j+12] for j in range(0,len(units),12)]
            parts=[('Stanzas '+str(j+1)+'–'+str(min(j+12,len(units)))) if id=='norse-myths' else 'Reading '+str(j//12+1) for j in range(0,len(units),12)]
            dest=out/id/'en'/f'{i}.json';dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps({'c':chapters},ensure_ascii=False,separators=(',',':')))
            books.append({'n':name,'g':group,'v':[len(c) for c in chapters],'parts':parts})
        works.append({'id':id,'title':title,'sub':group,'tradition':trad,'mark':mark,'blurb':blurb,'aligned':False,'single':False,'editions':[{'id':'en','label':'English · '+translator,'short':'English','lang':'en','dir':'ltr','stanzas':True,'source':source+'; translation by '+translator+'. Complete selected poems; editorial notes omitted. Readings are divided into twelve paragraphs or stanzas for navigation.','license':'Public domain in the United States. Source distribution: Project Gutenberg; see mythic-sources.txt.'}],'books':books,'unit':'Reading','verse':'Stanza' if id=='norse-myths' else 'Paragraph'})
    index=json.loads((out/'index.json').read_text());index['works']=[w for w in index['works'] if w['id'] not in {x['id'] for x in works}]+works
    (out/'index.json').write_text(json.dumps(index,ensure_ascii=False,separators=(',',':')))
    notes='MYTHIC READINGS / SOURCE RECORD\n\n'+ '\n\n'.join(w['title']+'\n'+w['editions'][0]['source'] for w in works)+'\n\nThese are historical literary texts, separate from the fictional enemies in Fracture City.\nSource HTML SHA-256:\n'+ '\n'.join(f.name+': '+hashlib.sha256(f.read_bytes()).hexdigest() for f in [raw/'greek.html',raw/'norse.html'])+'\n\nProject Gutenberg license: https://www.gutenberg.org/policy/license.html\n'
    footer=greek.split('START: FULL LICENSE',1)
    if len(footer)>1:notes+='\nSOURCE DISTRIBUTION NOTICE\n'+plain(footer[1])+'\n'
    (out/'mythic-sources.txt').write_text(notes)
    print('Added Greek and Norse shelves:',[len(t) for t in texts],'source paragraphs/stanzas')
if __name__=='__main__':build(Path(sys.argv[1]),Path(sys.argv[2]) if len(sys.argv)>2 else ROOT/'apps/fracture-city-game/scriptures')
