#!/usr/bin/env python3
"""Check local Markdown links without requiring browser or network access."""
import re
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
files = list(ROOT.glob('*.md')) + list((ROOT / 'docs').rglob('*.md')) + list((ROOT / 'archive').rglob('*.md'))
failures = []
for source in files:
    body = re.sub(r'```.*?```', '', source.read_text(encoding='utf-8'), flags=re.S)
    for target in re.findall(r'!?\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)', body):
        if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', target) or target.startswith('#'):
            continue
        target = unquote(target.strip('<>').split('#')[0].split('?')[0])
        if not target:
            continue
        resolved = (source.parent / target).resolve()
        if not resolved.is_relative_to(ROOT) or not resolved.exists():
            failures.append(f'{source.relative_to(ROOT)}: {target}')
if failures:
    print('\n'.join(failures))
    raise SystemExit(1)
print(f'Local Markdown links checked in {len(files)} documents.')
