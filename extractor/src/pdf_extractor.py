"""Extract device data from PDF datasheets using Docling."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from rich.console import Console

from .schema import (
    ClockBus,
    ClockMux,
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
    PinPositionGrid,
    ResourceCount,
)

console = Console()

# ---------------------------------------------------------------------------
# Fuzzy column-matching keywords
# ---------------------------------------------------------------------------

# Keywords that identify a pin-attribute table column (lowercase).
# Each entry: (canonical_name, list_of_keywords_to_match)
_PIN_COLUMN_KEYWORDS: list[tuple[str, list[str]]] = [
    ("signal", ["signal", "signal name", "pin name", "name"]),
    ("pin_number", ["pin number", "pin no", "ball", "bga", "pin #", "337 bga", "337-pin", "176 bga", "176-pin"]),
    ("type", ["type", "pin type", "i/o", "io", "direction", "buffer type"]),
    ("description", ["description", "function", "desc"]),
]

# Power/ground signal patterns for pin classification
_POWER_PATTERNS = re.compile(
    r"^(V[DCS]{2}[A-Z0-9]*|AVDD|DVDD|VDD[A-Z0-9]*|VCC[A-Z0-9]*|VREF[A-Z]*|VBAT|VIN)$",
    re.IGNORECASE,
)
_GROUND_PATTERNS = re.compile(
    r"^(GND|VSS[A-Z0-9]*|AVSS|DVSS|AGND|DGND|PGND)$",
    re.IGNORECASE,
)

# Peripheral detection patterns (same as excel_extractor for consistency)
_PERIPHERAL_PATTERNS: dict[str, str] = {
    "EPWM": r"(?:^e?PWM|EPWM)",
    "ADC": r"(?:^ADC|^ADCIN)",
    "DAC": r"^DAC",
    "CAN": r"(?:CAN|MCAN)",
    "I2C": r"I2C",
    "SPI": r"SPI",
    "SCI": r"(?:SCI|UART)",
    "GPIO": r"^GPIO",
    "EQEP": r"(?:QEP|EQEP)",
    "FSI": r"FSI",
    "LIN": r"LIN",
    "SD": r"(?:^SD-|^SDFM|^SD\d)",
    "ECAP": r"(?:eCAP|ECAP)",
    "MCBSP": r"McBSP",
    "EMIF": r"EMIF",
    "USB": r"USB",
    "ENET": r"(?:ENET|MII|MDIO|RMII)",
    "XBAR": r"XBAR",
    "CLB": r"CLB",
    "CMPSS": r"CMPSS",
}

# Known TI C2000 peripheral counts for F2838x family (fallback defaults)
_F2838X_PERIPHERAL_DEFAULTS: dict[str, int] = {
    "EPWM": 16,
    "ADC": 4,
    "DAC": 3,
    "CMPSS": 8,
    "ECAP": 7,
    "EQEP": 3,
    "SCI": 4,
    "SPI": 4,
    "I2C": 2,
    "CAN": 2,
    "MCAN": 2,
    "FSI": 8,
    "LIN": 2,
    "MCBSP": 2,
    "SD": 2,
    "USB": 1,
    "EMIF": 2,
    "CLB": 8,
    "ENET": 1,
}


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def extract_from_pdf(file_path: Path) -> DeviceData:
    """Extract device data from a PDF datasheet using Docling.

    This uses Docling's DocumentConverter to extract pin attribute tables,
    clock specifications, and peripheral counts from TI datasheets.
    """
    try:
        from docling.document_converter import DocumentConverter

        console.print("[dim]Initializing Docling converter...[/]")
        converter = DocumentConverter()
        result = converter.convert(str(file_path))

        # Extract markdown for text-based analysis (clock specs, descriptions)
        markdown = result.document.export_to_markdown()

        # Extract tables as DataFrames
        tables: list[Any] = []
        for table in result.document.tables:
            try:
                df = table.export_to_dataframe(doc=result.document)
                tables.append(df)
            except Exception as e:
                console.print(f"[dim yellow]Skipped a table (export error): {e}[/]")

        console.print(f"[dim]Extracted {len(tables)} tables from PDF[/]")

        device_name = _infer_device_from_filename(file_path)

        # 1. Extract pin data from pin attribute tables
        packages, all_pins = _extract_pin_data(tables, device_name)

        # 2. Extract clock tree from tables and markdown text
        clock = _extract_clock_tree(tables, markdown)

        # 3. Extract peripheral groups from feature tables and pin data
        peripheral_groups = _extract_peripheral_groups(tables, markdown, all_pins)

        # 4. Build resource counts
        resources = _build_resources(all_pins, peripheral_groups)

        # 5. Extract description from markdown
        description = _extract_description(markdown, device_name, file_path)

        console.print(
            f"[green]Extracted {len(all_pins)} pins, "
            f"{len(clock.sources)} clock sources, "
            f"{sum(len(g.peripherals) for g in peripheral_groups)} peripherals[/]"
        )

        return DeviceData(
            device=DeviceInfo(
                name=device_name,
                manufacturer="Texas Instruments",
                family="C2000",
                description=description,
                datasheet_url=f"https://www.ti.com/lit/ds/symlink/{device_name.lower()}.pdf",
            ),
            packages=packages,
            clock=clock,
            peripherals=peripheral_groups,
            resources=resources,
        )

    except ImportError:
        console.print("[yellow]Warning: Docling not installed. Install with: uv pip install docling[/]")
        return DeviceData(
            device=DeviceInfo(
                name=_infer_device_from_filename(file_path),
                manufacturer="Unknown",
                family="Unknown",
                description=f"PDF extraction requires Docling. File: {file_path.name}",
            ),
        )


# ---------------------------------------------------------------------------
# Pin data extraction
# ---------------------------------------------------------------------------


def _fuzzy_match_column(col_name: str, keywords: list[str]) -> bool:
    """Check whether *col_name* fuzzy-matches any of the *keywords*."""
    norm = col_name.strip().lower()
    # Remove extra whitespace
    norm = re.sub(r"\s+", " ", norm)
    for kw in keywords:
        if kw in norm:
            return True
    return False


def _find_column(columns: list[str], canonical: str) -> str | None:
    """Return the first column name that fuzzy-matches *canonical*."""
    for canon_name, keywords in _PIN_COLUMN_KEYWORDS:
        if canon_name == canonical:
            for col in columns:
                if _fuzzy_match_column(str(col), keywords):
                    return col
            break
    return None


def _is_pin_attribute_table(df: Any) -> bool:
    """Heuristic: does *df* look like a pin attribute table?

    Requires at least a signal/name column and a pin-number column.
    """
    cols = [str(c).strip().lower() for c in df.columns]
    col_text = " | ".join(cols)

    has_signal = any(
        _fuzzy_match_column(c, kws)
        for canonical, kws in _PIN_COLUMN_KEYWORDS
        if canonical == "signal"
        for c in cols
    )
    has_pin_num = any(
        _fuzzy_match_column(c, kws)
        for canonical, kws in _PIN_COLUMN_KEYWORDS
        if canonical == "pin_number"
        for c in cols
    )

    # Also check if any column header literally contains "pin" and table has
    # enough rows (pin tables typically have >10 rows)
    has_pin_keyword = "pin" in col_text or "ball" in col_text or "bga" in col_text
    has_enough_rows = len(df) >= 5

    return (has_signal and has_pin_num) or (has_signal and has_pin_keyword and has_enough_rows)


def _classify_pin_type_pdf(signal_name: str, pin_type_str: str) -> str:
    """Classify a pin's type based on signal name and type column value."""
    upper_name = signal_name.upper().strip()
    upper_type = pin_type_str.upper().strip()

    # Ground
    if _GROUND_PATTERNS.match(upper_name):
        return "ground"
    # Power
    if _POWER_PATTERNS.match(upper_name):
        return "power"

    # Analog
    if upper_name.startswith(("ADC", "DAC", "ADCIN", "CMPSS", "VREF")):
        return "analog"
    if upper_type in ("A", "AI", "AO", "ANALOG"):
        return "analog"

    # Clock
    if any(kw in upper_name for kw in ("XTAL", "OSC", "X1", "X2", "CLKIN")):
        return "clock"

    # Special (reset, JTAG, boot, etc.)
    if any(kw in upper_name for kw in ("XRS", "RESET", "TMS", "TCK", "TDI", "TDO", "TRST", "BOOT", "ERRORSTS")):
        return "special"

    # I/O (default for anything with I, O, I/O, or GPIO type)
    return "io"


