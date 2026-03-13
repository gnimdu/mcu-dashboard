import { useDeviceStore } from '@/store/deviceStore';

export function DashboardView() {
  const { device } = useDeviceStore();

  if (!device) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-text-muted mb-4 block">developer_board</span>
          <h2 className="text-xl text-text-secondary mb-2">No Device Loaded</h2>
          <p className="text-text-muted text-sm">Load a device JSON file to get started</p>
        </div>
      </div>
    );
  }

  const resources = device.resources;

  return (
    <div className="flex-1 p-6 overflow-auto">
      {/* Device header */}
      <div className="flex items-start gap-6 mb-8">
        <div className="bg-panel-bg rounded-xl p-6 border border-panel-border flex-1">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-3xl text-accent">memory</span>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{device.device.name}</h1>
              <p className="text-text-secondary text-sm">{device.device.manufacturer} - {device.device.family}</p>
            </div>
          </div>
          <p className="text-text-muted text-sm">{device.device.description}</p>

          {/* Package info */}
          <div className="mt-4 flex gap-4">
            {device.packages.map((pkg, i) => (
              <div key={i} className="bg-editor-bg rounded-lg px-4 py-2 border border-panel-border">
                <div className="text-xs text-text-muted">Package</div>
                <div className="text-sm font-medium text-text-primary">{pkg.name}</div>
                <div className="text-xs text-accent">{pkg.pin_count} pins</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {device.clock.buses.length > 0 && (
          <MetricCard
            icon="speed"
            label="Core Clock"
            value={formatFrequency(device.clock.buses[0]?.frequency ?? 0)}
            color="text-accent"
          />
        )}
        <MetricCard icon="storage" label="Flash Size" value="1 MB" color="text-warning" />
        <MetricCard icon="memory" label="RAM Size" value="256 KB" color="text-success" />
      </div>

      {/* Resource allocation */}
      <div className="bg-panel-bg rounded-xl p-6 border border-panel-border">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-accent">analytics</span>
          Resource Allocation
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(resources).map(([name, { used, total }]) => (
            <ResourceBar key={name} name={name} used={used} total={total} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="bg-panel-bg rounded-xl p-5 border border-panel-border text-center">
      <span className={`material-symbols-outlined text-3xl ${color} mb-2 block`}>{icon}</span>
      <div className="text-2xl font-bold font-mono text-text-primary">{value}</div>
      <div className="text-xs text-text-muted mt-1">{label}</div>
    </div>
  );
}

function ResourceBar({ name, used, total }: { name: string; used: number; total: number }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  const barColor = pct > 80 ? 'bg-error' : pct > 50 ? 'bg-warning' : 'bg-accent';

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-secondary">{name}</span>
        <span className="text-text-muted font-mono">{used} / {total}</span>
      </div>
      <div className="h-2 bg-editor-bg rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatFrequency(hz: number): string {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(1)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(0)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(0)} kHz`;
  return `${hz} Hz`;
}
