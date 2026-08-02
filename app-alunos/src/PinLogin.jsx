import { useCallback } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Backspace } from "@phosphor-icons/react/Backspace"
import { GraduationCap } from "@phosphor-icons/react/GraduationCap"
import { OperationPinLogin, usePwaLifecycle } from "@edustock/operacao-shared"
import { login } from "./api.js"
import PwaControls from "./PwaControls.jsx"

export default function PinLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const pwa = usePwaLifecycle()
  const onSuccess = useCallback(
    () => navigate("/registrar", { replace: true }),
    [navigate],
  )

  return (
    <OperationPinLogin
      title="EduStock Alunos"
      subtitle="Digite o PIN da sua turma"
      icon={<GraduationCap size={34} weight="duotone" data-testid="icone-cabecalho" />}
      login={login}
      onSuccess={onSuccess}
      notice={location.state?.message}
      disabled={!pwa.online}
      disabledNotice="Sem conexão. Conecte o dispositivo à internet para entrar."
      footer={<PwaControls pwa={pwa} />}
      backspaceIcon={<Backspace size={22} weight="bold" />}
    />
  )
}
