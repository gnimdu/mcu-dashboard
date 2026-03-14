import { useState, useEffect } from 'react';
import { useDeviceStore } from '@/store/deviceStore';
import type { ClockSource, PLL, ClockBus } from '@/types/device';

// Layout constants
const NODE_W = 220;
const NODE_GAP_X = 100;
const NODE_GAP_Y = 20;
const COLUMN_X = [40, 40 + NODE_W + NODE_GAP_X, 40 + 2 * (NODE_W + NODE_GAP_X)];
const HEADER_Y = 10;
const CONTENT_Y = 40;

export function ClockView() {
  const { device, updatePLL, updateClockSource, updateBusDivider } = useDeviceStore();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  if (!device) {
    return <div className="flex-1 flex items-center justify-center text-text-muted">No device loaded</div>;
  }

  const { clock } = device;

  // Compute node positions
  const sourcePositions: Record<string, { x: number; y: number; h: number }> = {};
  let sy = CONTENT_Y;
  for (const src of clock.sources) {
    const h = 100;
    sourcePositions[src.id] = { x: COLUMN_X[0], y: sy, h };
    sy += h + NODE_GAP_Y;
  }

  const pllPositions: Record<string, { x: number; y: number; h: number }> = {};
  let py = CONTENT_Y;
  for (const pll of clock.plls) {
    const h = 180;
    pllPositions[pll.id] = { x: COLUMN_X[1], y: py, h };
    py += h + NODE_GAP_Y;
  }

  const busPositions: Record<string, { x: number; y: number; h: number }> = {};
  let by = CONTENT_Y;
  for (const bus of clock.buses) {
    const h = 70;
    busPositions[bus.id] = { x: COLUMN_X[2], y: by, h };
    by += h + NODE_GAP_Y;
  }

  const totalH = Math.max(sy, py, by) + 40;
  const totalW = COLUMN_X[2] + NODE_W + 40;

  // Build connector paths: source→PLL, PLL→bus, bus→bus
  const connectors: { from: { x: number; y: number }; to: { x: number; y: number }; color: string; active: boolean }[] = [];

  for (const pll of clock.plls) {
    const sp = sourcePositions[pll.source];
    const pp = pllPositions[pll.id];
    if (sp && pp) {
      connectors.push({
        from: { x: sp.x + NODE_W, y: sp.y + sp.h / 2 },
        to: { x: pp.x, y: pp.y + 30 },
        color: '#569cd6',
        active: pll.enabled,
      });
    }
  }

  for (const bus of clock.buses) {
    const bp = busPositions[bus.id];
    if (!bp) continue;
    const pllSrc = pllPositions[bus.source];
    const busSrc = busPositions[bus.source];
    if (pllSrc) {
      connectors.push({
        from: { x: pllSrc.x + NODE_W, y: pllSrc.y + pllSrc.h / 2 },
        to: { x: bp.x, y: bp.y + bp.h / 2 },
        color: '#c586c0',
        active: true,
      });
    } else if (busSrc) {
      connectors.push({
        from: { x: busSrc.x + NODE_W, y: busSrc.y + busSrc.h / 2 },
        to: { x: bp.x, y: bp.y + bp.h / 2 },
        color: '#4ec9b0',
        active: true,
      });
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Clock tree SVG diagram */}
      <div className="flex-1 overflow-auto p-4">
        <svg
          width={totalW}
          height={totalH}
          className="min-w-full"
          style={{ minWidth: totalW, minHeight: totalH }}
        >
          <defs>
            <marker id="arrowBlue" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#569cd6" />
            </marker>
            <marker id="arrowPurple" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#c586c0" />
            </marker>
            <marker id="arrowTeal" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#4ec9b0" />
            </marker>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Column headers */}
          <text x={COLUMN_X[0]} y={HEADER_Y + 14} className="fill-text-muted text-[11px] font-semibold uppercase tracking-wider">
            Input Sources
          </text>
          <text x={COLUMN_X[1]} y={HEADER_Y + 14} className="fill-text-muted text-[11px] font-semibold uppercase tracking-wider">
            Phase-Locked Loops
          </text>
          <text x={COLUMN_X[2]} y={HEADER_Y + 14} className="fill-text-muted text-[11px] font-semibold uppercase tracking-wider">
            Bus Clocks
          </text>

          {/* Connectors */}
          {connectors.map((c, i) => {
            const midX = (c.from.x + c.to.x) / 2;
            const markerEnd = c.color === '#569cd6' ? 'url(#arrowBlue)' : c.color === '#c586c0' ? 'url(#arrowPurple)' : 'url(#arrowTeal)';
            return (
              <path
                key={i}
                d={`M ${c.from.x} ${c.from.y} C ${midX} ${c.from.y}, ${midX} ${c.to.y}, ${c.to.x} ${c.to.y}`}
                fill="none"
                stroke={c.color}
                strokeWidth={c.active ? 2 : 1}
                strokeDasharray={c.active ? 'none' : '6 4'}
                opacity={c.active ? 0.8 : 0.3}
                markerEnd={markerEnd}
              />
            );
          })}

          {/* Source nodes */}
          {clock.sources.map((src) => {
            const pos = sourcePositions[src.id];
            return (
              <SourceNodeSVG
                key={src.id}
                source={src}
                x={pos.x}
                y={pos.y}
                w={NODE_W}
                h={pos.h}
                hovered={hoveredNode === src.id}
                onHover={setHoveredNode}
                onChange={updateClockSource}
              />
            );
          })}

          {/* PLL nodes */}
          {clock.plls.map((pll) => {
            const pos = pllPositions[pll.id];
            return (
              <PLLNodeSVG
                key={pll.id}
                pll={pll}
                x={pos.x}
                y={pos.y}
                w={NODE_W}
                h={pos.h}
                hovered={hoveredNode === pll.id}
                onHover={setHoveredNode}
                onChange={updatePLL}
              />
            );
          })}

          {/* Bus nodes */}
          {clock.buses.map((bus) => {
            const pos = busPositions[bus.id];
            return (
              <BusNodeSVG
                key={bus.id}
                bus={bus}
                x={pos.x}
                y={pos.y}
                w={NODE_W}
                h={pos.h}
                hovered={hoveredNode === bus.id}
                onHover={setHoveredNode}
                onChange={updateBusDivider}
              />
            );
          })}
        </svg>
      </div>

      {/* Clock summary sidebar */}
      <aside className="w-72 bg-sidebar-bg border-l border-panel-border p-4 overflow-auto shrink-0">
        <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-accent text-base">summarize</span>
          Clock Summary
        </h3>

        <div className="space-y-5">
          {/* Sources */}
          <SummarySection title="Oscillator Sources">
            {clock.sources.map((src) => (
              <SummaryRow
                key={src.id}
                label={src.name}
                value={formatFreq(src.frequency)}
                color={src.type === 'internal' ? 'text-clock-hsi' : 'text-clock-hse'}
                dimmed={!src.enabled}
              />
            ))}
          </SummarySection>

          {/* PLLs */}
          {clock.plls.length > 0 && (
            <SummarySection title="PLL Outputs">
              {clock.plls.map((pll) => (
                <div key={pll.id} className="py-1.5 border-b border-panel-border last:border-0">
                  <SummaryRow label={pll.name} value={formatFreq(pll.output_frequency)} color="text-clock-pll" />
                  <div className="text-[10px] text-text-muted mt-0.5 ml-1">
                    VCO: {formatFreq(pll.vco_frequency)} | M={pll.input_div} N={pll.multiplier} P={pll.output_div}
                  </div>
                </div>
              ))}
            </SummarySection>
          )}

          {/* Buses */}
          <SummarySection title="Bus Clocks">
            {clock.buses.map((bus) => (
              <SummaryRow
                key={bus.id}
                label={bus.name}
                value={formatFreq(bus.frequency)}
                color="text-text-primary"
                sub={`/${bus.divider} from ${bus.source}`}
              />
            ))}
          </SummarySection>

          {/* Frequency warnings */}
          <FrequencyWarnings clock={clock} />
        </div>
      </aside>
    </div>
  );
}

