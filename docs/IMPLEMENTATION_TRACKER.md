# MCU Dashboard - Implementation Tracker

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Completed

---

## Phase 0: Project Setup
- [~] Create GitHub repo (`gnimdu/mcu-dashboard`)
- [~] Initialize React + TypeScript + Vite frontend
- [ ] Configure Tailwind CSS 4 dark theme
- [ ] Initialize Python extractor with uv
- [~] Create CLAUDE.md, .gitignore
- [ ] Initial commit

## Phase 1: Data Extraction Pipeline
- [ ] Excel extractor (port from antigravity)
- [ ] Pydantic data models (schema.py)
- [ ] PDF extractor (Docling integration)
- [ ] CLI interface (cli.py)
- [ ] Test with TI ControlCard data

## Phase 2: Frontend Shell & Navigation
- [ ] Header component with nav tabs
- [ ] Sidebar component
- [ ] StatusBar component
- [ ] Tab routing (Dashboard/Pinout/Clock/Peripherals)
- [ ] Zustand stores (device, pin, clock, peripheral)
- [ ] Device JSON loading

## Phase 3: Dashboard View
- [ ] Device overview card
- [ ] Key metrics row (clock, flash, RAM)
- [ ] Resource allocation progress bars
- [ ] Configuration summary

## Phase 4: Pinout View (Core)
- [ ] Chip SVG component (QFP/BGA/ControlCard)
- [ ] Pin color coding (assigned/unassigned/power/conflict)
- [ ] Pin configuration panel
- [ ] Peripheral sidebar with usage counts
- [ ] Pin assignment logic + conflict detection
- [ ] Zoom/pan controls

## Phase 5: Clock Configuration View
- [ ] Oscillator nodes (HSI/HSE)
- [ ] PLL node with M/N/P/Q dividers
- [ ] Mux and prescaler nodes
- [ ] SVG connectors with animation
- [ ] Clock summary panel
- [ ] Frequency propagation logic

## Phase 6: Peripheral Manager View
- [ ] Peripheral tree sidebar
- [ ] Dynamic configuration forms
- [ ] Parameter Settings tab
- [ ] Per-peripheral panels (ADC, UART, SPI, etc.)

## Phase 7: Export & Reports
- [ ] PDF report generation
- [ ] Excel export
- [ ] JSON import/export

## Phase 8: Claude Skill
- [ ] SKILL.md with frontmatter
- [ ] Extraction scripts
- [ ] Eval test cases
- [ ] Skill validation

## Phase 9: Polish & Testing
- [ ] Responsive layout
- [ ] Error boundaries
- [ ] Performance optimization
- [ ] README documentation

---

## Notes
- Started: 2026-03-13
- Frontend: React 19 + TypeScript + Vite 6 + Tailwind CSS 4
- Backend: Python 3.13 + Docling + Pandas
- Test MCU: TI TMS320F28388D (ControlCard + datasheet)
