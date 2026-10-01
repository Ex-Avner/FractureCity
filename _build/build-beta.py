#!/usr/bin/env python3
"""
Build the Fracture City web beta from the canonical game.

    python3 _build/build-beta.py                      # sample cast, no telemetry
    python3 _build/build-beta.py --cast mine          # your own characters and scenes
    python3 _build/build-beta.py --key phc_xxxxx      # with PostHog reporting
    FC_POSTHOG_KEY=phc_xxx python3 _build/build-beta.py   # same, from the environment

On Cloudflare Pages, set the build command to `python3 _build/build-beta.py`,
the output directory to `_build/webbeta-dist`, and FC_POSTHOG_KEY as an
encrypted variable. Every push then deploys, and the key never enters git.

It does three things to apps/fracture-city-game/index.html and nothing else:

  1. repoints the vendored three.js from ../../shared/ to shared/, because a
     deployed site is flat and the desktop shell's tree is not
  2. injects the analytics config — an empty key means no script tag, no
     request and no reporting, which is the state this ships in
  3. writes _headers and _redirects for Cloudflare Pages / Netlify

Output: _build/webbeta-dist/  and  _build/fracture-city-beta-v<version>.zip
"""
import argparse, json, os, re, shutil, sys, zipfile

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME   = os.path.join(ROOT, 'apps', 'fracture-city-game', 'index.html')
VENDOR = os.path.join(ROOT, 'shared', 'vendor', 'three.min.js')
OUT    = os.path.join(ROOT, '_build', 'webbeta-dist')

#  The feed hosts, and nothing else. This list is the same one the game shows
#  in its own network report — if they ever disagree, one of them is lying to
#  the player, and the gate test fails.
FEED_HOSTS = [
    'https://mastodon.social',
    'https://hn.algolia.com',
    'https://public.api.bsky.app',
    'https://en.wikipedia.org',
    'https://hacker-news.firebaseio.com',
]



def read_cast(which='sample'):
    """The cast the build ships with.

    'sample' (the default) is _build/sample-cast.json — four characters and two
    scenes written for the beta. The public build carries those, and NOT the
    characters from the book: a hosted page is one share away from anybody, and
    unreleased work should not be the thing that leaks.

    'mine' snapshots data/character-forge and data/scene-composer instead, for
    a build you are keeping. Each file there is one record, sometimes wrapped
    as {"value": ...} by the shell's data layer; unwrapped so the game sees one
    shape either way.
    """
    if which == 'sample':
        path = os.path.join(ROOT, '_build', 'sample-cast.json')
        if not os.path.exists(path):
            print('  ! no sample cast at _build/sample-cast.json — shipping without one')
            return {'characters': [], 'scenes': []}
        with open(path, encoding='utf-8') as fh:
            d = json.load(fh)
        return {'characters': d.get('characters', []), 'scenes': d.get('scenes', [])}

    out = {'characters': [], 'scenes': []}
    jobs = [
        ('characters', os.path.join(ROOT, 'data', 'character-forge'), 'character_seed_'),
        ('scenes',     os.path.join(ROOT, 'data', 'scene-composer'),  'scene_'),
    ]
    for key, folder, prefix in jobs:
        if not os.path.isdir(folder):
            continue
        for name in sorted(os.listdir(folder)):
            if not name.startswith(prefix) or not name.endswith('.json'):
                continue
            try:
                with open(os.path.join(folder, name), encoding='utf-8') as fh:
                    v = json.load(fh)
                out[key].append(v.get('value', v) if isinstance(v, dict) else v)
            except Exception as e:
                print(f'  ! skipped {name}: {e}')
    return out

def build_headers(key: str, host: str) -> str:
    """A CSP built from what the build actually contacts.

    'unsafe-inline' is present and not going away in this release: the game is
    one enormous inline <script> with inline <style> injected by two dozen
    sections. Removing it means hashing or noncing every one of them, which is
    a real job for after the source split — not something to fake with a
    permissive policy that reads as strict.

    What the policy does buy today is the part that matters for a static game:
    no remote script origin, no object embeds, no framing, and connect-src
    limited to the five feed hosts. If a dependency ever tries to reach
    somewhere new, the browser stops it and says so.
    """
    connect = ["'self'"] + FEED_HOSTS
    script = ["'self'", "'unsafe-inline'"]
    worker = ["'self'", 'blob:']
    if key:
        api = host.rstrip('/')
        assets = api.replace('//us.i.', '//us-assets.i.').replace('//eu.i.', '//eu-assets.i.')
        connect += [api, assets]
        script.append(assets)

    csp = '; '.join([
        "default-src 'self'",
        'script-src ' + ' '.join(script),
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "media-src 'self' data: blob:",
        'connect-src ' + ' '.join(connect),
        'worker-src ' + ' '.join(worker),
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
        "frame-ancestors 'self'",
    ])

    return f"""/shared/vendor/*
  Cache-Control: public, max-age=31536000, immutable

/*
  Content-Security-Policy: {csp}

/*.html
  Cache-Control: public, max-age=0, must-revalidate
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
"""

