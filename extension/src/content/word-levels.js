let loading;
export function vocabularyTier(word, settings, ranks) {
  if (!settings.vocabHighlight || settings.learnLang.split('-')[0] !== 'en') return 0;
  const rank = ranks?.[word.toLowerCase().replaceAll('’', "'")];
  if (!rank || rank < 2500 || (settings.vocabLevel !== 'all' && rank < Number(settings.vocabLevel))) return 0;
  return rank < 4500 ? 1 : rank < 6500 ? 2 : rank < 9000 ? 3 : 4;
}
export function loadWordRanks() {
  if (!loading) {
    const url = globalThis.chrome?.runtime?.getURL ? chrome.runtime.getURL('src/ipad/data/word-ranks.json') : new URL('../ipad/data/word-ranks.json', import.meta.url);
    loading = fetch(url).then(response => { if (!response.ok) throw new Error('词频数据未能读取'); return response.json(); })
      .then(data => data.ranks).catch(error => { loading = null; throw error; });
  }
  return loading;
}
