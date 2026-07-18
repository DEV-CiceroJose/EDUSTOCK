# Redesign dos apps de PIN (app-cozinha + app-alunos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `app-cozinha/` and `app-alunos/` (identidade visual, logout por inatividade, robustez de rede) sem extrair um pacote de UI compartilhado entre eles.

**Architecture:** Os dois apps Vite permanecem independentes. Cada um ganha, em paralelo e de forma deliberadamente duplicada: um hook `useIdleLogout`, uma versão de `api.js` com retry seletivo, tokens/ícones consistentes com `frontend/`, e testes Vitest cobrindo só a lógica nova de risco (idle timeout, retry).

**Tech Stack:** React 19, Vite 8, Tailwind CSS v4, react-router-dom 7, lucide-react (novo), Vitest + Testing Library (novo nos dois apps).

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-07-17-redesign-apps-pin-design.md`.
- Nenhum pacote compartilhado entre `app-cozinha/` e `app-alunos/` — cada mudança é replicada manualmente nos dois projetos (decisão explícita da spec §7).
- `req()` em `api.js` tem retry **desligado por padrão**; só chamadas explicitamente marcadas `{ retry: true }` reenviam em falha de rede. `baixaProducao` nunca reenvia (spec §5.1 — não é idempotente no backend).
- Timeout de inatividade: default 5 minutos, configurável via `VITE_IDLE_TIMEOUT_MIN`.
- Versões de teste alinhadas com `frontend/package.json`: `vitest@^4.1.8`, `jsdom@^29.1.1`, `@testing-library/react@^16.3.2`, `@testing-library/jest-dom@^6.9.1`.
- Nenhum emoji deve sobrar como ícone nos dois apps ao final do plano — todos vêm de `lucide-react`.

---

### Task 1: app-cozinha — infraestrutura de teste + `useIdleLogout`

**Files:**
- Modify: `app-cozinha/package.json`
- Modify: `app-cozinha/vite.config.js`
- Create: `app-cozinha/src/test-setup.js`
- Create: `app-cozinha/src/useIdleLogout.js`
- Create: `app-cozinha/src/useIdleLogout.test.js`
- Modify: `app-cozinha/src/App.jsx`

**Interfaces:**
- Produces: `useIdleLogout(aoExpirar: () => void, minutos?: number): void` — exportado de `app-cozinha/src/useIdleLogout.js`, usado por Task 4 (nenhuma outra task depende disso além da própria integração em `App.jsx` feita aqui).

- [ ] **Step 1: Instalar dependências de teste**

Run: `cd app-cozinha && npm install --save-dev vitest@^4.1.8 jsdom@^29.1.1 @testing-library/react@^16.3.2 @testing-library/jest-dom@^6.9.1`

Expected: `package.json` ganha as 4 entradas em `devDependencies`.

- [ ] **Step 2: Adicionar script de teste**

Modify `app-cozinha/package.json`, dentro de `"scripts"`, adicione:

```json
"test": "vitest run"
```

(fica ao lado de `"dev"`, `"build"`, `"preview"`, mesmo padrão de `frontend/package.json`)

- [ ] **Step 3: Configurar Vitest em `vite.config.js`**

Substitua o conteúdo de `app-cozinha/vite.config.js` por:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5175,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.js',
  },
})
```

- [ ] **Step 4: Criar `src/test-setup.js`**

Create `app-cozinha/src/test-setup.js`:

```js
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 5: Escrever o teste do hook (falhando)**

Create `app-cozinha/src/useIdleLogout.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIdleLogout } from './useIdleLogout.js'

