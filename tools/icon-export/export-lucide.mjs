#!/usr/bin/env node
/**
 * Export named lucide icons to standalone SVG files.
 *
 * lucide-react-native ships no .svg assets — each icon is an array of element
 * tuples inside an ES module, meant to be handed to a React renderer. This
 * pulls those arrays out with a regex over the module source (rather than
 * importing, which would drag React Native into a plain node process) and
 * wraps them in the standard lucide SVG envelope.
 *
 * Usage: node tools/icon-export/export-lucide.mjs sparkles network lock
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const ICON_DIR = join(REPO_ROOT, 'frontend', 'node_modules', 'lucide-react-native', 'dist', 'esm', 'icons');
const OUT_DIR = join(REPO_ROOT, 'assets', 'icons');

// The envelope lucide itself renders with. stroke="currentColor" is pointless
// in a standalone file, so the stroke is set to white and the raster is tinted
// at composite time instead.
const OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ' +
  'fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';

function toSvg(source) {
  // Each element is ["tag", { attr: "value", ... }]. The key attribute is
  // React reconciliation bookkeeping and has no meaning in SVG, so it is dropped.
  // lucide pretty-prints elements with long path data across several lines,
  // so every bracket here has to tolerate arbitrary surrounding whitespace.
  // Matching only the single-line form silently dropped the main path of any
  // complex icon and emitted a plausible-looking SVG with its body missing.
  const elements = [...source.matchAll(/\[\s*"(\w+)"\s*,\s*\{([^}]*)\}/g)];
  if (elements.length === 0) throw new Error('no elements matched');
  const body = elements.map(([, tag, attrs]) => {
    const pairs = [...attrs.matchAll(/(\w+):\s*"([^"]*)"/g)]
      .filter(([, name]) => name !== 'key')
      .map(([, name, value]) => `${name}="${value}"`)
      .join(' ');
    return `  <${tag} ${pairs} />`;
  });
  return [OPEN, ...body, '</svg>'].join('\n');
}

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error('usage: export-lucide.mjs <icon-name>...');
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });
for (const name of names) {
  const source = await readFile(join(ICON_DIR, `${name}.js`), 'utf8');
  const target = join(OUT_DIR, `${name}.svg`);
  await writeFile(target, toSvg(source));
  console.log(`wrote ${target}`);
}