// --- SVG Node Components ---

function SourceNodeSVG({
  source, x, y, w, h, hovered, onHover, onChange,
}: {
  source: ClockSource; x: number; y: number; w: number; h: number;
  hovered: boolean; onHover: (id: string | null) => void;
  onChange: (id: string, field: 'frequency' | 'enabled', value: number | boolean) => void;
}) {
  const borderColor = source.type === 'internal' ? '#569cd6' : '#4ec9b0';
  const typeLabel = source.type === 'internal' ? 'INT RC' : 'EXT OSC';

  return (
    <g
      onMouseEnter={() => onHover(source.id)}
      onMouseLeave={() => onHover(null)}
    >
      <rect
        x={x} y={y} width={w} height={h} rx={8}
        fill="#1e293b" stroke={hovered ? borderColor : '#334155'} strokeWidth={hovered ? 2 : 1}
        filter={hovered ? 'url(#glow)' : undefined}
      />
      {/* Left accent bar */}
      <rect x={x} y={y} width={4} height={h} rx={2} fill={borderColor} />

      {/* Type badge */}
      <text x={x + 16} y={y + 22} fill={borderColor} fontSize={10} fontWeight={700} letterSpacing={0.5}>
        {typeLabel}
      </text>
      <text x={x + 80} y={y + 22} fill="#e2e8f0" fontSize={12} fontWeight={500}>
        {source.name}
      </text>

      {/* Toggle */}
      <foreignObject x={x + w - 50} y={y + 8} width={42} height={24}>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={source.enabled}
            onChange={(e) => onChange(source.id, 'enabled', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-panel-border rounded-full peer peer-checked:bg-accent transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </foreignObject>

      {/* Frequency input */}
      <foreignObject x={x + 14} y={y + 40} width={120} height={36}>
        <EditableNumber
          value={source.frequency / 1e6}
          min={0.1}
          onChange={(mhz) => onChange(source.id, 'frequency', mhz * 1e6)}
          className="w-full bg-editor-bg border border-panel-border rounded px-2 py-1.5 text-sm font-mono text-text-primary focus:border-accent outline-none"
        />
      </foreignObject>
      <text x={x + 140} y={y + 62} fill="#94a3b8" fontSize={12}>MHz</text>

      {/* Output frequency */}
      <text x={x + 14} y={y + 90} fill="#94a3b8" fontSize={10}>
        Output: {formatFreq(source.frequency)}
      </text>
    </g>
  );
}

function PLLNodeSVG({
  pll, x, y, w, h, hovered, onHover, onChange,
}: {
  pll: PLL; x: number; y: number; w: number; h: number;
  hovered: boolean; onHover: (id: string | null) => void;
  onChange: (id: string, field: 'input_div' | 'multiplier' | 'output_div', value: number) => void;
}) {
  return (
    <g
      onMouseEnter={() => onHover(pll.id)}
      onMouseLeave={() => onHover(null)}
    >
      <rect
        x={x} y={y} width={w} height={h} rx={8}
        fill="#1e293b" stroke={hovered ? '#c586c0' : '#334155'} strokeWidth={hovered ? 2 : 1}
        filter={hovered ? 'url(#glow)' : undefined}
      />
      <rect x={x} y={y} width={4} height={h} rx={2} fill="#c586c0" />

      {/* Header */}
      <text x={x + 16} y={y + 22} fill="#c586c0" fontSize={11} fontWeight={700} letterSpacing={0.5}>
        {pll.name}
      </text>
      <text x={x + w - 14} y={y + 22} fill="#94a3b8" fontSize={9} textAnchor="end">
        src: {pll.source}
      </text>

      {/* PLL params */}
      {(['input_div', 'multiplier', 'output_div'] as const).map((field, i) => {
        const labels = ['Input Div (M)', 'Multiplier (N)', 'Output Div (P)'];
        return (
          <g key={field}>
            <text x={x + 16} y={y + 50 + i * 32} fill="#94a3b8" fontSize={11}>
              {labels[i]}
            </text>
            <foreignObject x={x + w - 70} y={y + 36 + i * 32} width={54} height={26}>
              <EditableNumber
                value={pll[field]}
                min={1}
                onChange={(val) => onChange(pll.id, field, val)}
                className="w-full bg-editor-bg border border-panel-border rounded px-2 py-0.5 text-xs font-mono text-text-primary text-right focus:border-accent outline-none"
              />
            </foreignObject>
          </g>
        );
      })}

      {/* VCO + Output */}
      <line x1={x + 14} y1={y + 134} x2={x + w - 14} y2={y + 134} stroke="#334155" strokeWidth={1} />
      <text x={x + 16} y={y + 152} fill="#94a3b8" fontSize={10}>
        VCO: {formatFreq(pll.vco_frequency)}
      </text>
      <text x={x + 16} y={y + 172} fill="#c586c0" fontSize={16} fontWeight={700} fontFamily="monospace">
        {formatFreq(pll.output_frequency)}
      </text>
    </g>
  );
}

function BusNodeSVG({
  bus, x, y, w, h, hovered, onHover, onChange,
}: {
  bus: ClockBus; x: number; y: number; w: number; h: number;
  hovered: boolean; onHover: (id: string | null) => void;
  onChange: (id: string, divider: number) => void;
}) {
  return (
    <g
      onMouseEnter={() => onHover(bus.id)}
      onMouseLeave={() => onHover(null)}
    >
      <rect
        x={x} y={y} width={w} height={h} rx={8}
        fill="#1e293b" stroke={hovered ? '#4ec9b0' : '#334155'} strokeWidth={hovered ? 2 : 1}
        filter={hovered ? 'url(#glow)' : undefined}
      />
      <rect x={x} y={y} width={4} height={h} rx={2} fill="#4ec9b0" />

      {/* Name */}
      <text x={x + 16} y={y + 20} fill="#e2e8f0" fontSize={12} fontWeight={600}>
        {bus.name}
      </text>

      {/* Frequency - large, prominent */}
      <text x={x + 16} y={y + 46} fill="#4ec9b0" fontSize={16} fontWeight={700} fontFamily="monospace">
        {formatFreq(bus.frequency)}
      </text>

      {/* Divider + source */}
      <text x={x + w - 14} y={y + 20} fill="#64748b" fontSize={9} textAnchor="end">
        ÷{bus.divider} from {bus.source}
      </text>
      <foreignObject x={x + w - 50} y={y + 32} width={38} height={22}>
        <EditableNumber
          value={bus.divider}
          min={1}
          onChange={(val) => onChange(bus.id, val)}
          className="w-full bg-editor-bg border border-panel-border rounded px-1 py-0 text-[10px] font-mono text-text-primary text-center focus:border-accent outline-none"
        />
      </foreignObject>
      <text x={x + w - 54} y={y + 46} fill="#94a3b8" fontSize={9} textAnchor="end">÷</text>
    </g>
  );
}

// --- Sidebar Components ---

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs text-text-muted font-semibold uppercase mb-2 tracking-wider">{title}</h4>
      <div className="space-y-0">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value, color, dimmed, sub }: {
  label: string; value: string; color: string; dimmed?: boolean; sub?: string;
}) {
  return (
    <div className={`flex justify-between items-center py-1.5 border-b border-panel-border last:border-0 ${dimmed ? 'opacity-40' : ''}`}>
      <div>
        <span className="text-xs text-text-secondary">{label}</span>
        {sub && <span className="text-[9px] text-text-muted block">{sub}</span>}
      </div>
      <span className={`text-sm font-mono font-bold ${color}`}>{value}</span>
    </div>
  );
}

