import { getToken } from '../lib/auth'
import { fetchAutenticado } from '../lib/authenticatedFetch'

const BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/distribuicao`

export async function distribuicao(path, { method = 'GET', body, download } = {}) {
  const multipart = body instanceof FormData
  const response = await fetchAutenticado(`${BASE}${path}`, {
    method, cache: 'no-store',
    headers: { Authorization: `Token ${getToken()}`, ...(!multipart ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? (multipart ? body : JSON.stringify(body)) : undefined,
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || Object.entries(data).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('; ') || 'Não foi possível concluir. Tente novamente.')
  }
  if (download) {
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = url
    link.download = download
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return
  }
  return response.json()
}
