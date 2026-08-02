import { ArrowClockwise } from "@phosphor-icons/react/ArrowClockwise"
import { CheckCircle } from "@phosphor-icons/react/CheckCircle"
import { DeviceMobile } from "@phosphor-icons/react/DeviceMobile"
import { DownloadSimple } from "@phosphor-icons/react/DownloadSimple"
import { WifiHigh } from "@phosphor-icons/react/WifiHigh"
import { WifiSlash } from "@phosphor-icons/react/WifiSlash"

export default function PwaControls({ pwa }) {
  return (
    <section className="mt-7 w-full border-t border-line pt-5" aria-label="Aplicativo e conexão">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${
            pwa.online ? "bg-ok-tint text-ok" : "bg-err-tint text-err"
          }`}
          role="status"
        >
          {pwa.online ? <WifiHigh size={18} weight="bold" /> : <WifiSlash size={18} weight="bold" />}
          {pwa.online ? "Online" : "Sem conexão"}
        </span>

        {pwa.installed && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-tint px-3 py-1.5 text-sm font-bold text-accent">
            <CheckCircle size={18} weight="fill" /> Instalado
          </span>
        )}
      </div>

      {pwa.canInstall && (
        <button type="button" onClick={pwa.install} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-accent bg-accent-tint px-4 py-3 font-bold text-accent">
          <DownloadSimple size={21} weight="bold" /> Instalar EduStock Cozinha
        </button>
      )}

      {pwa.updateAvailable && (
        <button type="button" onClick={pwa.applyUpdate} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 font-bold text-white">
          <ArrowClockwise size={21} weight="bold" /> Atualizar aplicativo
        </button>
      )}

      {!pwa.canInstall && !pwa.installed && (
        <details className="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-soft">
          <summary className="flex cursor-pointer list-none items-center justify-center gap-2 font-bold text-accent">
            <DeviceMobile size={20} weight="bold" /> Como instalar
          </summary>
          <p className="mb-0 mt-2 text-center leading-relaxed">
            No Android ou computador, use “Instalar app” no menu do navegador. No iPhone, use Compartilhar e “Adicionar à Tela de Início”.
          </p>
        </details>
      )}
    </section>
  )
}