def _classify_peripheral_pdf(func_name: str) -> str:
    """Classify a function/signal name to its peripheral type."""
    for peripheral, pattern in _PERIPHERAL_PATTERNS.items():
        if re.search(pattern, func_name, re.IGNORECASE):
            return peripheral
    if func_name.upper().startswith("TZ"):
        return "EPWM"
    if func_name.upper().startswith(("OUTPUTXBAR", "INPUTXBAR")):
        return "XBAR"
    return "Other"


def _parse_bga_position(pin_number: str) -> PinPositionGrid | None:
    """Parse a BGA ball number like 'A1', 'AB12' into a PinPositionGrid."""
    pin_number = pin_number.strip()
    match = re.match(r"^([A-Z]{1,2})(\d{1,2})$", pin_number, re.IGNORECASE)
    if match:
        return PinPositionGrid(row=match.group(1).upper(), col=int(match.group(2)))
    return None


def _parse_mux_functions(signal_name: str, description: str) -> list[PinFunction]:
    """Parse signal name and description into PinFunction objects.

    TI datasheets often describe mux modes in the description column
    or list multiple function names separated by '/' or ','.
    """
    functions: list[PinFunction] = []
    seen_names: set[str] = set()

    # Primary function from signal name
    primary_name = signal_name.strip()
    if primary_name and primary_name.lower() not in ("", "nan", "-", "--"):
        periph = _classify_peripheral_pdf(primary_name)
        functions.append(PinFunction(name=primary_name, peripheral=periph))
        seen_names.add(primary_name.upper())

    # Try to extract additional mux functions from description
    if description and description.strip().lower() not in ("", "nan", "-", "--"):
        desc = description.strip()

        # Look for "GPIO<n>/Signal1/Signal2" or "Signal1, Signal2" patterns
        # Split on common delimiters
        parts = re.split(r"[/,;\n]", desc)
        for part in parts:
            part = part.strip()
            # Remove parenthetical notes
            part = re.sub(r"\(.*?\)", "", part).strip()
            # Skip empty, very long descriptions (sentences), or pure numbers
            if not part or len(part) > 40 or part.isdigit():
                continue
            # Skip if it looks like a sentence (contains multiple spaces and common words)
            if " " in part and any(w in part.lower() for w in ["pin", "directly", "active", "directly", "active low"]):
                continue
            # Extract token-like identifiers (alphanumeric with underscores)
            token_match = re.match(r"^([A-Za-z][A-Za-z0-9_#\-]*)", part)
            if token_match:
                token = token_match.group(1).strip()
                if token.upper() not in seen_names and len(token) >= 2:
                    periph = _classify_peripheral_pdf(token)
                    functions.append(PinFunction(name=token, peripheral=periph))
                    seen_names.add(token.upper())

    return functions


