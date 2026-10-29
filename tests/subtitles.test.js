import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJSON3, parseVTT, normalizeCues, cueIndex, pairCues, tokenize } from '../extension/src/content/subtitles.js';
import { pickTrack, readYouTube } from '../extension/src/content/youtube.js';

test('JSON3 timing, multi-segment text and empty events produce ordered nonoverlapping cues', () => {
  const rows = parseJSON3({ events: [{ tStartMs: 5000, dDurationMs: 2000, segs: [{ utf8: 'Second' }] },
    { tStartMs: 1000, dDurationMs: 6000, segs: [{ utf8: 'Hello ' }, { utf8: 'world' }] }, { tStartMs: 0 }] });
  assert.deepEqual(rows, [{ start: 1, end: 5, text: 'Hello world' }, { start: 5, end: 7, text: 'Second' }]);
  assert.equal(cueIndex(rows, 0.9), -1); assert.equal(cueIndex(rows, 1), 0); assert.equal(cueIndex(rows, 5), 1); assert.equal(cueIndex(rows, 7), -1);
});
test('VTT handles identifiers, hours, positioning and cue markup', () => {
  const rows = parseVTT('WEBVTT\n\n17\n01:02:03.500 --> 01:02:05.000 align:start\n<v Speaker>Hello</v> world\n');
  assert.deepEqual(rows, [{ start: 3723.5, end: 3725, text: 'Hello world' }]);
});
test('caption normalization drops invalid rows and merges simultaneous segments', () => {
  assert.deepEqual(normalizeCues([{ start: -1, text: 'bad' }, { start: 1, end: 3, text: 'one' },
    { start: 1, end: 4, text: 'two' }]), [{ start: 1, end: 4, text: 'one\ntwo' }]);
});
test('translated cues align on actual overlap, including one translation across two source cues', () => {
  const source = [{ start: 0, end: 2, text: 'one' }, { start: 2, end: 4, text: 'two' }, { start: 5, end: 6, text: 'gap' }];
  assert.deepEqual(pairCues(source, [{ start: 1, end: 3, text: '中文' }]).map(row => row.native), ['中文', '中文', '']);
});
test('tokenization preserves punctuation and apostrophes without interpreting markup', () => {
  const text = "Don't re-write <b>words</b>.";
  assert.equal(tokenize(text).map(row => row.text).join(''), text);
  assert.ok(tokenize(text).some(row => row.word && row.text === "Don't"));
});
test('manual language tracks win over ASR and unrelated languages are not silently selected', () => {
  const tracks = [{ language: 'en-US', automatic: true }, { language: 'en-GB', automatic: false }, { language: 'zh-Hans' }];
  assert.equal(pickTrack(tracks, 'en').language, 'en-GB'); assert.equal(pickTrack(tracks, 'fr'), undefined);
});
test('translation failure preserves source cues and signals a visible warning', async () => {
  let calls = 0;
  const request = async action => {
    if (action === 'snapshot') return { id: 'example', title: 'Example', tracks: [{ url: 'caption', language: 'en' }] };
    if (++calls === 1) return { events: [{ tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: 'Hello' }] }] };
    throw new Error('Translation unavailable');
  };
  const result = await readYouTube({ learnLang: 'en', nativeLang: 'zh' }, request);
  assert.equal(result.cues[0].text, 'Hello'); assert.equal(result.cues[0].native, ''); assert.match(result.warning, /译文/);
});
