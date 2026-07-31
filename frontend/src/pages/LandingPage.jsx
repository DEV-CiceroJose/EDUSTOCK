import { Link } from "react-router-dom"
import { estaAutenticado } from "../lib/auth"

const FEATURES = [
  {
    number: "01",
    title: "Estoque sob controle",
    text: "Entradas, saídas, validade e níveis mínimos reunidos em uma visão simples para a equipe escolar.",
  },
  {
    number: "02",
    title: "Merenda bem planejada",
    text: "Presença das turmas e produção da cozinha conectadas para apoiar o preparo diário sem desperdício.",
  },
  {
    number: "03",
    title: "Prestação de contas",
    text: "Relatórios organizados por fornecedor, nota fiscal e categoria, prontos para apoiar a gestão.",
  },
]

const STEPS = [
  ["Registre", "Cadastre produtos, fornecedores e entradas."],
  ["Acompanhe", "Receba alertas e consulte movimentações."],
  ["Decida", "Use dados claros para comprar e produzir melhor."],
]

function BrandMark() {
  return (
    <span className="landing-brand-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" role="img">
        <path d="M8 12.5 20 6l12 6.5v15L20 34 8 27.5v-15Z" fill="currentColor" opacity=".14" />
        <path d="m10 13 10 5.5L30 13M20 18.5V31" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m14.5 10.5 10.5 5.7v7.3" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function DashboardPreview() {
  return (
    <div className="landing-preview" aria-label="Prévia ilustrativa do painel EduStock">
      <div className="landing-preview-top">
        <span><BrandMark /> EduStock</span>
        <span className="landing-preview-avatar">EC</span>
      </div>
      <div className="landing-preview-body">
        <aside aria-hidden="true">
          <i className="active" />
          <i />
          <i />
          <i />
          <i />
        </aside>
        <div className="landing-preview-content">
          <div className="landing-preview-heading">
            <div>
              <small>Visão geral</small>
              <strong>Bom dia, equipe!</strong>
            </div>
            <span>+ Nova entrada</span>
          </div>
          <div className="landing-preview-stats">
            <article><small>Itens cadastrados</small><strong>248</strong><em>+12 este mês</em></article>
            <article><small>Estoque baixo</small><strong>08</strong><em>Atenção necessária</em></article>
            <article><small>Validade próxima</small><strong>05</strong><em>Próximos 30 dias</em></article>
          </div>
          <div className="landing-preview-chart">
            <div>
              <small>Movimentação mensal</small>
              <strong>Entradas e consumo</strong>
            </div>
            <svg viewBox="0 0 460 120" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#3d8c6d" stopOpacity=".3" />
                  <stop offset="1" stopColor="#3d8c6d" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 94 C55 88 55 52 105 62 S175 96 220 58 290 28 330 44 405 70 460 18 V120 H0Z" fill="url(#chart-fill)" />
              <path d="M0 94 C55 88 55 52 105 62 S175 96 220 58 290 28 330 44 405 70 460 18" fill="none" stroke="#2f7a5b" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
      <span className="landing-floating-card landing-floating-alert">
        <b>8</b><span>itens pedem<br />reposição</span>
      </span>
      <span className="landing-floating-card landing-floating-ok">
        <b>✓</b><span>Contagem da turma<br />registrada</span>
      </span>
    </div>
  )
}

export default function LandingPage() {
  const dashboardPath = estaAutenticado() ? "/inventario" : "/login"
  const dashboardLabel = estaAutenticado() ? "Abrir painel" : "Acessar sistema"

  return (
    <div className="landing-shell">
      <header className="landing-header">
        <Link className="landing-brand" to="/" aria-label="EduStock, página inicial">
          <BrandMark />
          <span>Edu<strong>Stock</strong></span>
        </Link>
        <nav aria-label="Navegação principal">
          <a href="#recursos">Recursos</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#beneficios">Benefícios</a>
        </nav>
        <Link className="landing-login" to={dashboardPath}>{dashboardLabel}</Link>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <span className="landing-kicker">Gestão escolar, sem complicação</span>
            <h1>Mais alimento na mesa.<br /><em>Menos desperdício.</em></h1>
            <p>
              Estoque, merenda e prestação de contas em um só lugar.
              Informação confiável para quem cuida da escola todos os dias.
            </p>
            <div className="landing-actions">
              <Link className="landing-primary" to={dashboardPath}>
                {dashboardLabel}
                <span aria-hidden="true">→</span>
              </Link>
              <a className="landing-secondary" href="#recursos">Conhecer recursos</a>
            </div>
            <div className="landing-trust">
              <span><b>✓</b> Acesso protegido</span>
              <span><b>✓</b> Feito para escolas</span>
              <span><b>✓</b> Fácil de usar</span>
            </div>
          </div>
          <DashboardPreview />
        </section>

        <section className="landing-features" id="recursos">
          <div className="landing-section-heading">
            <span>Uma rotina mais leve</span>
            <h2>Da despensa à prestação de contas</h2>
            <p>O EduStock conecta as tarefas que fazem a alimentação escolar acontecer.</p>
          </div>
          <div className="landing-feature-grid">
            {FEATURES.map((feature) => (
              <article key={feature.number}>
                <span>{feature.number}</span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-flow" id="como-funciona">
          <div className="landing-flow-copy">
            <span className="landing-kicker">Simples desde o primeiro dia</span>
            <h2>Três passos para uma gestão mais segura</h2>
            <p>
              Sem planilhas espalhadas e sem informação perdida. Cada registro
              alimenta uma visão atualizada para toda a equipe autorizada.
            </p>
          </div>
          <ol>
            {STEPS.map(([title, text], index) => (
              <li key={title}>
                <span>{index + 1}</span>
                <div><strong>{title}</strong><p>{text}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-benefits" id="beneficios">
          <blockquote>
            “Quando a informação fica simples, sobra mais tempo para cuidar do que realmente importa.”
          </blockquote>
          <div>
            <span>EduStock para a rede pública</span>
            <p>Uma base única para decisões mais rápidas, compras mais conscientes e alimentação bem planejada.</p>
          </div>
        </section>

        <section className="landing-cta">
          <div>
            <span>Pronto para organizar sua escola?</span>
            <h2>Comece com o que você já tem.</h2>
          </div>
          <Link className="landing-primary landing-primary-light" to={dashboardPath}>
            {dashboardLabel}<span aria-hidden="true">→</span>
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <Link className="landing-brand" to="/"><BrandMark /><span>Edu<strong>Stock</strong></span></Link>
        <p>Gestão de estoque e merenda escolar.</p>
        <span>© {new Date().getFullYear()} EduStock</span>
      </footer>
    </div>
  )
}
