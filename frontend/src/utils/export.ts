/**
 * Export utilities for MCU Dashboard
 * - JSON: Full device configuration state
 * - PDF: Printable report with pin table, clock summary, peripheral list
 * - Excel: Pin mapping spreadsheet with resource allocation
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import type { DeviceData, Package, Pin } from '@/types/device';

// ──── JSON Export ────

export function exportJSON(device: DeviceData) {
  const json = JSON.stringify(device, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  saveAs(blob, `${device.device.name}_config.json`);
}

// ──── PDF Report ────

export function exportPDF(device: DeviceData, pkg: Package) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 15;

  // Title
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text(`${device.device.name} Configuration Report`, pageW / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`${device.device.manufacturer} | ${device.device.family} | ${pkg.name}`, pageW / 2, y, { align: 'center' });
  y += 4;
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageW / 2, y, { align: 'center' });
  y += 10;

  // Device Info box
  doc.setDrawColor(200);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, pageW - 28, 22, 2, 2, 'FD');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`Description: ${device.device.description || 'N/A'}`, 18, y + 6);
  doc.text(`Package: ${pkg.name} (${pkg.pin_count} pins)`, 18, y + 12);
  doc.text(`Core Clock: ${formatFreq(device.clock.buses.find(b => b.id === 'sysclk')?.frequency ?? 0)}`, 18, y + 18);
  y += 28;

  // Pin Assignment Table
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text('Pin Assignments', 14, y);
  y += 4;

  const pinRows = pkg.pins
    .filter(p => p.type !== 'power' && p.type !== 'ground')
    .map((pin) => [
      pin.id,
      pin.name,
      pin.type,
      pin.assigned_function || '-',
      pin.user_label || '-',
      pin.functions.map(f => f.name).slice(0, 3).join(', ') + (pin.functions.length > 3 ? '...' : ''),
    ]);

  autoTable(doc, {
    startY: y,
    head: [['Pin ID', 'Name', 'Type', 'Assigned', 'Label', 'Available Functions']],
    body: pinRows,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [56, 189, 248], textColor: [255, 255, 255], fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 22 },
      2: { cellWidth: 14 },
      3: { cellWidth: 25 },
      4: { cellWidth: 20 },
      5: { cellWidth: 'auto' },
    },
    margin: { left: 14, right: 14 },
  });

  // Clock Summary (new page)
  doc.addPage();
  y = 15;
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text('Clock Configuration', 14, y);
  y += 6;

  // Sources
  const clockRows: string[][] = [];
  for (const src of device.clock.sources) {
    clockRows.push(['Source', src.name, src.type, formatFreq(src.frequency), src.enabled ? 'Enabled' : 'Disabled']);
  }
  for (const pll of device.clock.plls) {
    clockRows.push(['PLL', pll.name, `M=${pll.input_div} N=${pll.multiplier} P=${pll.output_div}`, formatFreq(pll.output_frequency), pll.enabled ? 'Enabled' : 'Disabled']);
  }
  for (const bus of device.clock.buses) {
    clockRows.push(['Bus', bus.name, `÷${bus.divider} from ${bus.source}`, formatFreq(bus.frequency), '-']);
  }

  autoTable(doc, {
    startY: y,
    head: [['Category', 'Name', 'Config', 'Frequency', 'Status']],
    body: clockRows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [197, 134, 192], textColor: [255, 255, 255] },
    margin: { left: 14, right: 14 },
  });

  // Resource Allocation
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 80;
  y += 10;
  doc.setFontSize(12);
  doc.text('Resource Allocation', 14, y);
  y += 6;

  const resourceRows = Object.entries(device.resources).map(([name, r]) => [
    name,
    String(r.used),
    String(r.total),
    r.total > 0 ? `${Math.round((r.used / r.total) * 100)}%` : '-',
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Peripheral', 'Used', 'Total', 'Utilization']],
    body: resourceRows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [78, 201, 176], textColor: [255, 255, 255] },
    margin: { left: 14, right: 14 },
  });

  // Peripheral Configuration
  doc.addPage();
  y = 15;
  doc.setFontSize(12);
  doc.text('Peripheral Configuration', 14, y);
  y += 6;

  const periphRows: string[][] = [];
  for (const group of device.peripherals) {
    for (const p of group.peripherals) {
      periphRows.push([
        group.category,
        p.name,
        p.type,
        p.enabled ? 'Enabled' : 'Disabled',
        String(p.pins.length),
        p.params.map(pr => `${pr.name}=${pr.value ?? pr.default}`).slice(0, 3).join(', '),
      ]);
    }
  }

  autoTable(doc, {
    startY: y,
    head: [['Category', 'Name', 'Type', 'Status', 'Pins', 'Parameters']],
    body: periphRows,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [86, 156, 214], textColor: [255, 255, 255] },
    margin: { left: 14, right: 14 },
  });

  // Footer on each page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`MCU Dashboard - ${device.device.name} | Page ${i}/${totalPages}`, pageW / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
  }

  doc.save(`${device.device.name}_report.pdf`);
}

// ──── Excel Export ────

export function exportExcel(device: DeviceData, pkg: Package) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Pin Mapping
  const pinData = pkg.pins.map((pin: Pin) => ({
    'Pin ID': pin.id,
    'Name': pin.name,
    'Type': pin.type,
    'Assigned Function': pin.assigned_function || '',
    'User Label': pin.user_label || '',
    'Available Functions': pin.functions.map(f => f.name).join(', '),
    'Peripherals': [...new Set(pin.functions.map(f => f.peripheral))].join(', '),
  }));
  const pinSheet = XLSX.utils.json_to_sheet(pinData);
  pinSheet['!cols'] = [
    { wch: 12 }, { wch: 15 }, { wch: 8 }, { wch: 20 },
    { wch: 15 }, { wch: 50 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, pinSheet, 'Pin Mapping');

  // Sheet 2: Clock Configuration
  const clockData = [
    ...device.clock.sources.map(s => ({
      'Category': 'Source', 'Name': s.name, 'Type': s.type,
      'Frequency (Hz)': s.frequency, 'Frequency': formatFreq(s.frequency),
      'Config': '', 'Enabled': s.enabled,
    })),
    ...device.clock.plls.map(p => ({
      'Category': 'PLL', 'Name': p.name, 'Type': '',
      'Frequency (Hz)': p.output_frequency, 'Frequency': formatFreq(p.output_frequency),
      'Config': `M=${p.input_div} N=${p.multiplier} P=${p.output_div} VCO=${formatFreq(p.vco_frequency)}`,
      'Enabled': p.enabled,
    })),
    ...device.clock.buses.map(b => ({
      'Category': 'Bus', 'Name': b.name, 'Type': '',
      'Frequency (Hz)': b.frequency, 'Frequency': formatFreq(b.frequency),
      'Config': `÷${b.divider} from ${b.source}`, 'Enabled': true,
    })),
  ];
  const clockSheet = XLSX.utils.json_to_sheet(clockData);
  XLSX.utils.book_append_sheet(wb, clockSheet, 'Clock Config');

  // Sheet 3: Resource Allocation
  const resourceData = Object.entries(device.resources).map(([name, r]) => ({
    'Peripheral': name,
    'Used': r.used,
    'Total': r.total,
    'Available': r.total - r.used,
    'Utilization %': r.total > 0 ? Math.round((r.used / r.total) * 100) : 0,
  }));
  const resourceSheet = XLSX.utils.json_to_sheet(resourceData);
  XLSX.utils.book_append_sheet(wb, resourceSheet, 'Resources');

  // Sheet 4: Peripherals
  const periphData: Record<string, unknown>[] = [];
  for (const group of device.peripherals) {
    for (const p of group.peripherals) {
      const row: Record<string, unknown> = {
        'Category': group.category,
        'Name': p.name,
        'Type': p.type,
        'Enabled': p.enabled,
        'Pin Count': p.pins.length,
        'Pins': p.pins.join(', '),
      };
      for (const param of p.params) {
        row[`Param: ${param.name}`] = param.value ?? param.default;
      }
      periphData.push(row);
    }
  }
  const periphSheet = XLSX.utils.json_to_sheet(periphData);
  XLSX.utils.book_append_sheet(wb, periphSheet, 'Peripherals');

  XLSX.writeFile(wb, `${device.device.name}_config.xlsx`);
}

// ──── Helpers ────

function formatFreq(hz: number): string {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(1)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(hz % 1e6 === 0 ? 0 : 1)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(hz % 1e3 === 0 ? 0 : 1)} kHz`;
  return `${hz} Hz`;
}
