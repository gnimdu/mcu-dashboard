import { useDeviceStore } from '@/store/deviceStore';

export function ClockView() {
  const { device } = useDeviceStore();

  if (!device) {
    return <div className="flex-1 flex items-center justify-center text-text-muted">No device loaded</div>;
  }

  const { clock } = device;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Clock tree diagram */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="min-w-[1200px]">
          <div className="flex items-start gap-16">
            {/* Input Sources */}
            <div className="space-y-6">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Input Sources</h3>
              {clock.sources.map((src) => (
                <ClockSourceNode key={src.id} source={src} />
              ))}
            </div>

            {/* SVG Connectors placeholder */}
            <div className="flex items-center self-center">
              <svg width="80" height="2" className="overflow-visible">
                <line x1="0" y1="1" x2="80" y2="1" stroke="#569cd6" strokeWidth="2" className="connector-active" />
                <polygon points="75,-3 80,1 75,5" fill="#569cd6" />
              </svg>
            </div>

            {/* PLL */}
            <div className="space-y-6">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">PLL</h3>
              {clock.plls.map((pll) => (
                <PLLNode key={pll.id} pll={pll} />
              ))}
            </div>

            {/* SVG Connectors */}
            <div className="flex items-center self-center">
              <svg width="80" height="2" className="overflow-visible">
                <line x1="0" y1="1" x2="80" y2="1" stroke="#c586c0" strokeWidth="2" className="connector-active" />
                <polygon points="75,-3 80,1 75,5" fill="#c586c0" />
              </svg>
            </div>

            {/* System Buses */}
            <div className="space-y-6">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Bus Clocks</h3>
              {clock.buses.map((bus) => (
                <BusNode key={bus.id} bus={bus} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Clock summary panel */}
      <aside className="w-72 bg-sidebar-bg border-l border-panel-border p-4 overflow-auto shrink-0">
        <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-accent text-base">summarize</span>
          Clock Summary
        </h3>

        <div className="space-y-4">
          <div>
            <h4 className="text-xs text-text-muted font-semibold uppercase mb-2">Main Bus Clocks</h4>
            {clock.buses.map((bus) => (
              <div key={bus.id} className="flex justify-between items-center py-1.5 border-b border-panel-border last:border-0">
                <span className="text-xs text-text-secondary">{bus.name}</span>
                <span className="text-sm font-mono font-bold text-text-primary">
                  {formatFreq(bus.frequency)}
                </span>
              </div>
            ))}
          </div>

          {clock.plls.length > 0 && (
            <div>
              <h4 className="text-xs text-text-muted font-semibold uppercase mb-2">PLL Output</h4>
              {clock.plls.map((pll) => (
                <div key={pll.id} className="flex justify-between items-center py-1.5">
                  <span className="text-xs text-text-secondary">{pll.name}</span>
                  <span className="text-sm font-mono font-bold text-clock-pll">
                    {formatFreq(pll.output_frequency)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button className="w-full mt-4 py-2 bg-accent/15 text-accent rounded text-xs font-medium hover:bg-accent/25 transition-colors flex items-center justify-center gap-1.5">
            <span className="material-symbols-outlined text-base">download</span>
            Export Report
          </button>
        </div>
      </aside>
    </div>
  );
}

function ClockSourceNode({ source }: { source: { id: string; name: string; frequency: number; type: string; enabled: boolean } }) {
  const borderColor = source.type === 'internal' ? 'border-l-clock-hsi' : 'border-l-clock-hse';
  const textColor = source.type === 'internal' ? 'text-clock-hsi' : 'text-clock-hse';

  return (
    <div className={`bg-panel-bg rounded-lg border border-panel-border border-l-4 ${borderColor} p-4 w-56`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold uppercase ${textColor}`}>{source.type === 'internal' ? 'INT RC' : 'EXT OSC'}</span>
          <span className="text-xs text-text-primary font-medium">{source.name}</span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={source.enabled} readOnly className="sr-only peer" />
          <div className="w-7 h-4 bg-panel-border rounded-full peer peer-checked:bg-accent transition-colors" />
        </label>
      </div>
      <div className="flex items-baseline gap-1">
        <input
          type="number"
          className="w-20 bg-editor-bg border border-panel-border rounded px-2 py-1 text-sm font-mono text-text-primary focus:border-accent outline-none"
          value={source.frequency / 1e6}
          readOnly
        />
        <span className="text-xs text-text-muted">MHz</span>
      </div>
    </div>
  );
}

function PLLNode({ pll }: { pll: { id: string; name: string; input_div: number; multiplier: number; output_div: number; vco_frequency: number; output_frequency: number; enabled: boolean } }) {
  return (
    <div className="bg-panel-bg rounded-lg border border-panel-border border-l-4 border-l-clock-pll p-4 w-64">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase text-clock-pll">{pll.name}</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={pll.enabled} readOnly className="sr-only peer" />
          <div className="w-7 h-4 bg-panel-border rounded-full peer peer-checked:bg-accent transition-colors" />
        </label>
      </div>
      <div className="space-y-2">
        <ParamRow label="Input Div (M)" value={pll.input_div} />
        <ParamRow label="Multiplier (N)" value={pll.multiplier} />
        <ParamRow label="System Div (P)" value={pll.output_div} />
        <div className="pt-2 border-t border-panel-border">
          <div className="text-xs text-text-muted">VCO: {formatFreq(pll.vco_frequency)}</div>
          <div className="text-lg font-mono font-bold text-clock-pll mt-1">
            {formatFreq(pll.output_frequency)}
          </div>
        </div>
      </div>
    </div>
  );
}

function BusNode({ bus }: { bus: { id: string; name: string; divider: number; frequency: number } }) {
  return (
    <div className="bg-panel-bg rounded-lg border border-panel-border border-l-4 border-l-clock-ahb p-4 w-48">
      <div className="text-xs text-text-muted mb-1">{bus.name}</div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-text-muted">/{bus.divider}</span>
      </div>
      <div className="text-lg font-mono font-bold text-text-primary">
        {formatFreq(bus.frequency)}
      </div>
    </div>
  );
}

function ParamRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-muted">{label}</span>
      <input
        type="number"
        className="w-16 bg-editor-bg border border-panel-border rounded px-2 py-0.5 text-xs font-mono text-text-primary text-right focus:border-accent outline-none"
        value={value}
        readOnly
      />
    </div>
  );
}

function formatFreq(hz: number): string {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(1)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(1)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(1)} kHz`;
  return `${hz} Hz`;
}
