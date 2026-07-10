# Utility Scripts

These scripts were used during the development and validation of the MS43
checksum algorithm. They are not part of the main tool, but are kept for
reference and reproducibility.

| Script | Purpose |
|--------|---------|
| `brute-force-cal-checksum.ts` | Brute-force search for the calibration checksum algorithm parameters (poly, init). |
| `discover-checksum.ts` | Automatic discovery of checksum location and algorithm. |
| `exhaustive-search.ts` | Exhaustive parameter scan to verify the found checksum algorithm. |
| `find-additive.ts` | Search for an additive constant in the checksum formula. |
| `find-cal-algo.ts` | Find the specific algorithm (poly/init) for the calibration CRC. |
| `find-checksum.ts` | Locate and identify the checksum in a binary. |
| `find-zero-checksum.ts` | Find a binary modification that yields a zero checksum (useful for testing). |
| `verify-cal-checksum.ts` | Verify the calibration checksum on a known binary. |
| `verify-checksum.ts` | General checksum verification script. |
| `verify-final.ts` | Final verification of both checksums before marking the plugin as validated. |
| `test-crc16custom.js` | JavaScript test for the custom CRC16 implementation. |
| `test-ms43-plugin.js` | Manual test of the ms43 checksum plugin (used before the Vitest suite). |

### Note
These scripts were written for one‑off experiments and may not follow the
same code quality standards as the `src/` directory. They are not required
for normal operation of `ecu-tool`.