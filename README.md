
# ecu-tool

A professional‑grade command‑line tool for inspecting, editing, and
**safely flashing** **Siemens MS43** ECU calibration binaries. It parses
TunerPro‑style XDF map definitions, reads / edits / diffs maps, and
automatically recomputes both required checksums so every saved file is
**ready to flash**.

> ⚠️ **SAFETY FIRST** – Even with correct checksums, a bad tune can damage an
> engine. Always bench‑test on a spare ECU before flashing to a real vehicle.
> The checksums have been verified on a limited set of files; use with caution.

---

## ✨ What it does

- **XDF parsing** – loads a full MS43 XDF (1 447 maps), resolves addresses,
  dimensions, equations, and output types.
- **Map reading** – reads raw binary data, converts to **engineering units**
  (e.g. `0.25*X` → real idle speed), with signed‑type support.
- **Editing** – change any cell **by row/col**; writes a `.modified` copy
  (never touches the original).
- **Automatic checksum correction** – on every edit, the tool recomputes
  **both** MS43 checksums and saves a `.modified.fixed` file.
- **Diffing** – compare two binaries (stock vs. tuned) map‑by‑map, seeing
  every changed cell in engineering units. Great for reverse‑engineering tunes.
- **Export** – write any map to CSV (engineering values).

---

## 🔧 Tech stack

| Concern | Choice |
|---|---|
| Language | TypeScript (strict) |
| Runtime | Node.js |
| CLI framework | [`commander`](https://www.npmjs.com/package/commander) |
| XDF parsing | [`xml2js`](https://www.npmjs.com/package/xml2js) |
| Math | [`expr-eval`](https://www.npmjs.com/package/expr-eval) |
| CRC | [`crc`](https://www.npmjs.com/package/crc) + custom CRC16 for init value |
| Module system | CommonJS (Node10 resolution) |

---

## 📁 Project structure

```
ecu-tool/
├── bin/
│   └── ecu-tool.js            # global launcher (optional)
├── src/                       # TypeScript source
│   ├── checksums/
│   │   ├── index.ts           # plugin registry
│   │   ├── ms43.ts            # MS43 checksum plugin (validated on stock file)
│   │   └── types.ts
│   ├── cli.ts                 # commander CLI
│   ├── tuningTool.ts          # list/read/edit/export
│   ├── diff.ts                # binary diff
│   ├── checksum.ts            # checksum runner
│   ├── XdfLoader.ts           # XDF parser
│   ├── BinaryReader.ts        # byte → number engine
│   └── mathEvaluator.ts       # equation evaluator
├── dist/                      # compiled JavaScript (after `npm run build`)
├── data/                      # XDF definition + sample binaries
├── discover-checksum.ts       # brute‑force checksum discovery script
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🚀 Installation & usage

### 1. Install dependencies

```bash
npm install
```

### 2. Compile TypeScript

```bash
npx tsc
# or: npm run build
```

All compiled JavaScript goes into the `dist/` folder – your `src/` stays clean.

### 3. Run a command

```bash
node dist/cli.js <command> [options]
```

**Available commands:**

| Command | Description |
|---|---|
| `list [term]` | List all maps (optional name filter) |
| `read <map>` | Print a map as a table (raw + engineering) |
| `edit <map> <row> <col> <value>` | Edit a raw cell and auto‑fix checksums |
| `export <map> [-o file.csv]` | Export engineering values to CSV |
| `diff <file1> <file2>` | Compare two binaries map‑by‑map |
| `checksum <file>` | Manually recompute checksums → `.fixed` |

Global options: `-x, --xdf <path>` and `-b, --bin <path>` to override the
default data files.

### 4. (Optional) Create a global command

```bash
npm link
ecu-tool list
```

---

> ⚠️ **Reminder** – Even if the checksum is correct, **always bench‑test**
> before flashing to a real ECU. The checksum algorithms have been verified
> on the stock file but not yet with automated tests across many binaries.

---

## ✅ Checksum validation story

The MS43 uses two separate checksums that must be updated after any map edit.
Our original discovery had a bug – two overlapping patches that were
mathematically impossible. After a thorough reverse‑engineering session, we
identified the correct algorithms:

- **Program area** (`0x00000‑0x5FFFF`): CRC16/XMODEM (init `0x0000`).
- **Calibration area** (`0x60000‑0x7FFFD`): a custom CRC16 with polynomial
  `0x1021` and initial value `0xA580`. The program checksum **must** be
  written before computing the calibration checksum because the calibration
  block includes the program checksum storage address.

Both algorithms have been verified on the stock calibration binary
`MS43_WBABW510X0PK46741_430069_512KB.bin` – the computed values match the
stored ones. **This does not yet guarantee correctness for every possible
map edit or edge case.** Treat the output with appropriate caution.

---

## 🧪 Testing status

The core CRC algorithms have been manually checked against a reference
binary. However, the project currently has **no automated test suite**.
Before relying on this tool for critical work, consider adding regression
tests that:
- Lock in the exact checksum values for known binaries.
- Verify map reading, editing, and diff outputs.
- Run on every commit via CI.

This is the top priority for the next release.

---

## 🛣️ Roadmap

Planned features for future releases:

- **Data visualization** – graphical frontend / web dashboard.
- **Datalogging integration** – parse ECU logs and suggest optimal map values.
- **Multi‑ECU support** – the checksum system is pluggable; next ECUs will be
  MS41, MS42, and MS45 (with proper verification against real dumps).
- **Unit tests & CI** – full test suite covering CRC, math, and XDF parsing.

---

## 📜 License

MIT – see [LICENSE](LICENSE) 

---

*Built with care by A.Karim Bouchiba. Contributions welcome.*
```

---

