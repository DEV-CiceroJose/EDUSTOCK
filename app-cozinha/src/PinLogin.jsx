import { useCallback } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ChefHat } from "lucide-react"
import { OperationPinLogin } from "@edustock/operacao-shared"
import { login } from "./api.js"

export default function PinLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const onSuccess = useCallback(
    () => navigate("/producao", { replace: true }),
    [navigate],
  )

  return (
    <OperationPinLogin
      title="Produção"
      subtitle="Digite o PIN da cozinha"
      icon={<ChefHat size={32} data-testid="icone-cabecalho" />}
      iconClassName="bg-accent"
      login={login}
      onSuccess={onSuccess}
      notice={location.state?.message}
      fallbackError="Falha na conexão."
    />
  )
}
