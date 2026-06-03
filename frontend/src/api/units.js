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
