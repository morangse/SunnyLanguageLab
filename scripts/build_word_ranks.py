"""Build vocabulary hints from the same pinned, MIT-licensed ECDICT source.

Ranks are corpus frequency hints, not exam certification or a vocabulary test.
No network access: run after obtaining the CSV documented by build_chinese_dictionary.py.
"""
import argparse
import csv
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--csv', type=Path, default=ROOT.parent / 'ecdict-source.csv')
    args = parser.parse_args()
    ranks = {}
    with args.csv.open(encoding='utf-8-sig', newline='') as stream:
        for row in csv.DictReader(stream):
            word = row['word'].strip()
            # Omit entries recorded as proper names; sentence-initial common words still match.
            if not re.fullmatch(r"[a-z][a-z'-]*", word):
                continue
            rank = int(row.get('bnc') or 0) or int(row.get('frq') or 0)
            if not 0 < rank <= 50000:
                continue
            forms = [word]
            for exchange in row.get('exchange', '').split('/'):
                if ':' in exchange:
                    kind, values = exchange.split(':', 1)
                    if kind in {'p', 'd', 'i', '3', 'r', 't', 's'}:
                        forms.extend(values.split(','))
            for form in forms:
                if re.fullmatch(r"[a-z][a-z'-]*", form):
                    ranks[form] = min(ranks.get(form, rank), rank)
    data = {'source': 'ECDICT ab22ad36302cafc6349a050e2b60894855208055', 'license': 'MIT',
            'sourceSHA256': hashlib.sha256(args.csv.read_bytes()).hexdigest(),
            'method': 'BNC rank when present, otherwise FRQ; listed inflections inherit the lowest rank; unknown words are unmarked',
            'ranks': dict(sorted(ranks.items()))}
    path = ROOT / 'extension/src/ipad/data/word-ranks.json'
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{len(ranks)} ranked forms / {path.stat().st_size} bytes')


if __name__ == '__main__':
    main()
