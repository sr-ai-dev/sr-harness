import { EditorLayout } from './components/editor/EditorLayout'
import { LeftPanel } from './components/editor/LeftPanel'
import { RightPanel } from './components/editor/RightPanel'
import { Toolbar } from './components/Toolbar/Toolbar'
import './index.css'

function App() {
  return (
    <EditorLayout
      leftPanelContent={<LeftPanel />}
      rightPanelContent={<RightPanel />}
      toolbarContent={<Toolbar />}
    />
  )
}

export default App
