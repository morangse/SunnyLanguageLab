#!/usr/bin/env python3
"""Package a reviewable source snapshot without local state or build dependencies."""
import argparse
import json
import hashlib
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROOT_FILES = {'package.json', 'release-status.json', '.gitignore', 'LICENSE'}
DIRECTORIES = {'extension', 'server', 'scripts', 'tests', 'docs', '.github'}
BLOCKED_DIRS = {'node_modules', '.wrangler', '__pycache__', '.git'}
BLOCKED_SUFFIXES = {'.pem', '.key', '.p12', '.pfx', '.mobileprovision', '.ipa', '.db', '.sqlite', '.log', '.pyc'}

def source_files():
    for folder in sorted(DIRECTORIES):
        for path in sorted((ROOT / folder).rglob('*')):
            rel = path.relative_to(ROOT)
            if not path.is_file() or any(part in BLOCKED_DIRS for part in rel.parts):
                continue
            if path.suffix.lower() in BLOCKED_SUFFIXES:
                continue
            if path.name.startswith(('.env', '.dev.vars')) and not path.name.endswith('.example'):
                continue
            if path.name == 'wrangler.local.json':
                continue
            yield path
    for path in sorted(ROOT.iterdir()):
        if path.is_file() and (path.name in ROOT_FILES or path.suffix == '.md'):
            yield path

def main():
    parser = argparse.ArgumentParser()
    version = json.loads((ROOT / 'extension/manifest.json').read_text(encoding='utf-8'))['version']
    parser.add_argument('--output', default=f'dist/SunnyLanguageLab-v{version}-source-preview.zip')
    args = parser.parse_args()
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    paths = list(source_files())
    if output in paths:
        raise SystemExit('Output must be outside source input directories.')
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in paths:
            archive.write(path, path.relative_to(ROOT).as_posix())
    print(f'{len(paths)} source files: {output.name}')
    print('SHA256 ' + hashlib.sha256(output.read_bytes()).hexdigest())

if __name__ == '__main__':
    main()
