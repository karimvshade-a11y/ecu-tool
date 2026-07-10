 
# ECU Calibration Tool

A professional-grade, test‑driven ECU tuning CLI for Siemens MS43 (extensible to any ECU via XDF definitions).

## Features

- 📋 **Map listing** — 1,400+ maps with fuzzy search
- 🔍 **Read maps** — raw hex, engineering units, or JSON
- 🔥 **ASCII heatmaps** — instant visual diagnosis (hot/cold colors)
- ✏️ **Cell editing** — modify single cells, automatic checksum correction
- 📝 **Audit trail** — `.edit-log.json` records every change (old value, new value, timestamp)
- ↩️ **Undo (revert)** — roll back any edit from the audit log
- ✅ **Checksum validation & correction** — plugin‑based (MS43 2‑sum, 5‑sum)
- 📊 **Diff two binaries** — map‑by‑map comparison (raw + engineering)
- 📤 **Export to CSV** — engineering values ready for Excel/WinOLS
- 🧪 **23 tests, CI‑ready** — unit + integration, runs on every push

## Quick Start

```bash
# Install
npm install

# Build
npx tsc

# List all maps
node dist/cli.js list

# Search for a map
node dist/cli.js list ip_ti

# Read a map (raw + engineering) with heatmap
node dist/cli.js read ip_ti_fl__n

# Read as JSON (machine‑readable)
node dist/cli.js read ip_ti_fl__n --json

# Edit a cell (row 0, col 0) with raw value 500
node dist/cli.js edit ip_ti_fl__n 0 0 500

# Revert the last edit
node dist/cli.js revert ip_ti_fl__n

# Validate checksums on a file
node dist/cli.js validate data/my_bin.bin

# Fix checksums (writes .fixed file)
node dist/cli.js checksum data/my_bin.bin

# Compare two binaries (map‑by‑map)
node dist/cli.js diff stock.bin tuned.bin

# Export a map to CSV
node dist/cli.js export ip_ti_fl__n -o my_map.csv
```

## Project Structure

```
ecu-tool/
├── src/
│   ├── cli.ts              # Commander‑based CLI
│   ├── tuningTool.ts        # Core business logic
│   ├── BinaryReader.ts      # Buffer reader with signed/unsigned support
│   ├── XdfLoader.ts         # XDF definition parser
│   ├── checksum.ts          # Checksum runner
│   ├── diff.ts              # Map‑by‑map diff engine
│   └── checksums/           # Plugin registry
│       ├── registry.ts
│       └── plugins/ms43_*.ts
├── tests/                   # Vitest (unit + integration)
├── data/                    # XDF + binary (not public)
└── .github/workflows/       # CI (runs on push)
```

## Audit Trail & Safety

Every edit is logged in `<binary>.edit-log.json` with:
- map name, address, row, col
- old and new raw values
- ISO timestamp
- checksum status (corrected/failed)

Use `revert <mapName>` to undo the latest edit, or `revert <mapName> --entry <index>` for a specific one.

## Extending to Other ECUs

The tool uses an XDF definition file (TunerPro format). To support a new ECU, simply provide its XDF and binary. The core engine is ECU‑agnostic — only checksum plugins are MS43‑specific (easily replaceable via the plugin registry).

## Development

```bash
# Run all tests
npx vitest run

# Watch mode
npx vitest

# Build
npx tsc
```

CI runs on every push via GitHub Actions (see `.github/workflows/test.yml`).

## License

MIT
```

 