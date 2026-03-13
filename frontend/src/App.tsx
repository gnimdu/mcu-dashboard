import { useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { StatusBar } from '@/components/layout/StatusBar';
import { DashboardView } from '@/views/DashboardView';
import { PinoutView } from '@/views/PinoutView';
import { ClockView } from '@/views/ClockView';
import { PeripheralsView } from '@/views/PeripheralsView';
import { useDeviceStore } from '@/store/deviceStore';
import sampleDevice from '@/data/f28388d-controlcard.json';
import type { DeviceData } from '@/types/device';

function App() {
  const { activeTab, setDevice } = useDeviceStore();

  useEffect(() => {
    setDevice(sampleDevice as DeviceData);
  }, [setDevice]);

  return (
    <>
      <Header />
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'pinout' && <PinoutView />}
        {activeTab === 'clock' && <ClockView />}
        {activeTab === 'peripherals' && <PeripheralsView />}
      </main>
      <StatusBar />
    </>
  );
}

export default App;
