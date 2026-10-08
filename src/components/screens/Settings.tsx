import { useState } from 'react'
import { useAcademyStore } from '../../state/academyStore'
import { useSettingsStore, type TurnSpeed } from '../../state/settingsStore'
import { SiteNav } from '../SiteNav'

const TOGGLE = (on: boolean) =>
  `h-6 w-11 rounded-full transition ${on ? 'bg-[#FFD500]' : 'bg-white/15'} relative`
const KNOB = (on: boolean) =>
  `absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${on ? 'left-5' : 'left-0.5'}`

export function Settings() {
  const settings = useSettingsStore()
  const resetAcademy = useAcademyStore((s) => s.reset)
  const [cleared, setCleared] = useState(false)

  return (
    <main className="min-h-dvh bg-[#16171B] px-6 py-12 text-[#ECEAE4]">
      <div className="mx-auto max-w-2xl">
        <SiteNav size={40} />
        <h1 className="font-display mt-10 text-4xl font-extrabold tracking-tight">Settings</h1>

        <div className="mt-8 space-y-6">
          <Row
            label="Colorblind-friendly palette"
            description="Uses a high-contrast alternate palette instead of the standard WCA colours."
          >
            <button
              type="button"
              data-testid="colorblind-toggle"
              role="switch"
              aria-checked={settings.colorblindPalette}
              aria-label="Colorblind-friendly palette"
              className={TOGGLE(settings.colorblindPalette)}
              onClick={() => settings.setColorblindPalette(!settings.colorblindPalette)}
            >
              <span className={KNOB(settings.colorblindPalette)} />
            </button>
          </Row>

          <Row label="Default input mode" description="Which control scheme Free Play starts in.">
            <select
              data-testid="default-input-mode"
              aria-label="Default input mode"
              value={settings.defaultInputMode}
              onChange={(e) => settings.setDefaultInputMode(e.target.value as 'mouse' | 'hands')}
              className="rounded-lg border border-white/10 bg-[#202227] px-3 py-1.5 text-sm"
            >
              <option value="mouse">Mouse</option>
              <option value="hands">Hands</option>
            </select>
          </Row>

          <Row
            label="Swap left and right hand"
            description="Turn on if the Hands panel shows your right hand as 'Left hand' (some cameras label them the other way round)."
          >
            <button
              type="button"
              data-testid="swap-hands-toggle"
              role="switch"
              aria-checked={settings.swapHands}
              aria-label="Swap left and right hand"
              className={TOGGLE(settings.swapHands)}
              onClick={() => settings.setSwapHands(!settings.swapHands)}
            >
              <span className={KNOB(settings.swapHands)} />
            </button>
          </Row>

          <Row label="Turn speed" description="How fast a layer turns on screen. Fast suits a quick solver; slow is easier to follow.">
            <select
              data-testid="turn-speed"
              aria-label="Turn speed"
              value={settings.turnSpeed}
              onChange={(e) => settings.setTurnSpeed(e.target.value as TurnSpeed)}
              className="rounded-lg border border-white/10 bg-[#202227] px-3 py-1.5 text-sm"
            >
              <option value="slow">Slow</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
            </select>
          </Row>

          <Row
            label="Saved on this device"
            description="Your finished lessons and best solve times. Nothing is stored anywhere else."
          >
            <button
              type="button"
              data-testid="clear-saved"
              className="shrink-0 rounded-full border border-white/15 px-4 py-1.5 text-sm font-medium hover:border-[#E5384F] hover:text-[#FF8A9A]"
              onClick={() => {
                if (!window.confirm('Clear your finished lessons and best times on this device? This cannot be undone.')) return
                resetAcademy()
                try {
                  localStorage.removeItem('cubepalm.best.v1')
                } catch {
                  // Storage blocked: there was nothing saved to clear.
                }
                setCleared(true)
              }}
            >
              {cleared ? 'Cleared' : 'Clear'}
            </button>
          </Row>
        </div>
      </div>
    </main>
  )
}

function Row({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#202227] p-4">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-[#9C9AA3]">{description}</p>
      </div>
      {children}
    </div>
  )
}
