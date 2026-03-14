import { create } from 'zustand';
import type { DeviceData, Package, Pin } from '@/types/device';

export type ViewTab = 'dashboard' | 'pinout' | 'clock' | 'peripherals';

interface DeviceState {
  // Device data
  device: DeviceData | null;
  availableDevices: string[];
  selectedPackageIndex: number;

  // Navigation
  activeTab: ViewTab;

  // Pin selection
  selectedPinId: string | null;

  // Actions
  setDevice: (device: DeviceData) => void;
  setAvailableDevices: (devices: string[]) => void;
  setSelectedPackage: (index: number) => void;
  setActiveTab: (tab: ViewTab) => void;
  selectPin: (pinId: string | null) => void;
  assignFunction: (pinId: string, functionName: string) => void;
  setUserLabel: (pinId: string, label: string) => void;
  clearPinAssignment: (pinId: string) => void;

  // Clock actions
  updatePLL: (pllId: string, field: 'input_div' | 'multiplier' | 'output_div', value: number) => void;
  updateClockSource: (sourceId: string, field: 'frequency' | 'enabled', value: number | boolean) => void;
  updateBusDivider: (busId: string, divider: number) => void;

  // Computed
  currentPackage: () => Package | null;
  selectedPin: () => Pin | null;
  getResourceUsage: () => Record<string, { used: number; total: number }>;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  device: null,
  availableDevices: [],
  selectedPackageIndex: 0,
  activeTab: 'dashboard',
  selectedPinId: null,

  setDevice: (device) => set({ device, selectedPackageIndex: 0, selectedPinId: null }),
  setAvailableDevices: (devices) => set({ availableDevices: devices }),
  setSelectedPackage: (index) => set({ selectedPackageIndex: index, selectedPinId: null }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectPin: (pinId) => set({ selectedPinId: pinId }),

  assignFunction: (pinId, functionName) => {
    const { device, selectedPackageIndex } = get();
    if (!device) return;

    const updatedDevice = structuredClone(device);
    const pkg = updatedDevice.packages[selectedPackageIndex];
    const pin = pkg.pins.find((p) => p.id === pinId);
    if (pin) {
      pin.assigned_function = functionName;

      // Update resource counts
      const fn = pin.functions.find((f) => f.name === functionName);
      if (fn) {
        const resource = updatedDevice.resources[fn.peripheral];
        if (resource) {
          resource.used = pkg.pins.filter(
            (p) => p.assigned_function && p.functions.some((f) => f.peripheral === fn.peripheral && f.name === p.assigned_function)
          ).length;
        }
      }
    }

    set({ device: updatedDevice });
  },

  setUserLabel: (pinId, label) => {
    const { device, selectedPackageIndex } = get();
    if (!device) return;

    const updatedDevice = structuredClone(device);
    const pin = updatedDevice.packages[selectedPackageIndex].pins.find((p) => p.id === pinId);
    if (pin) pin.user_label = label;
    set({ device: updatedDevice });
  },

  clearPinAssignment: (pinId) => {
    const { device, selectedPackageIndex } = get();
    if (!device) return;

    const updatedDevice = structuredClone(device);
    const pin = updatedDevice.packages[selectedPackageIndex].pins.find((p) => p.id === pinId);
    if (pin) {
      pin.assigned_function = undefined;
      pin.user_label = undefined;
    }
    set({ device: updatedDevice });
  },

  updatePLL: (pllId, field, value) => {
    const { device } = get();
    if (!device) return;
    const updated = structuredClone(device);
    const pll = updated.clock.plls.find((p) => p.id === pllId);
    if (!pll) return;
    pll[field] = value;
    // Find source frequency
    const src = updated.clock.sources.find((s) => s.id === pll.source);
    const srcFreq = src?.frequency ?? 0;
    pll.vco_frequency = (srcFreq / pll.input_div) * pll.multiplier;
    pll.output_frequency = pll.vco_frequency / pll.output_div;
    // Propagate to buses sourced from this PLL
    const propagate = (sourceId: string, freq: number) => {
      for (const bus of updated.clock.buses) {
        if (bus.source === sourceId) {
          bus.frequency = freq / bus.divider;
          propagate(bus.id, bus.frequency);
        }
      }
    };
    propagate(pll.id, pll.output_frequency);
    set({ device: updated });
  },

  updateClockSource: (sourceId, field, value) => {
    const { device } = get();
    if (!device) return;
    const updated = structuredClone(device);
    const src = updated.clock.sources.find((s) => s.id === sourceId);
    if (!src) return;
    if (field === 'frequency') src.frequency = value as number;
    else src.enabled = value as boolean;
    // Recompute PLLs sourced from this
    for (const pll of updated.clock.plls) {
      if (pll.source === sourceId) {
        pll.vco_frequency = (src.frequency / pll.input_div) * pll.multiplier;
        pll.output_frequency = pll.vco_frequency / pll.output_div;
        const propagate = (sid: string, freq: number) => {
          for (const bus of updated.clock.buses) {
            if (bus.source === sid) {
              bus.frequency = freq / bus.divider;
              propagate(bus.id, bus.frequency);
            }
          }
        };
        propagate(pll.id, pll.output_frequency);
      }
    }
    set({ device: updated });
  },

  updateBusDivider: (busId, divider) => {
    const { device } = get();
    if (!device) return;
    const updated = structuredClone(device);
    const bus = updated.clock.buses.find((b) => b.id === busId);
    if (!bus) return;
    bus.divider = divider;
    // Find source frequency (could be PLL or another bus)
    const pll = updated.clock.plls.find((p) => p.id === bus.source);
    const parentBus = updated.clock.buses.find((b) => b.id === bus.source);
    const srcFreq = pll?.output_frequency ?? parentBus?.frequency ?? 0;
    bus.frequency = srcFreq / divider;
    // Propagate to child buses
    const propagate = (sid: string, freq: number) => {
      for (const b of updated.clock.buses) {
        if (b.source === sid) {
          b.frequency = freq / b.divider;
          propagate(b.id, b.frequency);
        }
      }
    };
    propagate(bus.id, bus.frequency);
    set({ device: updated });
  },

  currentPackage: () => {
    const { device, selectedPackageIndex } = get();
    return device?.packages[selectedPackageIndex] ?? null;
  },

  selectedPin: () => {
    const { device, selectedPackageIndex, selectedPinId } = get();
    if (!device || !selectedPinId) return null;
    return device.packages[selectedPackageIndex].pins.find((p) => p.id === selectedPinId) ?? null;
  },

  getResourceUsage: () => {
    const { device } = get();
    return device?.resources ?? {};
  },
}));
