export function PropertiesPanel() {
  return (
    <div
      data-testid="properties-panel"
      className="flex-1 overflow-y-auto p-3"
    >
      <p className="text-xs text-[#9ca3af]">No selection</p>
      <div className="mt-4 space-y-3">
        <div className="space-y-1">
          <label className="text-xs text-[#9ca3af]">X</label>
          <input
            type="number"
            placeholder="0"
            className="w-full bg-transparent text-xs text-white outline-none placeholder-[#9ca3af]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-[#9ca3af]">Y</label>
          <input
            type="number"
            placeholder="0"
            className="w-full bg-transparent text-xs text-white outline-none placeholder-[#9ca3af]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-[#9ca3af]">W</label>
          <input
            type="number"
            placeholder="0"
            className="w-full bg-transparent text-xs text-white outline-none placeholder-[#9ca3af]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-[#9ca3af]">H</label>
          <input
            type="number"
            placeholder="0"
            className="w-full bg-transparent text-xs text-white outline-none placeholder-[#9ca3af]"
          />
        </div>
      </div>
    </div>
  )
}