describe('useIdleLogout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('chama aoExpirar depois do tempo configurado sem interação', () => {
    const aoExpirar = vi.fn()
    renderHook(() => useIdleLogout(aoExpirar, 5))

    vi.advanceTimersByTime(5 * 60 * 1000)

    expect(aoExpirar).toHaveBeenCalledTimes(1)
  })

  it('não chama aoExpirar se houver interação antes do prazo', () => {
    const aoExpirar = vi.fn()
    renderHook(() => useIdleLogout(aoExpirar, 5))

    vi.advanceTimersByTime(4 * 60 * 1000)
    window.dispatchEvent(new Event('keydown'))
    vi.advanceTimersByTime(4 * 60 * 1000)

    expect(aoExpirar).not.toHaveBeenCalled()
  })

  it('reseta o timer a cada evento e só expira depois do último', () => {
    const aoExpirar = vi.fn()
    renderHook(() => useIdleLogout(aoExpirar, 5))

    vi.advanceTimersByTime(4 * 60 * 1000)
    window.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(5 * 60 * 1000)

    expect(aoExpirar).toHaveBeenCalledTimes(1)
  })

  it('desliga os listeners ao desmontar', () => {
    const aoExpirar = vi.fn()
    const { unmount } = renderHook(() => useIdleLogout(aoExpirar, 5))

    unmount()
    vi.advanceTimersByTime(5 * 60 * 1000)

    expect(aoExpirar).not.toHaveBeenCalled()
  })

  it('usa default de 5 minutos quando VITE_IDLE_TIMEOUT_MIN não está setada', () => {
    const aoExpirar = vi.fn()
    renderHook(() => useIdleLogout(aoExpirar))

    vi.advanceTimersByTime(5 * 60 * 1000 - 1)
    expect(aoExpirar).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(aoExpirar).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 6: Rodar o teste e confirmar que falha**

Run: `cd app-cozinha && npx vitest run src/useIdleLogout.test.js`
Expected: FAIL — `Failed to resolve import "./useIdleLogout.js"` (o arquivo ainda não existe).

- [ ] **Step 7: Implementar o hook**

Create `app-cozinha/src/useIdleLogout.js`:

```js
import { useEffect, useRef } from 'react'

const EVENTOS = ['pointerdown', 'touchstart', 'keydown']

function minutosConfigurados() {
  const raw = import.meta.env.VITE_IDLE_TIMEOUT_MIN
  const min = Number(raw)
  return Number.isFinite(min) && min > 0 ? min : 5
}

/**
 * Desloga automaticamente após N minutos sem interação do usuário
 * (pointerdown, touchstart, keydown). O timer reinicia a cada interação,
 * não a cada re-render — aoExpirar é lido de uma ref interna para não
 * precisar ser memoizado pelo chamador.
 *
 * @param {() => void} aoExpirar
 * @param {number} [minutos] — sobrescreve VITE_IDLE_TIMEOUT_MIN (default 5); usado nos testes
 */
export function useIdleLogout(aoExpirar, minutos = minutosConfigurados()) {
  const timerRef = useRef(null)
  const aoExpirarRef = useRef(aoExpirar)
  aoExpirarRef.current = aoExpirar

  useEffect(() => {
    function reiniciar() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => aoExpirarRef.current(), minutos * 60 * 1000)
    }

    reiniciar()
    EVENTOS.forEach((ev) => window.addEventListener(ev, reiniciar))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      EVENTOS.forEach((ev) => window.removeEventListener(ev, reiniciar))
    }
  }, [minutos])
}
```

- [ ] **Step 8: Rodar o teste e confirmar que passa**

Run: `cd app-cozinha && npx vitest run src/useIdleLogout.test.js`
Expected: PASS — 5 testes verdes.

- [ ] **Step 9: Integrar o hook em `App.jsx`**

Substitua o conteúdo de `app-cozinha/src/App.jsx` por:

```jsx
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import PinLogin from './PinLogin.jsx'
import ProducaoView from './ProducaoView.jsx'
import { isLoggedIn, logout } from './api.js'
import { useIdleLogout } from './useIdleLogout.js'

function Protegido({ children }) {
  const navigate = useNavigate()
  useIdleLogout(() => {
    logout()
    navigate('/login', { replace: true })
  })

  return isLoggedIn() ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PinLogin />} />
        <Route
          path="/producao"
          element={
            <Protegido>
              <ProducaoView />
            </Protegido>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 10: Verificação manual**

Run: `cd app-cozinha && npm run dev`

Abra o app, logue com o PIN de teste, e confirme no DevTools que não há erros no console. Verificação completa do timeout (esperar 5 min) fica para depois que `VITE_IDLE_TIMEOUT_MIN=1` estiver setado num `.env.local` de teste manual — não é obrigatório nesta etapa, os testes automatizados do Step 8 já cobrem a lógica.

- [ ] **Step 11: Commit**

```bash
git add app-cozinha/package.json app-cozinha/package-lock.json app-cozinha/vite.config.js app-cozinha/src/test-setup.js app-cozinha/src/useIdleLogout.js app-cozinha/src/useIdleLogout.test.js app-cozinha/src/App.jsx
git commit -m "feat(app-cozinha): logout automático por inatividade + infra de teste"
```

---

### Task 2: app-cozinha — retry seletivo em `api.js`

**Files:**
- Modify: `app-cozinha/src/api.js`
- Create: `app-cozinha/src/api.test.js`

**Interfaces:**
- Consumes: nenhuma (task independente de Task 1).
- Produces: `getPlano(data, turno)` continua com a mesma assinatura, agora com retry automático. `baixaProducao(data, turno, itens?)` continua com a mesma assinatura, explicitamente sem retry. Task 4 consome as duas sem mudança de call site.

- [ ] **Step 1: Escrever os testes de retry (falhando)**

Create `app-cozinha/src/api.test.js`:

```js
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { getPlano, baixaProducao } from './api.js'

const originalFetch = global.fetch

function respostaJson(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  }
}

describe('api.js — retry de rede', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('getPlano tenta de novo depois de uma falha de rede e retorna no sucesso', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(respostaJson(200, { itens: [] }))
    global.fetch = fetchMock

    const resultado = await getPlano('2026-07-17', 'MANHA')

    expect(resultado).toEqual({ itens: [] })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  }, 10000)

  it('baixaProducao NUNCA tenta de novo depois de uma falha de rede', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    global.fetch = fetchMock

    await expect(baixaProducao('2026-07-17', 'MANHA')).rejects.toThrow('Failed to fetch')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('erro HTTP de aplicação (4xx) nunca é reenviado, mesmo em endpoint com retry:true', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaJson(403, { detail: 'Módulo inativo' }))
    global.fetch = fetchMock

    await expect(getPlano('2026-07-17', 'MANHA')).rejects.toThrow('Módulo inativo')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd app-cozinha && npx vitest run src/api.test.js`
Expected: FAIL — `getPlano` hoje não reenvia em falha de rede (`fetchMock` chamado 1x, teste espera 2x) e lança o `TypeError` original sem cair no `catch` esperado.

- [ ] **Step 3: Implementar o retry em `req()`**

Substitua o conteúdo de `app-cozinha/src/api.js` por:

```js
/**
 * api.js — cliente HTTP do app-cozinha
 *
 * Todos os pedidos vão para /api/operacao/*
 * Nunca expõe preços, fornecedores ou relatórios financeiros.
 */

const BASE = import.meta.env.VITE_API_BASE ?? ''

function token() {
  return sessionStorage.getItem('cozinha_token') ?? ''
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const BACKOFF_MS = [500, 1500]

/**
 * @param {string} method
 * @param {string} path
 * @param {object} [body]
 * @param {{ retry?: boolean }} [opts] — retry: reenvia até 2x em falha de rede/timeout.
 *   Nunca reenvia por causa de uma resposta HTTP de erro (4xx/5xx), só quando o
 *   fetch falha antes de obter resposta (rede caiu, timeout).
 */
async function req(method, path, body, opts = {}) {
  const { retry = false } = opts
  const headers = { 'Content-Type': 'application/json' }
  const t = token()
  if (t) headers['X-Operacao-Token'] = t

  const tentativasTotais = retry ? BACKOFF_MS.length + 1 : 1

  let ultimoErroDeRede = null
  for (let tentativa = 0; tentativa < tentativasTotais; tentativa++) {
    if (tentativa > 0) await esperar(BACKOFF_MS[tentativa - 1])

    let res
    try {
      res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
      })
    } catch (e) {
      ultimoErroDeRede = e
      continue // falha de rede/timeout: tenta de novo se ainda houver tentativas
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const err = new Error(data.detail ?? `HTTP ${res.status}`)
      err.status = res.status
      err.data = data
      throw err // erro de aplicação: nunca reenviar
    }

    if (res.status === 204) return null
    return res.json()
  }

  throw ultimoErroDeRede
}

/**
 * Login com PIN da cozinha.
 */
export async function login(pin) {
  const data = await req('POST', '/api/operacao/auth/', {
    pin,
    perfil: 'COZINHA',
  })
  sessionStorage.setItem('cozinha_token', data.token)
  return data
}

export function logout() {
  sessionStorage.removeItem('cozinha_token')
}

export function isLoggedIn() {
  return !!token()
}

/**
 * Retorna o plano de produção do dia para o turno informado.
 * GET é sempre seguro para retry — não tem efeito colateral.
 */
export async function getPlano(data, turno) {
  return req('GET', `/api/operacao/plano-do-dia/?data=${data}&turno=${turno}`, undefined, { retry: true })
}

/**
 * Executa a baixa de produção: registra saídas de estoque para cada item.
 *
 * retry: false explícito — core/operacao.py:baixa_de_producao cria uma
 * Movimentacao de saída a cada chamada, sem deduplicação. Reenviar
 * automaticamente depois de uma falha de rede arrisca debitar o estoque
 * duas vezes, então esta chamada NUNCA reenvia sozinha.
 */
export async function baixaProducao(data, turno, itens) {
  const body = { data, turno }
  if (itens) body.itens = itens
  return req('POST', '/api/operacao/baixa-de-producao/', body, { retry: false })
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd app-cozinha && npx vitest run src/api.test.js`
Expected: PASS — 3 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add app-cozinha/src/api.js app-cozinha/src/api.test.js
git commit -m "feat(app-cozinha): retry automático seguro em getPlano, nunca em baixaProducao"
```

---

### Task 3: app-cozinha — identidade visual + `PinLogin.jsx`

**Files:**
- Modify: `app-cozinha/package.json`
- Modify: `app-cozinha/src/index.css`
- Modify: `app-cozinha/src/PinLogin.jsx`
- Create: `app-cozinha/src/PinLogin.test.jsx`

**Interfaces:**
- Consumes: nenhuma.
- Produces: token `--color-accent`/`--color-accent-tint` em `index.css`, disponíveis via utilitários Tailwind `bg-accent`/`text-accent`/`bg-accent-tint` para Task 4.

- [ ] **Step 1: Instalar lucide-react**

Run: `cd app-cozinha && npm install lucide-react`

Expected: `package.json` ganha `lucide-react` em `dependencies`.

- [ ] **Step 2: Adicionar tokens de acento e mover a cor de ação primária para laranja**

Modify `app-cozinha/src/index.css`. No bloco `@theme`, logo depois de `--color-brand-tint: #e7efe8;`, adicione:

```css
--color-accent:      #e07a3e;
--color-accent-tint: #fbe9d9;
```

Depois, troque a definição de `.btn-primary` (cor de ação principal — botão "Dar Baixa de Produção" e "Fechar" do resultado) de sálvia para laranja:

```css
.btn-primary {
  background: var(--color-accent);
  color: #fff;
  box-shadow: 0 8px 24px -10px rgba(224, 122, 62, 0.55);
}
.btn-primary:hover:not(:disabled) { filter: brightness(1.04); }
```

E `.numkey-confirm` (declarado no arquivo mas não usado hoje em nenhum `.jsx` do app-cozinha — mantém o token consistente para o caso de ser usado no futuro):

```css
.numkey-confirm {
  background: var(--color-accent);
  color: #fff;
  border-color: var(--color-accent);
}
.numkey-confirm:active { filter: brightness(0.92); }
```

- [ ] **Step 3: Escrever o teste de `PinLogin` (falhando)**

Create `app-cozinha/src/PinLogin.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PinLogin from './PinLogin.jsx'
import { login } from './api.js'

vi.mock('./api.js', () => ({
  login: vi.fn(),
}))

describe('PinLogin (app-cozinha)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mostra o ícone ChefHat no cabeçalho, sem emoji', () => {
    render(
      <MemoryRouter>
        <PinLogin />
      </MemoryRouter>
    )

    expect(screen.getByTestId('icone-cabecalho')).toBeInTheDocument()
    expect(screen.queryByText('🍽️')).not.toBeInTheDocument()
  })

  it('chama login ao completar os 4 dígitos do PIN', () => {
    login.mockResolvedValue({ token: 'abc' })

    render(
      <MemoryRouter>
        <PinLogin />
      </MemoryRouter>
    )

    ;['1', '2', '3', '4'].forEach((digito) => {
      fireEvent.click(screen.getByRole('button', { name: digito }))
    })

    expect(login).toHaveBeenCalledWith('1234')
  })
})
```

- [ ] **Step 4: Rodar o teste e confirmar que falha**

Run: `cd app-cozinha && npx vitest run src/PinLogin.test.jsx`
Expected: FAIL — `getByTestId('icone-cabecalho')` não encontra nada (o componente ainda renderiza o emoji 🍽️, sem `data-testid`).

- [ ] **Step 5: Reescrever `PinLogin.jsx`**

Substitua o conteúdo de `app-cozinha/src/PinLogin.jsx` por:

```jsx
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChefHat, Delete } from 'lucide-react'
import { login } from './api.js'

export default function PinLogin() {
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // PIN configurado via .env — validação final sempre no backend
  const pinEsperado = import.meta.env.VITE_PIN_COZINHA ?? ''

  const pressKey = useCallback((val) => {
    setErro('')
    if (val === 'back') {
      setPin((p) => p.slice(0, -1))
    } else if (pin.length < 4) {
      const novoPin = pin + val
      setPin(novoPin)
      if (novoPin.length === 4) confirmar(novoPin)
    }
  }, [pin]) // eslint-disable-line

  async function confirmar(pinVal = pin) {
    if (pinVal.length !== 4) return

    // Verificação local antes de ir ao servidor (reduz latência na interface)
    if (pinEsperado && pinVal !== pinEsperado) {
      setErro('PIN inválido.')
      setPin('')
      return
    }

    setLoading(true)
    try {
      await login(pinVal)
      navigate('/producao', { replace: true })
    } catch (e) {
      setErro(e.message ?? 'Falha na conexão.')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back']

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col items-center justify-center bg-white px-6 py-10">
      <div className="mb-8 text-center">
        <div
          className="mx-auto mb-4 grid place-items-center rounded-3xl bg-accent text-white"
          style={{ width: 72, height: 72 }}
        >
          <ChefHat size={32} data-testid="icone-cabecalho" />
        </div>
        <h1 className="m-0 text-[1.6rem] font-extrabold">Produção</h1>
        <p className="mt-1.5 text-base text-ink-soft">Digite o PIN da cozinha</p>
      </div>

      <div className="mb-6 flex items-center justify-center">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`pin-dot${i < pin.length ? ' filled' : ''}`} />
        ))}
      </div>

      {erro && (
        <div className="mb-4 w-full rounded-2xl bg-err-tint px-4 py-3 text-center text-[0.95rem] font-semibold text-err">
          {erro}
        </div>
      )}

      <div className="grid w-full gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {teclas.map((t, i) => {
          if (t === '') return <div key={i} />
          if (t === 'back') {
            return (
              <button key="back" onClick={() => pressKey('back')} className="numkey numkey-back" aria-label="Apagar" disabled={loading}>
                <Delete size={22} />
              </button>
            )
          }
          return (
            <button key={t} onClick={() => pressKey(t)} className="numkey" disabled={loading || pin.length >= 4}>
              {t}
            </button>
          )
        })}
      </div>

      {loading && (
        <p className="mt-6 text-center text-[0.95rem] text-ink-soft">Verificando…</p>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `cd app-cozinha && npx vitest run src/PinLogin.test.jsx`
Expected: PASS — 2 testes verdes.

- [ ] **Step 7: Verificação visual manual**

Run: `cd app-cozinha && npm run dev`

Abra `http://localhost:5175/login` e confirme visualmente: círculo do cabeçalho laranja (não mais sálvia), ícone de talheres (Lucide) em vez de 🍽️, teclado numérico inalterado.

- [ ] **Step 8: Commit**

```bash
git add app-cozinha/package.json app-cozinha/package-lock.json app-cozinha/src/index.css app-cozinha/src/PinLogin.jsx app-cozinha/src/PinLogin.test.jsx
git commit -m "feat(app-cozinha): identidade visual com acento laranja e ícones lucide-react"
```

---

### Task 4: app-cozinha — `ProducaoView.jsx` (ícones, estilo, robustez)

**Files:**
- Modify: `app-cozinha/src/ProducaoView.jsx`
- Create: `app-cozinha/src/ProducaoView.test.jsx`

**Interfaces:**
- Consumes: `getPlano(data, turno)` e `baixaProducao(data, turno, itens?)` de Task 2 (mesmas assinaturas, comportamento de retry já embutido). `logout()` de `api.js` (inalterado).

- [ ] **Step 1: Escrever os testes (falhando)**

Create `app-cozinha/src/ProducaoView.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProducaoView from './ProducaoView.jsx'
import { getPlano, baixaProducao } from './api.js'

vi.mock('./api.js', () => ({
  getPlano: vi.fn(),
  baixaProducao: vi.fn(),
  logout: vi.fn(),
}))

const PLANO_BASE = {
  data: '2026-07-17',
  turno: 'MANHA',
  total_alunos: 120,
  previsao: null,
  itens: [
    {
      produto_id: 1,
      produto_nome: 'Arroz',
      categoria_nome: 'Alimentos',
      unidade: 'KG',
      quantidade: '5.000',
      quantidade_legivel: '5,0 kg',
      saldo_atual: '20.000',
      estoque_insuficiente: false,
    },
  ],
}

function renderView() {
  return render(
    <MemoryRouter>
      <ProducaoView />
    </MemoryRouter>
  )
}

describe('ProducaoView (app-cozinha)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPlano.mockResolvedValue(PLANO_BASE)
  })

  it('mostra o ícone de categoria correto e nenhum emoji', async () => {
    renderView()

    expect(await screen.findByTestId('icone-categoria-alimento')).toBeInTheDocument()
    expect(screen.queryByText('⚠️')).not.toBeInTheDocument()
    expect(screen.queryByText('✅')).not.toBeInTheDocument()
  })

  it('não envia baixaProducao duas vezes em cliques duplos', async () => {
    let resolverBaixa
    baixaProducao.mockReturnValue(new Promise((resolve) => { resolverBaixa = resolve }))

    renderView()
    await screen.findByTestId('icone-categoria-alimento')

    fireEvent.click(screen.getByRole('button', { name: 'Dar Baixa de Produção' }))
    const botaoConfirmar = await screen.findByRole('button', { name: /Dar baixa/ })

    fireEvent.click(botaoConfirmar)
    fireEvent.click(botaoConfirmar)

    resolverBaixa({ data: '2026-07-17', turno: 'MANHA', resultados: [], sucesso: 1, falhas: 0 })
    await waitFor(() => expect(baixaProducao).toHaveBeenCalledTimes(1))
  })

  it('em falha de rede, mostra aviso e recarrega o plano automaticamente', async () => {
    baixaProducao.mockRejectedValue(new TypeError('Failed to fetch'))

    renderView()
    await screen.findByTestId('icone-categoria-alimento')

    fireEvent.click(screen.getByRole('button', { name: 'Dar Baixa de Produção' }))
    fireEvent.click(await screen.findByRole('button', { name: /Dar baixa/ }))

    await waitFor(() => {
      expect(document.body.textContent).toContain('O plano foi recarregado')
    })
    expect(getPlano).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd app-cozinha && npx vitest run src/ProducaoView.test.jsx`
Expected: FAIL nos 3 testes — `icone-categoria-alimento` não existe ainda (SVG sem `data-testid`), e a mensagem "O plano foi recarregado" não existe (catch atual não recarrega o plano).

- [ ] **Step 3: Reescrever `ProducaoView.jsx`**

Substitua o conteúdo de `app-cozinha/src/ProducaoView.jsx` por:

```jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPlano, baixaProducao, logout } from './api.js'
import { UtensilsCrossed, Droplets, Package, AlertTriangle, CheckCircle2 } from 'lucide-react'

const TURNOS = [
  { key: 'MANHA', label: 'Manhã' },
  { key: 'TARDE', label: 'Tarde' },
  { key: 'INTEGRAL', label: 'Integral' },
]

/** Formata YYYY-MM-DD para dd/mm/aaaa */
function formatarData(iso) {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/** Retorna a data de hoje em YYYY-MM-DD (horário local) */
function hoje() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Determina o turno padrão pelo horário atual */
function turnoAtual() {
  const h = new Date().getHours()
  if (h < 12) return 'MANHA'
  if (h < 18) return 'TARDE'
  return 'INTEGRAL'
}

/* ─── Ícone por categoria ────────────────────────────────────────────── */
function IconeCategoria({ nome }) {
  const n = (nome ?? '').toLowerCase()
  if (n.includes('alimento') || n.includes('merenda') || n.includes('refeit')) {
    return <UtensilsCrossed size={24} data-testid="icone-categoria-alimento" />
  }
  if (n.includes('limpeza') || n.includes('higie')) {
    return <Droplets size={24} data-testid="icone-categoria-limpeza" />
  }
  return <Package size={24} data-testid="icone-categoria-padrao" />
}

/* ─── Card de produto ─────────────────────────────────────────────────── */
function CardProduto({ item }) {
  return (
    <div className={`recipe-card${item.estoque_insuficiente ? ' insufficient' : ''}`}>
      <div
        className="grid shrink-0 place-items-center rounded-2xl"
        style={{
          width: 52, height: 52,
          background: item.estoque_insuficiente ? 'rgba(193,68,68,0.12)' : 'var(--color-brand-tint)',
          color: item.estoque_insuficiente ? 'var(--color-err)' : 'var(--color-brand)',
        }}
      >
        <IconeCategoria nome={item.categoria_nome} />
      </div>

      <div className="min-w-0 flex-1">
        <div style={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2 }}>
          {item.produto_nome}
        </div>
        <div style={{ color: 'var(--color-ink-soft)', fontSize: '0.85rem', marginTop: 2 }}>
          {item.categoria_nome}
        </div>
      </div>

      <div className="text-right shrink-0">
        <div
          style={{
            fontSize: '1.4rem',
            fontWeight: 800,
            color: item.estoque_insuficiente ? 'var(--color-err)' : 'var(--color-brand)',
            lineHeight: 1,
          }}
        >
          {item.quantidade_legivel ?? `${item.quantidade} ${item.unidade}`}
        </div>
        {item.estoque_insuficiente && (
          <div className="mt-1 flex items-center justify-end gap-1 text-[0.78rem] font-bold text-err">
            <AlertTriangle size={14} /> Estoque insuficiente
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Modal de confirmação da baixa ─────────────────────────────────── */
function ModalBaixa({ plano, onConfirmar, onCancelar, loading }) {
  const itensDisponiveis = plano.itens.filter((i) => !i.estoque_insuficiente)

  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="m-0 mb-1 text-[1.3rem] font-extrabold">
          Confirmar baixa de produção
        </h2>
        <p className="m-0 mb-5 text-[0.9rem] text-ink-soft">
          Serão registradas saídas de estoque para os itens abaixo.
        </p>

        <div className="mb-6 flex flex-col gap-2">
          {itensDisponiveis.map((item) => (
            <div key={item.produto_id} className="flex items-center justify-between rounded-[14px] bg-canvas px-4 py-3">
              <span className="text-[0.95rem] font-semibold">{item.produto_nome}</span>
              <span className="text-base font-extrabold text-brand">
                {item.quantidade_legivel ?? `${item.quantidade} ${item.unidade}`}
              </span>
            </div>
          ))}
        </div>

        {plano.itens.some((i) => i.estoque_insuficiente) && (
          <div className="mb-5 rounded-[14px] bg-warn-tint px-4 py-3 text-[0.88rem] font-semibold text-warn">
            Itens com estoque insuficiente serão ignorados.
          </div>
        )}

        <button
          className="btn-action btn-primary"
          onClick={onConfirmar}
          disabled={loading || itensDisponiveis.length === 0}
        >
          {loading ? 'Registrando…' : (
            <>
              <CheckCircle2 size={20} /> Dar baixa
            </>
          )}
        </button>
        <button
          onClick={onCancelar}
          className="mt-3 w-full cursor-pointer border-none bg-transparent p-[0.9rem] text-[0.95rem] font-semibold text-ink-soft"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

/* ─── Modal de resultado da baixa ───────────────────────────────────── */
function ModalResultado({ resultado, onFechar }) {
  const IconeResultado = resultado.falhas === 0 ? CheckCircle2 : AlertTriangle
  const corIcone = resultado.falhas === 0 ? 'text-ok' : 'text-warn'

  return (
    <div className="modal-overlay">
      <div className="modal-sheet text-center">
        <IconeResultado size={48} className={`mx-auto mb-2 ${corIcone}`} data-testid="icone-resultado" />
        <h2 className="m-0 mb-2 text-[1.3rem] font-extrabold">
          Baixa concluída
        </h2>

        <div className="my-4 flex justify-center gap-6">
          <div>
            <div className="text-[2rem] font-extrabold text-ok">{resultado.sucesso}</div>
            <div className="text-[0.8rem] text-ink-soft">sucesso(s)</div>
          </div>
          {resultado.falhas > 0 && (
            <div>
              <div className="text-[2rem] font-extrabold text-err">{resultado.falhas}</div>
              <div className="text-[0.8rem] text-ink-soft">falha(s)</div>
            </div>
          )}
        </div>

        {resultado.resultados?.filter((r) => !r.ok).map((r) => (
          <div key={r.produto_id} className="mb-1.5 rounded-xl bg-err-tint px-3.5 py-2.5 text-left text-[0.85rem] font-semibold text-err">
            {r.produto_nome}: {r.erro}
          </div>
        ))}

        <button className="btn-action btn-primary mt-4" onClick={onFechar}>
          Fechar
        </button>
      </div>
    </div>
  )
}

/* ─── View principal ─────────────────────────────────────────────────── */
export default function ProducaoView() {
  const navigate = useNavigate()
  const [turno, setTurno] = useState(turnoAtual)
  const [data] = useState(hoje)
  const [plano, setPlano] = useState(null)
  const [loadingPlano, setLoadingPlano] = useState(false)
  const [erroPlano, setErroPlano] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [loadingBaixa, setLoadingBaixa] = useState(false)
  const [resultado, setResultado] = useState(null)
  const enviandoRef = useRef(false)

  const carregarPlano = useCallback(async () => {
    setLoadingPlano(true)
    setErroPlano('')
    try {
      const p = await getPlano(data, turno)
      setPlano(p)
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        logout()
        navigate('/login', { replace: true })
        return
      }
      setErroPlano(e.message ?? 'Erro ao carregar plano.')
    } finally {
      setLoadingPlano(false)
    }
  }, [data, turno, navigate])

  useEffect(() => {
    carregarPlano()
  }, [carregarPlano])

  async function executarBaixa() {
    if (enviandoRef.current) return
    enviandoRef.current = true
    setLoadingBaixa(true)
    try {
      const res = await baixaProducao(data, turno)
      setResultado(res)
      setModalAberto(false)
    } catch (e) {
      const semResposta = e.status === undefined
      setErroPlano(
        semResposta
          ? 'Não foi possível confirmar se a baixa foi registrada. O plano foi recarregado — confira o saldo antes de tentar de novo.'
          : e.message ?? 'Erro ao registrar baixa.'
      )
      setModalAberto(false)
      carregarPlano()
    } finally {
      setLoadingBaixa(false)
      enviandoRef.current = false
    }
  }

  function fecharResultado() {
    setResultado(null)
    carregarPlano()
  }

  function sair() {
    logout()
    navigate('/login', { replace: true })
  }

  const itensDisponiveis = plano?.itens?.filter((i) => !i.estoque_insuficiente) ?? []

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-canvas)',
        maxWidth: 640,
        margin: '0 auto',
      }}
    >
      <header className="sticky top-0 z-20 bg-accent px-5 py-4 text-white">
        {plano?.previsao?.alerta_reducao && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-warn px-4 py-2.5 text-[0.9rem] font-bold text-white">
            <AlertTriangle size={18} />
            Frequência abaixo de 50% da média — considere reduzir a produção
          </div>
        )}

        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[1.3rem] font-extrabold leading-tight">Ordem de Produção</div>
            <div className="mt-0.5 text-[0.9rem] opacity-80">{formatarData(data)}</div>
          </div>
          <div className="text-right">
            {plano && (
              <>
                <div className="text-[1.8rem] font-extrabold leading-none">{plano.total_alunos}</div>
                <div className="text-[0.8rem] opacity-80">alunos</div>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {TURNOS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTurno(t.key)}
              className={`turno-chip${turno === t.key ? ' active' : ' border-white/30 bg-white/10 text-white/75'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main style={{ flex: 1, padding: '1.25rem', paddingBottom: '7rem' }}>
        {loadingPlano && (
          <div style={{ textAlign: 'center', color: 'var(--color-ink-faint)', paddingTop: '3rem', fontSize: '1rem' }}>
            Carregando plano…
          </div>
        )}

        {erroPlano && !loadingPlano && (
          <div
            style={{
              background: 'var(--color-err-tint)',
              color: 'var(--color-err)',
              borderRadius: 16,
              padding: '1rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            {erroPlano}
            <button
              onClick={carregarPlano}
              style={{ display: 'block', margin: '0.75rem auto 0', fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', color: 'var(--color-err)', textDecoration: 'underline' }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!loadingPlano && plano && plano.itens.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--color-ink-faint)', paddingTop: '3rem', fontSize: '1rem' }}>
            Nenhum item de produção para este turno.<br />
            <span style={{ fontSize: '0.85rem' }}>Verifique se as frequências foram registradas.</span>
          </div>
        )}

        {!loadingPlano && plano && plano.itens.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {plano.itens.map((item) => (
              <CardProduto key={item.produto_id} item={item} />
            ))}
          </div>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 mx-auto max-w-[640px] border-t-[1.5px] border-line bg-surface px-5 py-4">
        <div className="flex gap-2">
          <button
            onClick={sair}
            className="shrink-0 cursor-pointer rounded-2xl border-[1.5px] border-line bg-canvas px-4 py-3.5 text-[0.9rem] font-semibold text-ink-soft"
          >
            Sair
          </button>
          <button
            className="btn-action btn-primary flex-1"
            disabled={!plano || itensDisponiveis.length === 0 || loadingPlano}
            onClick={() => setModalAberto(true)}
          >
            Dar Baixa de Produção
          </button>
        </div>
      </footer>

      {modalAberto && plano && (
        <ModalBaixa
          plano={plano}
          onConfirmar={executarBaixa}
          onCancelar={() => setModalAberto(false)}
          loading={loadingBaixa}
        />
      )}

      {resultado && (
        <ModalResultado resultado={resultado} onFechar={fecharResultado} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd app-cozinha && npx vitest run src/ProducaoView.test.jsx`
Expected: PASS — 3 testes verdes.

- [ ] **Step 5: Rodar a suíte completa do app-cozinha**

Run: `cd app-cozinha && npm test`
Expected: PASS — todos os testes de `useIdleLogout.test.js`, `api.test.js`, `PinLogin.test.jsx` e `ProducaoView.test.jsx` verdes.

- [ ] **Step 6: Confirmar que o build ainda funciona**

Run: `cd app-cozinha && npm run build`
Expected: build conclui sem erro.

- [ ] **Step 7: Commit**

```bash
git add app-cozinha/src/ProducaoView.jsx app-cozinha/src/ProducaoView.test.jsx
git commit -m "feat(app-cozinha): ícones lucide-react, retry-safety e bloqueio de duplo envio na baixa de produção"
```

---

### Task 5: app-alunos — infraestrutura de teste + `useIdleLogout`

**Files:**
- Modify: `app-alunos/package.json`
- Modify: `app-alunos/vite.config.js`
- Create: `app-alunos/src/test-setup.js`
- Create: `app-alunos/src/useIdleLogout.js`
- Create: `app-alunos/src/useIdleLogout.test.js`
- Modify: `app-alunos/src/App.jsx`

**Interfaces:**
- Produces: `useIdleLogout(aoExpirar: () => void, minutos?: number): void` — idêntico em comportamento ao de app-cozinha (Task 1), mas é uma cópia própria, não importada entre projetos. Usado por Task 8.

- [ ] **Step 1: Instalar dependências de teste**

Run: `cd app-alunos && npm install --save-dev vitest@^4.1.8 jsdom@^29.1.1 @testing-library/react@^16.3.2 @testing-library/jest-dom@^6.9.1`

- [ ] **Step 2: Adicionar script de teste**

Modify `app-alunos/package.json`, dentro de `"scripts"`, adicione:

```json
"test": "vitest run"
```

- [ ] **Step 3: Configurar Vitest em `vite.config.js`**

Substitua o conteúdo de `app-alunos/vite.config.js` por:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.js',
  },
})
```

- [ ] **Step 4: Criar `src/test-setup.js`**

Create `app-alunos/src/test-setup.js`:

```js
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 5: Escrever o teste do hook (falhando)**

Create `app-alunos/src/useIdleLogout.test.js` — conteúdo idêntico ao de `app-cozinha/src/useIdleLogout.test.js` (Task 1, Step 5):

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIdleLogout } from './useIdleLogout.js'

describe('useIdleLogout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('chama aoExpirar depois do tempo configurado sem interação', () => {
    const aoExpirar = vi.fn()
    renderHook(() => useIdleLogout(aoExpirar, 5))

    vi.advanceTimersByTime(5 * 60 * 1000)

    expect(aoExpirar).toHaveBeenCalledTimes(1)
  })

  it('não chama aoExpirar se houver interação antes do prazo', () => {
    const aoExpirar = vi.fn()
    renderHook(() => useIdleLogout(aoExpirar, 5))

    vi.advanceTimersByTime(4 * 60 * 1000)
    window.dispatchEvent(new Event('keydown'))
    vi.advanceTimersByTime(4 * 60 * 1000)

    expect(aoExpirar).not.toHaveBeenCalled()
  })

  it('reseta o timer a cada evento e só expira depois do último', () => {
    const aoExpirar = vi.fn()
    renderHook(() => useIdleLogout(aoExpirar, 5))

    vi.advanceTimersByTime(4 * 60 * 1000)
    window.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(5 * 60 * 1000)

    expect(aoExpirar).toHaveBeenCalledTimes(1)
  })

  it('desliga os listeners ao desmontar', () => {
    const aoExpirar = vi.fn()
    const { unmount } = renderHook(() => useIdleLogout(aoExpirar, 5))

    unmount()
    vi.advanceTimersByTime(5 * 60 * 1000)

    expect(aoExpirar).not.toHaveBeenCalled()
  })

  it('usa default de 5 minutos quando VITE_IDLE_TIMEOUT_MIN não está setada', () => {
    const aoExpirar = vi.fn()
    renderHook(() => useIdleLogout(aoExpirar))

    vi.advanceTimersByTime(5 * 60 * 1000 - 1)
    expect(aoExpirar).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(aoExpirar).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 6: Rodar o teste e confirmar que falha**

Run: `cd app-alunos && npx vitest run src/useIdleLogout.test.js`
Expected: FAIL — `Failed to resolve import "./useIdleLogout.js"`.

- [ ] **Step 7: Implementar o hook**

Create `app-alunos/src/useIdleLogout.js` — conteúdo idêntico ao de `app-cozinha/src/useIdleLogout.js` (Task 1, Step 7):

```js
import { useEffect, useRef } from 'react'

const EVENTOS = ['pointerdown', 'touchstart', 'keydown']

function minutosConfigurados() {
  const raw = import.meta.env.VITE_IDLE_TIMEOUT_MIN
  const min = Number(raw)
  return Number.isFinite(min) && min > 0 ? min : 5
}

/**
 * Desloga automaticamente após N minutos sem interação do usuário
 * (pointerdown, touchstart, keydown). O timer reinicia a cada interação,
 * não a cada re-render — aoExpirar é lido de uma ref interna para não
 * precisar ser memoizado pelo chamador.
 *
 * @param {() => void} aoExpirar
 * @param {number} [minutos] — sobrescreve VITE_IDLE_TIMEOUT_MIN (default 5); usado nos testes
 */
export function useIdleLogout(aoExpirar, minutos = minutosConfigurados()) {
  const timerRef = useRef(null)
  const aoExpirarRef = useRef(aoExpirar)
  aoExpirarRef.current = aoExpirar

  useEffect(() => {
    function reiniciar() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => aoExpirarRef.current(), minutos * 60 * 1000)
    }

    reiniciar()
    EVENTOS.forEach((ev) => window.addEventListener(ev, reiniciar))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      EVENTOS.forEach((ev) => window.removeEventListener(ev, reiniciar))
    }
  }, [minutos])
}
```

- [ ] **Step 8: Rodar o teste e confirmar que passa**

Run: `cd app-alunos && npx vitest run src/useIdleLogout.test.js`
Expected: PASS — 5 testes verdes.

- [ ] **Step 9: Integrar o hook em `App.jsx`**

Substitua o conteúdo de `app-alunos/src/App.jsx` por:

```jsx
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import PinLogin from './PinLogin.jsx'
import ContagemView from './ContagemView.jsx'
import { getSessao, logout } from './api.js'
import { useIdleLogout } from './useIdleLogout.js'

/**
 * Guarda de rota — redireciona para /login se não há sessão ativa.
 */
function Protegido({ children }) {
  const navigate = useNavigate()
  useIdleLogout(() => {
    logout()
    navigate('/login', { replace: true })
  })

  return getSessao() ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PinLogin />} />
        <Route
          path="/registrar"
          element={
            <Protegido>
              <ContagemView />
            </Protegido>
          }
        />
        {/* Qualquer outra rota vai para login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 10: Verificação manual**

Run: `cd app-alunos && npm run dev`

Abra o app, logue com um PIN de teste e confirme no DevTools que não há erros no console.

- [ ] **Step 11: Commit**

```bash
git add app-alunos/package.json app-alunos/package-lock.json app-alunos/vite.config.js app-alunos/src/test-setup.js app-alunos/src/useIdleLogout.js app-alunos/src/useIdleLogout.test.js app-alunos/src/App.jsx
git commit -m "feat(app-alunos): logout automático por inatividade + infra de teste"
```

---

### Task 6: app-alunos — retry seletivo em `api.js`

**Files:**
- Modify: `app-alunos/src/api.js`
- Create: `app-alunos/src/api.test.js`

**Interfaces:**
- Consumes: nenhuma.
- Produces: `login(pin, turma, turno)` inalterada (sem retry — default `false`). `registrarContagem(quantidade_alunos, data?)` com retry automático. Task 8 consome as duas sem mudança de call site.

- [ ] **Step 1: Escrever os testes de retry (falhando)**

Create `app-alunos/src/api.test.js`:

```js
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { login, registrarContagem } from './api.js'

const originalFetch = global.fetch

function respostaJson(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  }
}

describe('api.js — retry de rede', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('registrarContagem tenta de novo depois de uma falha de rede e retorna no sucesso', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(respostaJson(200, { id: 1, quantidade_alunos: 30 }))
    global.fetch = fetchMock

    const resultado = await registrarContagem(30)

    expect(resultado).toEqual({ id: 1, quantidade_alunos: 30 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  }, 10000)

  it('login NUNCA tenta de novo depois de uma falha de rede', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    global.fetch = fetchMock

    await expect(login('1234', '6A', 'MANHA')).rejects.toThrow('Failed to fetch')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('erro HTTP de aplicação (409) nunca é reenviado, mesmo em endpoint com retry:true', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaJson(409, { detail: 'Frequência já registrada hoje.' }))
    global.fetch = fetchMock

    await expect(registrarContagem(30)).rejects.toThrow('Frequência já registrada hoje.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd app-alunos && npx vitest run src/api.test.js`
Expected: FAIL — `registrarContagem` hoje não reenvia em falha de rede.

- [ ] **Step 3: Implementar o retry em `req()`**

Substitua o conteúdo de `app-alunos/src/api.js` por:

```js
/**
 * api.js — cliente HTTP do app-alunos
 *
 * Todos os pedidos vão para /api/operacao/*
 * O token de sessão é lido de sessionStorage e enviado no header
 * X-Operacao-Token (nunca no Authorization, que é do painel admin).
 *
 * Nenhuma função aqui expõe preços, fornecedores ou relatórios.
 */

const BASE = import.meta.env.VITE_API_BASE ?? ''

function token() {
  return sessionStorage.getItem('operacao_token') ?? ''
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const BACKOFF_MS = [500, 1500]

/**
 * @param {string} method
 * @param {string} path
 * @param {object} [body]
 * @param {{ retry?: boolean }} [opts] — retry: reenvia até 2x em falha de rede/timeout.
 *   Nunca reenvia por causa de uma resposta HTTP de erro (4xx/5xx), só quando o
 *   fetch falha antes de obter resposta (rede caiu, timeout).
 */
async function req(method, path, body, opts = {}) {
  const { retry = false } = opts
  const headers = { 'Content-Type': 'application/json' }
  const t = token()
  if (t) headers['X-Operacao-Token'] = t

  const tentativasTotais = retry ? BACKOFF_MS.length + 1 : 1

  let ultimoErroDeRede = null
  for (let tentativa = 0; tentativa < tentativasTotais; tentativa++) {
    if (tentativa > 0) await esperar(BACKOFF_MS[tentativa - 1])

    let res
    try {
      res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
      })
    } catch (e) {
      ultimoErroDeRede = e
      continue
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const err = new Error(data.detail ?? `HTTP ${res.status}`)
      err.status = res.status
      err.data = data
      throw err
    }

    if (res.status === 204) return null
    return res.json()
  }

  throw ultimoErroDeRede
}

/**
 * Login via PIN — troca PIN+perfil por token de sessão.
 * @param {string} pin  — 4 dígitos
 * @param {string} turma — identificador da turma (ex.: "6A")
 * @param {string} turno — "MANHA" | "TARDE" | "INTEGRAL"
 * @returns {{ token, perfil, turma, turno }}
 */
export async function login(pin, turma, turno) {
  const data = await req('POST', '/api/operacao/auth/', {
    pin,
    perfil: 'ALUNO_REP',
  })
  sessionStorage.setItem('operacao_token', data.token)
  sessionStorage.setItem('operacao_sessao', JSON.stringify({
    turma: data.turma || turma,
    turno: data.turno || turno,
    perfil: data.perfil,
  }))
  return data
}

export function logout() {
  sessionStorage.removeItem('operacao_token')
  sessionStorage.removeItem('operacao_sessao')
}

export function getSessao() {
  try {
    return JSON.parse(sessionStorage.getItem('operacao_sessao') ?? 'null')
  } catch {
    return null
  }
}

/**
 * Registra a frequência de hoje para a turma autenticada.
 *
 * retry: true — o backend tem constraint única em FrequenciaDiaria e devolve
 * 409 numa segunda tentativa idêntica (core/operacao_views.py), então reenviar
 * depois de uma falha de rede nunca duplica o registro.
 *
 * @param {number} quantidade_alunos
 * @param {string?} data — YYYY-MM-DD (omitir = hoje)
 * @returns {{ id, data, turno, turma, quantidade_alunos, previsao }}
 */
export async function registrarContagem(quantidade_alunos, data) {
  const body = { quantidade_alunos }
  if (data) body.data = data
  return req('POST', '/api/operacao/contagem/', body, { retry: true })
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd app-alunos && npx vitest run src/api.test.js`
Expected: PASS — 3 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add app-alunos/src/api.js app-alunos/src/api.test.js
git commit -m "feat(app-alunos): retry automático seguro em registrarContagem, nunca em login"
```

---

### Task 7: app-alunos — identidade visual + `PinLogin.jsx`

**Files:**
- Modify: `app-alunos/package.json`
- Modify: `app-alunos/src/PinLogin.jsx`
- Create: `app-alunos/src/PinLogin.test.jsx`

**Interfaces:**
- Consumes: nenhuma. (app-alunos mantém `--color-brand` como cor primária — não recebe tokens de acento, conforme spec §3.1.)

- [ ] **Step 1: Instalar lucide-react**

Run: `cd app-alunos && npm install lucide-react`

- [ ] **Step 2: Escrever o teste de `PinLogin` (falhando)**

Create `app-alunos/src/PinLogin.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('./api.js', () => ({
  login: vi.fn(),
}))

describe('PinLogin (app-alunos)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv('VITE_PINS', '6A:1234')
    vi.stubEnv('VITE_TURNOS', '6A:MANHA')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('mostra o ícone School no cabeçalho, sem emoji', async () => {
    const { default: PinLogin } = await import('./PinLogin.jsx')

    render(
      <MemoryRouter>
        <PinLogin />
      </MemoryRouter>
    )

    expect(screen.getByTestId('icone-cabecalho')).toBeInTheDocument()
    expect(screen.queryByText('🏫')).not.toBeInTheDocument()
  })

  it('chama login com a turma certa ao completar os 4 dígitos do PIN', async () => {
    const { login } = await import('./api.js')
    login.mockResolvedValue({ token: 'abc', turma: '6A', turno: 'MANHA' })
    const { default: PinLogin } = await import('./PinLogin.jsx')

    render(
      <MemoryRouter>
        <PinLogin />
      </MemoryRouter>
    )

    ;['1', '2', '3', '4'].forEach((digito) => {
      fireEvent.click(screen.getByRole('button', { name: digito }))
    })

    expect(login).toHaveBeenCalledWith('1234', '6A', 'MANHA')
  })
})
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `cd app-alunos && npx vitest run src/PinLogin.test.jsx`
Expected: FAIL — `getByTestId('icone-cabecalho')` não encontra nada (componente ainda usa o emoji 🏫).

- [ ] **Step 4: Reescrever `PinLogin.jsx`**

Substitua o conteúdo de `app-alunos/src/PinLogin.jsx` por:

```jsx
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { School, Delete } from 'lucide-react'
import { login } from './api.js'

/**
 * Lê o mapa de PINs do .env:
 *   VITE_PINS=6A:1001,6B:1002,...
 *   VITE_TURNOS=6A:MANHA,7B:TARDE,...
 *
 * Retorna { [pin]: { turma, turno } }
 */
function carregarMapaPins() {
  const raw = import.meta.env.VITE_PINS ?? ''
  const turnos = import.meta.env.VITE_TURNOS ?? ''

  const mapasTurnos = {}
  for (const par of turnos.split(',')) {
    const [turma, turno] = par.split(':')
    if (turma && turno) mapasTurnos[turma.trim()] = turno.trim()
  }

  const mapa = {}
  for (const par of raw.split(',')) {
    const [turma, pin] = par.split(':')
    if (turma && pin) {
      mapa[pin.trim()] = {
        turma: turma.trim(),
        turno: mapasTurnos[turma.trim()] ?? 'MANHA',
      }
    }
  }
  return mapa
}

const MAPA_PINS = carregarMapaPins()

const TURNO_LABEL = { MANHA: 'Manhã', TARDE: 'Tarde', INTEGRAL: 'Integral' }

export default function PinLogin() {
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const pressKey = useCallback((val) => {
    setErro('')
    if (val === 'back') {
      setPin((p) => p.slice(0, -1))
    } else if (pin.length < 4) {
      const novoPin = pin + val
      setPin(novoPin)
      if (novoPin.length === 4) {
        confirmar(novoPin)
      }
    }
  }, [pin]) // eslint-disable-line

  async function confirmar(pinVal = pin) {
    if (pinVal.length !== 4) return
    const entrada = MAPA_PINS[pinVal]
    if (!entrada) {
      setErro('PIN inválido. Tente novamente.')
      setPin('')
      return
    }

    setLoading(true)
    try {
      await login(pinVal, entrada.turma, entrada.turno)
      navigate('/registrar', { replace: true })
    } catch (e) {
      setErro(e.message ?? 'Falha na conexão.')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back']

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col items-center justify-center bg-white px-6 py-10">
      <div className="mb-8 text-center">
        <div
          className="mx-auto mb-4 grid place-items-center rounded-3xl bg-brand text-white"
          style={{ width: 72, height: 72 }}
        >
          <School size={32} data-testid="icone-cabecalho" />
        </div>
        <h1 className="m-0 text-[1.6rem] font-extrabold">Frequência</h1>
        <p className="mt-1.5 text-base text-ink-soft">Digite o PIN da sua turma</p>
      </div>

      <div className="mb-6 flex items-center justify-center">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`pin-dot${i < pin.length ? ' filled' : ''}`} />
        ))}
      </div>

      {erro && (
        <div className="mb-4 w-full rounded-2xl bg-err-tint px-4 py-3 text-center text-[0.95rem] font-semibold text-err">
          {erro}
        </div>
      )}

      <div className="grid w-full gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {teclas.map((t, i) => {
          if (t === '') return <div key={i} />
          if (t === 'back') {
            return (
              <button key="back" onClick={() => pressKey('back')} className="numkey numkey-back" aria-label="Apagar" disabled={loading}>
                <Delete size={22} />
              </button>
            )
          }
          return (
            <button key={t} onClick={() => pressKey(t)} className="numkey" disabled={loading || pin.length >= 4}>
              {t}
            </button>
          )
        })}
      </div>

      {loading && (
        <p className="mt-6 text-center text-[0.95rem] text-ink-soft">Verificando…</p>
      )}

      {pin.length === 4 && MAPA_PINS[pin] && !loading && (
        <div className="mt-6 rounded-2xl bg-brand-tint px-5 py-3 text-center text-base">
          <span className="font-bold text-brand">Turma {MAPA_PINS[pin].turma}</span>{' '}
          <span className="text-ink-soft">— {TURNO_LABEL[MAPA_PINS[pin].turno] ?? MAPA_PINS[pin].turno}</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `cd app-alunos && npx vitest run src/PinLogin.test.jsx`
Expected: PASS — 2 testes verdes.

- [ ] **Step 6: Verificação visual manual**

Run: `cd app-alunos && npm run dev`

Abra `http://localhost:5174/login` e confirme visualmente: ícone `School` (Lucide) no lugar de 🏫, cor sálvia mantida (sem mudança de acento), teclado numérico inalterado.

- [ ] **Step 7: Commit**

```bash
git add app-alunos/package.json app-alunos/package-lock.json app-alunos/src/PinLogin.jsx app-alunos/src/PinLogin.test.jsx
git commit -m "feat(app-alunos): ícones lucide-react no lugar de emoji"
```

---

### Task 8: app-alunos — `ContagemView.jsx` (ícones, estilo, robustez)

**Files:**
- Modify: `app-alunos/src/ContagemView.jsx`
- Create: `app-alunos/src/ContagemView.test.jsx`

**Interfaces:**
- Consumes: `getSessao()`, `registrarContagem(quantidade_alunos, data?)` e `logout()` de Task 6 (mesmas assinaturas).

- [ ] **Step 1: Escrever os testes (falhando)**

Create `app-alunos/src/ContagemView.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ContagemView from './ContagemView.jsx'
import { getSessao, registrarContagem } from './api.js'

vi.mock('./api.js', () => ({
  getSessao: vi.fn(),
  registrarContagem: vi.fn(),
  logout: vi.fn(),
}))

function renderView() {
  return render(
    <MemoryRouter>
      <ContagemView />
    </MemoryRouter>
  )
}

describe('ContagemView (app-alunos)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessao.mockReturnValue({ turma: '6A', turno: 'MANHA' })
  })

  it('mostra o ícone de sucesso sem emoji ao confirmar a contagem', async () => {
    registrarContagem.mockResolvedValue({
      turma: '6A',
      turno: 'MANHA',
      quantidade_alunos: 30,
      previsao: null,
    })

    renderView()

    ;['3', '0'].forEach((digito) => {
      fireEvent.click(screen.getByRole('button', { name: digito }))
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByTestId('icone-sucesso')).toBeInTheDocument()
    expect(screen.queryByText('✓')).not.toBeInTheDocument()
  })

  it('não envia registrarContagem duas vezes em cliques duplos', async () => {
    let resolverContagem
    registrarContagem.mockReturnValue(new Promise((resolve) => { resolverContagem = resolve }))

    renderView()

    fireEvent.click(screen.getByRole('button', { name: '3' }))
    const botaoConfirmar = screen.getByRole('button', { name: 'Confirmar' })
    fireEvent.click(botaoConfirmar)
    fireEvent.click(botaoConfirmar)

    resolverContagem({ turma: '6A', turno: 'MANHA', quantidade_alunos: 3, previsao: null })
    await waitFor(() => expect(registrarContagem).toHaveBeenCalledTimes(1))
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd app-alunos && npx vitest run src/ContagemView.test.jsx`
Expected: FAIL — `icone-sucesso` não existe ainda (a tela de sucesso ainda renderiza `✓` sem `data-testid`).

- [ ] **Step 3: Reescrever `ContagemView.jsx`**

Substitua o conteúdo de `app-alunos/src/ContagemView.jsx` por:

```jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, Delete } from 'lucide-react'
import { getSessao, registrarContagem, logout } from './api.js'

const TURNO_LABEL = { MANHA: 'Manhã', TARDE: 'Tarde', INTEGRAL: 'Integral' }

/**
 * Formata a variação percentual em relação à média histórica.
 * Retorna null se não houver histórico.
 */
function formatarVariacao(previsao) {
  if (!previsao) return null
  const { total_alunos, media_historica } = previsao
  if (!media_historica || media_historica === 0) return null
  const pct = ((total_alunos - media_historica) / media_historica) * 100
  const sinal = pct > 0 ? '+' : ''
  return `${sinal}${pct.toFixed(0)}% em relação à média`
}

export default function ContagemView() {
  const navigate = useNavigate()
  const sessao = getSessao()

  const [numero, setNumero] = useState('')    // string de dígitos do teclado
  const [estado, setEstado] = useState('idle') // 'idle' | 'loading' | 'sucesso' | 'erro'
  const [resultado, setResultado] = useState(null)
  const [mensagemErro, setMensagemErro] = useState('')
  const enviandoRef = useRef(false)

  // Redireciona se sessão expirou
  if (!sessao) {
    navigate('/login', { replace: true })
    return null
  }

  const pressKey = useCallback((val) => {
    if (estado !== 'idle') return
    if (val === 'back') {
      setNumero((n) => n.slice(0, -1))
    } else if (numero.length < 4) {
      // Limita a 4 dígitos para evitar números absurdos (max 9999 alunos)
      setNumero((n) => n + val)
    }
  }, [estado, numero])

  async function confirmar() {
    const qtd = parseInt(numero, 10)
    if (!qtd || qtd <= 0) return
    if (enviandoRef.current) return
    enviandoRef.current = true

    setEstado('loading')
    try {
      const data = await registrarContagem(qtd)
      setResultado(data)
      setEstado('sucesso')
    } catch (e) {
      if (e.status === 409) {
        setMensagemErro('Frequência já registrada hoje para esta turma.')
      } else {
        setMensagemErro(e.message ?? 'Erro ao registrar. Tente novamente.')
      }
      setEstado('erro')
    } finally {
      enviandoRef.current = false
    }
  }

  function reiniciar() {
    setNumero('')
    setEstado('idle')
    setResultado(null)
    setMensagemErro('')
  }

  function sair() {
    logout()
    navigate('/login', { replace: true })
  }

  /* ---- Tela de Sucesso ---- */
  if (estado === 'sucesso' && resultado) {
    const variacao = formatarVariacao(resultado.previsao)
    const alerta = resultado.previsao?.alerta_reducao

    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-10"
        style={{ maxWidth: 420, margin: '0 auto' }}
      >
        <div className="result-card w-full">
          <div
            className="mx-auto mb-5 grid place-items-center rounded-full text-ok"
            style={{ width: 80, height: 80, background: 'var(--color-ok-tint)' }}
          >
            <CheckCircle2 size={40} data-testid="icone-sucesso" />
          </div>

          <p style={{ fontSize: '1rem', color: 'var(--color-ink-soft)', margin: 0 }}>
            Turma {resultado.turma} — {TURNO_LABEL[resultado.turno] ?? resultado.turno}
          </p>

          <div
            style={{
              fontSize: '4rem',
              fontWeight: 800,
              color: 'var(--color-brand)',
              lineHeight: 1.1,
              marginTop: '0.5rem',
            }}
          >
            {resultado.quantidade_alunos}
          </div>
          <p style={{ fontSize: '1.1rem', color: 'var(--color-ink-soft)', margin: '4px 0 0' }}>
            alunos registrados
          </p>

          {variacao && (
            <p
              className="mt-4 flex items-center justify-center gap-1.5 text-[0.95rem] font-semibold"
              style={{ color: alerta ? 'var(--color-warn)' : 'var(--color-ink-soft)' }}
            >
              {alerta && <AlertTriangle size={16} />}
              {variacao}
            </p>
          )}

          {alerta && (
            <div
              className="mt-4 rounded-xl px-4 py-3"
              style={{
                background: 'var(--color-warn-tint)',
                color: 'var(--color-warn)',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            >
              Frequência abaixo de 50% da média histórica
            </div>
          )}
        </div>

        <button
          onClick={sair}
          className="mt-8 w-full rounded-2xl py-4"
          style={{
            background: 'var(--color-canvas)',
            border: '1.5px solid var(--color-line)',
            fontSize: '1.05rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Concluído
        </button>
      </div>
    )
  }

  /* ---- Tela de Erro ---- */
  if (estado === 'erro') {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-10"
        style={{ maxWidth: 420, margin: '0 auto' }}
      >
        <div className="result-card w-full">
          <div
            className="mx-auto mb-5 grid place-items-center rounded-full text-err"
            style={{ width: 80, height: 80, background: 'var(--color-err-tint)' }}
          >
            <AlertTriangle size={40} data-testid="icone-erro" />
          </div>
          <p
            style={{
              fontSize: '1.05rem',
              fontWeight: 600,
              color: 'var(--color-err)',
              margin: 0,
            }}
          >
            {mensagemErro}
          </p>
        </div>

        <button
          onClick={reiniciar}
          className="mt-6 w-full rounded-2xl py-4"
          style={{
            background: 'var(--color-brand)',
            color: '#fff',
            border: 'none',
            fontSize: '1.05rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Tentar novamente
        </button>

        <button
          onClick={sair}
          className="mt-3 w-full rounded-2xl py-4"
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '0.95rem',
            color: 'var(--color-ink-soft)',
            cursor: 'pointer',
          }}
        >
          Sair
        </button>
      </div>
    )
  }

  /* ---- Tela Principal de Registro ---- */
  const podeConfirmar = numero.length > 0 && parseInt(numero, 10) > 0 && estado === 'idle'
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back']

  return (
    <div
      className="flex min-h-screen flex-col bg-white px-6 pb-8 pt-6"
      style={{ maxWidth: 420, margin: '0 auto' }}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
            Turma {sessao.turma}
          </div>
          <div style={{ color: 'var(--color-ink-soft)', fontSize: '0.95rem', marginTop: 2 }}>
            {TURNO_LABEL[sessao.turno] ?? sessao.turno}
          </div>
        </div>
        <button
          onClick={sair}
          style={{
            background: 'var(--color-canvas)',
            border: '1.5px solid var(--color-line)',
            borderRadius: 12,
            padding: '0.4rem 0.9rem',
            fontSize: '0.85rem',
            cursor: 'pointer',
            color: 'var(--color-ink-soft)',
            fontWeight: 600,
          }}
        >
          Sair
        </button>
      </div>

      <p
        className="mb-2 text-center"
        style={{ color: 'var(--color-ink-soft)', fontSize: '1rem' }}
      >
        Quantos alunos estão presentes?
      </p>

      <div
        className="pin-display mb-6 flex items-center justify-center"
        style={{ minHeight: '5rem' }}
      >
        {numero ? (
          <span style={{ color: 'var(--color-brand)' }}>{numero}</span>
        ) : (
          <span style={{ color: 'var(--color-ink-faint)', fontSize: '2rem' }}>—</span>
        )}
      </div>

      <div
        className="grid flex-1 gap-3"
        style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
      >
        {teclas.map((t, i) => {
          if (t === '') {
            return <div key={i} />
          }
          if (t === 'back') {
            return (
              <button
                key="back"
                onClick={() => pressKey('back')}
                className="numkey numkey-back"
                aria-label="Apagar"
              >
                <Delete size={22} />
              </button>
            )
          }
          return (
            <button
              key={t}
              onClick={() => pressKey(t)}
              className="numkey"
            >
              {t}
            </button>
          )
        })}
      </div>

      <button
        onClick={confirmar}
        disabled={!podeConfirmar}
        className="numkey-confirm mt-4 w-full rounded-2xl py-5"
        style={{
          fontSize: '1.15rem',
          fontWeight: 700,
          background: podeConfirmar ? 'var(--color-brand)' : '#ccc',
          color: '#fff',
          border: 'none',
          cursor: podeConfirmar ? 'pointer' : 'not-allowed',
          transition: 'background 150ms',
          minHeight: 64,
        }}
      >
        {estado === 'loading' ? 'Enviando…' : 'Confirmar'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd app-alunos && npx vitest run src/ContagemView.test.jsx`
Expected: PASS — 2 testes verdes.

- [ ] **Step 5: Rodar a suíte completa do app-alunos**

Run: `cd app-alunos && npm test`
Expected: PASS — todos os testes de `useIdleLogout.test.js`, `api.test.js`, `PinLogin.test.jsx` e `ContagemView.test.jsx` verdes.

- [ ] **Step 6: Confirmar que o build ainda funciona**

Run: `cd app-alunos && npm run build`
Expected: build conclui sem erro.

- [ ] **Step 7: Commit**

```bash
git add app-alunos/src/ContagemView.jsx app-alunos/src/ContagemView.test.jsx
git commit -m "feat(app-alunos): ícones lucide-react e bloqueio de duplo envio na contagem"
```

---

## Verificação final (manual, os dois apps)

Depois da Task 8, com os dois servidores de dev rodando (`app-cozinha` na porta 5175, `app-alunos` na 5174, backend Django na 8000):

1. Logar nos dois apps e confirmar visualmente a diferença de cor (laranja na cozinha, sálvia em alunos) lado a lado.
2. Confirmar que nenhum emoji aparece em nenhuma tela dos dois apps.
3. Setar `VITE_IDLE_TIMEOUT_MIN=1` num `.env.local` de cada app, logar, esperar 1 minuto sem tocar a tela, confirmar que volta pra `/login` sozinho.
4. No DevTools, com a aba Network em "Offline", tentar dar baixa de produção (app-cozinha) — confirmar que NÃO há novas chamadas de rede depois da primeira falha, e que a mensagem de "plano recarregado" aparece assim que a rede volta.
