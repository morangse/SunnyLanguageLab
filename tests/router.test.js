import test from 'node:test';
import assert from 'node:assert/strict';
import { localStorage, TOKEN } from './helpers.js';

test('content scripts cannot read keys, mutate AI credentials or configure sync and backups', async () => {
  let listener;
  const local = localStorage({ sunnyGeminiKey: 'private-gemini-test-key' });
  globalThis.chrome = {
    storage: { local }, runtime: {
      id: 'sunny-test', getURL: path => 'chrome-extension://sunny-test/' + path,
      onMessage: { addListener(fn) { listener = fn; } }, onStartup: { addListener() {} }, onInstalled: { addListener() {} }
    }
  };
  await import('../extension/src/background/service-worker.js');
  const message = (body, sender) => new Promise(resolve => listener(body, sender, resolve));
  const content = { id: chrome.runtime.id, tab: { id: 1 }, url: 'https://www.youtube.com/watch?v=test' };
  const options = { id: chrome.runtime.id, url: chrome.runtime.getURL('src/options/options.html') };
  const embedded = { ...options, tab: { id: 1 }, frameId: 2, url: chrome.runtime.getURL('src/options/panel.html') + '#ai' };
  for (const type of ['saveConfig', 'recoverLegacyAI', 'clearCache', 'syncConfigure', 'syncDisconnect', 'syncNow', 'syncArchive', 'vocabBackup', 'vocabLegacyBackup', 'vocabRestore']) {
    assert.match((await message({ type }, content)).error, /设置页/);
  }
  await message({ type: 'preferencesPatch', patch: { llmProvider: 'gemini', geminiModel: 'evil-model', enabled: false } }, content);
  const state = await message({ type: 'getState' }, content);
  assert.equal(state.settings.enabled, false); assert.equal(state.settings.llmProvider, 'none'); assert.ok(state.hasKeys.gemini);
  assert.ok(!JSON.stringify(state).includes('private-gemini-test-key'));
  const updated = await message({ type: 'saveConfig', settings: { llmProvider: 'gemini', geminiModel: 'fixture-model' } }, embedded);
  assert.equal(updated.settings.geminiModel, 'fixture-model');
  for (const url of [options.url + '.evil', 'https://www.youtube.com/src/options/options.html?embedded=1#ai']) {
    assert.match((await message({ type: 'saveConfig' }, { ...embedded, url })).error, /设置页/);
  }
  assert.match((await message({ type: 'saveConfig' }, { ...embedded, url: chrome.runtime.getURL('src/options/panel.html') + '.evil' })).error, /设置页/);
  const config = await message({ type: 'syncConfigure', endpoint: 'https://test.user.workers.dev', token: TOKEN }, options);
  assert.ok(config.hasToken); assert.ok(!JSON.stringify(config).includes(TOKEN));
  await message({ type: 'syncDisconnect' }, options);
  delete globalThis.chrome;
});
