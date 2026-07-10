import { ChecksumPlugin } from './types';
import { plugin as ms43Plugin } from '../plugins/ms43_2sum';
import { plugin as ms43_5sum } from '../plugins/ms43_5sum';

const plugins: Map<string, ChecksumPlugin> = new Map();
plugins.set(ms43Plugin.name, ms43Plugin);
plugins.set(ms43_5sum.name, ms43_5sum);

// Later: auto‑discover by scanning src/plugins/*.ts

export function getPlugin(name: string): ChecksumPlugin {
  const p = plugins.get(name);
  if (!p) {
    const available = Array.from(plugins.keys()).join(', ');
    throw new Error(`Unknown checksum plugin "${name}". Available: ${available}`);
  }
  return p;
}