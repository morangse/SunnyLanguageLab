// Shared by the full settings tab and the compact extension-origin panel.
export function setupAIForm({ send, onState = () => {} }) {
  const $ = selector => document.querySelector(selector);
  let settings = {}, hasKeys = {};
  function providerChanged() {
    const provider = $('#provider').value, active = provider !== 'none';
    $('#model').value = settings[provider + 'Model'] || '';
    $('#api-key').value = '';
    $('#api-key').placeholder = hasKeys[provider] ? '已保存，留空沿用' : '填写 API 密钥';
    $('#model').disabled = !active; $('#api-key').disabled = !active;
    $('#forget-key').disabled = !active || !hasKeys[provider];
    const fields = $('[data-ai-fields]'); if (fields) fields.hidden = !active;
    const status = $('#ai-status'); if (status) status.textContent = !active ? '已关闭' : hasKeys[provider] ? '密钥已保存' : '待配置';
  }
  function setState(state) {
    settings = state.settings; hasKeys = state.hasKeys || {};
    $('#provider').value = settings.llmProvider; providerChanged(); onState(state);
  }
  async function refresh() { setState(await send('getState')); }
  $('#provider').addEventListener('change', providerChanged);
  $('#ai-form').addEventListener('submit', async event => {
    event.preventDefault();
    const provider = $('#provider').value, model = $('#model').value.trim(), key = $('#api-key').value.trim();
    const submit = $('#ai-form').querySelector('[type=submit]'); submit.disabled = true;
    try {
      if (provider !== 'none') {
        if (!model) throw new Error('请填写自己账户可用的模型 ID');
        if (!key && !hasKeys[provider]) throw new Error('请填写 API 密钥');
        const origin = provider === 'gemini' ? 'https://generativelanguage.googleapis.com/*' : 'https://api.anthropic.com/*';
        if (chrome.permissions && !await chrome.permissions.request({ origins: [origin] })) throw new Error('未允许访问，原配置已保留');
      }
      const payload = { settings: { llmProvider: provider } };
      if (provider !== 'none') {
        payload.settings[provider + 'Model'] = model;
        if (key) { payload.provider = provider; payload.key = key; }
      }
      await send('saveConfig', payload); await refresh();
      $('#ai-message').textContent = provider === 'none' ? '已关闭 AI。' : '已保存，可在词卡中点「AI 解释」。';
    } catch (error) { $('#ai-message').textContent = error.message; }
    finally { submit.disabled = false; }
  });
  $('#forget-key').addEventListener('click', async () => {
    const provider = $('#provider').value; if (provider === 'none') return;
    try { await send('saveConfig', { provider, key: '', settings: { llmProvider: 'none' } }); await refresh(); $('#ai-message').textContent = '已移除密钥并关闭 AI。'; }
    catch (error) { $('#ai-message').textContent = error.message; }
  });
  $('#recover-ai').addEventListener('click', async () => {
    try {
      const result = await send('recoverLegacyAI'); await refresh();
      $('#ai-message').textContent = result.recovered ? `恢复了 ${result.recovered} 个旧密钥，请核对模型并保存配置。` : '没有可恢复的旧密钥，或当前密钥已存在。';
    } catch (error) { $('#ai-message').textContent = error.message; }
  });
  return { refresh, setState };
}
