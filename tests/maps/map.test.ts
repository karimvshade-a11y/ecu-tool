// tests/maps/map.test.ts
import { describe, it, expect } from 'vitest';
import { XdfLoader } from '../../src/XdfLoader';
import * as fs from 'fs';
import * as path from 'path';

// A minimal valid XDF string that matches the expected root element
const validXdf = `<?xml version="1.0"?>
<XDFFORMAT version="1.70">
  <XDFHEADER>
    <flags>0</flags>
    <BASEOFFSET offset="0" />
  </XDFHEADER>
  <XDFTABLE uniqueid="0x1234">
    <title>Test Map</title>
    <description>2x2 test</description>
    <XDFAXIS id="x" uniqueid="0x1235">
      <EMBEDDEDDATA mmedaddress="0" mmedelementsizebits="16" />
      <indexcount>2</indexcount>
      <MATH equation="X" />
    </XDFAXIS>
    <XDFAXIS id="y" uniqueid="0x1236">
      <EMBEDDEDDATA mmedaddress="4" mmedelementsizebits="16" />
      <indexcount>2</indexcount>
      <MATH equation="X" />
    </XDFAXIS>
    <XDFAXIS id="z" uniqueid="0x1237">
      <EMBEDDEDDATA mmedaddress="8" mmedelementsizebits="16" mmedcolcount="2" mmedrowcount="2" />
      <MATH equation="X" />
    </XDFAXIS>
  </XDFTABLE>
</XDFFORMAT>`;

describe('XDF parsing', () => {
  it('parses a valid XDF string and returns table definitions', async () => {
    // Write the valid XDF to a temp file
    const tempFile = path.join(__dirname, 'temp_valid.xdf');
    fs.writeFileSync(tempFile, validXdf, 'utf8');

    try {
      const loader = new XdfLoader();
      const tables = await loader.loadXdf(tempFile);

      expect(Array.isArray(tables)).toBe(true);
      expect(tables.length).toBe(1);
      expect(tables[0].name).toBe('Test Map');
      expect(tables[0].rows).toBe(2);
      expect(tables[0].cols).toBe(2);
      expect(tables[0].address).toBe(8); // baseOffset 0 + z-axis address 0x8
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });

  it('loads sample.xdf (known to have a different root) but gracefully fails', async () => {
    // This demonstrates that the current sample.xdf is not parseable by loadXdf.
    // We can keep this test as documentation – when you update sample.xdf to a
    // real XDF, this test can then check the table count.
    const loader = new XdfLoader();
    await expect(loader.loadXdf('sample.xdf')).rejects.toThrow();
  });
});