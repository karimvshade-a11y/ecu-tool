import { ChecksumPlugin } from './types';
import { plugin as ms43Plugin } from '../plugins/ms43_2sum';

const plugins: Map<string, ChecksumPlugin> = new Map();
// Register the built‑in 2‑sum plugin under the name 'ms43'
plugins.set(ms43Plugin.name, ms43Plugin);

// TODO: auto‑discover additional plugins from src/plugins/ in a future update

export function getPlugin(name: string): ChecksumPlugin {
  const p = plugins.get(name);
  if (!p) {
    const available = Array.from(plugins.keys()).join(', ');
    throw new Error(`Unknown checksum plugin "${name}". Available: ${available}`);
  }
  return p;
}