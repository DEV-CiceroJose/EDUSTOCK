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

const WHATSAPP_URL = "https://wa.me/5581991816899?text=Ol%C3%A1%21%20Gostaria%20de%20conhecer%20melhor%20a%20EduStock."

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

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.5 11.8a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.2-4.4a8.4 8.4 0 1 1 15.8-4.3Z" />
      <path d="M8.2 7.4c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.8 1.9c.1.3.1.5-.1.7l-.6.8c-.2.2-.1.4 0 .6.7 1.2 1.6 2.2 2.8 2.8.2.1.4.2.6 0l.9-1c.2-.2.4-.3.7-.2l1.9.9c.3.1.4.3.4.5 0 .3-.1 1.3-.7 1.8-.5.6-1.4.9-2.3.7-1-.2-2.3-.7-4.1-2.3-1.5-1.3-2.6-3-2.9-4-.4-1-.1-2.2.5-2.8l.4-.4Z" />
    </svg>
  )
}

function DashboardPreview() {
  return (
    <section className="landing-preview" aria-label="Prévia demonstrativa do painel EduStock">
      <div className="landing-preview-top">
        <span><BrandMark /> EduStock</span>
        <span className="landing-preview-meta">
          <small>Exemplo demonstrativo</small>
          <span className="landing-preview-avatar">EC</span>
        </span>
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
    </section>
  )
}

export default function LandingPage() {
  const dashboardPath = estaAutenticado() ? "/dashboard" : "/login"
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
          <a href="#contato">Fale conosco</a>
        </nav>
        <Link className="landing-login" to={dashboardPath}>{dashboardLabel}</Link>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <span className="landing-kicker">Gestão escolar, sem complicação</span>
            <h1>Mais alimento na mesa.<br /><em>Menos desperdício.</em></h1>
            <p>
              Uma visão diária para estoque, presença, produção da merenda e prestação de contas.
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

        <section className="landing-proof" aria-label="Pilares da plataforma">
          <div><strong>Operação diária</strong><span>Prioridades visíveis desde o primeiro acesso</span></div>
          <div><strong>Equipe conectada</strong><span>Gestão, representantes e cozinha no mesmo fluxo</span></div>
          <div><strong>Decisão segura</strong><span>Registros organizados para acompanhar e prestar contas</span></div>
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

        <section className="landing-contact" id="contato" aria-labelledby="landing-contact-title">
          <div className="landing-contact-copy">
            <span className="landing-kicker">Contato direto</span>
            <h2 id="landing-contact-title">Vamos transformar a rotina da sua escola?</h2>
            <p>
              Converse com a EduStock para conhecer a plataforma, esclarecer dúvidas
              e entender como ela pode apoiar a alimentação escolar.
            </p>
            <div className="landing-contact-notes">
              <span><b>01</b> Atendimento humano</span>
              <span><b>02</b> Demonstração orientada</span>
              <span><b>03</b> Conversa sem compromisso</span>
            </div>
          </div>
          <div className="landing-contact-card">
            <span>Fale com a equipe</span>
            <strong>Estamos no WhatsApp</strong>
            <p>Envie uma mensagem e conte um pouco sobre a sua escola ou rede.</p>
            <a className="landing-whatsapp" href={WHATSAPP_URL} target="_blank" rel="noreferrer">
              <WhatsAppIcon />
              Conversar no WhatsApp
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </main>

      <a
        className="landing-whatsapp-float"
        href={WHATSAPP_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Falar com a EduStock no WhatsApp"
      >
        <WhatsAppIcon />
      </a>

      <footer className="landing-footer">
        <Link className="landing-brand" to="/"><BrandMark /><span>Edu<strong>Stock</strong></span></Link>
        <p>Gestão de estoque e merenda escolar.</p>
        <a href="#contato">Contato</a>
        <span>© {new Date().getFullYear()} EduStock</span>
      </footer>
    </div>
  )
}
