import { useCallback, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Backspace } from "@phosphor-icons/react/Backspace"
import { ChefHat } from "@phosphor-icons/react/ChefHat"
import { OperationPinLogin, usePwaLifecycle } from "@edustock/operacao-shared"
import { login } from "./api.js"
import PwaControls from "./PwaControls.jsx"

export default function PinLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const pwa = usePwaLifecycle()
  const [perfil, setPerfil] = useState("COZINHA")
  const onSuccess = useCallback(
    (sessao) => navigate(sessao.perfil === "NUTRICIONISTA" ? "/nutricao" : "/producao", { replace: true }),
    [navigate],
  )

  return (
    <OperationPinLogin
      key={perfil}
      title={perfil === "NUTRICIONISTA" ? "EduStock Nutrição" : "EduStock Cozinha"}
      subtitle={perfil === "NUTRICIONISTA" ? "Digite o PIN da nutricionista" : "Digite o PIN da cozinha"}
      icon={<ChefHat size={34} weight="duotone" data-testid="icone-cabecalho" />}
      iconClassName="bg-accent"
      login={(pin) => login(pin, perfil)}
      onSuccess={onSuccess}
      notice={location.state?.message}
      fallbackError="Falha na conexão."
      disabled={!pwa.online}
      disabledNotice="Sem conexão. Conecte o dispositivo à internet para entrar."
      footer={<>
        <div className="mt-6 grid w-full grid-cols-2 gap-2" aria-label="Tipo de acesso">
          <button type="button" className={`rounded-xl border px-3 py-2 font-semibold ${perfil === "COZINHA" ? "border-brand bg-brand text-white" : "border-line bg-white"}`} onClick={() => setPerfil("COZINHA")}>Cozinha</button>
          <button type="button" className={`rounded-xl border px-3 py-2 font-semibold ${perfil === "NUTRICIONISTA" ? "border-brand bg-brand text-white" : "border-line bg-white"}`} onClick={() => setPerfil("NUTRICIONISTA")}>Nutricionista</button>
        </div>
        <PwaControls pwa={pwa} />
      </>}
      backspaceIcon={<Backspace size={22} weight="bold" />}
    />
  )
}