REDIRECTS = "/*  /index.html  200\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--key', default='', help='PostHog project key (phc_...). Empty = no telemetry.')
    ap.add_argument('--host', default='https://us.i.posthog.com', help='PostHog API host')
    ap.add_argument('--cast', default='sample', choices=['sample', 'mine', 'none'],
                    help="Whose characters ship in the build. 'sample' (default) is the "
                         "four written for the beta; 'mine' bakes in data/character-forge "
                         "and data/scene-composer; 'none' ships without a cast.")
    args = ap.parse_args()

    #  Fall back to the environment, so a CI build can inject the key without it
    #  ever being written into the repository. On Cloudflare Pages this is
    #  Settings -> Variables and Secrets -> FC_POSTHOG_KEY, and the key stays
    #  out of git entirely; locally, --key still wins if it is given.
    if not args.key:
        args.key = os.environ.get('FC_POSTHOG_KEY', '').strip()
    args.host = args.host or os.environ.get('FC_POSTHOG_HOST', 'https://us.i.posthog.com')

    html = open(GAME, encoding='utf-8').read()

    version = (re.search(r"SH_VERSION\s*=\s*'([^']+)'", html) or [None, '0.0.0'])[1]

    # 1. flatten the vendor path
    before = html
    html = html.replace('<script src="../../shared/vendor/three.min.js"></script>',
                        '<script src="shared/vendor/three.min.js"></script>')
    if html == before:
        sys.exit('! the vendored three.js tag was not where it was expected — check the game file')

    # 2. inject the analytics config immediately above it, so it is defined
    #    before any game code runs
    anchor = '<script src="shared/vendor/three.min.js"></script>'
    cfg = (
        '<script>\n'
        '  /* Fracture City beta telemetry. An empty key means this build loads no\n'
        '     analytics script and makes no off-origin request. Players can opt out\n'
        '     at any time with fcTelemetry(false), and Do Not Track is obeyed. */\n'
        f"  window.FC_ANALYTICS = {{ key: '{args.key}', host: '{args.host}' }};\n"
        '  /* This deploy is one file plus three.js. The other Present Palm apps\n'
        '     are not in it, so the arcade cabinets must not try to load them by\n'
        '     relative path — above the site root, _redirects answers with this\n'
        '     same game and the cabinet fills with a copy of itself. */\n'
        '  window.FC_STANDALONE = true;\n'
        '</script>\n'
    )
    html = html.replace(anchor, cfg + anchor, 1)

    # 2c. bake the story in.
    #
    #     Character Forge and Scene Composer write into data/. A web page has
    #     no data folder, so the hosted build carries a snapshot: the same
    #     seeds and scenes, as a literal. Section 66 reads the shell's live
    #     folder first and falls back to this, so the desktop app is always
    #     current and the beta always has a cast.
    cast = {'characters': [], 'scenes': []} if args.cast == 'none' else read_cast(args.cast)
    if cast['characters'] or cast['scenes']:
        html = html.replace(anchor,
            '<script>\n'
            '  /* Snapshot of Character Forge and Scene Composer at build time. */\n'
            '  window.FC_CAST = ' + json.dumps(cast, ensure_ascii=False) + ';\n'
            '</script>\n' + anchor, 1)
    print(f"  cast      {len(cast['characters'])} characters, {len(cast['scenes'])} scenes  ({args.cast})")

    # 2b. strip the CDN fallback.
    #
    #     The desktop shell keeps it — it once rescued a build whose vendored
    #     path did not exist on that machine, and the failure mode it prevents
    #     (a menu that draws perfectly and does nothing) is genuinely the worst
    #     one. But out here three.js is in the folder next to index.html, the
    #     README says "no CDN, no network", and the CSP does not allow cdnjs.
    #     A fallback that cannot fire and contradicts the documentation is not
    #     a safety net, it is a false statement.
    cdn = ("  document.write('<scr' + 'ipt src=\"https://cdnjs.cloudflare.com/ajax/libs/"
           "three.js/r158/three.min.js\"><\\/scr' + 'ipt>');")
    if cdn in html:
        html = html.replace(cdn,
            "  /* CDN fallback removed for the hosted build: three.js is vendored\n"
            "     beside this file and the Content-Security-Policy forbids cdnjs. */")
    else:
        print('! the CDN fallback line was not where it was expected — check it by hand')

    # 2d. compile the Wild cabinet in.
    #
    #     The hosted build is one file plus three.js — there is no apps/ tree,
    #     so every arcade cabinet that loads ../<slug>/index.html is dark out
    #     here. STILL HUMAN // WILD is the exception: its engine is a plain
    #     script that mounts into a box, so it rides along inside the page and
    #     section 68 draws it straight into the cabinet stage. The desktop
    #     shell does not need this — there the cabinet loads the real app.
    wild = os.path.join(ROOT, 'apps', 'still-human-wild', 'still-human-wild.js')
    if os.path.exists(wild):
        engine = open(wild, encoding='utf-8').read()
        #  The LAST </body>, not the first. Section 44's field-book export
        #  builds a whole standalone document inside a JS template literal,
        #  and that literal contains </body></html>. Splicing a <script> tag
        #  in there closes the game's own script mid-expression, and the
        #  entire city dies with a syntax error somewhere in a CSS string.
        cut = html.rfind('</body>')
        if cut < 0:
            sys.exit('! no </body> to compile the Wild engine into')
        html = (html[:cut]
                + '<script>\n/* apps/still-human-wild/still-human-wild.js, compiled in by\n'
                  '   build-beta.py so the arcade has a cabinet that works on the web. */\n'
                + engine + '\n</script>\n'
                + html[cut:])
        print(f'  wild      compiled in ({len(engine)//1024} KB)')
    else:
        print('  ! apps/still-human-wild/still-human-wild.js missing — cabinet ships dark')

    # 3. lay out the folder
    #
    #    A clean removal first, so a file dropped from a previous version does
    #    not linger in the deploy. Some sandboxes refuse deletes; the output is
    #    a fixed set of four files, so overwriting in place is a correct
    #    fallback rather than a compromise.
    if os.path.isdir(OUT):
        try:
            shutil.rmtree(OUT)
        except OSError as e:
            print(f'  (could not clear {OUT}: {e.strerror}; overwriting in place)')
    os.makedirs(os.path.join(OUT, 'shared', 'vendor'), exist_ok=True)
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(html)

    #  Whatever local modules the page asks for, ship them. The deploy used to
    #  be one HTML file plus three.js by assumption, so the first sibling module
    #  the game loaded would have 404'd in the deploy and nowhere else — the
    #  same shape of failure as the arcade in section 64. Following the page
    #  rather than a hand-kept list means nobody has to remember this again.
    #  _test/webbuild.js fails the build if a script tag has no file behind it.
    app_dir = os.path.dirname(GAME)
    for src in re.findall(r'<script[^>]+src="([^"]+)"', html):
        if src.startswith(('http://', 'https://')) or src.startswith('shared/'):
            continue
        src_path = os.path.normpath(os.path.join(app_dir, src))
        dst_path = os.path.normpath(os.path.join(OUT, src))
        if not os.path.isfile(src_path):
            sys.exit(f'! index.html loads {src} and there is no file at {src_path}')
        os.makedirs(os.path.dirname(dst_path), exist_ok=True)
        shutil.copy2(src_path, dst_path)
        print(f'  + {src}')
    shutil.copy2(VENDOR, os.path.join(OUT, 'shared', 'vendor', 'three.min.js'))
    open(os.path.join(OUT, '_headers'), 'w').write(build_headers(args.key, args.host))
    open(os.path.join(OUT, '_redirects'), 'w').write(REDIRECTS)

    readme = os.path.join(ROOT, '_build', 'BETA-README.txt')
    if os.path.exists(readme):
        shutil.copy2(readme, os.path.join(OUT, 'README.txt'))

    zip_path = os.path.join(ROOT, '_build', f'fracture-city-beta-v{version}.zip')
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for base, _, files in os.walk(OUT):
            for f in files:
                full = os.path.join(base, f)
                z.write(full, os.path.relpath(full, OUT))

    print(f'built v{version}')
    print(f'  folder    {OUT}')
    print(f'  zip       {zip_path}  ({os.path.getsize(zip_path)//1024} KB)')
    print(f'  telemetry {"ON  key " + args.key[:12] + "..." if args.key else "OFF (no key, no network)"}')


if __name__ == '__main__':
    main()
