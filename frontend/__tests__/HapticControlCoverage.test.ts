/**
 * @format
 */

/// <reference types="node" />

import fs from 'fs';
import path from 'path';

const sourceRoot = path.resolve(__dirname, '../src');
const allowedNativeControlFiles = new Set([
  path.join(sourceRoot, 'components/HapticPressable.tsx'),
  path.join(sourceRoot, 'components/HapticSwitch.tsx'),
]);

const walk = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });

test('app controls use preference-aware haptic primitives', () => {
  const violations: string[] = [];
  const nativeControlPattern = /\b(Pressable|Switch|Button|TouchableOpacity|TouchableHighlight|TouchableNativeFeedback)\b/;

  for (const file of walk(sourceRoot)) {
    if (!/\.tsx?$/.test(file) || allowedNativeControlFiles.has(file)) {
      continue;
    }

    const source = fs.readFileSync(file, 'utf8');
    const imports = source.matchAll(
      /import\s*\{([^}]*)\}\s*from\s*['"](react-native|(?:\.\.\/)*infrastructure\/reactNative)['"]/g,
    );

    for (const match of imports) {
      if (nativeControlPattern.test(match[1])) {
        violations.push(path.relative(sourceRoot, file));
      }
    }
  }

  expect(violations).toEqual([]);
});
