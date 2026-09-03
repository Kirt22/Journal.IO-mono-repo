#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assertAuthoredScenario,
  authoredHashInput,
  sha256,
} from '../../backend/scripts/demo-fixture-utils.mjs';

const scenarioDirectory = path.resolve('src/demo/scenarios');

const main = async () => {
  const files = (await readdir(scenarioDirectory))
    .filter(file => file.endsWith('.json'))
    .sort();

  if (files.length !== 6) {
    throw new Error(`Expected 6 demo scenarios, found ${files.length}.`);
  }

  for (const file of files) {
    const fixture = JSON.parse(
      await readFile(path.join(scenarioDirectory, file), 'utf8'),
    );
    if (fixture.id !== file.replace(/\.json$/, '')) {
      throw new Error(`${file}: id must match its filename.`);
    }
    if (fixture.fictional !== true) {
      throw new Error(`${file}: fictional must be true.`);
    }
    if (fixture.status === 'draft') {
      if (fixture.captured !== null) {
        throw new Error(`${file}: draft fixtures cannot contain captured output.`);
      }
      // An empty draft is a placeholder for a scenario nobody has written yet,
      // and must stay valid — start:demo and ios:demo run this script first, so
      // failing here would block the demo build itself. But once a draft has
      // any authored content it gets the full structural check, because the
      // alternative is learning about a bad dayOffset or a missing answer from
      // the capture tool, after a run's worth of model calls has been spent.
      const authored =
        (fixture.entries?.length || 0) > 0 ||
        (fixture.askJadeQuestions?.length || 0) > 0;
      if (authored) {
        assertAuthoredScenario(fixture);
        console.info(`${file}: authored draft, ready to capture.`);
      }
      continue;
    }
    if (fixture.status !== 'captured' || !fixture.captured) {
      throw new Error(`${file}: invalid capture status.`);
    }

    assertAuthoredScenario(fixture);
    if (fixture.inputHash !== sha256(authoredHashInput(fixture))) {
      throw new Error(`${file}: authored input hash does not match.`);
    }
    if (fixture.outputHash !== sha256(fixture.captured)) {
      throw new Error(`${file}: captured output hash does not match.`);
    }
  }

  console.info(`Validated ${files.length} fictional demo scenario fixtures.`);
};

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Fixture validation failed.');
  process.exitCode = 1;
});
