import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useEditorStore } from './store'
import { useComponentStore } from './store/components'
import { createPersistence } from './store/persistence'

// Expose stores to window for E2E testing
declare global {
  interface Window {
    __editorStore: typeof useEditorStore
    __componentStore: typeof useComponentStore
  }
}
window.__editorStore = useEditorStore
window.__componentStore = useComponentStore

// Initialize persistence (restores from LocalStorage + starts auto-save)
createPersistence()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
