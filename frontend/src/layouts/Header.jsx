import { Icon } from "../lib/icons.jsx"
import { Link } from "react-router-dom"
import { getNome, getPapel, getUsername } from "../lib/auth"

export default function Header({
  search,
  setSearch,
  onAddItem,
  onReport,
  onMenu,
  menuOpen = false,
  canManage = true,
}) {
  const nomeUsuario = getNome()?.trim() || getUsername()?.trim() || "Usuário"
  const papelUsuario = getPapel() === "ADMIN" ? "Administrador" : "Operador"
  const inicialUsuario = nomeUsuario.charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        {/* Marca */}
        <button
          type="button"
          onClick={onMenu}
          className="grid h-10 w-10 place-items-center rounded-xl text-ink-soft hover:bg-surface-2 lg:hidden"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
        >
          {Icon.menu(22)}
        </button>
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-[#f4f1e7]">
            {Icon.box(22)}
          </div>
          <div className="leading-none">
            <div className="font-display text-lg font-bold tracking-tight">Gestor Escolar</div>
            <div className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-ink-faint">
              Estoque & Refeitório
            </div>
          </div>
        </div>

        {/* Busca global */}
        <div className="relative mx-1 hidden flex-1 md:block">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
            {Icon.search(18)}
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar item no estoque…"
            className="field pl-10 relative z-10"
          />
        </div>

        {/* Ações */}
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {canManage && (
            <button onClick={onAddItem} className="btn btn-brand">
              {Icon.plus(18)} <span className="hidden sm:inline">Adicionar Item</span>
            </button>
          )}
          <button onClick={onReport} className="btn btn-ghost">
            {Icon.report(18)} <span className="hidden lg:inline">Relatório</span>
          </button>
          <Link 
            to="/perfil" 
            className="ml-1 flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 transition-colors hover:bg-surface-2 cursor-pointer"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-tint font-display text-sm font-bold text-brand">
              {inicialUsuario}
            </span>
            <div className="hidden leading-none sm:block">
              <div className="max-w-36 truncate text-sm font-semibold">{nomeUsuario}</div>
              <div className="text-[0.66rem] text-ink-faint">{papelUsuario}</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Busca mobile */}
      <div className="px-4 pb-3 md:hidden">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
            {Icon.search(18)}
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar item…"
            className="field pl-10 relative z-10"
          />
        </div>
      </div>
    </header>
  )
}
