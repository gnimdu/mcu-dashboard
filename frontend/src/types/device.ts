// Core device data schema - matches Python extractor output

export interface DeviceData {
  device: DeviceInfo;
  packages: Package[];
  clock: ClockTree;
  peripherals: PeripheralGroup[];
  resources: Record<string, ResourceCount>;
}

export interface DeviceInfo {
  name: string;
  manufacturer: string;
  family: string;
  description: string;
  datasheet_url?: string;
  datasheet_version?: string;
}

// --- Pin types ---

export interface Package {
  name: string;
  type: PackageType;
  pin_count: number;
  dimensions?: { rows: number; cols: number };
  pins: Pin[];
}

export type PackageType = 'bga' | 'qfp' | 'lqfp' | 'controlcard' | 'launchpad';

export interface Pin {
  id: string;
  name: string;
  position: PinPosition;
  type: PinType;
  functions: PinFunction[];
  electrical?: PinElectrical;
  assigned_function?: string;
  user_label?: string;
}

export type PinPosition =
  | { side: 'top' | 'bottom' | 'left' | 'right'; index: number }
  | { row: string; col: number };

export type PinType = 'io' | 'analog' | 'power' | 'ground' | 'clock' | 'special';

export interface PinFunction {
  name: string;
  peripheral: string;
  mux_mode?: number;
}

export interface PinElectrical {
  voltage?: string;
  max_current?: string;
}

// --- Clock types ---

export interface ClockTree {
  sources: ClockSource[];
  plls: PLL[];
  muxes: ClockMux[];
  buses: ClockBus[];
}

export interface ClockSource {
  id: string;
  name: string;
  frequency: number;
  type: 'internal' | 'external';
  enabled: boolean;
}

export interface PLL {
  id: string;
  name: string;
  source: string;
  input_div: number;
  multiplier: number;
  output_div: number;
  vco_frequency: number;
  output_frequency: number;
  enabled: boolean;
}

export interface ClockMux {
  id: string;
  name: string;
  sources: string[];
  selected: string;
  output_frequency: number;
}

export interface ClockBus {
  id: string;
  name: string;
  source: string;
  divider: number;
  frequency: number;
}

// --- Peripheral types ---

export interface PeripheralGroup {
  category: string;
  peripherals: Peripheral[];
}

export interface Peripheral {
  name: string;
  type: string;
  enabled: boolean;
  instances: number;
  pins: string[];
  params: PeripheralParam[];
}

export interface PeripheralParam {
  name: string;
  label?: string;
  options?: (string | number)[];
  min?: number;
  max?: number;
  default: string | number | boolean;
  value?: string | number | boolean;
  unit?: string;
}

// --- Resource types ---

export interface ResourceCount {
  used: number;
  total: number;
}