def _extract_pin_data(tables: list[Any], device_name: str) -> tuple[list[Package], list[Pin]]:
    """Find pin attribute tables and extract Pin objects.

    Returns (list of Packages, flat list of all pins across packages).
    """
    import pandas as pd

    all_pins: list[Pin] = []
    packages: list[Package] = []
    pin_tables_found = 0

    # Track which package columns we find (BGA-337, BGA-176, etc.)
    package_pin_columns: dict[str, str] = {}  # display_name -> column_name

    for df in tables:
        if not _is_pin_attribute_table(df):
            continue

        pin_tables_found += 1
        cols = [str(c) for c in df.columns]

        # Find canonical columns
        signal_col = _find_column(cols, "signal")
        type_col = _find_column(cols, "type")
        desc_col = _find_column(cols, "description")

        if not signal_col:
            continue

        # Find all pin-number columns (there can be multiple for different packages)
        pin_num_cols: list[tuple[str, str]] = []  # (column_name, package_label)
        for col in cols:
            col_lower = col.strip().lower()
            # Match "337 BGA", "176-Pin BGA", "Pin Number (337 BGA)", etc.
            bga_match = re.search(r"(\d+)\s*[-\s]?\s*(?:pin)?\s*(?:bga|lqfp|qfp)", col_lower)
            if bga_match:
                pin_count_str = bga_match.group(1)
                pkg_type = "bga" if "bga" in col_lower else ("lqfp" if "lqfp" in col_lower else "qfp")
                label = f"{pin_count_str}-pin {pkg_type.upper()}"
                pin_num_cols.append((col, label))
                package_pin_columns[label] = col
            elif _fuzzy_match_column(col, ["pin number", "pin no", "pin #", "ball"]):
                # Generic pin number column
                if col not in [c for c, _ in pin_num_cols]:
                    pin_num_cols.append((col, "default"))

        # If no specific pin columns found, try to use whatever looks numeric
        if not pin_num_cols:
            for col in cols:
                if col != signal_col and col != type_col and col != desc_col:
                    # Check if the column has BGA-style values (letter+number)
                    sample_vals = df[col].dropna().head(10).astype(str)
                    bga_count = sum(1 for v in sample_vals if re.match(r"^[A-Z]{1,2}\d{1,2}$", v.strip(), re.IGNORECASE))
                    if bga_count >= 3:
                        pin_num_cols.append((col, "BGA"))
                        break

        console.print(f"[dim]  Pin table: {len(df)} rows, signal_col={signal_col}, "
                      f"pin_cols={[l for _, l in pin_num_cols]}[/]")

        # Process each row
        for _, row in df.iterrows():
            signal_raw = str(row.get(signal_col, "")).strip()
            if not signal_raw or signal_raw.lower() in ("", "nan", "-", "--", "signal name", "reserved"):
                continue

            # Clean signal name
            signal_name = re.sub(r"\s+", "", signal_raw).strip()

            # Get type and description
            pin_type_str = str(row.get(type_col, "")).strip() if type_col else ""
            desc_str = str(row.get(desc_col, "")).strip() if desc_col else ""

            # Classify
            pin_type = _classify_pin_type_pdf(signal_name, pin_type_str)

            # Parse functions
            if pin_type in ("power", "ground"):
                functions = [PinFunction(
                    name=signal_name,
                    peripheral="Power",
                )]
            else:
                functions = _parse_mux_functions(signal_name, desc_str)
                if not functions:
                    functions = [PinFunction(name=signal_name, peripheral="Other")]

            # Create a Pin for each package column
            for pin_col, pkg_label in pin_num_cols:
                pin_number_raw = str(row.get(pin_col, "")).strip()
                if not pin_number_raw or pin_number_raw.lower() in ("", "nan", "-", "--", "—"):
                    continue

                # Handle multiple pin numbers separated by commas/newlines
                pin_numbers = re.split(r"[,\n]+", pin_number_raw)
                for pn in pin_numbers:
                    pn = pn.strip()
                    if not pn or pn.lower() in ("", "-", "--", "—"):
                        continue

                    # Parse BGA position
                    position = _parse_bga_position(pn)
                    if not position:
                        # Try to use it as a numeric pin
                        num_match = re.match(r"(\d+)", pn)
                        if num_match:
                            # For non-BGA packages, create a grid position with row "R"
                            position = PinPositionGrid(row="R", col=int(num_match.group(1)))
                        else:
                            continue

                    pin_id = f"{pn}"
                    pin = Pin(
                        id=pin_id,
                        name=signal_name,
                        position=position,
                        type=pin_type,
                        functions=functions,
                    )
                    all_pins.append(pin)

    console.print(f"[dim]Found {pin_tables_found} pin attribute table(s), {len(all_pins)} total pin entries[/]")

    # Build Package objects - group pins by package
    if package_pin_columns:
        # We have named packages; rebuild pins per package
        packages = _build_packages_from_columns(tables, package_pin_columns, all_pins, device_name)
    elif all_pins:
        # Single unnamed package
        pkg_type = _guess_package_type(all_pins)
        pin_count = len(all_pins)
        packages = [Package(
            name=f"{pin_count}-pin {pkg_type.upper()}",
            type=pkg_type,
            pin_count=pin_count,
            pins=all_pins,
        )]

    return packages, all_pins


