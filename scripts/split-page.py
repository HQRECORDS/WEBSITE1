"""Split the dashboard page into small files for GitHub.

Usage: python3 scripts/split-page.py <dashboard index.html> <out dir>

The claude.ai dashboard is one big index.html. GitHub gets it in pieces so
each update only re-sends the parts that changed:
  page.html            the markup, with placeholders
  page-css-N.css       the styles, in parts
  page-sI-K.js         each script, in parts (split at "// ----------" markers)
runtime.js joins the parts back together in order before running them.
"""
import pathlib, re, sys

LIMIT = 30_000  # characters per part

src = pathlib.Path(sys.argv[1]).read_text()
out = pathlib.Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
for old in out.glob('page-*.css'):
    old.unlink()
for old in out.glob('page-*.js'):
    old.unlink()


def chunks(text, starts):
    """Split text into parts of at most LIMIT, cutting only before lines that match `starts`."""
    lines = text.splitlines(keepends=True)
    parts, cur = [], ''
    for line in lines:
        if cur and len(cur) + len(line) > LIMIT and starts(line):
            parts.append(cur)
            cur = ''
        cur += line
    if cur:
        parts.append(cur)
    # A part with no allowed cut point can still exceed LIMIT; cut it at any line.
    final = []
    for p in parts:
        while len(p) > LIMIT * 1.5:
            cut = p.rfind('\n', 0, LIMIT) + 1 or LIMIT
            final.append(p[:cut])
            p = p[cut:]
        final.append(p)
    return final


written = []

# Styles
m = re.search(r'<style>(.*?)</style>', src, re.S)
css_parts = chunks(m.group(1), lambda l: l.startswith('.') or l.startswith('@') or l.startswith('/*'))
names = []
for i, part in enumerate(css_parts, 1):
    name = f'page-css-{i}.css'
    (out / name).write_text(part)
    names.append(name)
src = src[:m.start()] + f'<style data-src="{" ".join(names)}"></style>' + src[m.end():]
written += names

# Scripts
blocks = list(re.finditer(r'<script>(.*?)</script>', src, re.S))
pieces, pos = [], 0
for i, b in enumerate(blocks, 1):
    parts = chunks(b.group(1), lambda l: l.startswith('// ----------') or l.startswith('dash.calc(') or l.startswith('dash.draw(') or l.startswith('dash.loader('))
    names = []
    for k, part in enumerate(parts, 1):
        name = f'page-s{i}-{k}.js'
        (out / name).write_text(part)
        names.append(name)
    written += names
    pieces.append(src[pos:b.start()] + f'<script data-src="{" ".join(names)}"></script>')
    pos = b.end()
pieces.append(src[pos:])
(out / 'page.html').write_text(''.join(pieces))
written.insert(0, 'page.html')

for n in written:
    print(f'{n}\t{len((out / n).read_text())}')
