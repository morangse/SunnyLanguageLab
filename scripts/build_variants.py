#!/usr/bin/env python3
"""Build two manifests around the same independently authored responsive client."""
import argparse
import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='dist')
    args = parser.parse_args()
    output = (ROOT / args.output).resolve()
    if not output.is_relative_to(ROOT) or not output.name.startswith('dist'):
        raise SystemExit('Build output must be a dist-prefixed directory inside this project.')
    source = ROOT / 'extension'
    marker = output / '.sunny-build'
    if output.exists() and not marker.exists() and any(output.iterdir()):
        raise SystemExit('Refusing to replace a directory not owned by this builder.')
    output.mkdir(parents=True, exist_ok=True)
    marker.write_text('SunnyLanguageLab generated browser packages\n', encoding='utf-8')
    for platform in ('chrome', 'safari'):
        target = output / platform
        if target.exists():
            if target.resolve().parent != output or target.is_symlink():
                raise SystemExit('Unsafe build destination')
            shutil.rmtree(target)
        shutil.copytree(source, target)
        manifest_path = target / 'manifest.json'
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        manifest['version_name'] = f"Sunny {manifest['version']} · {platform} preview"
        if platform == 'chrome':
            manifest['permissions'].append('unlimitedStorage')
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        for entry in manifest['content_scripts']:
            for script in entry['js']:
                if not (target / script).is_file():
                    raise SystemExit(f'Missing script: {script}')
        archive = output / f"SunnyLanguageLab-{platform}-v{manifest['version']}.zip"
        with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
            for path in sorted(target.rglob('*')):
                if path.is_file():
                    bundle.write(path, path.relative_to(target).as_posix())
        print(f'{platform}: {archive.name}')

if __name__ == '__main__':
    main()
