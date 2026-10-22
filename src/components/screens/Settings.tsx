import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAcademyStore } from '../../state/academyStore'
import { useSettingsStore, type SignReading, type TurnSpeed } from '../../state/settingsStore'
import { PageFrame } from '../pages/PageFrame'
import { FaceMark } from '../pages/faces'

// Settings: the white face. One instrument in layers, each control lined up in
// one column, every switch a sticker that clicks across.

// Phones without a vibration motor (and iPhones, whose browsers do not offer one) cannot do this.
const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

export function Settings() {
  const settings = useSettingsStore()
  const resetAcademy = useAcademyStore((s) => s.reset)
  const [cleared, setCleared] = useState(false)

  return (
    <PageFrame>
      <div className="mt-10 flex items-center gap-4 sm:mt-12">
        <FaceMark />
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Settings</h1>
      </div>
      <p className="mt-3 text-fg-muted">Changes apply straight away and are remembered on this device.</p>

      <div className="pg-layers mt-8">
        <Section title="Playing">
          <Row label="Default input mode" description="How the cube is turned when you open it." htmlFor="default-input-mode">
            <select
              id="default-input-mode"
              data-testid="default-input-mode"
              value={settings.defaultInputMode}
              onChange={(e) => settings.setDefaultInputMode(e.target.value as 'mouse' | 'hands')}
              className="pg-select"
            >
              <option value="mouse">Mouse or touch</option>
              <option value="hands">Hands</option>
            </select>
          </Row>

          <Row label="Turn speed" description="How fast a layer turns on screen. Fast suits a quick solver; slow is easier to follow." htmlFor="turn-speed">
            <select id="turn-speed" data-testid="turn-speed" value={settings.turnSpeed} onChange={(e) => settings.setTurnSpeed(e.target.value as TurnSpeed)} className="pg-select">
              <option value="slow">Slow</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
            </select>
          </Row>

          <Row label="Turn sound" description="A soft click as each layer lands, like a real cube.">
            <Switch testId="turn-sound" label="Turn sound" on={settings.turnSound} onChange={() => settings.setTurnSound(!settings.turnSound)} />
          </Row>

          <Row
            label="Vibrate on turns"
            description={
              canVibrate
                ? 'A short tap as each layer lands. Phones only: a computer has nothing to vibrate.'
                : 'This browser cannot make the device vibrate, so this is off. Android phones in Chrome, Edge or Firefox can.'
            }
          >
            {canVibrate ? (
              <Switch
                testId="haptics-toggle"
                label="Vibrate on turns"
                on={settings.haptics}
                onChange={() => {
                  // A tap now, so turning it on is felt.
                  if (!settings.haptics) navigator.vibrate(12)
                  settings.setHaptics(!settings.haptics)
                }}
              />
            ) : (
              <p className="text-sm font-bold text-fg-faint">Not on this device</p>
            )}
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
            <select id="sign-reading" data-testid="sign-reading" value={settings.signReading} onChange={(e) => settings.setSignReading(e.target.value as SignReading)} className="pg-select">
              <option value="classic">Classic</option>
              <option value="precise">Precise (experimental)</option>
            </select>
          </Row>

          <Row
            label="Swap left and right hand"
            description="Turn on if your right hand shows in blue, the left hand's colour, in the camera panel. Some cameras label hands the other way round."
          >
            <Switch testId="swap-hands-toggle" label="Swap left and right hand" on={settings.swapHands} onChange={() => settings.setSwapHands(!settings.swapHands)} />
          </Row>

          <Row
            label="Help measure hand tracking"
            description="Record your hands making each sign. Only the positions of points on your hands are kept, never a picture, and nothing is sent."
          >
            <Link to="/record" data-testid="open-record" className="pg-btn">
              Record
            </Link>
          </Row>
        </Section>

        <Section title="Your data">
          <Row label="Your numbers" description="How fast and how accurately you turn the cube with each input method. Kept on this device.">
            <Link to="/stats" data-testid="open-stats" className="pg-btn">
              Open
            </Link>
          </Row>

          <Row label="Saved on this device" description="Your finished lessons and best solve times. Nothing is stored anywhere else.">
            <button
              type="button"
              data-testid="clear-saved"
              className="pg-btn pg-btn-danger"
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
    </PageFrame>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="px-4 pt-5 sm:px-6 sm:pt-6">
      <h2 id={id} className="font-display text-lg font-bold">
        {title}
      </h2>
      <div className="pg-seams mt-2">{children}</div>
    </section>
  )
}

// Text on the left, the control in a column of its own on the right, so every
// select and switch lines up down the page. On a phone the control goes underneath.
function Row({ label, description, htmlFor, children }: { label: string; description: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 py-4 sm:flex-row sm:items-center sm:gap-6 sm:py-5">
      <div className="min-w-0 flex-1">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="font-bold">
            {label}
          </label>
        ) : (
          <p className="font-bold">{label}</p>
        )}
        <p className="mt-1 text-sm text-fg-faint">{description}</p>
      </div>
      <div className="w-full shrink-0 sm:flex sm:w-52 sm:justify-end">{children}</div>
    </div>
  )
}

// A sticker switch with its state also written beside it, so it reads without
// relying on colour. The whole thing is the target.
function Switch({ testId, label, on, onChange }: { testId: string; label: string; on: boolean; onChange: () => void }) {
  return (
    <button type="button" data-testid={testId} role="switch" aria-checked={on} aria-label={label} onClick={onChange} className="pg-switch">
      <span aria-hidden className="pg-switch-slot">
        <span className="pg-switch-knob" />
      </span>
      <span aria-hidden className={`w-7 text-left text-sm font-bold ${on ? 'text-fg' : 'text-fg-faint'}`}>
        {on ? 'On' : 'Off'}
      </span>
    </button>
  )
}
