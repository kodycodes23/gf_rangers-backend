const cacheStore = new Map()

function getCacheEntry(key) {
  const entry = cacheStore.get(key)
  if (!entry) return null

  if (entry.expiresAt <= Date.now()) {
    cacheStore.delete(key)
    return null
  }

  return entry.value
}

function setCacheEntry(key, value, ttlMs) {
  cacheStore.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  })
}

function deleteCacheByPrefix(prefix) {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key)
    }
  }
}

module.exports = {
  getCacheEntry,
  setCacheEntry,
  deleteCacheByPrefix,
}
