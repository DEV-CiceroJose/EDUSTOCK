import { useState } from "react"
import { NavLink } from "react-router-dom"
import { Icon } from "../lib/icons.jsx"
import { getModulosAtivos, ehAdmin, podeVerRede } from "../lib/auth"
import LogoutButton from "../components/LogoutButton"

const navItems = [
  { to: "/inventario", label: "Inventário", icon: "grid", section: "Operacional", modulo: "inventario" },
  { to: "/movimentacoes", label: "Movimentações", icon: "refresh", section: "Operacional", modulo: "movimentacoes" },
  { to: "/alertas", label: "Alertas", icon: "alert", section: "Operacional", modulo: "alertas" },
  { to: "/fornecedores", label: "Fornecedores", icon: "users", section: "Gestão", modulo: "fornecedores" },
  { to: "/relatorios", label: "Relatórios", icon: "report", section: "Gestão", modulo: "relatorios" },
  { to: "/merenda", label: "Merenda", icon: "food", section: "Gestão", modulo: "merenda" },
  { to: "/rede", label: "Painel municipal", icon: "report", section: "Gestão", modulo: null, somenteRede: true },
  { to: "/perfil", label: "Perfil", icon: "home", section: "Sistema", modulo: null },
  { to: "/configuracoes", label: "Configurações", icon: "gear", section: "Sistema", modulo: null },
  { to: "/admin/modulos", label: "Módulos", icon: "gear", section: "Sistema", modulo: null, somenteAdmin: true },
  { to: "/admin/usuarios", label: "Usuários", icon: "users", section: "Sistema", modulo: null, somenteAdmin: true },
]

export default function Sidebar({ mobile = false, onNavigate, onClose }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const expanded = mobile || isExpanded
  const labelVisibility = expanded ? "opacity-100" : "opacity-0"
  const modulosAtivos = getModulosAtivos()
  const itensVisiveis = navItems.filter((item) => {
    if (item.somenteAdmin && !ehAdmin()) return false
    if (item.somenteRede && !podeVerRede()) return false
    return !item.modulo || modulosAtivos.includes(item.modulo)
  })
  const sections = ["Operacional", "Gestão", "Sistema"]

  return (
    <aside
      id={mobile ? "mobile-navigation" : undefined}
      aria-label={mobile ? "Navegação principal" : undefined}
      className={
        mobile
          ? "fixed inset-y-0 left-0 z-50 flex w-72 flex-col gap-4 overflow-y-auto border-r border-line bg-surface px-3 py-4 shadow-[var(--shadow-pop)] lg:hidden"
          : `sticky top-0 hidden h-screen ${expanded ? "lg:w-56" : "lg:w-16"} shrink-0 flex-col gap-4 overflow-x-hidden overflow-y-auto border-r border-line bg-surface/60 px-2 py-4 transition-[width] duration-300 ease-in-out lg:flex`
      }
      onMouseEnter={mobile ? undefined : () => setIsExpanded(true)}
      onMouseLeave={mobile ? undefined : () => setIsExpanded(false)}
      onFocus={mobile ? undefined : () => setIsExpanded(true)}
      onBlur={mobile ? undefined : (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsExpanded(false)
      }}
    >
      {mobile && (
        <div className="flex items-center justify-between border-b border-line px-2 pb-3">
          <span className="font-display text-lg font-bold">Menu</span>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-surface-2"
            aria-label="Fechar menu"
          >
            {Icon.close(18)}
          </button>
        </div>
      )}
      {sections.map((section) => {
        const items = itensVisiveis.filter(item => item.section === section)
        if (items.length === 0) return null
        return (
          <div key={section} className="flex shrink-0 flex-col gap-1">
            <h3 className={`${labelVisibility} h-6 whitespace-nowrap px-3 py-1 text-xs font-medium uppercase tracking-wider text-neutral-400`}>
              {section}
            </h3>
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                aria-label={item.label}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex h-11 shrink-0 items-center gap-3 overflow-hidden px-3 py-2.5 rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-brand ${
                    isActive
                      ? "bg-brand text-[#f4f1e7]"
                      : "text-neutral-600 hover:bg-neutral-100"
                  }`
                }
              >
                <span className="shrink-0">
                  {Icon[item.icon](21)}
                </span>
                <span className={`${labelVisibility} whitespace-nowrap text-sm font-medium`}>
                  {item.label}
                </span>
              </NavLink>
            ))}
          </div>
        )
      })}
      <div className="mt-auto shrink-0 border-t border-line pt-3">
        <LogoutButton
          className="flex h-11 w-full items-center gap-3 overflow-hidden rounded-xl px-3 text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-brand"
          labelClassName={`${labelVisibility} whitespace-nowrap text-sm font-medium`}
        />
      </div>
    </aside>
  )
}
