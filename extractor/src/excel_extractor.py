"""Extract pinout data from TI ControlCard Excel files."""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd
from rich.console import Console

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

console = Console()

# Power/ground signal patterns
POWER_SIGNALS = {"5V0", "3V3", "GND", "VDD", "VSS", "VDDA", "VSSA", "VCC", "VDDIO", "VREFHI", "VREFLO"}

# Peripheral detection patterns
PERIPHERAL_PATTERNS: dict[str, str] = {
    "EPWM": r"PWM",
    "ADC": r"^ADC|^ADCIN",
    "CAN": r"CAN",
    "I2C": r"I2C",
    "SPI": r"SPI",
    "SCI": r"SCI|UART",
    "GPIO": r"^GPIO",
    "EQEP": r"QEP",
    "FSI": r"FSI",
    "LIN": r"LIN",
    "SD": r"^SD-",
    "ECAP": r"eCAP|ECAP",
    "MCBSP": r"McBSP",
}


def extract_from_excel(file_path: Path) -> DeviceData:
    """Extract device data from a TI ControlCard pinout Excel file.

    The TI ControlCard Excel has a dual-column layout:
    - Left side: HSEC pin (col 2), MCU pin (col 3), MCU usage (col 4), functions (col 5)
    - Right side: functions (col 7), MCU usage (col 8), MCU pin (col 9), HSEC pin (col 10)

    Data starts at row 3 (0-indexed). Some MCU pin rows don't have an HSEC pin in
    the same row (continuation rows in merged groups).
    """
    df = pd.read_excel(file_path, header=None)
    df = df.fillna("")

    pins: list[Pin] = []
    seen_ids: set[str] = set()
    resource_raw: dict[str, int] = {}

    console.print(f"[dim]Processing {file_path.name} ({df.shape[0]} rows, {df.shape[1]} cols)[/]")

    # Track current HSEC pin group for left and right sides
    current_left_hsec = ""
    current_right_hsec = ""
    left_pin_index = 0
    right_pin_index = 0

    for row_idx in range(3, len(df)):
        row = df.iloc[row_idx]

        # --- Left side ---
        left_hsec_raw = str(row.iloc[2]).strip() if row.iloc[2] != "" else ""
        left_mcu = str(row.iloc[3]).strip() if row.iloc[3] != "" else ""
        left_func = str(row.iloc[5]).strip() if row.iloc[5] != "" else ""

        # Update current HSEC group if new HSEC value appears
        if left_hsec_raw:
            current_left_hsec = left_hsec_raw
            left_pin_index = 0

        if left_mcu:
            _process_pin(
                hsec_raw=current_left_hsec,
                mcu_name=left_mcu,
                func_str=left_func,
                side="left",
                pin_index=left_pin_index,
                pins=pins,
                seen_ids=seen_ids,
                resource_raw=resource_raw,
            )
            left_pin_index += 1

        # --- Right side ---
        right_hsec_raw = str(row.iloc[10]).strip() if row.iloc[10] != "" else ""
        right_mcu = str(row.iloc[9]).strip() if row.iloc[9] != "" else ""
        right_func = str(row.iloc[7]).strip() if row.iloc[7] != "" else ""

        if right_hsec_raw:
            current_right_hsec = right_hsec_raw
            right_pin_index = 0

        if right_mcu:
            _process_pin(
                hsec_raw=current_right_hsec,
                mcu_name=right_mcu,
                func_str=right_func,
                side="right",
                pin_index=right_pin_index,
                pins=pins,
                seen_ids=seen_ids,
                resource_raw=resource_raw,
            )
            right_pin_index += 1

    # Assign positions: distribute pins by their sides
    left_pins = [p for p in pins if getattr(p.position, "side", "") == "left"]
    right_pins = [p for p in pins if getattr(p.position, "side", "") == "right"]
    for i, pin in enumerate(left_pins):
        pin.position = PinPositionSide(side="left", index=i)
    for i, pin in enumerate(right_pins):
        pin.position = PinPositionSide(side="right", index=i)

    # Build resource summary with dedup heuristics
    resources = _build_resources(pins, resource_raw)

    device_name = _infer_device_name(file_path)
    clock = _default_c2000_clock_tree()
    peripheral_groups = _build_peripheral_groups(pins)

    console.print(f"[green]Extracted {len(pins)} pins ({sum(1 for p in pins if p.type == 'io')} IO, "
                  f"{sum(1 for p in pins if p.type == 'analog')} analog, "
                  f"{sum(1 for p in pins if p.type in ('power', 'ground'))} power/gnd)[/]")

    return DeviceData(
        device=DeviceInfo(
            name=device_name,
            manufacturer="Texas Instruments",
            family="C2000",
            description=f"Dual-core 32-bit MCU with connectivity manager, 200 MHz C28x + CLA, 125 MHz CM (Arm Cortex-M4)",
            datasheet_url=f"https://www.ti.com/lit/ds/symlink/{device_name.lower()}.pdf",
        ),
        packages=[
            Package(
                name="180-pin HSEC ControlCard",
                type="controlcard",
                pin_count=len(pins),
                pins=sorted(pins, key=lambda p: _sort_key(p.id)),
            )
        ],
        clock=clock,
        peripherals=peripheral_groups,
        resources=resources,
    )


