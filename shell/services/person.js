// =============================================================================
//  PERSON — the one record the shell owns, and no app does.
// -----------------------------------------------------------------------------
//  Every other write in Present Palm is namespaced to an app by construction:
//  data:save takes the slug from the launch argument, so data always lands in
//  data/<slug>/. That means no app can store a record belonging to a *person*
//  rather than to an app — which is why there were three competing ideas of
//  identity on disk (tot.profile.v1, character.identity.v1, and Fracture City's
//  untyped shift-profile) and no user account at all.
//
//  This is the missing noun. It lives at data/_shell/person.json, following the
//  same pattern providers.json already established: written by the shell, read
//  by every app, owned by none.
//
//  Kept free of electron imports so it can be tested directly.
// =============================================================================

const fs   = require('fs');
const path = require('path');
const os   = require('os');

function makePersonId(){
  return 'p_' + Math.random().toString(36).slice(2, 10);
}

//  Seed from the machine account so the first run is not blank. This is a
//  display handle, not a credential — it is meant to be edited.
//  Machine account names that say nothing about who the person is. Seeding a
//  username with "root" would be worse than not seeding one at all.
const GENERIC_ACCOUNTS = new Set(['root','admin','administrator','user','guest',
                                  'ubuntu','ec2-user','pi','node','default','owner']);
function defaultUsername(){
  try {
    const raw = (os.userInfo().username || '');
    const clean = String(raw).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (clean.length < 2 || GENERIC_ACCOUNTS.has(clean)) return 'resident';
    return clean.slice(0, 24);
  } catch (e){ return 'resident'; }
}

function sanitizeUsername(u){
  return String(u == null ? '' : u).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
}

function defaultPerson(){
  const now = new Date().toISOString();
  return {
    type:        'person.v1',
    id:          makePersonId(),
    username:    defaultUsername(),
    displayName: '',
    bio:         '',
    avatar:      null,
    created:     now,
    updated:     now,
    // What belongs to this person, addressed as "slug/key" — by reference and
    // never by copy, because a copy goes stale the moment the original changes.
    holds:       {},
  };
}

function createPerson(dataDir){
  const P = path.join(dataDir, '_shell', 'person.json');

  function write(p){
    const dir = path.dirname(P);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(P, JSON.stringify(p, null, 2));
    return p;
  }

  function read(){
    try {
      if (!fs.existsSync(P)) return write(defaultPerson());
      const stored = JSON.parse(fs.readFileSync(P, 'utf8'));
      // Repair rather than fail: an install predating a field should gain it,
      // without ever regenerating the id, which is the one thing that must not
      // move once anything references it.
      const base = defaultPerson();
      return {
        ...base, ...stored,
        type:    'person.v1',
        id:      stored.id      || base.id,
        created: stored.created || base.created,
        holds:   (stored.holds && typeof stored.holds === 'object') ? stored.holds : {},
      };
    } catch (e){
      return defaultPerson();
    }
  }

  //  id, type and created ARE the identity and cannot be overwritten by a
  //  caller. Everything else is the person's to change.
  function update(patch){
    const cur  = read();
    const next = { ...cur, ...(patch && typeof patch === 'object' ? patch : {}) };
    next.id      = cur.id;
    next.type    = 'person.v1';
    next.created = cur.created;
    next.updated = new Date().toISOString();
    const u = sanitizeUsername(next.username);
    next.username = u || cur.username;
    if (!next.holds || typeof next.holds !== 'object') next.holds = cur.holds;
    return write(next);
  }

  //  Record that something belongs to this person, as a "slug/key" reference.
  //  Apps call this instead of copying the thing into their own directory.
  function claim(type, ref){
    if (!type || !ref) return read();
    const p   = read();
    const cur = p.holds[type];
    if (Array.isArray(cur)){
      if (!cur.includes(ref)) cur.push(ref);
    } else if (typeof cur === 'string'){
      if (cur !== ref) p.holds[type] = [cur, ref];
    } else {
      p.holds[type] = ref;
    }
    p.updated = new Date().toISOString();
    return write(p);
  }

  function release(type, ref){
    const p = read();
    const cur = p.holds[type];
    if (Array.isArray(cur)){
      p.holds[type] = cur.filter(r => r !== ref);
      if (p.holds[type].length === 0) delete p.holds[type];
      else if (p.holds[type].length === 1) p.holds[type] = p.holds[type][0];
    } else if (cur === ref){
      delete p.holds[type];
    }
    p.updated = new Date().toISOString();
    return write(p);
  }

  //  Resolve "slug/key" to the live record. This is the read that replaces the
  //  cached_* copies: always current, never a snapshot.
  function resolve(ref){
    try {
      const i = String(ref).indexOf('/');
      if (i < 0) return null;
      const slug = String(ref).slice(0, i);
      const key  = String(ref).slice(i + 1);
      // Character-class sanitising is not enough on its own here: '.' is a
      // legal character in both a slug and a key, so '..' survives it and
      // path.join happily walks out of the data directory. Resolve the final
      // path and require that it is genuinely inside dataDir.
      const f = path.resolve(dataDir, slug, `${key}.json`);
      const root = path.resolve(dataDir) + path.sep;
      if (!f.startsWith(root)) return null;
      if (!fs.existsSync(f)) return null;
      return JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch (e){ return null; }
  }

  //  Resolve everything held of one type, dropping references that no longer
  //  point at anything, so a deleted original does not surface as a null.
  function resolveAll(type){
    const p = read();
    const cur = p.holds[type];
    const refs = Array.isArray(cur) ? cur : (cur ? [cur] : []);
    return refs.map(r => { const v = resolve(r); return v ? { ref: r, value: v } : null; })
               .filter(Boolean);
  }

  return { read, update, claim, release, resolve, resolveAll, path: P };
}

module.exports = { createPerson, defaultPerson, sanitizeUsername, makePersonId };
