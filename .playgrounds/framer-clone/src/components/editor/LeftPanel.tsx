import { useState } from 'react'
import { LayersPanel } from '../panels/LayersPanel'
import { PropertiesPanel } from '../panels/PropertiesPanel'
import { AssetLibrary } from '../panels/AssetLibrary'

type PanelTab = 'layers' | 'properties' | 'assets'

export function LeftPanel() {
  const [activeTab, setActiveTab] = useState<PanelTab>('layers')

  return (
    <aside
      data-testid="left-panel"
      className="flex flex-col w-56 h-full border-r border-[#3a3a3a] backdrop-blur-sm bg-[rgba(26,26,26,0.8)] rounded-tr-lg rounded-br-lg overflow-hidden"
    >
      {/* Tabs */}
      <div className="flex border-b border-[#3a3a3a]">
        <button
          data-testid="tab-layers"
          onClick={() => setActiveTab('layers')}
          className={[
            'flex-1 py-2 text-xs font-medium transition-colors',
            activeTab === 'layers'
              ? 'text-white border-b-2 border-[rgb(0,153,255)]'
              : 'text-[#9ca3af] hover:text-white',
          ].join(' ')}
        >
          Layers
        </button>
        <button
          data-testid="tab-assets"
          onClick={() => setActiveTab('assets')}
          className={[
            'flex-1 py-2 text-xs font-medium transition-colors',
            activeTab === 'assets'
              ? 'text-white border-b-2 border-[rgb(0,153,255)]'
              : 'text-[#9ca3af] hover:text-white',
          ].join(' ')}
        >
          Assets
        </button>
        <button
          data-testid="tab-properties"
          onClick={() => setActiveTab('properties')}
          className={[
            'flex-1 py-2 text-xs font-medium transition-colors',
            activeTab === 'properties'
              ? 'text-white border-b-2 border-[rgb(0,153,255)]'
              : 'text-[#9ca3af] hover:text-white',
          ].join(' ')}
        >
          Props
        </button>
      </div>

      {/* Panel content */}
      {activeTab === 'layers' && <LayersPanel />}
      {activeTab === 'assets' && <AssetLibrary />}
      {activeTab === 'properties' && <PropertiesPanel />}
    </aside>
  )
}
