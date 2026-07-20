import { useState } from "react"
import { NavLink } from "react-router-dom"
import { Icon } from "../lib/icons.jsx"
import { getModulosAtivos, ehAdmin } from "../lib/auth"

const navItems = [
  { to: "/inventario", label: "Inventário", icon: "grid", section: "Operacional", modulo: "inventario" },
  { to: "/movimentacoes", label: "Movimentações", icon: "refresh", section: "Operacional", modulo: "movimentacoes" },
  { to: "/alertas", label: "Alertas", icon: "alert", section: "Operacional", modulo: "alertas" },
  { to: "/fornecedores", label: "Fornecedores", icon: "users", section: "Gestão", modulo: "fornecedores" },
  { to: "/relatorios", label: "Relatórios", icon: "report", section: "Gestão", modulo: "relatorios" },
  { to: "/merenda", label: "Merenda", icon: "food", section: "Gestão", modulo: "merenda" },
  { to: "/perfil", label: "Perfil", icon: "home", section: "Sistema", modulo: null },
  { to: "/configuracoes", label: "Configurações", icon: "gear", section: "Sistema", modulo: null },
  { to: "/admin/modulos", label: "Módulos", icon: "gear", section: "Sistema", modulo: null, somenteAdmin: true },
]

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false)
  const modulosAtivos = getModulosAtivos()
  const itensVisiveis = navItems.filter((item) => {
    if (item.somenteAdmin && !ehAdmin()) return false
    return !item.modulo || modulosAtivos.includes(item.modulo)
  })
  const sections = ["Operacional", "Gestão", "Sistema"]

  return (
    <aside
      className={`sticky top-0 hidden h-screen ${isExpanded ? 'lg:w-56' : 'lg:w-16'} shrink-0 flex-col gap-4 border-r border-line bg-surface/60 py-4 px-2 lg:flex transition-all duration-300 ease-in-out`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {sections.map((section) => {
        const items = itensVisiveis.filter(item => item.section === section)
        if (items.length === 0) return null
        return (
          <div key={section} className="flex flex-col gap-1">
            <h3 className={`${isExpanded ? 'lg:inline' : 'lg:hidden'} px-3 py-1 text-xs font-medium text-neutral-400 uppercase tracking-wider`}>
              {section}
            </h3>
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    isActive
                      ? "bg-brand text-[#f4f1e7]"
                      : "text-neutral-600 hover:bg-neutral-100"
                  }`
                }
              >
                <span className="shrink-0">
                  {Icon[item.icon](21)}
                </span>
                <span className={`${isExpanded ? 'lg:inline' : 'lg:hidden'} text-sm font-medium`}>
                  {item.label}
                </span>
              </NavLink>
            ))}
          </div>
        )
      })}
    </aside>
  )
}
