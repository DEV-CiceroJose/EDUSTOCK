import { useState, useEffect } from "react"
import { getConfig, setConfig as persistConfig } from "../lib/config"

const DENSITY_OPTIONS = [
  { value: "confortavel", label: "Confortável" },
  { value: "compacto", label: "Compacto" },
  { value: "denso", label: "Denso" }
]

export default function ConfiguracoesPage() {
  const [config, setConfig] = useState(() => getConfig())

  // Load existing preferences on mount
  useEffect(() => {
    const currentConfig = getConfig()
    setConfig(currentConfig)
  }, [])

  // Persist config using helper function
  const updateConfig = (updates) => {
    try {
      const newConfig = persistConfig(updates)
      setConfig(newConfig)
    } catch (error) {
      console.error("Failed to save config:", error)
    }
  }

  const handleMockToggle = () => {
    updateConfig({ useMock: !config.useMock })
    // Reload page when mock toggle changes
    window.location.reload()
  }

  const handlePrecoToggle = () => {
    updateConfig({ mostrarPreco: !config.mostrarPreco })
    window.location.reload()
  }

  const handleValidityDaysChange = (e) => {
    const value = parseInt(e.target.value, 10)
    // Validate positive integer
    if (!isNaN(value) && value > 0) {
      updateConfig({ validityAlertDays: value })
    }
  }

  const handleDensityChange = (density) => {
    updateConfig({ cardDensity: density })
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold leading-tight">Configurações</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-faint">
          Gerencie preferências da aplicação
        </p>
      </div>

      <div className="space-y-6">
        {/* Dados Mock Section */}
        <section className="rounded-2xl border border-line bg-surface p-6">
          <div className="mb-4">
            <h2 className="font-display text-lg font-bold leading-tight">Dados de Demonstração</h2>
            <p className="mt-1 text-sm text-ink-faint">
              Ativar dados simulados para testes e demonstrações
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="mock-toggle" className="font-medium">
                Usar dados mock
              </label>
              <p className="text-sm text-ink-faint">A página será recarregada após alternar</p>
            </div>
            <button
              id="mock-toggle"
              type="button"
              role="switch"
              aria-checked={config.useMock}
              onClick={handleMockToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${
                config.useMock ? "bg-brand" : "bg-line"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#f4f1e7] shadow ring-0 transition duration-200 ease-in-out ${
                  config.useMock ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </section>

        {/* Exibição de Custos Section */}
        <section className="rounded-2xl border border-line bg-surface p-6">
          <div className="mb-4">
            <h2 className="font-display text-lg font-bold leading-tight">Exibição de Custos</h2>
            <p className="mt-1 text-sm text-ink-faint">
              Controla se preço/custo aparece nos cadastros, formulários e relatórios
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="preco-toggle" className="font-medium">
                Mostrar preços e custos
              </label>
              <p className="text-sm text-ink-faint">A página será recarregada após alternar</p>
            </div>
            <button
              id="preco-toggle"
              type="button"
              role="switch"
              aria-checked={config.mostrarPreco}
              onClick={handlePrecoToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${
                config.mostrarPreco ? "bg-brand" : "bg-line"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#f4f1e7] shadow ring-0 transition duration-200 ease-in-out ${
                  config.mostrarPreco ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </section>

        {/* Alertas de Validade Section */}
        <section className="rounded-2xl border border-line bg-surface p-6">
          <div className="mb-4">
            <h2 className="font-display text-lg font-bold leading-tight">Alertas de Validade</h2>
            <p className="mt-1 text-sm text-ink-faint">
              Configure o prazo de antecedência para alertas de produtos próximos ao vencimento
            </p>
          </div>

          <div>
            <label htmlFor="validity-days" className="mb-2 block font-medium">
              Prazo de alerta de validade (dias)
            </label>
            <input
              id="validity-days"
              type="number"
              min="1"
              value={config.validityAlertDays}
              onChange={handleValidityDaysChange}
              className="w-full max-w-xs rounded-lg border border-line bg-[#f4f1e7] px-4 py-2 text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <p className="mt-2 text-sm text-ink-faint">
              Produtos com validade em até {config.validityAlertDays} dias aparecerão nos alertas
            </p>
          </div>
        </section>

        {/* Densidade de Cards Section */}
        <section className="rounded-2xl border border-line bg-surface p-6">
          <div className="mb-4">
            <h2 className="font-display text-lg font-bold leading-tight">Densidade de Cards</h2>
            <p className="mt-1 text-sm text-ink-faint">
              Ajuste o espaçamento e tamanho dos cards de produtos
            </p>
          </div>

          <div>
            <label className="mb-3 block font-medium">Escolha a densidade</label>
            <div className="flex flex-wrap gap-2">
              {DENSITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleDensityChange(option.value)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    config.cardDensity === option.value
                      ? "bg-brand text-[#f4f1e7]"
                      : "bg-surface-2 text-ink-soft hover:bg-line"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
