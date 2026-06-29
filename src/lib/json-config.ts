/**
 * Read / merge / write JSON config files without clobbering unrelated keys.
 * Coding tools own these files; we only touch our own slice of them.
 */

import fs from 'node:fs';
import path from 'node:path';

export function readJson<T extends object>(file: string): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return {} as T;
  }
}

export function writeJson(file: string, data: unknown, indent = 2): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, indent), 'utf-8');
}
