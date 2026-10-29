import test from 'node:test';
import assert from 'node:assert/strict';
import { createLookupCache } from '../extension/src/background/cache.js';
import { plainDefinition, readDefinitions, lookupEnglish } from '../extension/src/background/wiktionary.js';
import { explanationRequest, explain } from '../extension/src/background/llm.js';
import { preferences } from '../extension/src/background/settings.js';
import { fetchJSON } from '../extension/src/background/network.js';

test('concurrent cache requests share work, callers cannot mutate cached values, and expiration reloads', async () => {
  let time = 0, calls = 0; const cache = createLookupCache({ ttl: 10, limit: 2, now: () => time });
  const loader = async () => { calls++; return { meaning: 'one' }; };
  const values = await Promise.all([cache.resolve('a', loader), cache.resolve('a', loader)]);
  assert.equal(calls, 1); values[0].meaning = 'changed';
  assert.equal((await cache.resolve('a', loader)).meaning, 'one'); time = 11;
  await cache.resolve('a', loader); assert.equal(calls, 2);
});
test('clearing an in-flight cache does not resurrect its result after completion', async () => {
  const cache = createLookupCache(); let resolve;
  const pending = cache.resolve('secret', () => new Promise(done => { resolve = done; }));
  await Promise.resolve(); cache.clear(); resolve('old'); await pending;
  assert.equal(await cache.resolve('secret', async () => 'new'), 'new');
});
test('Wiktionary HTML becomes plain text and request failure keeps an attribution URL', async () => {
  assert.equal(plainDefinition('<script>bad()</script><i>A</i> &amp; B'), 'A & B');
  assert.deepEqual(readDefinitions({ en: [{ partOfSpeech: 'Noun', definitions: [{ definition: '<b>practice</b>' }] }] }), [{ part: 'Noun', text: 'practice' }]);
  const result = await lookupEnglish('hello', 'en', async () => { throw new Error('offline'); });
  assert.equal(result.url, 'https://en.wiktionary.org/wiki/hello'); assert.equal(result.entries.length, 0);
});
test('AI requests keep keys out of URLs, bound user text and never choose an unrequested provider', async () => {
  const request = explanationRequest({ provider: 'gemini', key: 'private-test-key', model: 'example-model', text: 'hello', sentence: 'Hello world', nativeLang: 'zh' });
  assert.ok(!request.url.includes('private-test-key')); assert.equal(request.headers['x-goog-api-key'], 'private-test-key');
  assert.throws(() => explanationRequest({ provider: 'custom', key: 'x', model: 'example' }));
  const result = await explain({ provider: 'anthropic', key: 'private-test-key', model: 'example-model', text: 'hello' }, async (url, options) => {
    assert.equal(url, 'https://api.anthropic.com/v1/messages'); assert.equal(options.headers['x-api-key'], 'private-test-key');
    return Response.json({ content: [{ type: 'text', text: '你好' }] });
  });
  assert.equal(result.text, '你好');
});
test('network reads are bounded without content-length and time out waiting for headers', async () => {
  await assert.rejects(() => fetchJSON('https://example.test', {}, async () => new Response('x'.repeat(2000001))), /响应过大/);
  await assert.rejects(() => fetchJSON('https://example.test', {}, async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  }), 5), /连接超时/);
});
test('settings reject credential fields, invalid languages and unsupported providers', () => {
  const result = preferences({ enabled: 'false', fontScale: 99, learnLang: '<script>', apiKey: 'private', llmProvider: 'arbitrary' });
  assert.equal(result.enabled, true); assert.equal(result.fontScale, 1.5); assert.equal(result.learnLang, 'en');
  assert.equal(result.llmProvider, 'none'); assert.ok(!('apiKey' in result));
});
