import { useDeviceStore } from '@/store/deviceStore';
import type { Pin } from '@/types/device';

export function PinoutView() {
  const { device, selectedPackageIndex, selectedPinId, selectPin } = useDeviceStore();

  if (!device) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted">
        No device loaded
      </div>
    );
  }

  const pkg = device.packages[selectedPackageIndex];
  if (!pkg) return null;

  const selectedPin = pkg.pins.find((p) => p.id === selectedPinId);

  // Organize pins by side for QFP/LQFP layout
  const pinsBySide = {
    top: pkg.pins.filter((p) => 'side' in p.position && p.position.side === 'top'),
    right: pkg.pins.filter((p) => 'side' in p.position && p.position.side === 'right'),
    bottom: pkg.pins.filter((p) => 'side' in p.position && p.position.side === 'bottom'),
    left: pkg.pins.filter((p) => 'side' in p.position && p.position.side === 'left'),
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Peripheral sidebar */}
      <PeripheralSidebar />

      {/* Main chip view */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
        <div className="relative">
          {/* Chip body */}
          <div className="relative bg-chip-body border-2 border-gray-600 rounded-lg w-[400px] h-[400px] flex items-center justify-center">
            <div className="text-center">
              <div className="text-text-primary font-bold text-lg">{device.device.name}</div>
              <div className="text-text-muted text-xs">{pkg.name}</div>
              <div className="text-text-muted text-xs mt-1">{pkg.pin_count} pins</div>
            </div>

            {/* Top pins */}
            <div className="absolute -top-10 left-8 right-8 flex justify-between">
              {pinsBySide.top.map((pin) => (
                <PinElement key={pin.id} pin={pin} orientation="vertical" selected={pin.id === selectedPinId} onClick={() => selectPin(pin.id)} />
              ))}
            </div>

            {/* Bottom pins */}
            <div className="absolute -bottom-10 left-8 right-8 flex justify-between">
              {pinsBySide.bottom.map((pin) => (
                <PinElement key={pin.id} pin={pin} orientation="vertical" selected={pin.id === selectedPinId} onClick={() => selectPin(pin.id)} />
              ))}
            </div>

            {/* Left pins */}
            <div className="absolute -left-10 top-8 bottom-8 flex flex-col justify-between">
              {pinsBySide.left.map((pin) => (
                <PinElement key={pin.id} pin={pin} orientation="horizontal" selected={pin.id === selectedPinId} onClick={() => selectPin(pin.id)} />
              ))}
            </div>

            {/* Right pins */}
            <div className="absolute -right-10 top-8 bottom-8 flex flex-col justify-between">
              {pinsBySide.right.map((pin) => (
                <PinElement key={pin.id} pin={pin} orientation="horizontal" selected={pin.id === selectedPinId} onClick={() => selectPin(pin.id)} />
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-6 flex items-center justify-center gap-4 text-xs">
            <LegendItem color="bg-chip-pin-active" label="Assigned" />
            <LegendItem color="bg-chip-pin" label="Unassigned" />
            <LegendItem color="bg-chip-pin-power" label="Power" />
            <LegendItem color="bg-chip-pin-ground" label="Ground" />
            <LegendItem color="bg-chip-pin-conflict" label="Conflict" />
          </div>
        </div>
      </div>

      {/* Pin config panel */}
      {selectedPin && <PinConfigPanel pin={selectedPin} />}
    </div>
  );
}

function PinElement({
  pin,
  orientation,
  selected,
  onClick,
}: {
  pin: Pin;
  orientation: 'vertical' | 'horizontal';
  selected: boolean;
  onClick: () => void;
}) {
  const isAssigned = !!pin.assigned_function;
  const colorClass = selected
    ? 'bg-accent'
    : isAssigned
      ? 'bg-chip-pin-active'
      : pin.type === 'power'
        ? 'bg-chip-pin-power'
        : pin.type === 'ground'
          ? 'bg-chip-pin-ground'
          : pin.type === 'analog'
            ? 'bg-chip-pin-analog'
            : 'bg-chip-pin';

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center cursor-pointer"
      title={`${pin.id}: ${pin.name}${pin.assigned_function ? ` → ${pin.assigned_function}` : ''}`}
    >
      <div
        className={`pin-geometry rounded-sm ${colorClass} ${
          orientation === 'vertical' ? 'w-1.5 h-8' : 'w-8 h-1.5'
        } group-hover:bg-accent-hover`}
      />
      <span className="absolute text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
        style={orientation === 'vertical' ? { top: '-14px' } : { left: '100%', marginLeft: '4px' }}
      >
        {pin.name}
      </span>
    </button>
  );
}

function PeripheralSidebar() {
  const { device } = useDeviceStore();
  if (!device) return null;

  return (
    <aside className="w-60 bg-sidebar-bg border-r border-panel-border p-3 overflow-auto shrink-0">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Peripherals</h3>
      {device.peripherals.map((group) => (
        <details key={group.category} className="mb-2" open>
          <summary className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer hover:text-text-primary py-1">
            <span className="material-symbols-outlined text-sm text-accent">expand_more</span>
            {group.category}
          </summary>
          <div className="ml-6 mt-1">
            {group.peripherals.map((p) => (
              <div key={p.name} className="flex items-center justify-between text-xs py-0.5">
                <span className={p.enabled ? 'text-text-primary' : 'text-text-muted'}>{p.name}</span>
                <span className={`font-mono ${p.enabled ? 'text-success' : 'text-text-muted'}`}>
                  {p.enabled ? 'ON' : 'OFF'}
                </span>
              </div>
            ))}
          </div>
        </details>
      ))}

      {/* Resource summary */}
      <div className="mt-4 pt-4 border-t border-panel-border">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Resources</h3>
        {Object.entries(device.resources).map(([name, { used, total }]) => (
          <div key={name} className="flex justify-between text-xs py-0.5">
            <span className="text-text-secondary">{name}</span>
            <span className="font-mono text-text-muted">{used}/{total}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function PinConfigPanel({ pin }: { pin: Pin }) {
  const { assignFunction, setUserLabel, clearPinAssignment } = useDeviceStore();

  return (
    <aside className="w-72 bg-sidebar-bg border-l border-panel-border p-4 overflow-auto shrink-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Pin Configuration</h3>
        <span className="px-2 py-0.5 bg-accent/15 text-accent text-xs rounded">{pin.id}</span>
      </div>

      <div className="space-y-4">
        {/* Pin name */}
        <div>
          <label className="block text-xs text-text-muted mb-1">Pin Name</label>
          <div className="text-sm font-mono text-text-primary">{pin.name}</div>
        </div>

        {/* Signal selection */}
        <div>
          <label className="block text-xs text-text-muted mb-1">Signal Selection</label>
          <select
            className="w-full bg-panel-bg border border-panel-border rounded px-2 py-1.5 text-xs text-text-primary focus:border-accent outline-none"
            value={pin.assigned_function ?? ''}
            onChange={(e) => {
              if (e.target.value) assignFunction(pin.id, e.target.value);
              else clearPinAssignment(pin.id);
            }}
          >
            <option value="">-- Not assigned --</option>
            {pin.functions.map((fn) => (
              <option key={fn.name} value={fn.name}>
                {fn.name} ({fn.peripheral})
              </option>
            ))}
          </select>
        </div>

        {/* User label */}
        <div>
          <label className="block text-xs text-text-muted mb-1">User Label</label>
          <input
            type="text"
            className="w-full bg-panel-bg border border-panel-border rounded px-2 py-1.5 text-xs text-text-primary focus:border-accent outline-none"
            placeholder="e.g., STATUS_LED"
            value={pin.user_label ?? ''}
            onChange={(e) => setUserLabel(pin.id, e.target.value)}
          />
        </div>

        {/* Pin type */}
        <div>
          <label className="block text-xs text-text-muted mb-1">Type</label>
          <span className="text-xs px-2 py-0.5 rounded bg-panel-bg text-text-secondary capitalize">{pin.type}</span>
        </div>

        {/* Electrical */}
        {pin.electrical && (
          <div>
            <label className="block text-xs text-text-muted mb-1">Electrical</label>
            {pin.electrical.voltage && (
              <div className="text-xs text-text-secondary">Voltage: {pin.electrical.voltage}</div>
            )}
          </div>
        )}

        {/* All functions */}
        <div>
          <label className="block text-xs text-text-muted mb-1">Available Functions</label>
          <div className="space-y-1">
            {pin.functions.map((fn) => (
              <div
                key={fn.name}
                className={`text-xs px-2 py-1 rounded cursor-pointer transition-colors ${
                  fn.name === pin.assigned_function
                    ? 'bg-accent/15 text-accent'
                    : 'bg-panel-bg text-text-secondary hover:bg-panel-border'
                }`}
                onClick={() => assignFunction(pin.id, fn.name)}
              >
                <span className="font-mono">{fn.name}</span>
                <span className="text-text-muted ml-1">({fn.peripheral})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-3 h-1.5 rounded-sm ${color}`} />
      <span className="text-text-muted">{label}</span>
    </div>
  );
}
