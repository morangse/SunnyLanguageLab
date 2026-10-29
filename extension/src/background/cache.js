// A bounded, session-scoped cache. A browser restart intentionally clears lookups.
export function createLookupCache({ limit = 128, ttl = 900000, now = Date.now } = {}) {
  const rows = new Map();
  const requests = new Map();
  let epoch = 0;
  return {
    async resolve(key, loader) {
      const prior = rows.get(key);
      if (prior && prior.until > now()) {
        rows.delete(key); rows.set(key, prior);
        return structuredClone(prior.value);
      }
      if (requests.has(key)) return structuredClone(await requests.get(key));
      const generation = epoch;
      const task = Promise.resolve().then(loader).then(value => {
        if (generation === epoch) {
          rows.delete(key); rows.set(key, { value: structuredClone(value), until: now() + ttl });
          while (rows.size > limit) rows.delete(rows.keys().next().value);
        }
        return value;
      });
      requests.set(key, task);
      try { return structuredClone(await task); }
      finally { if (requests.get(key) === task) requests.delete(key); }
    },
    clear() { const count = rows.size; epoch++; rows.clear(); requests.clear(); return count; }
  };
}
