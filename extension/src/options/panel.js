import { setupAIForm } from './ai-settings.js';
const send = async (type, payload = {}) => {
  const result = await chrome.runtime.sendMessage({ type, ...payload });
  if (!result || result.error) throw new Error(result?.error || '请重新打开设置');
  return result;
};
function sectionChanged() {
  const active = location.hash === '#sync' ? 'sync' : 'ai';
  for (const name of ['ai', 'sync']) document.getElementById(name).hidden = name !== active;
  document.querySelectorAll('[data-section]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.section === active)));
  document.scrollingElement.scrollTop = 0;
  if (parent !== window) parent.postMessage({ type: 'sunny-settings-section', section: active }, '*');
}
document.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', () => { location.hash = button.dataset.section; }));
addEventListener('hashchange', sectionChanged); sectionChanged();
const ai = setupAIForm({ send, onState: state => { document.getElementById('vocab-count').textContent = state.vocabCount + ' 个生词'; } });
void ai.refresh().catch(error => { document.getElementById('ai-status').textContent = '连接失败'; document.getElementById('ai-message').textContent = error.message; document.getElementById('vocab-count').textContent = '读取失败'; });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.vocab) document.getElementById('vocab-count').textContent = (changes.vocab.newValue?.length || 0) + ' 个生词';
});
