import { useState, useRef, useEffect } from 'react';
import { useDeviceStore, type ViewTab } from '@/store/deviceStore';
import { exportJSON, exportPDF, exportExcel } from '@/utils/export';

const tabs: { id: ViewTab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'pinout', label: 'Pinout', icon: 'memory' },
  { id: 'peripherals', label: 'Peripherals', icon: 'settings_input_component' },
  { id: 'clock', label: 'Clock Config', icon: 'schedule' },
];

export function Header() {
  const { device, activeTab, setActiveTab, availableDevices, selectedPackageIndex } = useDeviceStore();
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const pkg = device?.packages[selectedPackageIndex];

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
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/15 text-accent rounded text-xs font-medium hover:bg-accent/25 transition-colors"
          >
            <span className="material-symbols-outlined text-base">download</span>
            Export
            <span className="material-symbols-outlined text-xs">expand_more</span>
          </button>
          {exportMenuOpen && device && pkg && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-panel-bg border border-panel-border rounded-lg shadow-xl z-50 py-1">
              <button
                onClick={() => { exportJSON(device); setExportMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-editor-bg hover:text-text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-sm text-accent">code</span>
                Export JSON
              </button>
              <button
                onClick={() => { exportPDF(device, pkg); setExportMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-editor-bg hover:text-text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-sm text-error">picture_as_pdf</span>
                Export PDF Report
              </button>
              <button
                onClick={() => { exportExcel(device, pkg); setExportMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-editor-bg hover:text-text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-sm text-success">table_chart</span>
                Export Excel
              </button>
            </div>
          )}
        </div>
        <button className="p-1.5 text-text-muted hover:text-text-primary transition-colors">
          <span className="material-symbols-outlined text-lg">settings</span>
        </button>
      </div>
    </header>
  );
}
