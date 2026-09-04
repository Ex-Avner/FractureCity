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

    # 3. lay out the folder
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, 'shared', 'vendor'), exist_ok=True)
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(html)
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
