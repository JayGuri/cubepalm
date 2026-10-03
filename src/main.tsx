import './migrateStorage'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// A new deploy replaces the cached copy and reloads once, instead of showing
// the old site until the next visit. (Without this, a returning visitor kept
// seeing the previous version -- old name and icon included.)
registerSW({ immediate: true })
