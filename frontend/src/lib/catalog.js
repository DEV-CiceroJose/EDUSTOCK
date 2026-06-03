import { Icon } from "./icons.jsx"

// Paleta de tons suaves para os cartões de categoria (fallback por índice)
const PALETTE = [
  { tint: "#e7efe8", fg: "#2f7a5b", bar: "#2f8f5b" }, // verde
  { tint: "#fbe9d9", fg: "#c2682f", bar: "#e07a3e" }, // laranja
  { tint: "#e8eef7", fg: "#3a5a86", bar: "#4a72ab" }, // azul
  { tint: "#f4e7ef", fg: "#9c4f7c", bar: "#b9658f" }, // rosa
  { tint: "#f0eddc", fg: "#8a7a2f", bar: "#b09a37" }, // mostarda
  { tint: "#e6efef", fg: "#37807a", bar: "#449b93" }, // teal
]

// Casa por palavra-chave -> ícone + cor; senão usa fallback por índice
const RULES = [
  { test: /limp|higien|desinf|sab/i, icon: "spray", color: 0 },
  { test: /comid|alimen|merend|gêner|gener|perec/i, icon: "food", color: 1 },
  { test: /seman|rotativ|sulfite|consumo|descart/i, icon: "refresh", color: 2 },
  { test: /durad|ferrament|manuten/i, icon: "wrench", color: 4 },
  { test: /escrit|aluno|kit|escolar|caderno|estoj/i, icon: "backpack", color: 3 },
]

export function categoryStyle(name = "", index = 0) {
  const rule = RULES.find((r) => r.test.test(name))
  const colorIdx = rule ? rule.color : index % PALETTE.length
  const iconName = rule ? rule.icon : "box"
  return { ...PALETTE[colorIdx], renderIcon: (s) => Icon[iconName](s), iconName }
}
