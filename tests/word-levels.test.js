import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { vocabularyTier } from '../extension/src/content/word-levels.js';
import { preferences, getSettings, recoverLegacyAI } from '../extension/src/background/settings.js';

test('frequency thresholds, inflected forms, unknown words and language opt-out have stable meanings', async () => {
  const data = JSON.parse(await readFile(new URL('../extension/src/ipad/data/word-ranks.json', import.meta.url)));
  assert.equal(data.license, 'MIT'); assert.equal(data.ranks.makes, data.ranks.make);
  const settings = preferences({ vocabLevel: '6500' });
  assert.equal(vocabularyTier('resilient', settings, data.ranks), 4);
  assert.equal(vocabularyTier('Resilient', settings, data.ranks), 4);
  assert.equal(vocabularyTier('a-word-not-in-the-source', settings, data.ranks), 0);
  assert.equal(vocabularyTier('makes', settings, data.ranks), 0);
  assert.equal(vocabularyTier('resilient', { ...settings, vocabHighlight: false }, data.ranks), 0);
  assert.equal(vocabularyTier('resilient', { ...settings, learnLang: 'fr' }, data.ranks), 0);
  const ranks = { a: 2499, b: 2500, c: 4500, d: 6500, e: 9000 };
  assert.deepEqual(['a', 'b', 'c', 'd', 'e'].map(word => vocabularyTier(word, { ...settings, vocabLevel: 'all' }, ranks)), [0, 1, 2, 3, 4]);
});

test('study preferences preserve supported levels and discard injected or unsupported styles', () => {
  const valid = preferences({ vocabLevel: 9000, vocabStyle: 'pill', hoverPause: false, subtitleBackdrop: 'none' });
  assert.equal(valid.vocabLevel, '9000'); assert.equal(valid.vocabStyle, 'pill'); assert.equal(valid.hoverPause, false);
  const invalid = preferences({ vocabLevel: '-1', vocabStyle: 'url(evil)', subtitleBackdrop: '<html>', vocabHighlight: 'yes' });
  assert.equal(invalid.vocabLevel, '4500'); assert.equal(invalid.vocabStyle, 'underline'); assert.equal(invalid.subtitleBackdrop, 'soft');
});

test('same-install legacy settings and explicitly recovered AI keys preserve current values without exposing credentials', async () => {
  const values = { geminiApiKey: 'legacy-fixture-key', sunnyAnthropicKey: 'current-fixture-key', anthropicApiKey: 'older-fixture-key' };
  const storage = { async get(keys) { return Object.fromEntries(keys.filter(key => key in values).map(key => [key, values[key]])); }, async set(patch) { Object.assign(values, patch); } };
  const previous = { async get() { return { settings: { fontScale: 1.25, vocabLevel: '9000', llmProvider: 'gemini', geminiModel: 'legacy-model' } }; } };
  assert.equal((await getSettings(storage, previous)).vocabLevel, '9000');
  const restored = await recoverLegacyAI(storage, previous);
  assert.equal(restored.recovered, 1); assert.equal(restored.settings.fontScale, 1.25);
  assert.equal(values.sunnyGeminiKey, 'legacy-fixture-key'); assert.equal(values.sunnyAnthropicKey, 'current-fixture-key');
  assert.ok(!JSON.stringify(restored).includes('fixture-key'));
  values.sunnyPreferences.vocabLevel = '2500';
  assert.equal((await getSettings(storage, previous)).vocabLevel, '2500');
});
