// =============================================================================
//  Media - your music, art and video, served to apps
// -----------------------------------------------------------------------------
//  Apps load from file:// and every file:// page is its own opaque origin, so
//  an image from another folder can be shown but not drawn into WebGL, and a
//  song can play but not be analysed. This serves a short list of folders on a
//  privileged scheme with CORS and byte ranges, so a game can put your art on
//  a billboard and your music on its radio.
//
//    palm-media://media/<kind>/<folderIndex>/<relative path>
//
//  Only the folders below are reachable. Nothing outside them resolves, and
//  nothing is ever written through this scheme.
// =============================================================================

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');

const SCHEME = 'palm-media';

const KINDS = {
  music:  ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.oga', '.flac', '.opus'],
  images: ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
  videos: ['.mp4', '.webm', '.m4v', '.mov'],
};
const TYPES = {
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.flac': 'audio/flac', '.opus': 'audio/ogg',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.m4v': 'video/mp4', '.mov': 'video/quicktime',
};

const README = {
  music: 'Drop music here (mp3, m4a, wav, ogg, flac). Subfolders work as albums.\n' +
         'Fracture City plays it on Palm Radio. Press H in the game to open the Studio panel.\n',
  images: 'Drop images here (png, jpg, webp, gif). Fracture City puts them on rooftop billboards\n' +
          'and the skyline. Everything Palm Image Studio makes is included automatically.\n',
  videos: 'Drop short clips here (mp4, webm). Fracture City plays them on the nearest billboards.\n' +
          'Everything Palm Video Studio makes is included automatically.\n',
};

function createMedia({ root, home, bundledRoot }) {
  home = home || os.homedir();
  const mediaDir = path.join(root, 'media');
  //  Index 0 of each kind is the folder people drop files into. The rest are
  //  other Present Palm apps' outputs, read-only and included when present.
  const folders = {
    music:  [path.join(mediaDir, 'music')],
    images: [path.join(mediaDir, 'art'),   path.join(home, 'Documents', 'Codex', 'LocalImageStudio', 'images')],
    videos: [path.join(mediaDir, 'video'), path.join(home, 'Documents', 'Codex', 'LocalVideoStudio', 'videos')],
  };

  if (bundledRoot && bundledRoot !== root) folders.music.push(path.join(bundledRoot, 'media', 'music'));

  function ensure() {
    for (const kind of Object.keys(folders)) {
      const dir = folders[kind][0];
      try {
        fs.mkdirSync(dir, { recursive: true });
        const readme = path.join(dir, 'README.txt');
        if (!fs.existsSync(readme)) fs.writeFileSync(readme, README[kind]);
      } catch (e) { /* a read-only root still serves the studio folders */ }
    }
  }

  //  Prompts saved by the studios become titles.
  function studioTitle(file) {
    const meta = file.replace(/\.(png|jpe?g|webp|mp4|webm)$/i, '.studio.json');
    if (meta === file) return null;
    try { const j = JSON.parse(fs.readFileSync(meta, 'utf8')); return j.prompt || null; } catch (e) { return null; }
  }

  function walk(dir, exts, depth, out, base) {
    let names;
    try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const d of names) {
      if (d.name.startsWith('.')) continue;
      const full = path.join(dir, d.name);
      if (d.isDirectory()) { if (depth > 0) walk(full, exts, depth - 1, out, base); continue; }
      if (!d.isFile() || !exts.includes(path.extname(d.name).toLowerCase())) continue;
      out.push({ full, rel: path.relative(base, full) });
      if (out.length >= 2000) return;
    }
  }

  function list(kind) {
    const exts = KINDS[kind];
    if (!exts) return { kind, items: [], folders: [] };
    const items = [];
    folders[kind].forEach((dir, fi) => {
      const found = [];
      walk(dir, exts, 2, found, dir);
      for (const f of found) {
        let st; try { st = fs.statSync(f.full); } catch (e) { continue; }
        const rel = f.rel.split(path.sep).map(encodeURIComponent).join('/');
        items.push({
          kind, folder: fi, name: path.basename(f.full),
          title: studioTitle(f.full) || path.basename(f.full).replace(/\.[^.]+$/, '').replace(/[_]+/g, ' '),
          album: path.dirname(f.rel) === '.' ? null : path.dirname(f.rel),
          source: fi === 0 ? 'folder' : (kind === 'images' ? 'image-studio' : 'video-studio'),
          size: st.size, mtime: st.mtimeMs,
          url: `${SCHEME}://media/${kind}/${fi}/${rel}`,
        });
      }
    });
    items.sort((a, b) => b.mtime - a.mtime);
    return { kind, items, folders: folders[kind].map((d, i) => ({ index: i, path: d, exists: fs.existsSync(d) })) };
  }

  //  URL → absolute path, or null if it would leave its folder.
  function resolve(url) {
    let u;
    try { u = new URL(url); } catch (e) { return null; }
    if (u.protocol !== SCHEME + ':' || u.hostname !== 'media') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const [kind, fi, ...rest] = parts;
    if (!folders[kind] || !/^\d+$/.test(fi || '') || !rest.length) return null;
    const base = folders[kind][Number(fi)];
    if (!base) return null;
    let rel;
    try { rel = rest.map(decodeURIComponent).join(path.sep); } catch (e) { return null; }
    const full = path.resolve(base, rel);
    const back = path.relative(base, full);
    if (!back || back.startsWith('..') || path.isAbsolute(back)) return null;
    if (!KINDS[kind].includes(path.extname(full).toLowerCase())) return null;
    return full;
  }

  //  Byte ranges, because <audio> and <video> seek with them and a song that
  //  cannot seek cannot loop cleanly.
  function respond(request) {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' };
    const full = resolve(request.url);
    if (!full) return new Response('Not found', { status: 404, headers });
    let st;
    try { st = fs.statSync(full); } catch (e) { return new Response('Not found', { status: 404, headers }); }
    if (!st.isFile()) return new Response('Not found', { status: 404, headers });
    const size = st.size;
    headers['Content-Type'] = TYPES[path.extname(full).toLowerCase()] || 'application/octet-stream';
    headers['Accept-Ranges'] = 'bytes';
    const range = request.headers && (request.headers.get ? request.headers.get('range') : request.headers.range);
    const m = /^bytes=(\d*)-(\d*)$/.exec(range || '');
    if (m && (m[1] || m[2])) {
      let start, end;
      if (m[1]) { start = Number(m[1]); end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1; }
      else { start = Math.max(0, size - Number(m[2])); end = size - 1; }
      if (start > end || start >= size) {
        headers['Content-Range'] = `bytes */${size}`;
        return new Response(null, { status: 416, headers });
      }
      headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
      headers['Content-Length'] = String(end - start + 1);
      return new Response(Readable.toWeb(fs.createReadStream(full, { start, end })), { status: 206, headers });
    }
    headers['Content-Length'] = String(size);
    return new Response(Readable.toWeb(fs.createReadStream(full)), { status: 200, headers });
  }

  return { SCHEME, KINDS, folders, ensure, list, resolve, respond };
}

//  Must run before app 'ready'.
function registerScheme(protocol) {
  protocol.registerSchemesAsPrivileged([{
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true, bypassCSP: true },
  }]);
}

module.exports = { createMedia, registerScheme, SCHEME };
