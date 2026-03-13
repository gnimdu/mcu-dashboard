# MCU Dashboard - Device Data Schema

## Overview
Device data is stored as JSON files consumed by the frontend.
The Python extractor produces files conforming to this schema.

## Top-Level Structure

```json
{
  "device": { ... },
  "packages": [ ... ],
  "clock": { ... },
  "peripherals": [ ... ],
  "resources": { ... }
}
```

## Device Info

```json
{
  "name": "TMS320F28388D",
  "manufacturer": "Texas Instruments",
  "family": "C2000",
  "description": "Dual-core 32-bit MCU with connectivity manager",
  "datasheet_url": "https://www.ti.com/lit/ds/symlink/tms320f28388d.pdf",
  "datasheet_version": "Rev. E"
}
```

## Package

```json
{
  "name": "180-pin HSEC ControlCard",
  "type": "controlcard",
  "pin_count": 90,
  "pins": [ ... ]
}
```

### Pin

```json
{
  "id": "100",
  "name": "GPIO54",
  "position": { "side": "left", "index": 25 },
  "type": "io",
  "functions": [
    { "name": "GPIO54", "peripheral": "GPIO" },
    { "name": "SPIA_SIMO", "peripheral": "SPI", "mux_mode": 1 },
    { "name": "EPWM7A", "peripheral": "EPWM", "mux_mode": 5 }
  ],
  "electrical": { "voltage": "3.3V" }
}
```

### Pin Types
- `io` - General purpose I/O
- `analog` - ADC/DAC capable
- `power` - Power supply (VDD, VCC)
- `ground` - Ground (GND, VSS)
- `clock` - Clock input/output
- `special` - JTAG, reset, boot pins

## Clock Tree

```json
{
  "sources": [
    { "id": "intosc1", "name": "INTOSC1", "frequency": 10000000, "type": "internal" },
    { "id": "xtal", "name": "XTAL", "frequency": 20000000, "type": "external", "enabled": true }
  ],
  "plls": [
    {
      "id": "syspll",
      "name": "SYSPLL",
      "source": "xtal",
      "input_div": 1,
      "multiplier": 20,
      "output_div": 2,
      "vco_frequency": 400000000,
      "output_frequency": 200000000
    }
  ],
  "buses": [
    { "id": "sysclk", "name": "SYSCLK", "source": "syspll", "divider": 1, "frequency": 200000000 },
    { "id": "lspclk", "name": "LSPCLK", "source": "sysclk", "divider": 4, "frequency": 50000000 }
  ]
}
```

## Peripherals

```json
[
  {
    "category": "Connectivity",
    "peripherals": [
      {
        "name": "SPIA",
        "type": "SPI",
        "enabled": false,
        "instances": 1,
        "pins": ["GPIO54", "GPIO55", "GPIO56", "GPIO57"],
        "config": {
          "mode": { "options": ["Master", "Slave"], "default": "Master" },
          "speed": { "min": 1000, "max": 50000000, "default": 1000000, "unit": "Hz" },
          "data_bits": { "options": [8, 16], "default": 8 }
        }
      }
    ]
  }
]
```

## Resources

```json
{
  "GPIO": { "used": 2, "total": 169 },
  "EPWM": { "used": 0, "total": 16 },
  "ADC": { "used": 0, "total": 4 },
  "SPI": { "used": 0, "total": 4 },
  "SCI": { "used": 0, "total": 4 },
  "I2C": { "used": 0, "total": 2 },
  "CAN": { "used": 0, "total": 3 }
}
```
