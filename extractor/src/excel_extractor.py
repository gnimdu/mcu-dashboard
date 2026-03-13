"""Extract pinout data from TI ControlCard Excel files."""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from .schema import (
    ClockBus,
    ClockSource,
    ClockTree,
    DeviceData,
    DeviceInfo,
    Package,
    PLL,
    Peripheral,
    PeripheralGroup,
    PeripheralParam,
    Pin,
    PinFunction,
    PinPositionSide,
    ResourceCount,
)

# Power pin patterns to skip
POWER_PINS = {"5V0", "3V3", "GND", "VDD", "VSS", "VDDA", "VSSA", "VCC"}

# Peripheral detection patterns
PERIPHERAL_PATTERNS: dict[str, str] = {
    "EPWM": r"EPWM|PWM",
    "ADC": r"ADC",
    "CAN": r"CAN|MCAN",
    "I2C": r"I2C",
    "SPI": r"SPI",
    "SCI": r"SCI|UART",
    "GPIO": r"GPIO",
    "EQEP": r"EQEP|QEP",
    "FSI": r"FSI",
    "LIN": r"LIN",
    "EMIF": r"EMIF",
    "SD": r"SD\d",
}


def extract_from_excel(file_path: Path) -> DeviceData:
    """Extract device data from a TI ControlCard pinout Excel file."""
    df = pd.read_excel(file_path, header=None)

    pins: list[Pin] = []
    seen_ids: set[str] = set()
    resource_counts: dict[str, int] = {}

    # Parse from row 3 onwards (skip headers)
    for row_idx in range(2, len(df)):
        row = df.iloc[row_idx]

        # Left side: HSEC pin (col 2), MCU pin (col 3), functions (col 5)
        _process_pin_entry(row, 2, 3, 5, pins, seen_ids, resource_counts)

        # Right side: HSEC pin (col 10), MCU pin (col 9), functions (col 7)
        _process_pin_entry(row, 10, 9, 7, pins, seen_ids, resource_counts)

    # Assign positions (distribute around a virtual QFP package)
    total_pins = len(pins)
    per_side = max(1, total_pins // 4)

    for i, pin in enumerate(pins):
        side_idx = i // per_side
        sides = ["top", "right", "bottom", "left"]
        side = sides[min(side_idx, 3)]
        pin.position = PinPositionSide(side=side, index=i % per_side)  # type: ignore[assignment]

    # Build resource summary
    resources: dict[str, ResourceCount] = {}
    for name, count in resource_counts.items():
        resources[name] = ResourceCount(used=0, total=count)
    if "GPIO" not in resources:
        gpio_count = sum(1 for p in pins if p.type == "io")
        resources["GPIO"] = ResourceCount(used=0, total=gpio_count)

    # Infer device name from filename
    device_name = _infer_device_name(file_path)

    # Build default clock tree for C2000
    clock = _default_c2000_clock_tree()

    # Build default peripheral groups
    peripheral_groups = _build_peripheral_groups(pins)

    return DeviceData(
        device=DeviceInfo(
            name=device_name,
            manufacturer="Texas Instruments",
            family="C2000",
            description=f"Extracted from {file_path.name}",
        ),
        packages=[
            Package(
                name=f"{file_path.stem}",
                type="controlcard",
                pin_count=len(pins),
                pins=pins,
            )
        ],
        clock=clock,
        peripherals=peripheral_groups,
        resources=resources,
    )


def _process_pin_entry(
    row: pd.Series,
    hsec_col: int,
    mcu_col: int,
    func_col: int,
    pins: list[Pin],
    seen_ids: set[str],
    resource_counts: dict[str, int],
) -> None:
    """Process a single pin entry from the Excel row."""
    hsec_raw = str(row.iloc[hsec_col]) if pd.notna(row.iloc[hsec_col]) else ""
    mcu_raw = str(row.iloc[mcu_col]) if pd.notna(row.iloc[mcu_col]) else ""
    func_raw = str(row.iloc[func_col]) if pd.notna(row.iloc[func_col]) else ""

    if not hsec_raw or hsec_raw == "nan" or not mcu_raw or mcu_raw == "nan":
        return

    # Handle multi-pin HSEC (e.g., "49\n51\n53")
    hsec_parts = hsec_raw.strip().split("\n")
    pin_id = hsec_parts[0].strip()

    if not pin_id or pin_id in seen_ids:
        return
    seen_ids.add(pin_id)

    mcu_name = mcu_raw.strip().replace("\n", "").replace(" ", "")

    # Skip power pins
    if any(p in mcu_name.upper() for p in POWER_PINS):
        pin_type = "power" if "GND" not in mcu_name.upper() else "ground"
        pins.append(
            Pin(
                id=pin_id,
                name=mcu_name,
                position=PinPositionSide(side="top", index=0),
                type=pin_type,
                functions=[PinFunction(name=mcu_name, peripheral="Power")],
            )
        )
        return

    # Parse functions
    functions: list[PinFunction] = []
    func_names = re.split(r"[\s\n]+", func_raw.strip())
    func_names = [f for f in func_names if f and f.lower() not in ("or", "and/or", "and", "nan")]

    # Add MCU pin name as primary function
    if mcu_name not in func_names:
        func_names.insert(0, mcu_name)

    for fn_name in func_names:
        peripheral = _classify_peripheral(fn_name)
        functions.append(PinFunction(name=fn_name, peripheral=peripheral))

        # Count resources
        if peripheral not in ("GPIO", "Power", "Other"):
            resource_counts[peripheral] = resource_counts.get(peripheral, 0) + 1

    # Determine pin type
    pin_type = _classify_pin_type(mcu_name, functions)

    pins.append(
        Pin(
            id=pin_id,
            name=mcu_name,
            position=PinPositionSide(side="top", index=0),
            type=pin_type,
            functions=functions,
        )
    )


def _classify_peripheral(func_name: str) -> str:
    """Classify a function name to its peripheral type."""
    for peripheral, pattern in PERIPHERAL_PATTERNS.items():
        if re.search(pattern, func_name, re.IGNORECASE):
            return peripheral
    return "Other"


def _classify_pin_type(name: str, functions: list[PinFunction]) -> str:
    """Classify pin type based on name and functions."""
    upper = name.upper()
    if upper.startswith("ADC") or upper.startswith("DAC"):
        return "analog"
    if any(p in upper for p in ("VDD", "VCC", "5V", "3V")):
        return "power"
    if any(p in upper for p in ("GND", "VSS")):
        return "ground"
    if any(p in upper for p in ("XTAL", "OSC", "CLK")):
        return "clock"
    return "io"


def _infer_device_name(file_path: Path) -> str:
    """Try to infer device name from the Excel filename."""
    name = file_path.stem.upper()
    # Look for F28xxx patterns
    match = re.search(r"F\d{4,5}\w*", name)
    if match:
        return f"TMS320{match.group()}"
    return name


def _default_c2000_clock_tree() -> ClockTree:
    """Return a default C2000 clock tree configuration."""
    return ClockTree(
        sources=[
            ClockSource(id="intosc1", name="INTOSC1", frequency=10_000_000, type="internal", enabled=True),
            ClockSource(id="intosc2", name="INTOSC2", frequency=10_000_000, type="internal", enabled=False),
            ClockSource(id="xtal", name="X1/X2", frequency=20_000_000, type="external", enabled=True),
        ],
        plls=[
            PLL(
                id="syspll",
                name="SYSPLL",
                source="xtal",
                input_div=1,
                multiplier=20,
                output_div=2,
                vco_frequency=400_000_000,
                output_frequency=200_000_000,
                enabled=True,
            ),
        ],
        buses=[
            ClockBus(id="sysclk", name="SYSCLK", source="syspll", divider=1, frequency=200_000_000),
            ClockBus(id="lspclk", name="LSPCLK", source="sysclk", divider=4, frequency=50_000_000),
            ClockBus(id="epwmclk", name="EPWMCLK", source="sysclk", divider=2, frequency=100_000_000),
            ClockBus(id="canclk", name="CANCLK", source="sysclk", divider=2, frequency=100_000_000),
        ],
    )


def _build_peripheral_groups(pins: list[Pin]) -> list[PeripheralGroup]:
    """Build peripheral groups from pin functions."""
    # Collect unique peripherals from pin functions
    peripheral_map: dict[str, set[str]] = {}
    for pin in pins:
        for fn in pin.functions:
            if fn.peripheral not in ("GPIO", "Power", "Other"):
                if fn.peripheral not in peripheral_map:
                    peripheral_map[fn.peripheral] = set()
                peripheral_map[fn.peripheral].add(pin.name)

    # Categorize
    categories: dict[str, list[Peripheral]] = {
        "Analog": [],
        "Connectivity": [],
        "Timers": [],
    }

    for periph_type, pin_names in peripheral_map.items():
        periph = Peripheral(
            name=periph_type,
            type=periph_type,
            enabled=False,
            instances=1,
            pins=sorted(pin_names),
        )

        if periph_type in ("ADC", "DAC"):
            categories["Analog"].append(periph)
        elif periph_type in ("SCI", "SPI", "I2C", "CAN", "LIN", "FSI", "EMIF"):
            categories["Connectivity"].append(periph)
        else:
            categories["Timers"].append(periph)

    return [
        PeripheralGroup(category=cat, peripherals=periphs)
        for cat, periphs in categories.items()
        if periphs
    ]
