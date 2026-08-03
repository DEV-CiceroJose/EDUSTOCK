export function createOfflineQueue({ storageKey, send }) {
  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) ?? "[]")
      return Array.isArray(value) ? value : []
    } catch {
      localStorage.removeItem(storageKey)
      return []
    }
  }

  function write(items) {
    localStorage.setItem(storageKey, JSON.stringify(items))
  }

  function add(item) {
    const items = read()
    if (!items.some((current) => current.operacao_id === item.operacao_id)) {
      items.push(item)
      write(items)
    }
    return item
  }

  async function flush() {
    const pending = read()
    const remaining = []
    const completed = []
    for (let index = 0; index < pending.length; index += 1) {
      const item = pending[index]
      try {
        completed.push(await send(item))
      } catch (error) {
        if (error.status === 401 || error.status === 403) {
          remaining.push(...pending.slice(index))
          break
        }
        if (!error.status) remaining.push(item)
      }
    }
    write(remaining)
    return { completed, remaining }
  }

  return { add, flush, list: read, clear: () => write([]) }
}
