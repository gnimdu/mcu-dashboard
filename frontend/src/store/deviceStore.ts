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
