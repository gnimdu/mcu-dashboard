import { useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { StatusBar } from '@/components/layout/StatusBar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DashboardView } from '@/views/DashboardView';
import { PinoutView } from '@/views/PinoutView';
import { ClockView } from '@/views/ClockView';
import { PeripheralsView } from '@/views/PeripheralsView';
import { useDeviceStore } from '@/store/deviceStore';
import sampleDevice from '@/data/f28388d-controlcard.json';
import type { DeviceData } from '@/types/device';

function App() {
  const { activeTab, device, setDevice } = useDeviceStore();

  useEffect(() => {
    if (!device) {
      setDevice(sampleDevice as DeviceData);
    }
  }, [device, setDevice]);

  return (
    <>
      <Header />
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'dashboard' && (
          <ErrorBoundary>
            <DashboardView />
          </ErrorBoundary>
        )}
        {activeTab === 'pinout' && (
          <ErrorBoundary>
            <PinoutView />
          </ErrorBoundary>
        )}
        {activeTab === 'clock' && (
          <ErrorBoundary>
            <ClockView />
          </ErrorBoundary>
        )}
        {activeTab === 'peripherals' && (
          <ErrorBoundary>
            <PeripheralsView />
          </ErrorBoundary>
        )}
      </main>
      <StatusBar />
    </>
  );
}

export default App;