def _process_pin(
    hsec_raw: str,
    mcu_name: str,
    func_str: str,
    side: str,
    pin_index: int,
    pins: list[Pin],
    seen_ids: set[str],
    resource_raw: dict[str, int],
) -> None:
    """Process a single MCU pin entry."""
    # Clean MCU name
    mcu_clean = mcu_name.replace("\n", "").replace("\xa0", "").strip()
    mcu_clean = re.sub(r"[#*]+$", "", mcu_clean).strip()

    if not mcu_clean or mcu_clean.lower() in ("", "nan"):
        return

    # Skip header row remnants
    if "HSEC" in mcu_clean or "MCU" in mcu_clean:
        return

    # Extract HSEC pin numbers from the group
    hsec_numbers = _extract_hsec_numbers(hsec_raw)
    pin_id = hsec_numbers[pin_index] if pin_index < len(hsec_numbers) else f"H{side[0]}{pin_index}"

    # Deduplicate by MCU name (more reliable than HSEC pin)
    dedup_key = f"{mcu_clean}_{side}"
    if dedup_key in seen_ids:
        return
    seen_ids.add(dedup_key)

    # Check if power/ground/special
    is_power = any(sig in mcu_clean.upper() for sig in POWER_SIGNALS)
    is_ground = "GND" in mcu_clean.upper() or "VSS" in mcu_clean.upper()

    if is_ground:
        pins.append(Pin(
            id=pin_id,
            name=mcu_clean,
            position=PinPositionSide(side=side, index=pin_index),
            type="ground",
            functions=[PinFunction(name="GND", peripheral="Power")],
        ))
        return
    if is_power:
        pins.append(Pin(
            id=pin_id,
            name=mcu_clean,
            position=PinPositionSide(side=side, index=pin_index),
            type="power",
            functions=[PinFunction(name=mcu_clean, peripheral="Power")],
        ))
        return

    # Parse functions
    functions = _parse_functions(mcu_clean, func_str)

    # Count peripheral resources
    for fn in functions:
        if fn.peripheral not in ("GPIO", "Power", "Other"):
            resource_raw[fn.peripheral] = resource_raw.get(fn.peripheral, 0) + 1

    # Classify pin type
    pin_type = _classify_pin_type(mcu_clean, functions)

    pins.append(Pin(
        id=pin_id,
        name=mcu_clean,
        position=PinPositionSide(side=side, index=pin_index),
        type=pin_type,
        functions=functions,
    ))


def _extract_hsec_numbers(hsec_raw: str) -> list[str]:
    """Extract individual HSEC pin numbers from a multi-line cell."""
    if not hsec_raw:
        return []
    # Remove text after numbers like "VSS", "TMS", "TCK", etc.
    numbers = []
    for part in hsec_raw.split("\n"):
        part = part.strip()
        # Extract leading number
        match = re.match(r"(\d+)", part)
        if match:
            numbers.append(match.group(1))
        # Also check for "number   text   number" patterns
        for num_match in re.finditer(r"\b(\d+)\b", part):
            num = num_match.group(1)
            if num not in numbers:
                numbers.append(num)
    return numbers


def _parse_functions(mcu_name: str, func_str: str) -> list[PinFunction]:
    """Parse function string into a list of PinFunction objects."""
    functions: list[PinFunction] = []

    # Always add MCU pin name as primary function
    primary_periph = _classify_peripheral(mcu_name)
    functions.append(PinFunction(name=mcu_name, peripheral=primary_periph))

    if not func_str or func_str.lower() in ("", "nan", "rsv", "gpio"):
        if func_str.upper() == "GPIO" and primary_periph != "GPIO":
            functions.append(PinFunction(name="GPIO", peripheral="GPIO"))
        return functions

    # Clean function string: remove parenthetical notes, split on whitespace/newlines
    # Handle "(and/or DACA)" patterns by extracting the alternate name
    alternates = re.findall(r"\(and/or\s+(\w+)\)", func_str)
    clean_func = re.sub(r"\(and/or\s+\w+\)", "", func_str)
    clean_func = re.sub(r"\(.*?\)", "", clean_func)  # Remove other parentheticals

    tokens = re.split(r"[\s\n]+", clean_func.strip())
    tokens = [t.strip() for t in tokens if t.strip() and t.strip().lower() not in ("or", "and/or", "and", "nan", "")]

    # Add alternate function names from parentheticals
    tokens.extend(alternates)

    for token in tokens:
        if token == mcu_name:
            continue
        periph = _classify_peripheral(token)
        # Avoid duplicates
        if not any(f.name == token for f in functions):
            functions.append(PinFunction(name=token, peripheral=periph))

    return functions


