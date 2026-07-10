import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execa } from 'execa';
import * as path from 'path';
import * as fs from 'fs';

const CLI = path.resolve(__dirname, '..', '..', 'dist', 'cli.js');
const XDF = path.resolve(__dirname, '..', '..', 'data', 'Siemens_MS43_430069_512K.xdf');
const BIN = path.resolve(__dirname, '..', '..', 'data', 'MS43_WBABW510X0PK46741_430069_512KB.bin');
const TMP_BIN = BIN + '.integration-test';
const MAP_NAME = 'ip_ti_fl';

beforeAll(() => {
  if (!fs.existsSync(BIN)) {
    throw new Error(`Test binary not found: ${BIN}`);
  }
  fs.copyFileSync(BIN, TMP_BIN);
});

afterAll(() => {
  if (fs.existsSync(TMP_BIN)) fs.unlinkSync(TMP_BIN);
  // Clean up any generated files
  const files = [
    TMP_BIN + '.modified',
    TMP_BIN + '.fixed',
    BIN + '.modified.fixed',
    path.join(path.dirname(TMP_BIN), 'test-export.csv'),
  ];
  for (const f of files) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

describe('CLI integration: list', () => {
  it('lists all maps', async () => {
    const { stdout } = await execa('node', [CLI, 'list', '--xdf', XDF, '--bin', TMP_BIN]);
    expect(stdout).toContain('Total:');
    const match = stdout.match(/Total: (\d+) maps/);
    expect(match).toBeTruthy();
    const count = parseInt(match![1], 10);
    expect(count).toBeGreaterThan(1000);
  });

  it('filters maps by term', async () => {
    const { stdout } = await execa('node', [CLI, 'list', '--xdf', XDF, '--bin', TMP_BIN, 'ip_']);
    expect(stdout).toContain('Total:');
    const match = stdout.match(/Total: (\d+) maps/);
    expect(match).toBeTruthy();
    const count = parseInt(match![1], 10);
    expect(count).toBeGreaterThan(100);
    expect(count).toBeLessThan(1447);
  });
});

describe('CLI integration: read', () => {
  it('reads a map and shows raw + engineering values', async () => {
    const { stdout } = await execa('node', [CLI, 'read', '--xdf', XDF, '--bin', TMP_BIN, MAP_NAME]);
    expect(stdout).toContain('Map:');
    expect(stdout).toContain('Equation:');
    expect(stdout).toContain('Raw values:');
    expect(stdout).toContain('Engineering values:');
  });
});

describe('CLI integration: edit', () => {
  it('edits a cell and verifies the change', async () => {
    const newValue = 999;
    await execa('node', [CLI, 'edit', '--xdf', XDF, '--bin', TMP_BIN, MAP_NAME, '0', '0', String(newValue)]);

    const modifiedFile = TMP_BIN + '.modified';
    expect(fs.existsSync(modifiedFile)).toBe(true);
    fs.copyFileSync(modifiedFile, TMP_BIN);
    fs.unlinkSync(modifiedFile);

    const { stdout } = await execa('node', [CLI, 'read', '--xdf', XDF, '--bin', TMP_BIN, MAP_NAME]);
    expect(stdout).toContain(String(newValue));
  });
});

describe('CLI integration: export', () => {
  it('exports a map to a CSV file', async () => {
    const csvPath = path.join(path.dirname(TMP_BIN), 'test-export.csv');
    if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);

    await execa('node', [CLI, 'export', '--xdf', XDF, '--bin', TMP_BIN, MAP_NAME, '--output', csvPath]);

    expect(fs.existsSync(csvPath)).toBe(true);
    const content = fs.readFileSync(csvPath, 'utf8').trim();
    expect(content.length).toBeGreaterThan(0);
    expect(content.split('\n').length).toBeGreaterThan(1);

    fs.unlinkSync(csvPath);
  });
});

describe('CLI integration: checksum', () => {
  it('corrects checksums on a modified binary and produces a .fixed file', async () => {
    const { stdout } = await execa('node', [CLI, 'checksum', '--ecu', 'ms43', TMP_BIN]);
    const fixedFile = TMP_BIN + '.fixed';
    expect(fs.existsSync(fixedFile)).toBe(true);

    // Run again on the fixed file — should still produce a .fixed (no-op re-check)
    const { stdout: fixedStdout } = await execa('node', [CLI, 'checksum', '--ecu', 'ms43', fixedFile]);
    expect(fixedStdout).toContain('Saved:');
  });
});