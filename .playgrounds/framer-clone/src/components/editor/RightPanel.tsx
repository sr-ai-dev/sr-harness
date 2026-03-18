import { PropertiesPanel } from '../panels/PropertiesPanel'

export function RightPanel() {
  return (
    <aside
      data-testid="right-panel"
      className="flex flex-col w-56 h-full border-l border-[#3a3a3a] backdrop-blur-sm bg-[rgba(26,26,26,0.8)] rounded-tl-lg rounded-bl-lg overflow-hidden"
    >
      <div className="border-b border-[#3a3a3a] py-2 px-3">
        <span className="text-xs font-medium text-white">Properties</span>
      </div>
      <PropertiesPanel />
    </aside>
  )
}
