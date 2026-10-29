"""Compile an attributed offline English-Chinese subset from a pinned ECDICT CSV.

Usage: python scripts/build_chinese_dictionary.py --download
The source CSV is scratch data, not an extension asset. No network is used unless
--download is supplied. Data files and the upstream MIT license ship together.
"""
import argparse
import csv
import hashlib
import io
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMMIT = "ab22ad36302cafc6349a050e2b60894855208055"
SOURCE = f"https://raw.githubusercontent.com/skywind3000/ECDICT/{COMMIT}/ecdict.csv"
LICENSE = f"https://raw.githubusercontent.com/skywind3000/ECDICT/{COMMIT}/LICENSE"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--csv", type=Path, default=ROOT.parent / "ecdict-source.csv")
    args = parser.parse_args()
    output = ROOT / "extension/src/ipad/data"
    output.mkdir(parents=True, exist_ok=True)
    if args.download:
        with urllib.request.urlopen(SOURCE, timeout=60) as response:
            with args.csv.open("wb") as stream:
                while block := response.read(1024 * 1024):
                    stream.write(block)
        with urllib.request.urlopen(LICENSE, timeout=30) as response:
            (output / "ECDICT-LICENSE.txt").write_bytes(response.read())
    entries = {}
    exchanges = []
    with args.csv.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            word = row["word"].strip().lower()
            translation = row.get("translation", "").strip().replace("\\n", "\n")
            if not re.fullmatch(r"[a-z][a-z' -]{0,63}", word) or not re.search(r"[\u3400-\u9fff]", translation):
                continue
            ranks = [int(row.get(key) or 0) for key in ("bnc", "frq")]
            tagged = bool(row.get("tag")) or int(row.get("collins") or 0) > 0 or row.get("oxford") == "1"
            if not tagged and not any(0 < rank <= 30000 for rank in ranks):
                continue
            entries[word] = [translation[:2400], row.get("phonetic", ""), word]
            exchanges.append((word, row.get("exchange", "")))
    headwords = len(entries)
    # Add the upstream inflections only after every exact headword is installed.
    for lemma, exchange in exchanges:
        for item in exchange.split("/"):
            if ":" not in item:
                continue
            kind, values = item.split(":", 1)
            if kind not in ("p", "d", "i", "3", "r", "t", "s"):
                continue
            for word in values.split(","):
                word = word.strip().lower()
                if re.fullmatch(r"[a-z][a-z' -]{0,63}", word) and word not in entries:
                    entries[word] = entries[lemma]
    buckets = {}
    for word, value in sorted(entries.items()):
        buckets.setdefault(word[0], {})[word] = value
    for letter, bucket in buckets.items():
        (output / f"en-zh-{letter}.json").write_text(json.dumps(bucket, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    metadata = {
        "name": "ECDICT offline English-Chinese subset", "source": SOURCE,
        "commit": COMMIT, "license": "MIT", "headwords": headwords,
        "lookupForms": len(entries), "sourceSHA256": hashlib.sha256(args.csv.read_bytes()).hexdigest(),
        "selection": "Tagged/exam/Oxford/Collins headwords or BNC/FRQ rank <= 30000; plus listed inflections"
    }
    (output / "source.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, ensure_ascii=False))

if __name__ == "__main__":
    main()
