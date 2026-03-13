import { useDeviceStore, type ViewTab } from '@/store/deviceStore';

const tabs: { id: ViewTab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'pinout', label: 'Pinout', icon: 'memory' },
  { id: 'peripherals', label: 'Peripherals', icon: 'settings_input_component' },
  { id: 'clock', label: 'Clock Config', icon: 'schedule' },
];

export function Header() {
  const { device, activeTab, setActiveTab, availableDevices } = useDeviceStore();

  return (
    <header className="flex items-center h-12 bg-header-bg border-b border-panel-border px-4 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-6">
        <span className="material-symbols-outlined text-accent text-xl">developer_board</span>
        <span className="font-semibold text-text-primary text-sm tracking-wide">
          MCU Dashboard
        </span>
        <span className="text-text-muted text-xs">v0.1</span>
      </div>

      {/* Device selector */}
      <div className="flex items-center gap-2 mr-6">
        <span className="text-text-secondary text-xs">Device:</span>
        <select className="bg-panel-bg border border-panel-border rounded px-2 py-1 text-xs text-text-primary focus:border-accent outline-none">
          {device ? (
            <option>{device.device.name}</option>
          ) : (
            <option>No device loaded</option>
          )}
          {availableDevices.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Navigation tabs */}
      <nav className="flex items-center gap-1 flex-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-accent/15 text-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-panel-bg'
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/15 text-accent rounded text-xs font-medium hover:bg-accent/25 transition-colors">
          <span className="material-symbols-outlined text-base">download</span>
          Export
        </button>
        <button className="p-1.5 text-text-muted hover:text-text-primary transition-colors">
          <span className="material-symbols-outlined text-lg">settings</span>
        </button>
      </div>
    </header>
  );
}
