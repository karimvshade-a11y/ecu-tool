import { describe, it, expect } from 'vitest';
import { getPlugin } from '../../src/checksums/registry';

describe('Plugin registry', () => {
  it('returns the ms43 (2‑sum) plugin', () => {
    const p = getPlugin('ms43');
    expect(p.name).toBe('ms43');
    expect(p.validated).toBe(true);
    expect(typeof p.correct).toBe('function');
  });

  it('returns the ms43_5sum template', () => {
    const p = getPlugin('ms43_5sum');
    expect(p.name).toBe('ms43_5sum');
    expect(p.validated).toBe(false);
    expect(typeof p.correct).toBe('function');
  });

  it('throws for unknown plugin', () => {
    expect(() => getPlugin('nonexistent')).toThrow('Unknown checksum plugin');
  });
});