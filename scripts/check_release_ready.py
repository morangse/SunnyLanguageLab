#!/usr/bin/env python3
"""Validate a public source snapshot; runtime compatibility remains a separate review."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--report', action='store_true')
    args = parser.parse_args()
    state = json.loads((ROOT / 'release-status.json').read_text(encoding='utf-8'))
    reasons = []
    if state.get('independent_rewrite') is not True or state.get('source_review') != 'completed':
        reasons.append('Independent implementation review is incomplete.')
    if state.get('project_license') != 'MIT' or not (ROOT / 'LICENSE').is_file():
        reasons.append('Project license is missing.')
    if not (ROOT / state.get('review_record', '')).is_file():
        reasons.append('Source review record is missing.')
    if not (ROOT / 'extension/src/ipad/data/ECDICT-LICENSE.txt').is_file():
        reasons.append('Bundled dictionary license is missing.')
    if (ROOT / 'archive').exists():
        reasons.append('Legacy source archives must not enter this public snapshot.')
    for legacy in ['extension/src/content/core.js', 'extension/src/content/parsers.js', 'extension/src/content/netflix.js']:
        if (ROOT / legacy).exists():
            reasons.append('Unexpected legacy client path: ' + legacy)
    print(json.dumps({'source_ready': not reasons, 'distribution': 'preview', 'real_device_validation': state['real_device_validation'], 'reasons': reasons}, indent=2))
    if reasons and not args.report:
        raise SystemExit(1)

if __name__ == '__main__':
    main()
