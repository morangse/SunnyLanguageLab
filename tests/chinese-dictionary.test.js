import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lookupChinese } from '../extension/src/background/chinese-dictionary.js';
const read = async letter => JSON.parse(readFileSync(new URL('../extension/src/ipad/data/en-zh-' + letter + '.json', import.meta.url), 'utf8'));
test('licensed offline word data covers common words and inflections without AI', async () => {
  for (const word of ['resilient', 'remarkable', 'learning', 'went', 'children', 'practice']) {
    const row = await lookupChinese(word, read); assert.equal(row.offline, true); assert.match(row.meaning, /[\u3400-\u9fff]/);
  }
  assert.equal((await lookupChinese('went', read)).lemma, 'go');
  assert.equal(await lookupChinese('<script>', read), null);
  const source = JSON.parse(readFileSync(new URL('../extension/src/ipad/data/source.json', import.meta.url), 'utf8'));
  assert.equal(source.commit, 'ab22ad36302cafc6349a050e2b60894855208055');
  assert.match(readFileSync(new URL('../extension/src/ipad/data/ECDICT-LICENSE.txt', import.meta.url), 'utf8'), /MIT License/);
});
