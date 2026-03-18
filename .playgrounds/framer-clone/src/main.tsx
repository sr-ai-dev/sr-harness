import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useEditorStore } from './store'

// Expose store to window for E2E testing
declare global {
  interface Window {
    __editorStore: typeof useEditorStore
  }
}
window.__editorStore = useEditorStore

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
