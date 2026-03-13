import { useState, useMemo } from 'react';
import { useDeviceStore } from '@/store/deviceStore';
import type { Pin, PinType } from '@/types/device';

const PIN_TYPE_COLORS: Record<PinType | 'special', { bg: string; text: string; label: string }> = {
  io: { bg: 'bg-chip-pin', text: 'text-gray-300', label: 'GPIO' },
  analog: { bg: 'bg-chip-pin-analog', text: 'text-purple-300', label: 'Analog' },
  power: { bg: 'bg-chip-pin-power', text: 'text-red-300', label: 'Power' },
  ground: { bg: 'bg-chip-pin-ground', text: 'text-gray-500', label: 'Ground' },
  clock: { bg: 'bg-yellow-500', text: 'text-yellow-300', label: 'Clock' },
  special: { bg: 'bg-orange-500', text: 'text-orange-300', label: 'Special' },
};

export function PinoutView() {
  const { device, selectedPackageIndex, selectedPinId, selectPin } = useDeviceStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightPeripheral, setHighlightPeripheral] = useState<string | null>(null);

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
  const isControlCard = pkg.type === 'controlcard' || pkg.type === 'launchpad';

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Peripheral sidebar */}
      <PeripheralSidebar
        highlightPeripheral={highlightPeripheral}
        setHighlightPeripheral={setHighlightPeripheral}
      />

      {/* Main chip view */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search bar */}
        <div className="px-4 py-2 border-b border-panel-border bg-panel-bg flex items-center gap-3">
          <span className="material-symbols-outlined text-text-muted text-sm">search</span>
          <input
            type="text"
            placeholder="Search pins... (e.g., GPIO-00, SPI, ADC)"
            className="flex-1 bg-transparent text-xs text-text-primary placeholder-text-muted outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="text-xs text-text-muted">{pkg.pin_count} pins</span>
        </div>

        {/* Pin visualization */}
        <div className="flex-1 overflow-auto p-4">
          {isControlCard ? (
            <ControlCardView
              pins={pkg.pins}
              deviceName={device.device.name}
              packageName={pkg.name}
              selectedPinId={selectedPinId}
              searchQuery={searchQuery}
              highlightPeripheral={highlightPeripheral}
              onPinClick={selectPin}
            />
          ) : (
            <QFPView
              pins={pkg.pins}
              deviceName={device.device.name}
              packageName={pkg.name}
              selectedPinId={selectedPinId}
              searchQuery={searchQuery}
              highlightPeripheral={highlightPeripheral}
              onPinClick={selectPin}
            />
          )}

          {/* Legend */}
          <div className="mt-4 flex items-center justify-center gap-4 text-xs">
            {Object.entries(PIN_TYPE_COLORS).map(([type, { bg, label }]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className={`w-3 h-1.5 rounded-sm ${bg}`} />
                <span className="text-text-muted">{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1.5 rounded-sm bg-accent" />
              <span className="text-text-muted">Selected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pin config panel */}
      {selectedPin && <PinConfigPanel pin={selectedPin} />}
    </div>
  );
}

/* ─── ControlCard dual-row layout ─── */

function ControlCardView({
  pins,
  deviceName,
  packageName,
  selectedPinId,
  searchQuery,
  highlightPeripheral,
  onPinClick,
}: {
  pins: Pin[];
  deviceName: string;
  packageName: string;
  selectedPinId: string | null;
  searchQuery: string;
  highlightPeripheral: string | null;
  onPinClick: (id: string) => void;
}) {
  const leftPins = useMemo(() =>
    pins.filter((p) => 'side' in p.position && p.position.side === 'left')
      .sort((a, b) => ('index' in a.position ? a.position.index : 0) - ('index' in b.position ? b.position.index : 0)),
    [pins]
  );
  const rightPins = useMemo(() =>
    pins.filter((p) => 'side' in p.position && p.position.side === 'right')
      .sort((a, b) => ('index' in a.position ? a.position.index : 0) - ('index' in b.position ? b.position.index : 0)),
    [pins]
  );

  // Match rows: pair left and right pins by index
  const maxRows = Math.max(leftPins.length, rightPins.length);

  return (
    <div className="flex flex-col items-center">
      {/* Header */}
      <div className="mb-4 text-center">
        <div className="text-text-primary font-bold text-lg">{deviceName}</div>
        <div className="text-text-muted text-xs">{packageName}</div>
      </div>

      {/* Connector table */}
      <div className="relative bg-chip-body/50 border border-gray-700 rounded-lg overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[60px_1fr_180px_40px_180px_1fr_60px] items-center px-2 py-1.5 bg-header-bg border-b border-gray-700 text-[10px] text-text-muted uppercase tracking-wider">
          <div className="text-center">HSEC</div>
          <div>Functions</div>
          <div className="text-right pr-2">MCU Pin</div>
          <div className="text-center"></div>
          <div className="pl-2">MCU Pin</div>
          <div className="text-right">Functions</div>
          <div className="text-center">HSEC</div>
        </div>

        {/* Pin rows */}
        <div className="max-h-[calc(100vh-280px)] overflow-auto">
          {Array.from({ length: maxRows }).map((_, i) => {
            const leftPin = leftPins[i];
            const rightPin = rightPins[i];
            return (
              <ConnectorRow
                key={i}
                index={i}
                leftPin={leftPin}
                rightPin={rightPin}
                selectedPinId={selectedPinId}
                searchQuery={searchQuery}
                highlightPeripheral={highlightPeripheral}
                onPinClick={onPinClick}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ConnectorRow({
  index,
  leftPin,
  rightPin,
  selectedPinId,
  searchQuery,
  highlightPeripheral,
  onPinClick,
}: {
  index: number;
  leftPin?: Pin;
  rightPin?: Pin;
  selectedPinId: string | null;
  searchQuery: string;
  highlightPeripheral: string | null;
  onPinClick: (id: string) => void;
}) {
  const isEven = index % 2 === 0;

  return (
    <div className={`grid grid-cols-[60px_1fr_180px_40px_180px_1fr_60px] items-center px-2 py-0.5 ${
      isEven ? 'bg-panel-bg/30' : ''
    } hover:bg-panel-bg/50`}>
      {/* Left HSEC pin number */}
      <div className="text-center text-[10px] font-mono text-text-muted">
        {leftPin?.id ?? ''}
      </div>

      {/* Left functions */}
      <div className="text-right pr-2 truncate">
        {leftPin && (
          <PinFunctions pin={leftPin} searchQuery={searchQuery} highlightPeripheral={highlightPeripheral} align="right" />
        )}
      </div>

      {/* Left MCU pin */}
      <div className="text-right pr-2">
        {leftPin && (
          <PinChip
            pin={leftPin}
            selected={leftPin.id === selectedPinId}
            searchQuery={searchQuery}
            highlightPeripheral={highlightPeripheral}
            onClick={() => onPinClick(leftPin.id)}
          />
        )}
      </div>

      {/* Center connector divider */}
      <div className="flex items-center justify-center">
        <div className="w-3 h-5 bg-gray-700 rounded-sm border border-gray-600" />
      </div>

      {/* Right MCU pin */}
      <div className="pl-2">
        {rightPin && (
          <PinChip
            pin={rightPin}
            selected={rightPin.id === selectedPinId}
            searchQuery={searchQuery}
            highlightPeripheral={highlightPeripheral}
            onClick={() => onPinClick(rightPin.id)}
          />
        )}
      </div>

      {/* Right functions */}
      <div className="truncate">
        {rightPin && (
          <PinFunctions pin={rightPin} searchQuery={searchQuery} highlightPeripheral={highlightPeripheral} align="left" />
        )}
      </div>

      {/* Right HSEC pin number */}
      <div className="text-center text-[10px] font-mono text-text-muted">
        {rightPin?.id ?? ''}
      </div>
    </div>
  );
}

function PinChip({
  pin,
  selected,
  searchQuery,
  highlightPeripheral,
  onClick,
}: {
  pin: Pin;
  selected: boolean;
  searchQuery: string;
  highlightPeripheral: string | null;
  onClick: () => void;
}) {
  const isSearchMatch = searchQuery && pinMatchesSearch(pin, searchQuery);
  const isPeriphMatch = highlightPeripheral && pin.functions.some(f => f.peripheral === highlightPeripheral);
  const typeInfo = PIN_TYPE_COLORS[pin.type] ?? PIN_TYPE_COLORS.io;
  const isHighlighted = selected || isSearchMatch || isPeriphMatch;

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer whitespace-nowrap ${
        selected
          ? 'bg-accent/20 text-accent ring-1 ring-accent'
          : isHighlighted
            ? 'bg-accent/10 text-accent'
            : `${typeInfo.bg}/15 ${typeInfo.text} hover:bg-accent/10 hover:text-accent`
      }`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${
        selected ? 'bg-accent' : typeInfo.bg
      }`} />
      {pin.name}
      {pin.assigned_function && (
        <span className="text-accent text-[9px]">({pin.assigned_function})</span>
      )}
    </button>
  );
}

function PinFunctions({
  pin,
  searchQuery: _searchQuery,
  highlightPeripheral,
  align,
}: {
  pin: Pin;
  searchQuery: string;
  highlightPeripheral: string | null;
  align: 'left' | 'right';
}) {
  // Show alternate functions (skip the primary MCU pin name)
  const altFunctions = pin.functions.slice(1);
  if (altFunctions.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-0.5 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
      {altFunctions.slice(0, 4).map((fn) => {
        const isMatch = highlightPeripheral === fn.peripheral;
        return (
          <span
            key={fn.name}
            className={`text-[9px] px-1 py-px rounded ${
              isMatch
                ? 'bg-accent/20 text-accent'
                : 'bg-panel-bg/60 text-text-muted'
            }`}
          >
            {fn.name}
          </span>
        );
      })}
      {altFunctions.length > 4 && (
        <span className="text-[9px] text-text-muted">+{altFunctions.length - 4}</span>
      )}
    </div>
  );
}

/* ─── QFP package layout (for non-controlcard packages) ─── */

function QFPView({
  pins,
  deviceName,
  packageName,
  selectedPinId,
  searchQuery: _sq,
  highlightPeripheral: _hp,
  onPinClick,
}: {
  pins: Pin[];
  deviceName: string;
  packageName: string;
  selectedPinId: string | null;
  searchQuery: string;
  highlightPeripheral: string | null;
  onPinClick: (id: string) => void;
}) {
  const pinsBySide = useMemo(() => ({
    top: pins.filter((p) => 'side' in p.position && p.position.side === 'top'),
    right: pins.filter((p) => 'side' in p.position && p.position.side === 'right'),
    bottom: pins.filter((p) => 'side' in p.position && p.position.side === 'bottom'),
    left: pins.filter((p) => 'side' in p.position && p.position.side === 'left'),
  }), [pins]);

  return (
    <div className="flex items-center justify-center">
      <div className="relative bg-chip-body border-2 border-gray-600 rounded-lg w-[400px] h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-text-primary font-bold text-lg">{deviceName}</div>
          <div className="text-text-muted text-xs">{packageName}</div>
        </div>

        {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
          <div
            key={side}
            className={`absolute flex ${
              side === 'top' ? '-top-10 left-8 right-8 justify-between' :
              side === 'bottom' ? '-bottom-10 left-8 right-8 justify-between' :
              side === 'left' ? '-left-10 top-8 bottom-8 flex-col justify-between' :
              '-right-10 top-8 bottom-8 flex-col justify-between'
            }`}
          >
            {pinsBySide[side].map((pin) => (
              <PinStick
                key={pin.id}
                pin={pin}
                orientation={side === 'top' || side === 'bottom' ? 'vertical' : 'horizontal'}
                selected={pin.id === selectedPinId}
                onClick={() => onPinClick(pin.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PinStick({
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
  const typeInfo = PIN_TYPE_COLORS[pin.type] ?? PIN_TYPE_COLORS.io;
  const colorClass = selected ? 'bg-accent' : typeInfo.bg;

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center cursor-pointer"
      title={`${pin.id}: ${pin.name}`}
    >
      <div className={`rounded-sm ${colorClass} ${
        orientation === 'vertical' ? 'w-1.5 h-8' : 'w-8 h-1.5'
      } group-hover:bg-accent-hover`} />
      <span
        className="absolute text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
        style={orientation === 'vertical' ? { top: '-14px' } : { left: '100%', marginLeft: '4px' }}
      >
        {pin.name}
      </span>
    </button>
  );
}

/* ─── Peripheral Sidebar ─── */

function PeripheralSidebar({
  highlightPeripheral,
  setHighlightPeripheral,
}: {
  highlightPeripheral: string | null;
  setHighlightPeripheral: (p: string | null) => void;
}) {
  const { device } = useDeviceStore();
  if (!device) return null;

  return (
    <aside className="w-56 bg-sidebar-bg border-r border-panel-border p-3 overflow-auto shrink-0">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Peripherals</h3>
      {device.peripherals.map((group) => (
        <details key={group.category} className="mb-2" open>
          <summary className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer hover:text-text-primary py-1">
            <span className="material-symbols-outlined text-sm text-accent">expand_more</span>
            {group.category}
          </summary>
          <div className="ml-6 mt-1">
            {group.peripherals.map((p) => (
              <button
                key={p.name}
                className={`flex items-center justify-between text-xs py-0.5 w-full text-left rounded px-1 transition-colors ${
                  highlightPeripheral === p.name
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-muted hover:text-text-primary hover:bg-panel-bg/50'
                }`}
                onClick={() => setHighlightPeripheral(highlightPeripheral === p.name ? null : p.name)}
              >
                <span>{p.name}</span>
                <span className="font-mono text-[10px]">{p.pins.length}p</span>
              </button>
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

/* ─── Pin Config Panel ─── */

function PinConfigPanel({ pin }: { pin: Pin }) {
  const { assignFunction, setUserLabel, clearPinAssignment } = useDeviceStore();

  return (
    <aside className="w-72 bg-sidebar-bg border-l border-panel-border p-4 overflow-auto shrink-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Pin Configuration</h3>
        <span className="px-2 py-0.5 bg-accent/15 text-accent text-xs rounded font-mono">{pin.id}</span>
      </div>

      <div className="space-y-4">
        {/* Pin name and type */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-text-primary font-semibold">{pin.name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${
            PIN_TYPE_COLORS[pin.type]?.bg ?? 'bg-gray-500'
          }/20 ${PIN_TYPE_COLORS[pin.type]?.text ?? 'text-gray-300'}`}>
            {pin.type}
          </span>
        </div>

        {/* Signal selection */}
        <div>
          <label className="block text-xs text-text-muted mb-1">Signal Assignment</label>
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

        {/* Available functions list */}
        <div>
          <label className="block text-xs text-text-muted mb-2">Available Functions ({pin.functions.length})</label>
          <div className="space-y-1 max-h-64 overflow-auto">
            {pin.functions.map((fn) => (
              <button
                key={fn.name}
                className={`w-full text-left text-xs px-2 py-1 rounded transition-colors ${
                  fn.name === pin.assigned_function
                    ? 'bg-accent/15 text-accent ring-1 ring-accent/30'
                    : 'bg-panel-bg text-text-secondary hover:bg-panel-border hover:text-text-primary'
                }`}
                onClick={() => assignFunction(pin.id, fn.name)}
              >
                <span className="font-mono">{fn.name}</span>
                <span className="text-text-muted ml-1 text-[10px]">{fn.peripheral}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ─── Helpers ─── */

function pinMatchesSearch(pin: Pin, query: string): boolean {
  const q = query.toLowerCase();
  return (
    pin.name.toLowerCase().includes(q) ||
    pin.id.toLowerCase().includes(q) ||
    pin.functions.some(f => f.name.toLowerCase().includes(q) || f.peripheral.toLowerCase().includes(q))
  );
}
