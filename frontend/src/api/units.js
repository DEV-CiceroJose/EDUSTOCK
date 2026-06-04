// Espelha Produto.UNIDADE_CHOICES do model Django (core/models.py)
export const UNIDADES = [
  { value: "UN", label: "Unidade" },
  { value: "KG", label: "Quilograma" },
  { value: "L", label: "Litro" },
  { value: "CX", label: "Caixa" },
  { value: "PC", label: "Pacote" },
]

export const unidadeLabel = (v) =>
  UNIDADES.find((u) => u.value === v)?.label ?? v

// Espelha Produto.PERIODICIDADE_CHOICES
export const PERIODICIDADES = [
  { value: "SEMANAL", label: "Semanal" },
  { value: "MENSAL", label: "Mensal" },
  { value: "EVENTUAL", label: "Eventual" },
]

export const MOTIVOS_SAIDA = [
  { value: "consumo", label: "Consumo" },
  { value: "perda", label: "Perda" },
  { value: "ajuste", label: "Ajuste" },
  { value: "outro", label: "Outro" },
]
