const STORAGE_VERSION = 1
const RETRY_DELAY_MS = 30_000

export function classifyOfflineError(error) {
  if (!error.status || error.status === 429 || error.status >= 500) return "pending"
  if (error.status === 401 || error.status === 403) return "auth"
  return "attention"
}

export function createOfflineQueue({ storageKey, send, now = Date.now }) {
  const listeners = new Set()
  let flushInFlight = null
  let flushRequested = false

  function createEntry(payload) {
    return {
      id: payload.operacao_id ?? globalThis.crypto.randomUUID(),
      payload,
      status: "pending",
      attempts: 0,
      createdAt: now(),
      retryAt: null,
      lastError: null,
    }
  }

  function normalizeEntry(value) {
    if (value?.payload && value?.id) {
      return {
        id: value.id,
        payload: value.payload,
        status: value.status ?? "pending",
        attempts: value.attempts ?? 0,
        createdAt: value.createdAt ?? now(),
        retryAt: value.retryAt ?? null,
        lastError: value.lastError ?? null,
      }
    }
    return createEntry(value)
  }

  function read() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null")
      const values = Array.isArray(stored)
        ? stored
        : stored?.version === STORAGE_VERSION && Array.isArray(stored.entries)
          ? stored.entries
          : []
      return values.map(normalizeEntry)
    } catch {
      localStorage.removeItem(storageKey)
      return []
    }
  }

  function write(entries) {
    localStorage.setItem(storageKey, JSON.stringify({
      version: STORAGE_VERSION,
      entries,
    }))
    const snapshot = read()
    listeners.forEach((listener) => listener(snapshot))
  }

  function add(payload) {
    const entries = read()
    if (!entries.some((entry) => entry.payload.operacao_id === payload.operacao_id)) {
      entries.push(createEntry(payload))
      write(entries)
    }
    return payload
  }

  async function performFlush() {
    const entries = read()
    const completed = []

    for (let index = 0; index < entries.length; index += 1) {
      const entry = read().find((current) => current.id === entries[index].id)
      if (!entry) continue
      if (entry.status === "attention" || (entry.retryAt && entry.retryAt > now())) {
        continue
      }

      try {
        completed.push(await send(entry.payload))
        write(read().filter((current) => current.id !== entry.id))
      } catch (error) {
        const classification = classifyOfflineError(error)
        const current = read()
        if (current.some((item) => item.id === entry.id)) {
          write(current.map((item) => item.id === entry.id
            ? {
                ...item,
                status: classification === "attention" ? "attention" : "pending",
                attempts: item.attempts + 1,
                retryAt: classification === "pending" ? now() + RETRY_DELAY_MS : null,
                lastError: error.message ?? String(error),
              }
            : item))
        }
        if (classification === "auth") {
          break
        }
      }
    }

    return { completed, remaining: read() }
  }

  function flush() {
    if (flushInFlight) {
      flushRequested = true
    } else {
      flushInFlight = (async () => {
        const completed = []
        do {
          flushRequested = false
          const result = await performFlush()
          completed.push(...result.completed)
        } while (flushRequested)
        return { completed, remaining: read() }
      })().finally(() => {
        flushInFlight = null
      })
    }
    return flushInFlight
  }

  async function retry(id) {
    const entries = read().map((entry) => (
      !id || entry.id === id
        ? { ...entry, status: "pending", retryAt: null }
        : entry
    ))
    write(entries)
    return flush()
  }

  function remove(id) {
    write(read().filter((entry) => entry.id !== id))
  }

  function subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return {
    add,
    flush,
    list: read,
    retry,
    remove,
    subscribe,
    clear: () => write([]),
  }
}
