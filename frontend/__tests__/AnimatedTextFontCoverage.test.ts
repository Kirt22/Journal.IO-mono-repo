/**
 * @format
 */

/// <reference types="node" />

import fs from 'fs';
import path from 'path';

const sourceRoot = path.resolve(__dirname, '../src');

const walk = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });

/** Reads the object literal that starts at the `{` following `styles.<name>:`. */
const readStyleBlock = (source: string, name: string): string | null => {
  const declaration = new RegExp(`\\n\\s{2}${name}:\\s*\\{`).exec(source);

  if (!declaration) {
    return null;
  }

  let depth = 0;

  for (let index = declaration.index; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;

      if (depth === 0) {
        return source.slice(declaration.index, index + 1);
      }
    }
  }

  return null;
};

/** Everything between `<Animated.Text` and the `>` that closes the opening tag. */
const readOpeningTags = (source: string): string[] => {
  const tags: string[] = [];

  for (const match of source.matchAll(/<Animated\.Text\b/g)) {
    let depth = 0;

    for (let index = match.index; index < source.length; index += 1) {
      const character = source[index];

      if (character === '{') {
        depth += 1;
      } else if (character === '}') {
        depth -= 1;
      } else if (character === '>' && depth === 0) {
        tags.push(source.slice(match.index, index));
        break;
      }
    }
  }

  return tags;
};

/**
 * `Animated.Text` comes straight from react-native, so unlike the `Text` in
 * `infrastructure/reactNative.ts` it never passes through `applyFont` and falls
 * back to the platform system font. Where an animated layer sits over a wrapped
 * one — the auth wordmark, the new-entry prompt crossfade — the two then measure
 * differently, and the narrower layer gets ellipsized mid-word. Every animated
 * text must therefore name its own family.
 */
test('animated text names the font family it renders in', () => {
  const violations: string[] = [];

  for (const file of walk(sourceRoot)) {
    if (!/\.tsx$/.test(file)) {
      continue;
    }

    const source = fs.readFileSync(file, 'utf8');

    for (const tag of readOpeningTags(source)) {
      if (/fontFamily|typography\./.test(tag)) {
        continue;
      }

      const named = [...tag.matchAll(/styles\.([A-Za-z0-9_]+)/g)].map(
        match => match[1],
      );
      const resolved = named.some(name =>
        /fontFamily|typography\./.test(readStyleBlock(source, name) ?? ''),
      );

      if (!resolved) {
        violations.push(
          `${path.relative(sourceRoot, file)} (${named.join(', ') || 'inline style'})`,
        );
      }
    }
  }

  expect(violations).toEqual([]);
});
