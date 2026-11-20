#!/usr/bin/env python3
"""Build the one-file preview page used for the claude.ai links.

Usage: python3 tools/build-preview.py OUTPUT.html [--title "PC Parts Tycoon"]

Copies style.css and game.js into the page, embeds the bundled fonts as
data: URLs, drops links to other files (icons, manifest, font preload) and
removes the service-worker registration, which can't run in a preview.
"""
import base64, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
args = sys.argv[1:]
if not args:
    sys.exit(__doc__)
out = Path(args[0])
title = args[args.index('--title') + 1] if '--title' in args else None

html = (ROOT / 'index.html').read_text()
css = (ROOT / 'style.css').read_text()
for font in sorted((ROOT / 'fonts').glob('*.woff2')):
    data = base64.b64encode(font.read_bytes()).decode()
    css = css.replace(f'url(fonts/{font.name})', f'url(data:font/woff2;base64,{data})')
assert 'url(fonts/' not in css, 'a font in style.css was not embedded'

js = (ROOT / 'game.js').read_text()
js, n = re.subn(r"\nif \('serviceWorker' in navigator[^\n]*\n[^\n]*\n\}\n?", '\n', js)
assert n == 1, 'service-worker registration not found in game.js'

html = re.sub(r'\s*<link rel="(apple-touch-icon|icon|manifest|preload)"[^>]*>', '', html)
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>')
html = html.replace('<script src="game.js"></script>', '<script>\n' + js.replace('</script', '<\\/script') + '\n</script>')
assert '<style>' in html and '<script>\n' in html, 'index.html no longer matches what this script expects'
if title:
    html = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', html)

out.write_text(html)
print(f'wrote {out} ({len(html) // 1024} KB)')