def _classify_peripheral(func_name: str) -> str:
    """Classify a function name to its peripheral type."""
    for peripheral, pattern in PERIPHERAL_PATTERNS.items():
        if re.search(pattern, func_name, re.IGNORECASE):
            return peripheral
    if func_name.upper().startswith("TZ"):
        return "EPWM"  # Trip zones are part of EPWM
    return "Other"


def _classify_pin_type(name: str, functions: list[PinFunction]) -> str:
    """Classify pin type based on name and functions."""
    upper = name.upper()
    if upper.startswith("ADC") or upper.startswith("DAC") or upper.startswith("ADCIN"):
        return "analog"
    if any(p in upper for p in ("XTAL", "OSC", "X1", "X2")):
        return "clock"
    if upper.startswith("XRSN") or upper == "ERRORSTS":
        return "special"
    return "io"


def _build_resources(pins: list[Pin], resource_raw: dict[str, int]) -> dict[str, ResourceCount]:
    """Build resource summary with dedup heuristics."""
    resources: dict[str, ResourceCount] = {}

    # GPIO count = number of IO pins
    gpio_count = sum(1 for p in pins if p.type == "io")
    resources["GPIO"] = ResourceCount(used=0, total=gpio_count)

    # EPWM: divide by 2 (each module has A+B outputs), cap at 16 for F28388D
    epwm_raw = resource_raw.get("EPWM", 0)
    resources["EPWM"] = ResourceCount(used=0, total=min(16, max(1, epwm_raw // 2)))

    # ADC: count unique ADC channel pins (not function mentions)
    adc_count = sum(1 for p in pins if p.type == "analog")
    resources["ADC"] = ResourceCount(used=0, total=adc_count)

    # Others: use raw counts with reasonable caps
    for periph in ("SPI", "SCI", "I2C", "CAN", "EQEP", "FSI", "SD", "ECAP", "LIN"):
        raw = resource_raw.get(periph, 0)
        if raw > 0:
            # Rough scaling: each peripheral instance uses ~2-4 pins
            instances = max(1, raw // 3)
            resources[periph] = ResourceCount(used=0, total=instances)

    return resources


def _infer_device_name(file_path: Path) -> str:
    """Try to infer device name from the Excel filename."""
    name = file_path.stem.upper()
    # Look for specific TI patterns
    match = re.search(r"(F\d{4,5}\w*)", name)
    if match:
        return f"TMS320{match.group(1)}"
    # Check for "2838" pattern
    if "2838" in name:
        return "TMS320F28388D"
    return name


def _sort_key(pin_id: str) -> tuple[int, str]:
    """Sort pins by numeric ID first, then alphabetically."""
    match = re.match(r"(\d+)", pin_id)
    if match:
        return (int(match.group(1)), pin_id)
    return (99999, pin_id)


def _default_c2000_clock_tree() -> ClockTree:
    """Return a default C2000 F2838x clock tree configuration."""
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
            PLL(
                id="auxpll",
                name="AUXPLL",
                source="xtal",
                input_div=1,
                multiplier=12,
                output_div=2,
                vco_frequency=240_000_000,
                output_frequency=120_000_000,
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
    # Collect unique peripheral instances from pin functions
    peripheral_instances: dict[str, set[str]] = {}
    for pin in pins:
        for fn in pin.functions:
            if fn.peripheral not in ("GPIO", "Power", "Other"):
                if fn.peripheral not in peripheral_instances:
                    peripheral_instances[fn.peripheral] = set()
                peripheral_instances[fn.peripheral].add(pin.name)

    # Categorize into groups
    categories: dict[str, list[Peripheral]] = {
        "Analog": [],
        "Connectivity": [],
        "Timers": [],
        "System": [],
    }

    for periph_type, pin_names in sorted(peripheral_instances.items()):
        periph = Peripheral(
            name=periph_type,
            type=periph_type,
            enabled=False,
            instances=1,
            pins=sorted(pin_names),
            params=[],
        )

        if periph_type in ("ADC", "DAC"):
            categories["Analog"].append(periph)
        elif periph_type in ("SCI", "SPI", "I2C", "CAN", "LIN", "FSI", "EMIF", "MCBSP"):
            categories["Connectivity"].append(periph)
        elif periph_type in ("EPWM", "EQEP", "ECAP", "SD"):
            categories["Timers"].append(periph)
        else:
            categories["System"].append(periph)

    return [
        PeripheralGroup(category=cat, peripherals=periphs)
        for cat, periphs in categories.items()
        if periphs
    ]
