import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { useOperationalDashboard } from "../hooks/useOperationalDashboard"
import DashboardOperacionalPage from "./DashboardOperacionalPage"

vi.mock("../hooks/useOperationalDashboard", () => ({
  useOperationalDashboard: vi.fn(),
}))

const dashboardCompleto = {
  data: "2026-09-08",
  escola: { id: 1, nome: "Escola José de Alencar" },
  modulos: ["alertas", "inventario", "merenda"],
  presenca: {
    total_alunos: 426,
    turmas_registradas: 10,
    turmas_esperadas: 12,
    media_historica: 418,
    variacao_pct: 1.91,
  },
  refeicoes: {
    previstas: 1278,
    produzidas: 426,
    servidas: 412,
    descarte_kg: "2.500",
    etapas: [
      { refeicao: "CAFE_MANHA", rotulo: "Café da manhã", status: "CONCLUIDA" },
      { refeicao: "ALMOCO", rotulo: "Almoço", status: "AGUARDANDO_BAIXA" },
      { refeicao: "LANCHE_TARDE", rotulo: "Lanche da tarde", status: "SEM_REGISTRO" },
    ],
  },
  estoque: {
    itens: 100,
    adequados: 72,
    atencao: 18,
    criticos: 10,
    vencidos: 2,
    proximos_vencimento: 6,
  },
  proximas_acoes: [
    {
      codigo: "TURMAS_PENDENTES",
      prioridade: "alta",
      titulo: "Registrar frequência das turmas",
      descricao: "Há turmas ativas sem frequência registrada para hoje.",
      href: "/merenda",
    },
    {
      codigo: "ESTOQUE_CRITICO",
      prioridade: "alta",
      titulo: "Verificar estoque crítico",
      descricao: "Há itens críticos que precisam de atenção.",
      href: "/alertas",
    },
  ],
  tendencia: [
    { data: "2026-09-02", planejadas: 410, produzidas: 404, servidas: 397 },
    { data: "2026-09-03", planejadas: 420, produzidas: 414, servidas: 408 },
    { data: "2026-09-04", planejadas: 430, produzidas: 426, servidas: 419 },
    { data: "2026-09-05", planejadas: 440, produzidas: 432, servidas: 425 },
    { data: "2026-09-06", planejadas: 450, produzidas: 442, servidas: 436 },
    { data: "2026-09-07", planejadas: 460, produzidas: 452, servidas: 445 },
    { data: "2026-09-08", planejadas: 470, produzidas: 461, servidas: 454 },
  ],
  atividade_recente: [
    {
      id: 1,
      acao: "abriu",
      recurso: "Plano do almoço",
      ator: "Cozinha",
      criado_em: "2026-09-08T09:42:00-03:00",
    },
  ],
  atualizado_em: "2026-09-08T09:42:00-03:00",
}

function renderPage(hookState) {
  vi.mocked(useOperationalDashboard).mockReturnValue(hookState)
  return render(
    <MemoryRouter>
      <DashboardOperacionalPage />
    </MemoryRouter>,
  )
}

