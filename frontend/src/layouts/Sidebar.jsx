import { NavLink } from "react-router-dom"
import { Icon } from "../lib/icons.jsx"

const navItems = [
  // Seção Operacional
  { to: "/inventario", label: "Inventário", icon: "grid", section: "Operacional" },
  { to: "/movimentacoes", label: "Movimentações", icon: "refresh", section: "Operacional" },
  { to: "/alertas", label: "Alertas", icon: "alert", section: "Operacional" },
  
  // Seção Gestão
  { to: "/fornecedores", label: "Fornecedores", icon: "users", section: "Gestão" },
  { to: "/relatorios", label: "Relatórios", icon: "report", section: "Gestão" },
  { to: "/merenda", label: "Merenda", icon: "food", section: "Gestão" },
  
  // Seção Sistema
  { to: "/perfil", label: "Perfil", icon: "home", section: "Sistema" },
  { to: "/configuracoes", label: "Configurações", icon: "gear", section: "Sistema" },
]

export default function Sidebar() {
  const sections = ["Operacional", "Gestão", "Sistema"]
  
  return (
    <aside className="sticky top-0 hidden h-screen w-16 lg:w-56 shrink-0 flex-col gap-4 border-r border-line bg-surface/60 py-4 px-2 lg:flex">
      {sections.map((section) => {
        const items = navItems.filter(item => item.section === section)
        return (
          <div key={section} className="flex flex-col gap-1">
            <h3 className="hidden lg:inline px-3 py-1 text-xs font-medium text-neutral-400 uppercase tracking-wider">
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
                <span className="hidden lg:inline text-sm font-medium">
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
