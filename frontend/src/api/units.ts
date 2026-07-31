// Espelha Produto.UNIDADE_CHOICES do model Django (core/models.py)
import type { Periodicidade, Unidade } from "./types"

export const UNIDADES: ReadonlyArray<{ value: Unidade; label: string }> = [
  { value: "UN", label: "Unidade" },
  { value: "KG", label: "Quilograma" },
  { value: "L", label: "Litro" },
  { value: "CX", label: "Caixa" },
  { value: "PC", label: "Pacote" },
]

export const unidadeLabel = (v: Unidade | string): string =>
  UNIDADES.find((u) => u.value === v)?.label ?? v

// Espelha Produto.PERIODICIDADE_CHOICES
export const PERIODICIDADES: ReadonlyArray<{ value: Periodicidade; label: string }> = [
  { value: "SEMANAL", label: "Semanal" },
  { value: "MENSAL", label: "Mensal" },
  { value: "EVENTUAL", label: "Eventual" },
]

export const MOTIVOS_SAIDA: ReadonlyArray<{ value: string; label: string }> = [
  { value: "consumo", label: "Consumo" },
  { value: "perda", label: "Perda" },
  { value: "ajuste", label: "Ajuste" },
  { value: "outro", label: "Outro" },
]
