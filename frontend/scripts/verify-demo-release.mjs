#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const MARKERS = [
  'JOURNAL_IO_DEMO_MODE_BOOTSTRAP_V1',
  'emotional-eating',
  'rest-is-guilt',
  'reply-dependency',
  'sunday-collapse',
  'avoidance-loop',
  'Eating to avoid a feeling',
];
const FORBIDDEN_RELEASE_ENDPOINTS = [
  { label: 'localhost', pattern: /https?:\/\/(?:localhost|127\.0\.0\.1)(?=[:/])/i },
  { label: '10.x private network', pattern: /https?:\/\/10\.\d{1,3}(?:\.\d{1,3}){2}(?=[:/])/i },
  { label: '172.16-31.x private network', pattern: /https?:\/\/172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}(?=[:/])/i },
  { label: '192.168.x private network', pattern: /https?:\/\/192\.168(?:\.\d{1,3}){2}(?=[:/])/i },
];
const EXPECTED_PRODUCTION_API = 'https://api.journalio.app/api/v1';
const cli = path.resolve('node_modules/react-native/cli.js');

const bundle = ({ directory, platform, dev, production, entryFile }) => {
  const bundlePath = path.join(directory, `${platform}-${dev ? 'debug' : 'release'}.jsbundle`);
  const sourceMapPath = `${bundlePath}.map`;
  const assetsPath = path.join(directory, `${platform}-assets`);
  const result = spawnSync(
    process.execPath,
    [
      cli,
      'bundle',
      '--platform',
      platform,
      '--dev',
      String(dev),
      '--entry-file',
      entryFile,
      '--bundle-output',
      bundlePath,
      '--sourcemap-output',
      sourceMapPath,
      '--assets-dest',
      assetsPath,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DEMO_MODE_ENABLED: 'true',
        APP_ENV: production ? 'production' : 'simulator',
        BABEL_ENV: production ? 'production' : 'development',
        NODE_ENV: production ? 'production' : 'development',
        CONFIGURATION: production ? 'Release' : 'Debug',
      },
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `Metro ${platform} ${dev ? 'debug' : 'release'} bundle failed.\n${
        result.stderr || result.stdout
      }`,
    );
  }

  return { bundlePath, sourceMapPath };
};

const readArtifacts = async paths =>
  (await Promise.all(paths.map(file => readFile(file, 'utf8')))).join('\n');

const main = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'journal-demo-release-'));

  try {
    const debug = bundle({
      directory,
      platform: 'ios',
      dev: true,
      production: false,
      entryFile: 'index.demo.js',
    });
    const debugText = await readArtifacts([debug.bundlePath, debug.sourceMapPath]);
    if (!debugText.includes(MARKERS[0])) {
      throw new Error('The debug control bundle did not include Demo Mode.');
    }

    for (const platform of ['ios', 'android']) {
      const release = bundle({
        directory,
        platform,
        dev: false,
        production: true,
        entryFile: 'index.js',
      });
      const releaseText = await readArtifacts([release.bundlePath, release.sourceMapPath]);
      const releaseBundleText = await readFile(release.bundlePath, 'utf8');
      const leakedMarkers = MARKERS.filter(marker => releaseText.includes(marker));
      if (leakedMarkers.length) {
        throw new Error(
          `${platform} release bundle contains Demo Mode markers: ${leakedMarkers.join(', ')}`,
        );
      }
      const leakedEndpoints = FORBIDDEN_RELEASE_ENDPOINTS.filter(({ pattern }) =>
        pattern.test(releaseBundleText),
      ).map(({ label }) => label);
      if (leakedEndpoints.length) {
        throw new Error(
          `${platform} release bundle contains private endpoints: ${leakedEndpoints.join(', ')}`,
        );
      }
      if (!releaseBundleText.includes(EXPECTED_PRODUCTION_API)) {
        throw new Error(
          `${platform} release bundle is missing the production API endpoint.`,
        );
      }
      console.info(`${platform} release bundle: 0 Demo Mode markers`);
      console.info(`${platform} release bundle: production API only`);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Release verification failed.');
  process.exitCode = 1;
});
