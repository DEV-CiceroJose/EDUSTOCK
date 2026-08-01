import { useCallback } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { School } from "lucide-react"
import { OperationPinLogin } from "@edustock/operacao-shared"
import { login } from "./api.js"

export default function PinLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const onSuccess = useCallback(
    () => navigate("/registrar", { replace: true }),
    [navigate],
  )

  return (
    <OperationPinLogin
      title="Frequência"
      subtitle="Digite o PIN da sua turma"
      icon={<School size={32} data-testid="icone-cabecalho" />}
      login={login}
      onSuccess={onSuccess}
      notice={location.state?.message}
    />
  )
}
