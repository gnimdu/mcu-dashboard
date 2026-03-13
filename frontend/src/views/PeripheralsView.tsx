import { useState } from 'react';
import { useDeviceStore } from '@/store/deviceStore';
import type { Peripheral, PeripheralParam } from '@/types/device';

export function PeripheralsView() {
  const { device } = useDeviceStore();
  const [selectedPeripheral, setSelectedPeripheral] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  if (!device) {
    return <div className="flex-1 flex items-center justify-center text-text-muted">No device loaded</div>;
  }

  const allPeripherals = device.peripherals.flatMap((g) =>
    g.peripherals.map((p) => ({ ...p, category: g.category }))
  );

  const filteredGroups = searchQuery
    ? device.peripherals.map(g => ({
        ...g,
        peripherals: g.peripherals.filter(p =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.type.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(g => g.peripherals.length > 0)
    : device.peripherals;

  const selected = allPeripherals.find((p) => p.name === selectedPeripheral);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Peripheral tree */}
      <aside className="w-60 bg-sidebar-bg border-r border-panel-border overflow-auto shrink-0">
        <div className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-sm text-text-muted">search</span>
            <input
              type="text"
              placeholder="Search peripherals..."
              className="flex-1 bg-panel-bg border border-panel-border rounded px-2 py-1 text-xs text-text-primary focus:border-accent outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        {filteredGroups.map((group) => (
          <div key={group.category} className="mb-2">
            <div className="px-3 py-1 text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs">{getCategoryIcon(group.category)}</span>
              {group.category}
            </div>
            {group.peripherals.map((p) => (
              <button
                key={p.name}
                onClick={() => setSelectedPeripheral(p.name)}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${
                  selectedPeripheral === p.name
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-secondary hover:bg-panel-bg hover:text-text-primary'
                }`}
              >
                <span className="ml-5">{p.name}</span>
                <span className={`w-2 h-2 rounded-full ${p.enabled ? 'bg-success' : 'bg-panel-border'}`} />
              </button>
            ))}
          </div>
        ))}
      </aside>

      {/* Configuration panel */}
      <div className="flex-1 p-6 overflow-auto">
        {selected ? (
          <PeripheralConfig peripheral={selected} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <span className="material-symbols-outlined text-5xl mb-4">settings_input_component</span>
            <p className="text-sm">Select a peripheral to configure</p>
            <p className="text-xs mt-1">Choose from the sidebar to view settings and pin assignments</p>
          </div>
        )}
      </div>
    </div>
  );
}

function getCategoryIcon(category: string): string {
  switch (category) {
    case 'Analog': return 'show_chart';
    case 'Connectivity': return 'cable';
    case 'Timers': return 'timer';
    case 'System': return 'settings';
    default: return 'extension';
  }
}

function PeripheralConfig({ peripheral }: { peripheral: Peripheral & { category: string } }) {
  const [activeTab, setActiveTab] = useState<'params' | 'pins' | 'dma'>('params');

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-text-primary">{peripheral.name}</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-panel-bg text-text-muted border border-panel-border">
              {peripheral.category}
            </span>
          </div>
          <p className="text-text-muted text-xs mt-1">
            {peripheral.pins.length} pins available
          </p>
        </div>
        <button
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            peripheral.enabled
              ? 'bg-success/15 text-success border border-success/30'
              : 'bg-panel-bg text-text-muted border border-panel-border hover:border-accent hover:text-accent'
          }`}
        >
          <span className="material-symbols-outlined text-sm mr-1 align-middle">
            {peripheral.enabled ? 'toggle_on' : 'toggle_off'}
          </span>
          {peripheral.enabled ? 'ENABLED' : 'DISABLED'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-panel-border">
        {([
          { key: 'params' as const, label: 'Parameters', icon: 'tune' },
          { key: 'pins' as const, label: 'Pin Configuration', icon: 'memory' },
          { key: 'dma' as const, label: 'DMA Settings', icon: 'swap_horiz' },
        ]).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            <span className="material-symbols-outlined text-sm">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'params' && (
        <div className="bg-panel-bg rounded-xl p-6 border border-panel-border">
          {peripheral.params.length > 0 ? (
            <>
              <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-accent text-sm">tune</span>
                {peripheral.name} Parameters
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {peripheral.params.map((param) => (
                  <ParamField key={param.name} param={param} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-3xl text-text-muted mb-2 block">settings</span>
              <p className="text-text-muted text-xs">
                No configurable parameters for {peripheral.name}.
              </p>
              <p className="text-text-muted text-[10px] mt-1">
                Parameters will be available after datasheet extraction.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'pins' && (
        <div className="bg-panel-bg rounded-xl p-6 border border-panel-border">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-accent text-sm">memory</span>
            Available Pins ({peripheral.pins.length})
          </h3>
          {peripheral.pins.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {peripheral.pins.map((pinName) => (
                <div
                  key={pinName}
                  className="flex items-center gap-2 bg-editor-bg rounded px-3 py-2 text-xs border border-transparent hover:border-panel-border"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-chip-pin" />
                  <span className="font-mono text-text-primary">{pinName}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-xs">No pins associated with this peripheral.</p>
          )}
        </div>
      )}

      {activeTab === 'dma' && (
        <div className="bg-panel-bg rounded-xl p-6 border border-panel-border">
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-3xl text-text-muted mb-2 block">swap_horiz</span>
            <p className="text-text-muted text-sm">DMA Configuration</p>
            <p className="text-text-muted text-xs mt-1">DMA channel assignment will be available in a future update.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ParamField({ param }: { param: PeripheralParam }) {
  const label = param.label ?? param.name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  if (param.options) {
    return (
      <div>
        <label className="block text-xs text-text-muted mb-1.5">{label}</label>
        <select
          className="w-full bg-editor-bg border border-panel-border rounded px-3 py-2 text-xs text-text-primary focus:border-accent outline-none"
          defaultValue={String(param.default)}
        >
          {param.options.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}{param.unit ? ` ${param.unit}` : ''}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (typeof param.default === 'boolean') {
    return (
      <div className="flex items-center gap-3 py-1">
        <input
          type="checkbox"
          defaultChecked={param.default}
          className="accent-accent w-4 h-4"
          id={`param-${param.name}`}
        />
        <label htmlFor={`param-${param.name}`} className="text-xs text-text-secondary cursor-pointer">{label}</label>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs text-text-muted mb-1.5">
        {label}
        {param.unit && <span className="text-text-muted ml-1">({param.unit})</span>}
      </label>
      <input
        type="number"
        className="w-full bg-editor-bg border border-panel-border rounded px-3 py-2 text-xs font-mono text-text-primary focus:border-accent outline-none"
        defaultValue={Number(param.default)}
        min={param.min}
        max={param.max}
      />
    </div>
  );
}
