 
# 🏎️ ECU Calibration Tool

> **From script to ecosystem — a professional, test‑driven, universal ECU tuning CLI.**
>
> Built for tuners who demand safety, traceability, and the freedom to work with any ECU.

---

## 🔥 Why This Exists

Most tuning tools are either expensive black boxes or fragile one‑off scripts.  
We set out to build something different: an open, modular, and **safe** calibration workbench that grows with the community.

Every feature is designed with three principles:

- **Traceability** – every change is logged in an immutable audit trail
- **Safety first** – checksums are validated and corrected, never ignored
- **ECU agnostic** – the core knows nothing about your firmware; definitions come from standard XDF files

---

## ✨ Features

| Category | Capabilities |
|----------|--------------|
| 📋 **Map Browser** | List 1,400+ maps, fuzzy search by name |
| 🔍 **Reader** | Raw hex, engineering units, or clean JSON output |
| 🔥 **Heatmaps** | Color‑coded tables (blue → red) for instant visual diagnosis |
| ✏️ **Editor** | Edit single cells, auto‑save modified binary |
| 📝 **Audit Trail** | `.edit-log.json` records every change: old/new values, timestamp, checksum status |
| ↩️ **Undo** | Revert any edit directly from the audit log |
| 🔐 **Checksums** | Validate & correct checksums via pluggable algorithms (MS43 included) |
| 📊 **Diff** | Compare two binaries map‑by‑map, see only changed cells |
| 📤 **Export** | Save any map to CSV for Excel or WinOLS |
| 🧪 **Tested** | 23 unit + integration tests, CI on every push |
| 🌍 **Universal** | Drop in any XDF definition and binary – no code changes needed |

---

## 🚀 Quick Start

```bash
# 1. Install
git clone https://github.com/karimvshade-a11y/ecu-tool.git
cd ecu-tool
npm install

# 2. Build
npx tsc

# 3. Explore an ECU (replace with your own XDF/BIN)
node dist/cli.js -x data/Siemens_MS43_430069_512K.xdf -b data/your_bin.bin list
node dist/cli.js -x data/... -b data/... read ip_ti_fl__n
node dist/cli.js -x data/... -b data/... read ip_ti_fl__n --json
```

---

## 📖 Example Workflow (MS43)

```bash
# Load your ECU binary and XDF
BIN="data/stock.bin"
XDF="data/Siemens_MS43_430069_512K.xdf"

# List all maps
node dist/cli.js -x $XDF -b $BIN list

# Read a map with heatmap
node dist/cli.js -x $XDF -b $BIN read ip_ti_fl__n

# Edit row 3, column 0 with raw value 200, then auto‑fix checksums
node dist/cli.js -x $XDF -b $BIN edit ip_ti_fl__n 3 0 200 --ecu ms43

# See the audit trail
cat data/stock.bin.edit-log.json

# Revert that last change
node dist/cli.js -x $XDF -b $BIN revert ip_ti_fl__n --ecu ms43

# Compare your tuned file against stock
node dist/cli.js diff stock.bin tuned.bin

# Validate checksums on a file
node dist/cli.js validate data/tuned.bin --ecu ms43
```

---

## 🧱 Architecture

The tool is built in distinct layers, each testable and replaceable:

```
┌──────────────────────────────────┐
│            CLI (Commander)       │  ← User interface
├──────────────────────────────────┤
│         tuningTool.ts            │  ← Core logic (map I/O, edit, revert)
├────────────────────┬─────────────┤
│   BinaryReader     │  XdfLoader  │  ← Low‑level binary access & definition parser
├────────────────────┴─────────────┤
│   Checksum Plugins (registry)    │  ← ECU‑specific algorithms, drop‑in modules
└──────────────────────────────────┘
```

- **`tuningTool.ts`** is completely ECU‑agnostic. It never mentions MS43.
- **`XdfLoader.ts`** parses standard TunerPro `.xdf` files – drop in any ECU definition.
- **Checksum plugins** are optional, loaded by name (`--ecu ms43`). Adding a new ECU means writing one plugin file.

This separation means you can tune a Honda KPro, Bosch ME7, or GM LS1 with the same tool — just supply the right XDF and, if needed, a checksum plugin.

---

## 🗺️ Roadmap

| Milestone | Status |
|-----------|--------|
| ✅ Core CLI, map reader, heatmaps | **v0.1 – v0.9** |
| ✅ Edit, audit trail, checksum correction | **v0.9** |
| ✅ Revert (undo), diff, JSON output, universal XDF | **v1.0.0** 🎉 |
| ⬜ A2L parser (industry‑standard definitions) | **v1.1** |
| ⬜ Interactive TUI (arrow‑key navigation, live heatmaps) | **v1.2** |
| ⬜ npm package (`npx ecu-tool`) | **v1.3** |
| ⬜ Community plugin marketplace | **v2.0** |

---

## 🤝 Contributing

This tool is built for the community. To add support for a new ECU:

1. Drop its `.xdf` definition file into `data/`
2. (Optional) Write a checksum plugin in `src/checksums/` and register it
3. Test with the existing suite, send a PR

See `src/plugins/ms43_2sum.ts` and `ms43_5sum.ts` for example checksum plugins.

---

## 🧪 Development

```bash
# Run all tests
npx vitest run

# Watch mode
npx vitest

# Build
npx tsc
```

CI runs automatically on every push via GitHub Actions.

---

## 📄 License

MIT – use it, modify it, tune with it. Just keep the audit trail clean. 😉

---

<p align="center">
  <b>Built with care for the tuning community.</b><br>
  <i>“Trust the log. Trust the checksum. Trust the tool.”</i>
</p>
```

 