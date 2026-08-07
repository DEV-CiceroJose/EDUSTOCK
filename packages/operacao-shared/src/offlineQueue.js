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
    const operationId = payload.operacao_id ?? globalThis.crypto.randomUUID()
    return {
      id: operationId,
      payload: payload.operacao_id ? payload : { ...payload, operacao_id: operationId },
      status: "pending",
      attempts: 0,
      createdAt: now(),
      retryAt: null,
      lastError: null,
    }
  }

  function createAttentionEntry(payload, id, lastError) {
    return {
      id,
      payload,
      status: "attention",
      attempts: 0,
      createdAt: now(),
      retryAt: null,
      lastError,
    }
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
  }

  function normalizeEntry(value, index) {
    if (isObject(value?.payload) && value?.id) {
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
    if (isObject(value) && !("payload" in value)) return createEntry(value)
    return createAttentionEntry(
      value,
      `invalid:${storageKey}:${index}`,
      "Entrada offline persistida inválida",
    )
  }

  function read() {
    const raw = localStorage.getItem(storageKey)
    if (raw === null) return []
    try {
      const stored = JSON.parse(raw)
      const hasValidEnvelope = stored?.version === STORAGE_VERSION
        && Array.isArray(stored.entries)
      if (!Array.isArray(stored) && !hasValidEnvelope) {
        return [createAttentionEntry(
          stored,
          `invalid:${storageKey}:storage`,
          "Conteúdo offline persistido inválido",
        )]
      }
      const values = Array.isArray(stored) ? stored : stored.entries
      return values.map(normalizeEntry)
    } catch {
      return [createAttentionEntry(
        raw,
        `invalid:${storageKey}:storage`,
        "Armazenamento offline corrompido",
      )]
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
    if (!payload.operacao_id || !entries.some(
      (entry) => entry.payload?.operacao_id === payload.operacao_id,
    )) {
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

  function requestFlush(requestAnotherPass = false) {
    if (flushInFlight) {
      if (requestAnotherPass) flushRequested = true
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

  function flush() {
    return requestFlush()
  }

  async function retry(id) {
    const entries = read().map((entry) => (
      !id || entry.id === id
        ? { ...entry, status: "pending", retryAt: null }
        : entry
    ))
    write(entries)
    return requestFlush(true)
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
