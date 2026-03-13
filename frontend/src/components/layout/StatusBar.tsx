import { useDeviceStore } from '@/store/deviceStore';

export function StatusBar() {
  const { device } = useDeviceStore();

  return (
    <footer className="flex items-center h-6 bg-header-bg border-t border-panel-border px-4 text-xs text-text-muted shrink-0">
      <div className="flex items-center gap-4 flex-1">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-success" />
          System Ready
        </span>
        {device && (
          <>
            <span className="text-panel-border">|</span>
            <span>MCU: {device.device.name}</span>
            <span className="text-panel-border">|</span>
            <span>{device.device.manufacturer}</span>
            <span className="text-panel-border">|</span>
            <span>{device.device.family}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-4">
        {device && (
          <>
            <span>Packages: {device.packages.length}</span>
            <span className="text-panel-border">|</span>
          </>
        )}
        <span>v0.1.0</span>
      </div>
    </footer>
  );
}