def _guess_package_type(pins: list[Pin]) -> str:
    """Guess the package type from pin position formats."""
    bga_count = sum(1 for p in pins if isinstance(p.position, PinPositionGrid) and len(p.position.row) <= 2)
    if bga_count > len(pins) * 0.5:
        return "bga"
    return "qfp"


def _build_packages_from_columns(
    tables: list[Any],
    package_pin_columns: dict[str, str],
    all_pins: list[Pin],
    device_name: str,
) -> list[Package]:
    """Build separate Package objects when multiple package columns exist."""
    packages: list[Package] = []

    # Group all_pins by package -- for simplicity, since we've already
    # extracted all pins, build one combined package with all unique pins
    # (datasheet pin tables typically list signals with ball numbers for each package)
    seen: set[str] = set()
    unique_pins: list[Pin] = []
    for pin in all_pins:
        key = f"{pin.name}_{pin.id}"
        if key not in seen:
            seen.add(key)
            unique_pins.append(pin)

    for pkg_label in package_pin_columns:
        # Parse pin count from label like "337-pin BGA"
        count_match = re.search(r"(\d+)", pkg_label)
        pin_count = int(count_match.group(1)) if count_match else len(unique_pins)
        pkg_type = "bga" if "BGA" in pkg_label.upper() else ("lqfp" if "LQFP" in pkg_label.upper() else "qfp")

        packages.append(Package(
            name=f"{device_name} {pkg_label}",
            type=pkg_type,
            pin_count=pin_count,
            pins=unique_pins,
        ))

    if not packages and unique_pins:
        packages.append(Package(
            name=f"{device_name} BGA",
            type="bga",
            pin_count=len(unique_pins),
            pins=unique_pins,
        ))

    return packages


# ---------------------------------------------------------------------------
# Clock tree extraction
# ---------------------------------------------------------------------------


