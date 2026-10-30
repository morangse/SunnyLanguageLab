import { setupAIForm } from './ai-settings.js';
const send = async (type, payload = {}) => {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response || response.error) throw new Error(response?.error || '请重新打开设置');
  return response;
};
const $ = selector => document.querySelector(selector);
const ai = setupAIForm({ send, onState: state => { $('#vocab-count').textContent = `本机已收藏 ${state.vocabCount} 个词 / 表达。`; } });
async function initialize() {
  const state = await send('getState');
  for (const field of $('#preferences').elements) {
    if (!(field.name in state.settings)) continue;
    if (field.type === 'checkbox') field.checked = state.settings[field.name]; else field.value = state.settings[field.name];
  }
  ai.setState(state);
}
$('#preferences').addEventListener('submit', async event => {
  event.preventDefault(); const patch = {};
  for (const field of event.currentTarget.elements) if (field.name) patch[field.name] = field.type === 'checkbox' ? field.checked : field.value;
  try { await send('preferencesPatch', { patch }); $('#preferences-message').textContent = '已保存，视频面板会更新。'; }
  catch (error) { $('#preferences-message').textContent = error.message; }
});
$('#clear-cache').addEventListener('click', async () => {
  try { const result = await send('clearCache'); $('#cache-message').textContent = `清除了 ${result.cleared} 项会话缓存。`; }
  catch (error) { $('#cache-message').textContent = error.message; }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.vocab) $('#vocab-count').textContent = `本机已收藏 ${changes.vocab.newValue?.length || 0} 个词 / 表达。`;
});
void initialize().catch(error => { $('#preferences-message').textContent = error.message; $('#vocab-count').textContent = '读取失败，请重新打开设置。'; });