function FrequencyWarnings({ clock }: { clock: { plls: PLL[]; buses: ClockBus[] } }) {
  const warnings: string[] = [];

  for (const pll of clock.plls) {
    if (pll.vco_frequency > 600e6) warnings.push(`${pll.name} VCO exceeds 600 MHz (${formatFreq(pll.vco_frequency)})`);
    if (pll.output_frequency > 200e6) warnings.push(`${pll.name} output exceeds 200 MHz`);
  }
  for (const bus of clock.buses) {
    if (bus.frequency > 200e6) warnings.push(`${bus.name} exceeds 200 MHz`);
  }

  if (warnings.length === 0) return null;

  return (
    <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
      <h4 className="text-xs font-semibold text-warning mb-2 flex items-center gap-1.5">
        <span className="material-symbols-outlined text-sm">warning</span>
        Warnings
      </h4>
      {warnings.map((w, i) => (
        <p key={i} className="text-[10px] text-warning/80 mb-1">{w}</p>
      ))}
    </div>
  );
}

// --- Editable Number Input for SVG foreignObject ---

function EditableNumber({
  value, onChange, min, className,
}: {
  value: number; onChange: (v: number) => void; min?: number; className?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed >= (min ?? 0)) {
      onChange(parsed);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <input
      type="number"
      min={min}
      className={className}
      value={draft}
      onChange={(e) => { setEditing(true); setDraft(e.target.value); }}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}

// --- Helpers ---

function formatFreq(hz: number): string {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(1)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(hz % 1e6 === 0 ? 0 : 1)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(hz % 1e3 === 0 ? 0 : 1)} kHz`;
  return `${hz} Hz`;
}
