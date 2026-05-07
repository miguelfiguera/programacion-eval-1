import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

function syncDarkFromSystem() {
  document.documentElement.classList.toggle(
    'dark',
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
}

syncDarkFromSystem()
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', syncDarkFromSystem)

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Root element #root not found')
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
