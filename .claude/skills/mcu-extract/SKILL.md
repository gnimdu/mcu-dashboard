---
name: mcu-extract
description: Guided MCU data extraction from manufacturer datasheets (PDF/Excel) into device JSON for the MCU Dashboard
triggers:
  - extract MCU data
  - parse datasheet
  - create device JSON
  - extract pinout
  - extract clock tree
---

# MCU Data Extraction Skill

You are an expert MCU data extraction assistant. You help users extract pin mapping, clock tree, and peripheral configuration data from manufacturer datasheets (PDF and Excel files) into the standardized device JSON format used by the MCU Dashboard.

## Workflow

### Step 1: Identify Source Files
Ask the user which MCU they want to extract data for and what source files they have:
- **Excel pinout file** (e.g., TI ControlCard pinout spreadsheet)
- **PDF datasheet** (e.g., TMS320F28388D datasheet)
- **Both** (recommended for most complete extraction)

Check for files in the `Texas_Instruments/` directory or ask the user to provide paths.

### Step 2: Run the Extractor CLI
Use the Python extractor CLI to process the files:

```bash
# Excel only
cd extractor && uv run python src/cli.py excel --input <excel_file> --output <output.json>

# PDF only
cd extractor && uv run python src/cli.py pdf --input <pdf_file> --output <output.json>

# Merge both (recommended)
cd extractor && uv run python src/cli.py merge --excel <excel_file> --pdf <pdf_file> --output <output.json>
```

### Step 3: Validate the Output
After extraction, validate the output JSON:
1. Read the generated JSON file
2. Check that it has the required top-level fields: `device`, `packages`, `clock`, `peripherals`, `resources`
3. Verify pin counts match expectations
4. Check clock tree has valid frequencies
5. Ensure peripheral groups are properly categorized

### Step 4: Review and Fix
If the extraction has issues:
- **Missing pins**: Check the source file format and column layout
- **Wrong pin types**: Adjust classification logic in the extractor
- **Missing clock data**: PDF extraction may need manual clock tree entry
- **Missing peripherals**: Check peripheral pattern matching

### Step 5: Deploy to Frontend
Copy the validated JSON to the frontend data directory:
```bash
cp <output.json> frontend/src/data/
```

Then update `frontend/src/App.tsx` to import and use the new device data, or instruct the user to use the file upload feature.

## Device JSON Schema

The output must conform to this schema:

```json
{
  "device": {
    "name": "TMS320F28388D",
    "manufacturer": "Texas Instruments",
    "family": "C2000",
    "description": "Dual-core 32-bit MCU...",
    "datasheet_url": "https://..."
  },
  "packages": [{
    "name": "176-pin BGA",
    "type": "bga",
    "pin_count": 176,
    "pins": [{
      "id": "A1",
      "name": "GPIO-00",
      "position": { "row": "A", "col": 1 },
      "type": "io",
      "functions": [
        { "name": "GPIO-00", "peripheral": "GPIO" },
        { "name": "EPWM1A", "peripheral": "EPWM", "mux_mode": 1 }
      ]
    }]
  }],
  "clock": {
    "sources": [
      { "id": "intosc1", "name": "INTOSC1", "frequency": 10000000, "type": "internal" }
    ],
    "plls": [
      { "id": "syspll", "name": "SYSPLL", "source": "xtal", "input_div": 1, "multiplier": 20, "output_div": 2 }
    ],
    "buses": [
      { "id": "sysclk", "name": "SYSCLK", "source": "syspll", "divider": 1, "frequency": 200000000 }
    ]
  },
  "peripherals": [{
    "category": "Analog",
    "peripherals": [{ "name": "ADC", "type": "ADC", "instances": 4, "pins": [...] }]
  }],
  "resources": {
    "GPIO": { "used": 0, "total": 169 },
    "EPWM": { "used": 0, "total": 16 }
  }
}
```

## Supported Manufacturers
- **Texas Instruments** (C2000 family): ControlCard Excel pinouts + PDF datasheets
- Other manufacturers can be added by extending the extractor

## Tips
- For TI ControlCard Excel files, the extractor handles the dual-column layout automatically
- PDF extraction quality depends on table detection - results should always be manually reviewed
- The `merge` command combines Excel pin data with PDF clock/peripheral data for the most complete result
- Frequencies are always in Hz (integers)
- Pin types: `io`, `analog`, `power`, `ground`, `clock`, `special`
- Package types: `bga`, `qfp`, `lqfp`, `controlcard`, `launchpad`
