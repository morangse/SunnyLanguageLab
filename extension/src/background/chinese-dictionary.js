// Bundled ECDICT subset. Fetches extension resources only, never a remote service.
const buckets = new Map();
export async function lookupChinese(text, readBucket = async letter => {
  const response = await fetch(chrome.runtime.getURL("src/ipad/data/en-zh-" + letter + ".json"));
  if (!response.ok) throw new Error("离线词库暂时无法读取");
  return response.json();
}) {
  const key = String(text || "").trim().toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ");
  if (!/^[a-z][a-z' -]{0,63}$/.test(key)) return null;
  const letter = key[0];
  if (!buckets.has(letter)) {
    const promise = readBucket(letter).catch(error => { buckets.delete(letter); throw error; });
    buckets.set(letter, promise);
    if (buckets.size > 6) buckets.delete(buckets.keys().next().value);
  }
  const bucket = await buckets.get(letter);
  if (!Object.hasOwn(bucket, key)) return null;
  const [meaning, phonetic, lemma] = bucket[key];
  return { kind: "bilingual", text, meaning, phonetic, lemma, source: "ECDICT", offline: true };
}