describe("DashboardOperacionalPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    sessionStorage.setItem("edustock:auth:nome", "Cícero José")
  })

  it("apresenta a operação do dia e seus próximos passos com dados reais", () => {
    renderPage({ data: dashboardCompleto, loading: false, error: null, reload: vi.fn() })

    expect(screen.getByRole("heading", { name: /Bom dia, Cícero/i })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Fluxo do dia" })).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Próximas ações" })).toBeInTheDocument()
    expect(screen.getByText("426")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Abrir plano/i })).toHaveAttribute("href", "/merenda?view=producao")
    expect(screen.getByText(/Em 7 dias: 3\.080 planejadas, 3\.031 produzidas e 2\.984 servidas/i)).toBeInTheDocument()
  })

  it("não infere conclusão de presença, planejamento ou produção a partir dos números", () => {
    const semEstadoInferido = {
      ...dashboardCompleto,
      presenca: {
        ...dashboardCompleto.presenca,
        total_alunos: 100,
        turmas_registradas: 4,
        turmas_esperadas: 4,
      },
      refeicoes: {
        ...dashboardCompleto.refeicoes,
        previstas: 100,
        produzidas: 100,
        servidas: 100,
        etapas: dashboardCompleto.refeicoes.etapas.map((etapa) => ({
          ...etapa,
          status: "SEM_REGISTRO",
        })),
      },
    }

    renderPage({ data: semEstadoInferido, loading: false, error: null, reload: vi.fn() })
    const fluxo = within(screen.getByRole("region", { name: "Fluxo do dia" }))

    expect(fluxo.getByText("100 alunos registrados")).toBeInTheDocument()
    expect(fluxo.getByText("4 de 4 turmas")).toBeInTheDocument()
    expect(fluxo.getByText("100 refeições previstas")).toBeInTheDocument()
    expect(fluxo.getByText("100 produzidas · 100 servidas")).toBeInTheDocument()
    expect(fluxo.queryByText("Concluída")).not.toBeInTheDocument()
    expect(fluxo.getAllByText("Sem registro")).toHaveLength(3)
  })

  it("mantém foco visível nos links das próximas ações", () => {
    renderPage({ data: dashboardCompleto, loading: false, error: null, reload: vi.fn() })

    const actionLink = screen.getByRole("link", { name: /Verificar estoque crítico/i })
    expect(actionLink).toHaveClass(
      "focus-visible:outline-2",
      "focus-visible:outline-brand",
      "focus-visible:outline-offset-2",
    )
    expect(actionLink).not.toHaveClass("focus-visible:outline-none")
  })

  it("orienta o próximo registro quando ainda não existem dados operacionais", () => {
    const semDados = {
      ...dashboardCompleto,
      presenca: { ...dashboardCompleto.presenca, total_alunos: 0, turmas_registradas: 0, media_historica: 0, variacao_pct: null },
      refeicoes: { ...dashboardCompleto.refeicoes, previstas: 0, produzidas: 0, servidas: 0, descarte_kg: "0.000", etapas: dashboardCompleto.refeicoes.etapas.map((etapa) => ({ ...etapa, status: "SEM_REGISTRO" })) },
      estoque: { itens: 0, adequados: 0, atencao: 0, criticos: 0, vencidos: 0, proximos_vencimento: 0 },
      proximas_acoes: [],
      tendencia: dashboardCompleto.tendencia.map((ponto) => ({
        ...ponto,
        planejadas: 0,
        produzidas: 0,
        servidas: 0,
      })),
      atividade_recente: [],
    }

    renderPage({ data: semDados, loading: false, error: null, reload: vi.fn() })

    expect(screen.getByRole("heading", { name: "Comece pela presença das turmas" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Registrar presença" })).toHaveAttribute("href", "/merenda")
  })

  it("omite os blocos e ações de merenda quando o módulo não está disponível", () => {
    const semMerenda = {
      ...dashboardCompleto,
      modulos: ["alertas", "inventario"],
      presenca: null,
      refeicoes: null,
      tendencia: [],
    }

    renderPage({ data: semMerenda, loading: false, error: null, reload: vi.fn() })

    expect(screen.queryByRole("region", { name: "Fluxo do dia" })).not.toBeInTheDocument()
    expect(screen.queryByText("Registrar frequência das turmas")).not.toBeInTheDocument()
    expect(screen.getByText("Verificar estoque crítico")).toBeInTheDocument()
  })

  it("mantém as seções válidas quando outros módulos retornam nulos", () => {
    const somenteEstoque = {
      ...dashboardCompleto,
      modulos: ["alertas", "inventario"],
      presenca: null,
      refeicoes: null,
      tendencia: [],
      atividade_recente: [],
      proximas_acoes: dashboardCompleto.proximas_acoes.slice(1),
    }

    renderPage({ data: somenteEstoque, loading: false, error: new Error("Falha parcial"), reload: vi.fn() })

    expect(screen.getByRole("region", { name: "Saúde do estoque" })).toBeInTheDocument()
    expect(screen.getByText("72% adequado")).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("Alguns dados não puderam ser atualizados")
  })

  it("não substitui por etapas inventadas uma seção de merenda que veio nula", () => {
    const semPresenca = {
      ...dashboardCompleto,
      presenca: null,
    }

    renderPage({ data: semPresenca, loading: false, error: null, reload: vi.fn() })

    expect(screen.queryByText("Presenças")).not.toBeInTheDocument()
    expect(screen.getByText("1.278")).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Fluxo do dia" })).not.toBeInTheDocument()
  })

  it("preserva a geometria da página durante o carregamento", () => {
    renderPage({ data: null, loading: true, error: null, reload: vi.fn() })

    expect(screen.getByRole("status", { name: "Carregando painel operacional" })).toBeInTheDocument()
    expect(screen.queryByText("0")).not.toBeInTheDocument()
  })

  it("oferece nova tentativa quando o transporte falha", () => {
    const reload = vi.fn()
    renderPage({ data: null, loading: false, error: new Error("Sem conexão"), reload })

    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar o painel")
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(reload).toHaveBeenCalledOnce()
  })
})
