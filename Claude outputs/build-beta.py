#!/usr/bin/env python3
"""
Build the Fracture City web beta from the canonical game.

    python3 _build/build-beta.py                      # no telemetry, fully offline
    python3 _build/build-beta.py --key phc_xxxxx      # with PostHog reporting

It does three things to apps/fracture-city-game/index.html and nothing else:

  1. repoints the vendored three.js from ../../shared/ to shared/, because a
     deployed site is flat and the desktop shell's tree is not
  2. injects the analytics config — an empty key means no script tag, no
     request and no reporting, which is the state this ships in
  3. writes _headers and _redirects for Cloudflare Pages / Netlify

Output: _build/webbeta-dist/  and  _build/fracture-city-beta-v<version>.zip
"""
import argparse, os, re, shutil, sys, zipfile

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME   = os.path.join(ROOT, 'apps', 'fracture-city-game', 'index.html')
VENDOR = os.path.join(ROOT, 'shared', 'vendor', 'three.min.js')
OUT    = os.path.join(ROOT, '_build', 'webbeta-dist')

HEADERS = """/shared/vendor/*
  Cache-Control: public, max-age=31536000, immutable

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
    args = ap.parse_args()

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
        '</script>\n'
    )
    html = html.replace(anchor, cfg + anchor, 1)

    # 3. lay out the folder
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, 'shared', 'vendor'), exist_ok=True)
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(html)
    shutil.copy2(VENDOR, os.path.join(OUT, 'shared', 'vendor', 'three.min.js'))
    open(os.path.join(OUT, '_headers'), 'w').write(HEADERS)
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
