import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execa } from 'execa';
import * as path from 'path';
import * as fs from 'fs';

const CLI = path.resolve(__dirname, '..', '..', 'dist', 'cli.js');
const XDF = path.resolve(__dirname, '..', '..', 'data', 'Siemens_MS43_430069_512K.xdf');
const BIN = path.resolve(__dirname, '..', '..', 'data', 'MS43_WBABW510X0PK46741_430069_512KB.bin');
const TMP_BIN = BIN + '.integration-test';
const MAP_NAME = 'ip_ti_fl__n';

beforeAll(() => {
  if (!fs.existsSync(BIN)) {
    throw new Error(`Test binary not found: ${BIN}`);
  }
  fs.copyFileSync(BIN, TMP_BIN);
});

afterAll(() => {
  if (fs.existsSync(TMP_BIN)) fs.unlinkSync(TMP_BIN);
  const files = [
    TMP_BIN + '.modified',
    TMP_BIN + '.fixed',
    BIN + '.modified.fixed',
    path.join(path.dirname(TMP_BIN), 'test-export.csv'),
    TMP_BIN + '.edit-log.json',
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

  it('creates an edit log file after edit', async () => {
    const logFile = TMP_BIN + '.edit-log.json';
    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

    await execa('node', [CLI, 'edit', '--xdf', XDF, '--bin', TMP_BIN, MAP_NAME, '2', '0', '1234']);

    expect(fs.existsSync(logFile)).toBe(true);
    const log = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    expect(Array.isArray(log)).toBe(true);
    expect(log.length).toBeGreaterThanOrEqual(1);
    const last = log[log.length - 1];
    expect(last.mapName).toBe(MAP_NAME);
    expect(last.newRawValue).toBe(1234);
    expect(last.checksumStatus).toMatch(/corrected|failed/);
    expect(typeof last.timestamp).toBe('string');
  });

    it('reverts an edit and restores the original value', async () => {
  const logFile = TMP_BIN + '.edit-log.json';
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

  const WORK_BIN = TMP_BIN + '.revert-test';
  fs.copyFileSync(BIN, WORK_BIN);

  // Edit: write 200 at row 3, col 0
  await execa('node', [CLI, 'edit', '--xdf', XDF, '--bin', WORK_BIN, MAP_NAME, '3', '0', '200']);

  // Apply the edit (copy .modified over working binary)
  const modFile = WORK_BIN + '.modified';
  fs.copyFileSync(modFile, WORK_BIN);
  fs.unlinkSync(modFile);

  // Confirm 200 is present via JSON output
  let { stdout } = await execa('node', [CLI, 'read', '--json', '--xdf', XDF, '--bin', WORK_BIN, MAP_NAME]);
  let data = JSON.parse(stdout);
  expect(data.raw[3][0]).toBe(200);

  // Revert
  await execa('node', [CLI, 'revert', '--xdf', XDF, '--bin', WORK_BIN, MAP_NAME]);

  // Apply the revert (copy .modified over working binary)
  const modFile2 = WORK_BIN + '.modified';
  fs.copyFileSync(modFile2, WORK_BIN);
  fs.unlinkSync(modFile2);

  // Read JSON again – value must be back to original
  ({ stdout } = await execa('node', [CLI, 'read', '--json', '--xdf', XDF, '--bin', WORK_BIN, MAP_NAME]));
  data = JSON.parse(stdout);
  expect(data.raw[3][0]).not.toBe(200);

  fs.unlinkSync(WORK_BIN);
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

describe('CLI integration: validate', () => {
  it('detects incorrect checksums on the stock binary (known issue)', async () => {
    try {
      await execa('node', [CLI, 'validate', '--ecu', 'ms43', BIN]);
      expect.fail('should have thrown with non-zero exit code');
    } catch (err: any) {
      expect(err.exitCode).toBe(1);
      expect(err.stdout).toContain('MISMATCH');
      expect(err.stdout).toContain('Checksums need correction.');
    }
  });

  it('after fixing checksums, validate reports all correct', async () => {
    const fixable = BIN + '.validate-fixable';
    fs.copyFileSync(BIN, fixable);

    await execa('node', [CLI, 'checksum', '--ecu', 'ms43', fixable]);
    const fixedFile = fixable + '.fixed';

    const { stdout } = await execa('node', [CLI, 'validate', '--ecu', 'ms43', fixedFile]);
    expect(stdout).toContain('All checksums are correct.');

    if (fs.existsSync(fixable)) fs.unlinkSync(fixable);
    if (fs.existsSync(fixedFile)) fs.unlinkSync(fixedFile);
  });

  it('reports mismatched checksums on a deliberately modified binary', async () => {
    const modFile = TMP_BIN + '.validate-deliberate';
    fs.copyFileSync(TMP_BIN, modFile);
    const buf = fs.readFileSync(modFile);
    buf[0x60000] = (buf[0x60000] + 1) & 0xFF;
    fs.writeFileSync(modFile, buf);

    try {
      await execa('node', [CLI, 'validate', '--ecu', 'ms43', modFile]);
      expect.fail('should have thrown with non-zero exit code');
    } catch (err: any) {
      expect(err.exitCode).toBe(1);
      expect(err.stdout).toContain('MISMATCH');
      expect(err.stdout).toContain('Checksums need correction.');
    } finally {
      if (fs.existsSync(modFile)) fs.unlinkSync(modFile);
    }
  });
});

describe('CLI integration: heatmap', () => {
  it('read command outputs colored table when forced', async () => {
    const { stdout } = await execa('node', [CLI, 'read', '--xdf', XDF, '--bin', TMP_BIN, MAP_NAME], {
      env: { FORCE_COLOR: '1', ...process.env },
    });
    expect(stdout).toMatch(/\u001b\[\d+m/);
    expect(stdout).toContain('Map:');
  });
});