import { useState } from 'react';
import { useDeviceStore } from '@/store/deviceStore';
import type { Peripheral, PeripheralParam } from '@/types/device';

export function PeripheralsView() {
  const { device } = useDeviceStore();
  const [selectedPeripheral, setSelectedPeripheral] = useState<string | null>(null);

  if (!device) {
    return <div className="flex-1 flex items-center justify-center text-text-muted">No device loaded</div>;
  }

  const allPeripherals = device.peripherals.flatMap((g) =>
    g.peripherals.map((p) => ({ ...p, category: g.category }))
  );
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
            />
          </div>
        </div>
        {device.peripherals.map((group) => (
          <div key={group.category} className="mb-2">
            <div className="px-3 py-1 text-xs font-semibold text-text-muted uppercase tracking-wider">
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
                <span>{p.name}</span>
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
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Select a peripheral to configure
          </div>
        )}
      </div>
    </div>
  );
}

function PeripheralConfig({ peripheral }: { peripheral: Peripheral & { category: string } }) {
  const [activeTab, setActiveTab] = useState<'params' | 'pins' | 'dma'>('params');

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-text-primary">{peripheral.name} Configuration</h2>
          <p className="text-text-muted text-xs mt-1">
            {peripheral.type} - {peripheral.category} - {peripheral.instances} instance(s)
          </p>
        </div>
        <button
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            peripheral.enabled
              ? 'bg-success/15 text-success'
              : 'bg-panel-bg text-text-muted border border-panel-border'
          }`}
        >
          {peripheral.enabled ? 'ENABLED' : 'DISABLED'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-panel-border pb-2">
        {(['params', 'pins', 'dma'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-t text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'bg-accent/15 text-accent border-b-2 border-accent'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab === 'params' ? 'Parameter Settings' : tab === 'pins' ? 'Pin Configuration' : 'DMA Settings'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'params' && (
        <div className="bg-panel-bg rounded-xl p-6 border border-panel-border">
          <h3 className="text-sm font-semibold text-accent mb-4 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent" />
            {peripheral.type} Settings
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(peripheral.config).map(([key, param]) => (
              <ParamField key={key} name={key} param={param} />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'pins' && (
        <div className="bg-panel-bg rounded-xl p-6 border border-panel-border">
          <h3 className="text-sm font-semibold text-accent mb-4">Assigned Pins</h3>
          {peripheral.pins.length > 0 ? (
            <div className="space-y-2">
              {peripheral.pins.map((pinName) => (
                <div key={pinName} className="flex items-center justify-between bg-editor-bg rounded px-3 py-2 text-xs">
                  <span className="font-mono text-text-primary">{pinName}</span>
                  <span className="text-text-muted">Assigned</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-xs">No pins assigned</p>
          )}
        </div>
      )}

      {activeTab === 'dma' && (
        <div className="bg-panel-bg rounded-xl p-6 border border-panel-border">
          <h3 className="text-sm font-semibold text-accent mb-4">DMA Configuration</h3>
          <p className="text-text-muted text-xs">DMA configuration will be available in a future update.</p>
        </div>
      )}
    </div>
  );
}

function ParamField({ name, param }: { name: string; param: PeripheralParam }) {
  const label = name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  if (param.options) {
    return (
      <div>
        <label className="block text-xs text-text-muted mb-1">{label}</label>
        <select
          className="w-full bg-editor-bg border border-panel-border rounded px-3 py-2 text-xs text-text-primary focus:border-accent outline-none"
          defaultValue={String(param.default)}
        >
          {param.options.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (typeof param.default === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <input type="checkbox" defaultChecked={param.default} className="accent-accent" />
        <label className="text-xs text-text-secondary">{label}</label>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs text-text-muted mb-1">
        {label} {param.unit && <span className="text-text-muted">({param.unit})</span>}
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
