import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAcademyStore } from '../../state/academyStore'
import { useSettingsStore, type SignReading, type TurnSpeed } from '../../state/settingsStore'
import { SiteNav } from '../SiteNav'

// Native selects in the dark scheme (so the open list is dark too), 16px text
// so a phone does not zoom in on tap, and a full 44px target on touch screens.
const SELECT =
  'min-h-10 rounded-lg border border-white/15 bg-[#16171B] px-3 text-base [color-scheme:dark] hover:border-white/40 pointer-coarse:min-h-11 sm:text-sm'
const ACTION =
  'inline-flex min-h-10 shrink-0 items-center rounded-full border border-white/20 px-5 text-sm font-medium hover:border-white/50 pointer-coarse:min-h-11'

export function Settings() {
  const settings = useSettingsStore()
  const resetAcademy = useAcademyStore((s) => s.reset)
  const [cleared, setCleared] = useState(false)

  return (
    <main className="min-h-dvh bg-[#16171B] px-4 py-8 text-[#ECEAE4] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <SiteNav size={40} />
        <h1 className="font-display mt-8 text-3xl font-extrabold tracking-tight sm:mt-10 sm:text-4xl">Settings</h1>
        <p className="mt-2 text-[#9C9AA3]">Changes apply straight away and are remembered on this device.</p>

        <Section title="Playing">
          <Row label="Default input mode" description="How the cube is turned when you open it." htmlFor="default-input-mode">
            <select
              id="default-input-mode"
              data-testid="default-input-mode"
              aria-label="Default input mode"
              value={settings.defaultInputMode}
              onChange={(e) => settings.setDefaultInputMode(e.target.value as 'mouse' | 'hands')}
              className={SELECT}
            >
              <option value="mouse">Mouse or touch</option>
              <option value="hands">Hands</option>
            </select>
          </Row>

          <Row label="Turn speed" description="How fast a layer turns on screen. Fast suits a quick solver; slow is easier to follow." htmlFor="turn-speed">
            <select
              id="turn-speed"
              data-testid="turn-speed"
              aria-label="Turn speed"
              value={settings.turnSpeed}
              onChange={(e) => settings.setTurnSpeed(e.target.value as TurnSpeed)}
              className={SELECT}
            >
              <option value="slow">Slow</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
            </select>
          </Row>

          <Row label="Colour-blind friendly colours" description="Swaps the standard cube colours for a set that is easier to tell apart.">
            <Switch
              testId="colorblind-toggle"
              label="Colour-blind friendly colours"
              on={settings.colorblindPalette}
              onChange={() => settings.setColorblindPalette(!settings.colorblindPalette)}
            />
          </Row>
        </Section>

        <Section title="Hand signs">
          <Row
            label="Sign reading"
            description="Classic is the original rule. Precise corrects for the camera's picture shape, ignores a relaxed half-open hand, and smooths out jitter; it is new and measured only on a hand model so far."
            htmlFor="sign-reading"
          >
            <select
              id="sign-reading"
              data-testid="sign-reading"
              aria-label="Sign reading"
              value={settings.signReading}
              onChange={(e) => settings.setSignReading(e.target.value as SignReading)}
              className={SELECT}
            >
              <option value="classic">Classic</option>
              <option value="precise">Precise (experimental)</option>
            </select>
          </Row>

          <Row
            label="Swap left and right hand"
            description="Turn on if your right hand shows in blue, the left hand's colour, in the camera panel. Some cameras label hands the other way round."
          >
            <Switch
              testId="swap-hands-toggle"
              label="Swap left and right hand"
              on={settings.swapHands}
              onChange={() => settings.setSwapHands(!settings.swapHands)}
            />
          </Row>

          <Row
            label="Help measure hand tracking"
            description="Record your hands making each sign. Only the positions of points on your hands are kept, never a picture, and nothing is sent."
          >
            <Link to="/record" data-testid="open-record" className={ACTION}>
              Record
            </Link>
          </Row>
        </Section>

        <Section title="Your data">
          <Row label="Your numbers" description="How fast and how accurately you turn the cube with each input method. Kept on this device.">
            <Link to="/stats" data-testid="open-stats" className={ACTION}>
              Open
            </Link>
          </Row>

          <Row label="Saved on this device" description="Your finished lessons and best solve times. Nothing is stored anywhere else.">
            <button
              type="button"
              data-testid="clear-saved"
              className={`${ACTION} hover:border-[#F0566B] hover:text-[#FF8A9A]`}
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
        </Section>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId()
  return (
    <section className="mt-10" aria-labelledby={id}>
      <h2 id={id} className="font-display text-xl font-bold">
        {title}
      </h2>
      <div className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10 bg-[#202227]">{children}</div>
    </section>
  )
}

function Row({ label, description, htmlFor, children }: { label: string; description: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
      <div className="min-w-0">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="font-medium">
            {label}
          </label>
        ) : (
          <p className="font-medium">{label}</p>
        )}
        <p className="mt-0.5 text-sm text-[#9C9AA3]">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// A switch: a track and knob with the state also written beside it, so it
// reads at a glance without relying on colour. The whole thing is the target.
function Switch({ testId, label, on, onChange }: { testId: string; label: string; on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      data-testid={testId}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className="group inline-flex min-h-10 items-center gap-3 rounded-full pointer-coarse:min-h-11"
    >
      <span className={`relative h-7 w-12 rounded-full transition-colors ${on ? 'bg-[#FFD500]' : 'bg-white/15 group-hover:bg-white/25'}`}>
        <span
          className={`absolute top-1 h-5 w-5 rounded-full shadow transition-[left] ${on ? 'left-6 bg-[#16171B]' : 'left-1 bg-[#ECEAE4]'}`}
        />
      </span>
      <span aria-hidden className={`w-7 text-left text-sm font-semibold ${on ? 'text-[#FFD500]' : 'text-[#9C9AA3]'}`}>
        {on ? 'On' : 'Off'}
      </span>
    </button>
  )
}
