# MCU Dashboard - Project Rules

## Project Overview
Web-based MCU configuration and visualization tool (pinout, clock tree, peripherals, dashboard).
Manufacturer-agnostic. Static frontend with Python data extraction pipeline.

## Architecture
- `frontend/` - React 19 + TypeScript + Vite 6 + Tailwind CSS 4
- `extractor/` - Python CLI using Docling + Pandas for data extraction
- `.claude/skills/mcu-extract/` - Claude skill for interactive extraction
- `docs/` - Implementation tracker and schema documentation

## Frontend Conventions
- React functional components with TypeScript (strict mode)
- Zustand for state management (stores in `src/store/`)
- Tailwind CSS with custom dark theme (editor-bg: #0f172a, panel-bg: #1e293b)
- SVG-first approach for chip visualization (no canvas)
- File naming: PascalCase for components, camelCase for utilities
- All types in `src/types/` directory

## Python Conventions
- Python 3.12+ with type hints
- Pydantic for data models
- uv for dependency management
- CLI entry point: `extractor/src/cli.py`
- Tests in `extractor/tests/`

## Data Flow
1. Manufacturer files (PDF/Excel) → Python extractor → device JSON
2. Device JSON → frontend `src/data/` → React app renders views

## Key Commands
- Frontend dev: `cd frontend && npm run dev`
- Frontend build: `cd frontend && npm run build`
- Extract Excel: `cd extractor && uv run python src/cli.py excel --input <file> --output <json>`
- Extract PDF: `cd extractor && uv run python src/cli.py pdf --input <file> --output <json>`

## Test Data
- TI ControlCard pinout: `Texas_Instruments/ControlCard_pinout/`
- TI Datasheet: `Texas_Instruments/Datasheets/tms320f28388d_rev.pdf`
