#!/usr/bin/env node
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

// @shopify/react-native-skia no longer ships its prebuilt Apple binaries: its
// published `files` list stops at libs/.graphite, and the xcframeworks live in
// the react-native-skia-apple-* packages instead. The podspec copies them into
// libs/<platform>/ when CocoaPods evaluates it, so an `npm install` — which
// replaces the package directory, taking libs/ with it — leaves the tree in a
// state where the iOS build's [CP] Copy XCFrameworks phase fails with a bare
// rsync "No such file or directory". Nothing warns first: Podfile.lock and
// Pods/Manifest.lock still agree, so CocoaPods sees no reason to run.
//
// Running the same copy from postinstall closes that window. This deliberately
// mirrors install_apple_skia_libs in react-native-skia.podspec, down to the
// libs/<platform>/.version stamp, so whichever of the two runs second finds its
// work already done and leaves the files untouched rather than re-copying them
// and invalidating CocoaPods' cache.

const require = createRequire(import.meta.url);

const platformPackages = {
  ios: 'react-native-skia-apple-ios',
  macos: 'react-native-skia-apple-macos',
  tvos: 'react-native-skia-apple-tvos',
};

const resolvePackageDirectory = name => {
  try {
    return path.dirname(require.resolve(`${name}/package.json`));
  } catch {
    return null;
  }
};

const readPackageVersion = async directory =>
  JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')).version;

const readVersionStamp = async marker => {
  try {
    return (await readFile(marker, 'utf8')).trim();
  } catch {
    return null;
  }
};

const main = async () => {
  const skiaDirectory = resolvePackageDirectory('@shopify/react-native-skia');
  if (!skiaDirectory) {
    // Skia itself is absent — a partial or platform-specific install. Nothing
    // to repair, and failing here would break an otherwise valid `npm install`.
    return;
  }

  for (const [platform, packageName] of Object.entries(platformPackages)) {
    const packageDirectory = resolvePackageDirectory(packageName);
    if (!packageDirectory) {
      continue;
    }

    const source = path.join(packageDirectory, 'libs');
    const frameworks = (await readdir(source).catch(() => [])).filter(entry =>
      entry.endsWith('.xcframework'),
    );
    if (frameworks.length === 0) {
      continue;
    }

    const version = await readPackageVersion(packageDirectory);
    const destination = path.join(skiaDirectory, 'libs', platform);
    const marker = path.join(destination, '.version');
    if ((await readVersionStamp(marker)) === version) {
      continue;
    }

    await rm(destination, { recursive: true, force: true });
    await mkdir(destination, { recursive: true });
    for (const framework of frameworks) {
      await cp(
        path.join(source, framework),
        path.join(destination, framework),
        { recursive: true },
      );
    }
    await writeFile(marker, `${version}\n`);
    console.info(
      `react-native-skia: installed ${frameworks.length} ${platform} Skia frameworks (${version}).`,
    );
  }
};

main().catch(error => {
  console.error(
    error instanceof Error ? error.message : 'Skia framework installation failed.',
  );
  process.exitCode = 1;
});
