"""Inspect downloaded build artifacts without extracting or executing their contents."""
import argparse
import hashlib
import json
import plistlib
import zipfile
from pathlib import Path


def verify(folder, version):
    expected = {f'SunnyLanguageLab-{browser}-v{version}.zip' for browser in ('chrome', 'safari')}
    expected.update({f'SunnyLanguageLab-iOS-v{version}-unsigned.ipa', f'SunnyLanguageLab-v{version}-source-preview.zip'})
    files = {path.name for path in folder.iterdir() if path.is_file()}
    if files - {'SHA256SUMS.txt'} != expected:
        raise ValueError(f'Unexpected release assets: {files ^ expected}')
    required = {'src/content/surface.js', 'src/content/word-levels.js',
                'src/ipad/data/ECDICT-LICENSE.txt', 'src/ipad/data/word-ranks.json',
                'src/ipad/data/en-zh-a.json', 'src/options/options.html',
                'src/options/panel.html', 'src/options/ai-settings.js'}
    for browser in ('chrome', 'safari'):
        with zipfile.ZipFile(folder / f'SunnyLanguageLab-{browser}-v{version}.zip') as archive:
            manifest = json.loads(archive.read('manifest.json'))
            assert manifest['version'] == version, f'{browser} manifest version mismatch'
            assert required.issubset(archive.namelist()), f'{browser} is missing bundled learning assets'
            ranks = json.loads(archive.read('src/ipad/data/word-ranks.json'))
            assert ranks['license'] == 'MIT' and len(ranks['ranks']) > 70000, 'Word-rank asset incomplete'
    with zipfile.ZipFile(folder / f'SunnyLanguageLab-v{version}-source-preview.zip') as archive:
        assert {'LICENSE', 'THIRD_PARTY_NOTICES.md'}.issubset(archive.namelist()), 'Source licenses missing'
        assert json.loads(archive.read('extension/manifest.json'))['version'] == version, 'Source version mismatch'
    with zipfile.ZipFile(folder / f'SunnyLanguageLab-iOS-v{version}-unsigned.ipa') as archive:
        names = archive.namelist()
        app_plists = [name for name in names if name.startswith('Payload/') and name.count('/') == 2 and name.endswith('.app/Info.plist')]
        assert len(app_plists) == 1, 'Expected one iOS host application'
        info = plistlib.loads(archive.read(app_plists[0]))
        assert set(info['UIDeviceFamily']) == {1, 2}, 'iPhone/iPad device-family mismatch'
        manifests = [name for name in names if '.appex/' in name and name.endswith('/manifest.json')]
        assert len(manifests) == 1, 'Expected one packaged Safari WebExtension'
        manifest = json.loads(archive.read(manifests[0]))
        assert manifest['version'] == version, 'IPA extension version mismatch'
        prefix = manifests[0][:-len('manifest.json')]
        assert all(prefix + name in names for name in required), 'IPA is missing learning assets'
    lines = []
    for name in sorted(expected):
        lines.append(hashlib.sha256((folder / name).read_bytes()).hexdigest() + '  ' + name)
    (folder / 'SHA256SUMS.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'Checked four v{version} artifacts, offline data, MIT notices and iPhone/iPad families.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('folder', type=Path)
    parser.add_argument('--version', required=True)
    args = parser.parse_args()
    verify(args.folder, args.version)