def _extract_clock_tree(tables: list[Any], markdown: str) -> ClockTree:
    """Extract clock tree information from tables and markdown text.

    Looks for:
    - Oscillator frequencies (INTOSC1, INTOSC2, XTAL)
    - PLL parameters (SYSPLL, AUXPLL, multiplier/divider ranges)
    - System clock frequencies (SYSCLK, LSPCLK, etc.)
    """
    sources: list[ClockSource] = []
    plls: list[PLL] = []
    muxes: list[ClockMux] = []
    buses: list[ClockBus] = []

    # -- Extract from markdown text --
    intosc_freq = _find_frequency_in_text(markdown, r"INTOSC[12]?\s*(?:frequency)?\s*[:=]?\s*(\d+)\s*(MHz|kHz)")
    xtal_freq = _find_frequency_in_text(markdown, r"(?:X1|XTAL|crystal)\s*(?:frequency)?\s*[:=]?\s*(\d+)\s*(MHz|kHz)")
    sysclk_freq = _find_frequency_in_text(markdown, r"SYSCLK\s*(?:frequency|max|maximum)?\s*[:=]?\s*(\d+)\s*(MHz)")
    cm_freq = _find_frequency_in_text(markdown, r"(?:CM|Cortex.M4?|connectivity\s*manager)\s*(?:frequency|clock|max)?\s*[:=]?\s*(\d+)\s*(MHz)")

    # Try broader frequency patterns if specific ones didn't match
    if not intosc_freq:
        intosc_freq = _search_frequency_near_keyword(markdown, "INTOSC", default_hz=10_000_000)
    if not xtal_freq:
        xtal_freq = _search_frequency_near_keyword(markdown, "external oscillator", default_hz=20_000_000)
    if not sysclk_freq:
        sysclk_freq = _search_frequency_near_keyword(markdown, "SYSCLK", default_hz=200_000_000)

    # -- Extract from clock-related tables --
    for df in tables:
        _extract_clock_from_table(df, sources, plls, buses, markdown)

    # -- Build default clock sources if none found --
    if not sources:
        sources = [
            ClockSource(
                id="intosc1",
                name="INTOSC1",
                frequency=intosc_freq or 10_000_000,
                type="internal",
                enabled=True,
            ),
            ClockSource(
                id="intosc2",
                name="INTOSC2",
                frequency=intosc_freq or 10_000_000,
                type="internal",
                enabled=False,
            ),
            ClockSource(
                id="xtal",
                name="X1/X2",
                frequency=xtal_freq or 20_000_000,
                type="external",
                enabled=True,
            ),
        ]

    # -- Build default PLLs if none found --
    if not plls:
        xtal_hz = xtal_freq or 20_000_000
        sys_hz = sysclk_freq or 200_000_000
        # Calculate multiplier to reach SYSCLK from XTAL
        # SYSCLK = XTAL * multiplier / output_div
        # Assume output_div=2, so multiplier = SYSCLK * 2 / XTAL
        sys_mult = max(1, (sys_hz * 2) // xtal_hz)
        vco_hz = xtal_hz * sys_mult

        aux_hz = cm_freq or 120_000_000
        aux_mult = max(1, (aux_hz * 2) // xtal_hz)
        aux_vco = xtal_hz * aux_mult

        plls = [
            PLL(
                id="syspll",
                name="SYSPLL",
                source="xtal",
                input_div=1,
                multiplier=int(sys_mult),
                output_div=2,
                vco_frequency=int(vco_hz),
                output_frequency=int(sys_hz),
                enabled=True,
            ),
            PLL(
                id="auxpll",
                name="AUXPLL",
                source="xtal",
                input_div=1,
                multiplier=int(aux_mult),
                output_div=2,
                vco_frequency=int(aux_vco),
                output_frequency=int(aux_hz),
                enabled=True,
            ),
        ]

    # -- Build default buses if none found --
    if not buses:
        sys_hz = sysclk_freq or 200_000_000
        buses = [
            ClockBus(id="sysclk", name="SYSCLK", source="syspll", divider=1, frequency=int(sys_hz)),
            ClockBus(id="lspclk", name="LSPCLK", source="sysclk", divider=4, frequency=int(sys_hz) // 4),
            ClockBus(id="epwmclk", name="EPWMCLK", source="sysclk", divider=2, frequency=int(sys_hz) // 2),
            ClockBus(id="canclk", name="CANCLK", source="sysclk", divider=2, frequency=int(sys_hz) // 2),
        ]

    return ClockTree(sources=sources, plls=plls, muxes=muxes, buses=buses)


def _find_frequency_in_text(text: str, pattern: str) -> int | None:
    """Search for a frequency pattern in text. Returns frequency in Hz or None."""
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        value = float(match.group(1))
        unit = match.group(2).lower() if match.lastindex >= 2 else "mhz"
        if unit == "mhz":
            return int(value * 1_000_000)
        elif unit == "khz":
            return int(value * 1_000)
        elif unit == "ghz":
            return int(value * 1_000_000_000)
        return int(value)
    return None


def _search_frequency_near_keyword(text: str, keyword: str, default_hz: int) -> int:
    """Search for a frequency value near a keyword in text. Returns Hz."""
    # Find the keyword, then look for MHz/kHz within nearby characters
    pattern = re.escape(keyword)
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        return default_hz

    # Search in a window around the match
    start = max(0, match.start() - 200)
    end = min(len(text), match.end() + 200)
    window = text[start:end]

    # Look for frequency values
    freq_matches = re.findall(r"(\d+(?:\.\d+)?)\s*(MHz|kHz|GHz)", window, re.IGNORECASE)
    for val_str, unit in freq_matches:
        value = float(val_str)
        if unit.lower() == "mhz":
            return int(value * 1_000_000)
        elif unit.lower() == "khz":
            return int(value * 1_000)
        elif unit.lower() == "ghz":
            return int(value * 1_000_000_000)

    return default_hz


def _extract_clock_from_table(
    df: Any,
    sources: list[ClockSource],
    plls: list[PLL],
    buses: list[ClockBus],
    markdown: str,
) -> None:
    """Try to extract clock parameters from a single table."""
    cols = [str(c).strip().lower() for c in df.columns]
    col_text = " ".join(cols)

    # Look for clock parameter tables (parameter, min, typ, max, unit)
    has_param = any("param" in c or "symbol" in c for c in cols)
    has_minmax = any("min" in c or "max" in c or "typ" in c for c in cols)
    has_freq_unit = any("unit" in c or "mhz" in c or "khz" in c for c in cols)

    if not (has_param and has_minmax):
        return

    # Try to find oscillator and clock rows
    for _, row in df.iterrows():
        row_text = " ".join(str(v) for v in row.values).lower()

        # Internal oscillator frequency
        if "intosc" in row_text or "internal oscillator" in row_text:
            freq = _extract_freq_from_row(row, cols)
            if freq:
                source_id = "intosc1" if "1" in row_text else ("intosc2" if "2" in row_text else "intosc1")
                source_name = "INTOSC1" if "1" in row_text else ("INTOSC2" if "2" in row_text else "INTOSC1")
                # Check if we already have this source
                if not any(s.id == source_id for s in sources):
                    sources.append(ClockSource(
                        id=source_id,
                        name=source_name,
                        frequency=freq,
                        type="internal",
                        enabled=True,
                    ))

        # SYSCLK / system clock
        if "sysclk" in row_text or "system clock" in row_text:
            freq = _extract_freq_from_row(row, cols)
            if freq and not any(b.id == "sysclk" for b in buses):
                buses.append(ClockBus(id="sysclk", name="SYSCLK", source="syspll", divider=1, frequency=freq))

        # PLL parameters
        if "pll" in row_text and ("vco" in row_text or "output" in row_text):
            freq = _extract_freq_from_row(row, cols)
            if freq:
                pll_id = "syspll" if "sys" in row_text or "main" in row_text else "auxpll"
                if not any(p.id == pll_id for p in plls):
                    plls.append(PLL(
                        id=pll_id,
                        name=pll_id.upper(),
                        source="xtal",
                        output_frequency=freq,
                        enabled=True,
                    ))


def _extract_freq_from_row(row: Any, cols: list[str]) -> int | None:
    """Extract a frequency value from a table row, checking typ/max columns."""
    # Determine unit from the row or column
    unit_multiplier = 1_000_000  # Default to MHz
    for i, col in enumerate(cols):
        if "unit" in col:
            unit_val = str(row.iloc[i]).strip().lower()
            if "khz" in unit_val:
                unit_multiplier = 1_000
            elif "ghz" in unit_val:
                unit_multiplier = 1_000_000_000
            elif "hz" in unit_val and "mhz" not in unit_val and "khz" not in unit_val and "ghz" not in unit_val:
                unit_multiplier = 1
            break

    # Try typ, then max, then min columns
    for priority in ["typ", "max", "nom", "min"]:
        for i, col in enumerate(cols):
            if priority in col:
                val_str = str(row.iloc[i]).strip()
                # Remove non-numeric characters except decimal point and minus
                val_str = re.sub(r"[^\d.\-]", "", val_str)
                if val_str:
                    try:
                        value = float(val_str)
                        if value > 0:
                            return int(value * unit_multiplier)
                    except ValueError:
                        pass

    return None


# ---------------------------------------------------------------------------
# Peripheral extraction
# ---------------------------------------------------------------------------


def _extract_peripheral_groups(
    tables: list[Any],
    markdown: str,
    pins: list[Pin],
) -> list[PeripheralGroup]:
    """Extract peripheral groups from feature/summary tables and pin data.

    Strategy:
    1. Look for feature summary tables listing peripheral modules and counts
    2. Parse markdown text for peripheral mentions with counts
    3. Fall back to counting unique peripheral references in pin functions
    """
    peripheral_counts: dict[str, int] = {}

    # 1. Search tables for peripheral feature lists
    for df in tables:
        _extract_peripherals_from_table(df, peripheral_counts)

    # 2. Search markdown for peripheral counts
    _extract_peripherals_from_text(markdown, peripheral_counts)

    # 3. Augment with pin-function analysis
    _extract_peripherals_from_pins(pins, peripheral_counts)

    # Build PeripheralGroup objects organized by category
    categories: dict[str, list[Peripheral]] = {
        "Analog": [],
        "Connectivity": [],
        "Timers": [],
        "System": [],
    }

    # Collect pin names per peripheral type
    periph_pin_names: dict[str, set[str]] = {}
    for pin in pins:
        for fn in pin.functions:
            if fn.peripheral not in ("Power", "Other", "GPIO"):
                if fn.peripheral not in periph_pin_names:
                    periph_pin_names[fn.peripheral] = set()
                periph_pin_names[fn.peripheral].add(pin.name)

    for periph_type, count in sorted(peripheral_counts.items()):
        if count <= 0:
            continue

        pin_names = sorted(periph_pin_names.get(periph_type, []))
        periph = Peripheral(
            name=periph_type,
            type=periph_type,
            enabled=False,
            instances=count,
            pins=pin_names,
            params=_default_params(periph_type),
        )

        if periph_type in ("ADC", "DAC", "CMPSS"):
            categories["Analog"].append(periph)
        elif periph_type in ("SCI", "SPI", "I2C", "CAN", "MCAN", "LIN", "FSI", "EMIF", "MCBSP", "USB", "ENET"):
            categories["Connectivity"].append(periph)
        elif periph_type in ("EPWM", "EQEP", "ECAP", "SD", "CLB"):
            categories["Timers"].append(periph)
        else:
            categories["System"].append(periph)

    return [
        PeripheralGroup(category=cat, peripherals=periphs)
        for cat, periphs in categories.items()
        if periphs
    ]


def _extract_peripherals_from_table(df: Any, counts: dict[str, int]) -> None:
    """Look for feature/peripheral summary tables and extract counts."""
    cols = [str(c).strip().lower() for c in df.columns]

    # Feature tables often have columns like "Feature", "Count" / "Number" / "Qty"
    # or just list features in rows with numbers
    for _, row in df.iterrows():
        row_text = " ".join(str(v) for v in row.values)
        row_lower = row_text.lower()

        # Look for patterns like "16 ePWM modules" or "ePWM x 16"
        for periph_type, pattern in _PERIPHERAL_PATTERNS.items():
            if re.search(pattern, row_text, re.IGNORECASE):
                # Try to find a count in the same row
                count = _extract_count_from_text(row_text, periph_type)
                if count and count > counts.get(periph_type, 0):
                    counts[periph_type] = count


def _extract_peripherals_from_text(markdown: str, counts: dict[str, int]) -> None:
    """Search markdown for peripheral module counts.

    Looks for patterns like:
    - "16 ePWM channels"
    - "Four ADC modules"
    - "SCI/UART x 4"
    - "Up to 16 PWM"
    """
    # Word-to-number mapping
    word_numbers: dict[str, int] = {
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
        "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
        "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
        "nineteen": 19, "twenty": 20, "twenty-four": 24, "thirty-two": 32,
    }

    peripheral_search_patterns: list[tuple[str, str]] = [
        ("EPWM", r"(?:(\d+)|({words}))\s*(?:enhanced\s*)?(?:e?PWM|EPWM)\s*(?:module|channel|output)s?"),
        ("ADC", r"(?:(\d+)|({words}))\s*(?:ADC|analog.to.digital)\s*(?:module|converter|channel)s?"),
        ("DAC", r"(?:(\d+)|({words}))\s*(?:DAC|digital.to.analog)\s*(?:module|converter|output)s?"),
        ("CMPSS", r"(?:(\d+)|({words}))\s*(?:CMPSS|comparator)\s*(?:module|subsystem)s?"),
        ("ECAP", r"(?:(\d+)|({words}))\s*(?:eCAP|ECAP)\s*(?:module|channel)s?"),
        ("EQEP", r"(?:(\d+)|({words}))\s*(?:eQEP|EQEP)\s*(?:module|channel)s?"),
        ("SCI", r"(?:(\d+)|({words}))\s*(?:SCI|UART)\s*(?:module|channel|port)s?"),
        ("SPI", r"(?:(\d+)|({words}))\s*(?:SPI)\s*(?:module|channel|port)s?"),
        ("I2C", r"(?:(\d+)|({words}))\s*(?:I2C)\s*(?:module|channel|port)s?"),
        ("CAN", r"(?:(\d+)|({words}))\s*(?:DCAN|CAN\s*2\.0)\s*(?:module|channel|port)s?"),
        ("MCAN", r"(?:(\d+)|({words}))\s*(?:MCAN|CAN.FD)\s*(?:module|channel|port)s?"),
        ("FSI", r"(?:(\d+)|({words}))\s*(?:FSI)\s*(?:module|channel|port)s?"),
        ("LIN", r"(?:(\d+)|({words}))\s*(?:LIN)\s*(?:module|channel|port)s?"),
        ("SD", r"(?:(\d+)|({words}))\s*(?:SDFM|sigma.delta)\s*(?:module|filter)s?"),
        ("CLB", r"(?:(\d+)|({words}))\s*(?:CLB|configurable\s*logic\s*block)\s*(?:module|tile)s?"),
        ("USB", r"(?:(\d+)|({words}))\s*(?:USB)\s*(?:module|port|controller)s?"),
        ("EMIF", r"(?:(\d+)|({words}))\s*(?:EMIF|external\s*memory)\s*(?:module|interface)s?"),
    ]

    words_pattern = "|".join(word_numbers.keys())

    for periph_type, pat in peripheral_search_patterns:
        full_pattern = pat.format(words=words_pattern)
        matches = re.findall(full_pattern, markdown, re.IGNORECASE)
        for match in matches:
            num_str, word_str = match[0], match[1]
            if num_str:
                count = int(num_str)
            elif word_str:
                count = word_numbers.get(word_str.lower(), 0)
            else:
                continue
            if count > counts.get(periph_type, 0):
                counts[periph_type] = count

    # Also search for "N-channel" or "Nx" patterns like "16-channel ePWM"
    alt_patterns = [
        (r"(\d+)\s*[-x×]\s*(?:channel|module|ch)\s+(?:e?PWM|EPWM)", "EPWM"),
        (r"(\d+)\s*[-x×]\s*(?:bit|channel|module)\s+(?:ADC)", "ADC"),
        (r"(?:e?PWM|EPWM)\s*(?:module|channel)s?\s*[:=x×]\s*(\d+)", "EPWM"),
        (r"(?:ADC)\s*(?:module|channel)s?\s*[:=x×]\s*(\d+)", "ADC"),
    ]
    for pat, periph_type in alt_patterns:
        match = re.search(pat, markdown, re.IGNORECASE)
        if match:
            count = int(match.group(1))
            if count > counts.get(periph_type, 0):
                counts[periph_type] = count


def _extract_peripherals_from_pins(pins: list[Pin], counts: dict[str, int]) -> None:
    """Count peripheral instances from pin function data (fallback/augmentation)."""
    # Track unique instance numbers for each peripheral type
    periph_instances: dict[str, set[str]] = {}

    for pin in pins:
        for fn in pin.functions:
            if fn.peripheral in ("Power", "Other", "GPIO"):
                continue
            ptype = fn.peripheral
            if ptype not in periph_instances:
                periph_instances[ptype] = set()

            # Try to extract instance number from function name
            # e.g., "SCIA" -> instance A, "SPI3" -> instance 3, "EPWM1A" -> instance 1
            name = fn.name.upper()
            inst_match = re.search(r"(\d+)", name)
            if inst_match:
                periph_instances[ptype].add(inst_match.group(1))
            else:
                # Letter suffix (e.g., SCIA, SCIB)
                letter_match = re.search(r"([A-D])$", name)
                if letter_match:
                    periph_instances[ptype].add(letter_match.group(1))
                else:
                    periph_instances[ptype].add("default")

    # Use pin-derived counts only if we don't already have a count from tables/text
    for ptype, instances in periph_instances.items():
        instance_count = len(instances)
        # For peripherals with A/B outputs (like EPWM), divide by 2
        if ptype == "EPWM" and instance_count > 1:
            # EPWM has A and B channels per module; instance numbers are what matters
            numeric_instances = {i for i in instances if i.isdigit()}
            if numeric_instances:
                instance_count = len(numeric_instances)

        if ptype not in counts or counts[ptype] == 0:
            counts[ptype] = max(1, instance_count)


def _extract_count_from_text(text: str, periph_type: str) -> int | None:
    """Extract a numeric count from text associated with a peripheral type."""
    # Look for plain numbers
    numbers = re.findall(r"\b(\d+)\b", text)
    for num_str in numbers:
        num = int(num_str)
        # Reasonable peripheral count range (filter out years, pin numbers, etc.)
        if 1 <= num <= 64:
            return num
    return None


# ---------------------------------------------------------------------------
# Resource counting
# ---------------------------------------------------------------------------


def _build_resources(
    pins: list[Pin],
    peripheral_groups: list[PeripheralGroup],
) -> dict[str, ResourceCount]:
    """Build resource summary from pins and peripheral groups."""
    resources: dict[str, ResourceCount] = {}

    # GPIO count from IO pins
    gpio_count = sum(1 for p in pins if p.type == "io")
    if gpio_count > 0:
        resources["GPIO"] = ResourceCount(used=0, total=gpio_count)

    # ADC channels from analog pins
    adc_count = sum(1 for p in pins if p.type == "analog")
    if adc_count > 0:
        resources["ADC Channels"] = ResourceCount(used=0, total=adc_count)

    # Peripheral instances from groups
    for group in peripheral_groups:
        for periph in group.peripherals:
            resources[periph.name] = ResourceCount(used=0, total=periph.instances)

    return resources


# ---------------------------------------------------------------------------
# Description extraction
# ---------------------------------------------------------------------------


def _extract_description(markdown: str, device_name: str, file_path: Path) -> str:
    """Extract a short device description from the PDF markdown text."""
    # Look for description near the device name at the beginning of the document
    # TI datasheets usually have a one-line description near the title
    lines = markdown.split("\n")

    # Search first 100 lines for a description-like line
    for line in lines[:100]:
        line = line.strip()
        # Skip empty, very short, or header-only lines
        if len(line) < 20 or line.startswith("#"):
            continue
        # Look for lines that describe the device
        lower = line.lower()
        if any(kw in lower for kw in ["mcu", "microcontroller", "processor", "dual-core", "single-core",
                                       "c2000", "c28x", "dsp", "real-time"]):
            # Clean up markdown formatting
            desc = re.sub(r"[*_#\[\]]", "", line).strip()
            if len(desc) < 300:
                return desc

    return f"Extracted from {file_path.name}"


# ---------------------------------------------------------------------------
# Default peripheral parameters (shared with excel_extractor pattern)
# ---------------------------------------------------------------------------


def _default_params(periph_type: str) -> list[PeripheralParam]:
    """Generate default configuration parameters for common peripheral types."""
    if periph_type == "ADC":
        return [
            PeripheralParam(name="resolution", label="Resolution", options=["12-bit", "16-bit"], default="12-bit"),
            PeripheralParam(name="prescaler", label="Clock Prescaler", options=[1, 2, 4, 8], default=4),
            PeripheralParam(name="sampling_time", label="Sampling Time", min=1, max=256, default=16, unit="cycles"),
            PeripheralParam(name="continuous", label="Continuous Mode", default=False),
        ]
    if periph_type == "SCI":
        return [
            PeripheralParam(name="baud_rate", label="Baud Rate", options=[9600, 19200, 38400, 57600, 115200, 230400, 460800], default=115200, unit="bps"),
            PeripheralParam(name="data_bits", label="Data Bits", options=[7, 8], default=8),
            PeripheralParam(name="parity", label="Parity", options=["None", "Even", "Odd"], default="None"),
            PeripheralParam(name="stop_bits", label="Stop Bits", options=[1, 2], default=1),
        ]
    if periph_type == "SPI":
        return [
            PeripheralParam(name="mode", label="SPI Mode", options=["Mode 0", "Mode 1", "Mode 2", "Mode 3"], default="Mode 0"),
            PeripheralParam(name="clock_speed", label="Clock Speed", min=1000, max=50_000_000, default=1_000_000, unit="Hz"),
            PeripheralParam(name="data_size", label="Data Size", options=[8, 16], default=16, unit="bits"),
            PeripheralParam(name="bit_order", label="Bit Order", options=["MSB First", "LSB First"], default="MSB First"),
        ]
    if periph_type == "I2C":
        return [
            PeripheralParam(name="speed_mode", label="Speed Mode", options=["Standard (100kHz)", "Fast (400kHz)", "Fast Plus (1MHz)"], default="Standard (100kHz)"),
            PeripheralParam(name="own_address", label="Own Address", min=0, max=127, default=0),
            PeripheralParam(name="address_mode", label="Address Mode", options=["7-bit", "10-bit"], default="7-bit"),
        ]
    if periph_type == "CAN" or periph_type == "MCAN":
        return [
            PeripheralParam(name="bit_rate", label="Bit Rate", options=[125000, 250000, 500000, 1000000], default=500000, unit="bps"),
            PeripheralParam(name="mode", label="Mode", options=["Normal", "Loopback", "Silent"], default="Normal"),
            PeripheralParam(name="fd_enable", label="CAN FD Enable", default=periph_type == "MCAN"),
        ]
    if periph_type == "EPWM":
        return [
            PeripheralParam(name="frequency", label="PWM Frequency", min=1, max=200_000, default=20_000, unit="Hz"),
            PeripheralParam(name="duty_cycle", label="Duty Cycle", min=0, max=100, default=50, unit="%"),
            PeripheralParam(name="dead_band", label="Dead Band", min=0, max=1000, default=0, unit="ns"),
            PeripheralParam(name="count_mode", label="Count Mode", options=["Up", "Down", "Up-Down"], default="Up"),
        ]
    if periph_type == "EQEP":
        return [
            PeripheralParam(name="mode", label="Operating Mode", options=["Quadrature", "Direction Count", "Clock/Direction"], default="Quadrature"),
            PeripheralParam(name="max_count", label="Maximum Count", min=0, max=4294967295, default=65535),
        ]
    if periph_type == "DAC":
        return [
            PeripheralParam(name="resolution", label="Resolution", options=["12-bit"], default="12-bit"),
            PeripheralParam(name="reference", label="Voltage Reference", options=["VDAC", "VREF"], default="VDAC"),
        ]
    if periph_type == "CMPSS":
        return [
            PeripheralParam(name="high_comparator", label="High Comparator Enable", default=True),
            PeripheralParam(name="low_comparator", label="Low Comparator Enable", default=True),
        ]
    if periph_type == "FSI":
        return [
            PeripheralParam(name="data_width", label="Data Width", options=["1-lane", "2-lane"], default="1-lane"),
            PeripheralParam(name="clock_speed", label="Clock Speed", min=1000, max=200_000_000, default=50_000_000, unit="Hz"),
        ]
    if periph_type == "SD":
        return [
            PeripheralParam(name="data_rate", label="Data Rate", options=["Single", "Double"], default="Single"),
            PeripheralParam(name="filter_type", label="Filter Type", options=["Sinc1", "Sinc2", "Sinc3", "SincFast"], default="Sinc3"),
        ]
    return []


# ---------------------------------------------------------------------------
# Filename-based device inference (preserved from original)
# ---------------------------------------------------------------------------


def _infer_device_from_filename(file_path: Path) -> str:
    """Infer device name from PDF filename."""
    name = file_path.stem.upper()
    match = re.search(r"TMS320F\d{4,5}\w*", name)
    if match:
        return match.group()
    match = re.search(r"F\d{4,5}\w*", name)
    if match:
        return f"TMS320{match.group()}"
    return name
