import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useDeviceStore } from '@/store/deviceStore';
import type { DeviceData } from '@/types/device';
import sampleDevice from '@/data/f28388d-controlcard.json';

/**
 * Helper: reset the Zustand store to its initial state before each test.
 * Zustand stores are singletons so we need to clear state between tests.
 */
function resetStore() {
  useDeviceStore.setState({
    device: null,
    availableDevices: [],
    selectedPackageIndex: 0,
    activeTab: 'dashboard',
    selectedPinId: null,
  });
}

const deviceData = sampleDevice as unknown as DeviceData;

describe('deviceStore', () => {
  beforeEach(() => {
    resetStore();
  });

  // ------------------------------------------------------------------
  // Initial state
  // ------------------------------------------------------------------

  describe('initial state', () => {
    it('starts with null device', () => {
      const state = useDeviceStore.getState();
      expect(state.device).toBeNull();
    });

    it('starts with empty availableDevices', () => {
      const state = useDeviceStore.getState();
      expect(state.availableDevices).toEqual([]);
    });

    it('starts with dashboard as activeTab', () => {
      const state = useDeviceStore.getState();
      expect(state.activeTab).toBe('dashboard');
    });

    it('starts with no pin selected', () => {
      const state = useDeviceStore.getState();
      expect(state.selectedPinId).toBeNull();
    });

    it('starts with selectedPackageIndex 0', () => {
      const state = useDeviceStore.getState();
      expect(state.selectedPackageIndex).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // setDevice
  // ------------------------------------------------------------------

  describe('setDevice', () => {
    it('loads device data correctly', () => {
      act(() => {
        useDeviceStore.getState().setDevice(deviceData);
      });
      const state = useDeviceStore.getState();
      expect(state.device).not.toBeNull();
      expect(state.device!.device.name).toBe('TMS320F28388D');
      expect(state.device!.device.manufacturer).toBe('Texas Instruments');
      expect(state.device!.device.family).toBe('C2000');
    });

    it('resets selectedPackageIndex and selectedPinId', () => {
      // Set some state first
      useDeviceStore.setState({ selectedPackageIndex: 2, selectedPinId: '42' });
      act(() => {
        useDeviceStore.getState().setDevice(deviceData);
      });
      const state = useDeviceStore.getState();
      expect(state.selectedPackageIndex).toBe(0);
      expect(state.selectedPinId).toBeNull();
    });

    it('preserves packages and clock data', () => {
      act(() => {
        useDeviceStore.getState().setDevice(deviceData);
      });
      const state = useDeviceStore.getState();
      expect(state.device!.packages.length).toBeGreaterThan(0);
      expect(state.device!.packages[0].type).toBe('controlcard');
      expect(state.device!.clock.sources.length).toBe(3);
      expect(state.device!.clock.plls.length).toBe(2);
      expect(state.device!.clock.buses.length).toBe(4);
    });
  });

  // ------------------------------------------------------------------
  // setActiveTab
  // ------------------------------------------------------------------

  describe('setActiveTab', () => {
    it('changes the active tab', () => {
      act(() => {
        useDeviceStore.getState().setActiveTab('pinout');
      });
      expect(useDeviceStore.getState().activeTab).toBe('pinout');
    });

    it('changes to clock tab', () => {
      act(() => {
        useDeviceStore.getState().setActiveTab('clock');
      });
      expect(useDeviceStore.getState().activeTab).toBe('clock');
    });

    it('changes to peripherals tab', () => {
      act(() => {
        useDeviceStore.getState().setActiveTab('peripherals');
      });
      expect(useDeviceStore.getState().activeTab).toBe('peripherals');
    });
  });

  // ------------------------------------------------------------------
  // selectPin
  // ------------------------------------------------------------------

  describe('selectPin', () => {
    it('selects a pin by ID', () => {
      act(() => {
        useDeviceStore.getState().selectPin('49');
      });
      expect(useDeviceStore.getState().selectedPinId).toBe('49');
    });

    it('clears selection with null', () => {
      act(() => {
        useDeviceStore.getState().selectPin('49');
      });
      act(() => {
        useDeviceStore.getState().selectPin(null);
      });
      expect(useDeviceStore.getState().selectedPinId).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // assignFunction
  // ------------------------------------------------------------------

  describe('assignFunction', () => {
    beforeEach(() => {
      act(() => {
        useDeviceStore.getState().setDevice(deviceData);
      });
    });

    it('assigns a function to a pin', () => {
      act(() => {
        useDeviceStore.getState().assignFunction('49', 'PWM1A');
      });
      const state = useDeviceStore.getState();
      const pin = state.device!.packages[0].pins.find((p) => p.id === '49');
      expect(pin).toBeDefined();
      expect(pin!.assigned_function).toBe('PWM1A');
    });

    it('updates resource usage when assigning EPWM function', () => {
      act(() => {
        useDeviceStore.getState().assignFunction('49', 'PWM1A');
      });
      const state = useDeviceStore.getState();
      const epwmResource = state.device!.resources['EPWM'];
      expect(epwmResource).toBeDefined();
      // After assigning one EPWM function, used count should be at least 1
      expect(epwmResource.used).toBeGreaterThanOrEqual(1);
    });

    it('does nothing if device is null', () => {
      resetStore();
      act(() => {
        useDeviceStore.getState().assignFunction('49', 'PWM1A');
      });
      // Should not throw, device remains null
      expect(useDeviceStore.getState().device).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // clearPinAssignment
  // ------------------------------------------------------------------

  describe('clearPinAssignment', () => {
    beforeEach(() => {
      act(() => {
        useDeviceStore.getState().setDevice(deviceData);
      });
    });

    it('clears an assigned function', () => {
      act(() => {
        useDeviceStore.getState().assignFunction('49', 'PWM1A');
      });
      act(() => {
        useDeviceStore.getState().clearPinAssignment('49');
      });
      const pin = useDeviceStore.getState().device!.packages[0].pins.find((p) => p.id === '49');
      expect(pin!.assigned_function).toBeUndefined();
    });

    it('clears user_label as well', () => {
      act(() => {
        useDeviceStore.getState().setUserLabel('49', 'Motor A');
      });
      act(() => {
        useDeviceStore.getState().clearPinAssignment('49');
      });
      const pin = useDeviceStore.getState().device!.packages[0].pins.find((p) => p.id === '49');
      expect(pin!.user_label).toBeUndefined();
    });

    it('does nothing if device is null', () => {
      resetStore();
      act(() => {
        useDeviceStore.getState().clearPinAssignment('49');
      });
      expect(useDeviceStore.getState().device).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // updatePLL
  // ------------------------------------------------------------------

  describe('updatePLL', () => {
    beforeEach(() => {
      act(() => {
        useDeviceStore.getState().setDevice(deviceData);
      });
    });

    it('recomputes PLL frequencies when multiplier changes', () => {
      act(() => {
        useDeviceStore.getState().updatePLL('syspll', 'multiplier', 10);
      });
      const state = useDeviceStore.getState();
      const pll = state.device!.clock.plls.find((p) => p.id === 'syspll');
      expect(pll).toBeDefined();
      // XTAL=20MHz, input_div=1, multiplier=10 => vco=200MHz
      expect(pll!.vco_frequency).toBe(200_000_000);
      // output_div=2 => output=100MHz
      expect(pll!.output_frequency).toBe(100_000_000);
    });

    it('recomputes PLL frequencies when input_div changes', () => {
      act(() => {
        useDeviceStore.getState().updatePLL('syspll', 'input_div', 2);
      });
      const state = useDeviceStore.getState();
      const pll = state.device!.clock.plls.find((p) => p.id === 'syspll');
      // XTAL=20MHz, input_div=2, multiplier=20 => vco=200MHz
      expect(pll!.vco_frequency).toBe(200_000_000);
      expect(pll!.output_frequency).toBe(100_000_000);
    });

    it('recomputes PLL frequencies when output_div changes', () => {
      act(() => {
        useDeviceStore.getState().updatePLL('syspll', 'output_div', 4);
      });
      const state = useDeviceStore.getState();
      const pll = state.device!.clock.plls.find((p) => p.id === 'syspll');
      // XTAL=20MHz, input_div=1, multiplier=20 => vco=400MHz
      expect(pll!.vco_frequency).toBe(400_000_000);
      // output_div=4 => output=100MHz
      expect(pll!.output_frequency).toBe(100_000_000);
    });

    it('propagates frequency changes to downstream buses', () => {
      act(() => {
        useDeviceStore.getState().updatePLL('syspll', 'multiplier', 10);
      });
      const state = useDeviceStore.getState();
      // SYSCLK source=syspll, divider=1 => 100MHz
      const sysclk = state.device!.clock.buses.find((b) => b.id === 'sysclk');
      expect(sysclk!.frequency).toBe(100_000_000);
      // LSPCLK source=sysclk, divider=4 => 25MHz
      const lspclk = state.device!.clock.buses.find((b) => b.id === 'lspclk');
      expect(lspclk!.frequency).toBe(25_000_000);
      // EPWMCLK source=sysclk, divider=2 => 50MHz
      const epwmclk = state.device!.clock.buses.find((b) => b.id === 'epwmclk');
      expect(epwmclk!.frequency).toBe(50_000_000);
    });

    it('does nothing if device is null', () => {
      resetStore();
      act(() => {
        useDeviceStore.getState().updatePLL('syspll', 'multiplier', 10);
      });
      expect(useDeviceStore.getState().device).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // updateClockSource
  // ------------------------------------------------------------------

  describe('updateClockSource', () => {
    beforeEach(() => {
      act(() => {
        useDeviceStore.getState().setDevice(deviceData);
      });
    });

    it('updates source frequency and propagates to PLLs', () => {
      act(() => {
        useDeviceStore.getState().updateClockSource('xtal', 'frequency', 25_000_000);
      });
      const state = useDeviceStore.getState();
      const xtal = state.device!.clock.sources.find((s) => s.id === 'xtal');
      expect(xtal!.frequency).toBe(25_000_000);

      // SYSPLL: source=xtal, input_div=1, multiplier=20 => vco=500MHz
      const syspll = state.device!.clock.plls.find((p) => p.id === 'syspll');
      expect(syspll!.vco_frequency).toBe(500_000_000);
      expect(syspll!.output_frequency).toBe(250_000_000); // /2
    });

    it('propagates source frequency change to buses', () => {
      act(() => {
        useDeviceStore.getState().updateClockSource('xtal', 'frequency', 25_000_000);
      });
      const state = useDeviceStore.getState();
      // SYSCLK = 250MHz / 1
      const sysclk = state.device!.clock.buses.find((b) => b.id === 'sysclk');
      expect(sysclk!.frequency).toBe(250_000_000);
      // LSPCLK = 250MHz / 4
      const lspclk = state.device!.clock.buses.find((b) => b.id === 'lspclk');
      expect(lspclk!.frequency).toBe(62_500_000);
    });

    it('propagates to AUXPLL as well since it uses xtal', () => {
      act(() => {
        useDeviceStore.getState().updateClockSource('xtal', 'frequency', 10_000_000);
      });
      const state = useDeviceStore.getState();
      // AUXPLL: source=xtal, input_div=1, multiplier=12, output_div=2
      const auxpll = state.device!.clock.plls.find((p) => p.id === 'auxpll');
      expect(auxpll!.vco_frequency).toBe(120_000_000);
      expect(auxpll!.output_frequency).toBe(60_000_000);
    });

    it('updates enabled flag', () => {
      act(() => {
        useDeviceStore.getState().updateClockSource('intosc2', 'enabled', true);
      });
      const state = useDeviceStore.getState();
      const intosc2 = state.device!.clock.sources.find((s) => s.id === 'intosc2');
      expect(intosc2!.enabled).toBe(true);
    });

    it('does nothing if device is null', () => {
      resetStore();
      act(() => {
        useDeviceStore.getState().updateClockSource('xtal', 'frequency', 25_000_000);
      });
      expect(useDeviceStore.getState().device).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // updateBusDivider
  // ------------------------------------------------------------------

  describe('updateBusDivider', () => {
    beforeEach(() => {
      act(() => {
        useDeviceStore.getState().setDevice(deviceData);
      });
    });

    it('updates bus frequency based on new divider', () => {
      act(() => {
        useDeviceStore.getState().updateBusDivider('lspclk', 2);
      });
      const state = useDeviceStore.getState();
      const lspclk = state.device!.clock.buses.find((b) => b.id === 'lspclk');
      // LSPCLK source=sysclk(200MHz), divider=2 => 100MHz
      expect(lspclk!.divider).toBe(2);
      expect(lspclk!.frequency).toBe(100_000_000);
    });

    it('updates SYSCLK divider and propagates to child buses', () => {
      act(() => {
        useDeviceStore.getState().updateBusDivider('sysclk', 2);
      });
      const state = useDeviceStore.getState();
      // SYSCLK = 200MHz / 2 = 100MHz
      const sysclk = state.device!.clock.buses.find((b) => b.id === 'sysclk');
      expect(sysclk!.frequency).toBe(100_000_000);
      // LSPCLK source=sysclk(100MHz) / 4 = 25MHz
      const lspclk = state.device!.clock.buses.find((b) => b.id === 'lspclk');
      expect(lspclk!.frequency).toBe(25_000_000);
      // EPWMCLK source=sysclk(100MHz) / 2 = 50MHz
      const epwmclk = state.device!.clock.buses.find((b) => b.id === 'epwmclk');
      expect(epwmclk!.frequency).toBe(50_000_000);
    });

    it('does nothing if device is null', () => {
      resetStore();
      act(() => {
        useDeviceStore.getState().updateBusDivider('sysclk', 2);
      });
      expect(useDeviceStore.getState().device).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // Computed helpers
  // ------------------------------------------------------------------

  describe('computed helpers', () => {
    it('currentPackage returns null when no device loaded', () => {
      const pkg = useDeviceStore.getState().currentPackage();
      expect(pkg).toBeNull();
    });

    it('currentPackage returns the selected package', () => {
      act(() => {
        useDeviceStore.getState().setDevice(deviceData);
      });
      const pkg = useDeviceStore.getState().currentPackage();
      expect(pkg).not.toBeNull();
      expect(pkg!.name).toBe('180-pin HSEC ControlCard');
    });

    it('selectedPin returns null when no pin selected', () => {
      act(() => {
        useDeviceStore.getState().setDevice(deviceData);
      });
      const pin = useDeviceStore.getState().selectedPin();
      expect(pin).toBeNull();
    });

    it('selectedPin returns the selected pin', () => {
      act(() => {
        useDeviceStore.getState().setDevice(deviceData);
      });
      act(() => {
        useDeviceStore.getState().selectPin('49');
      });
      const pin = useDeviceStore.getState().selectedPin();
      expect(pin).not.toBeNull();
      expect(pin!.id).toBe('49');
      expect(pin!.name).toBe('GPIO-00');
    });

    it('getResourceUsage returns empty when no device', () => {
      const resources = useDeviceStore.getState().getResourceUsage();
      expect(resources).toEqual({});
    });

    it('getResourceUsage returns resources when device loaded', () => {
      act(() => {
        useDeviceStore.getState().setDevice(deviceData);
      });
      const resources = useDeviceStore.getState().getResourceUsage();
      expect(resources['GPIO']).toBeDefined();
      expect(resources['GPIO'].total).toBe(102);
      expect(resources['EPWM']).toBeDefined();
      expect(resources['ADC']).toBeDefined();
    });
  });
});
