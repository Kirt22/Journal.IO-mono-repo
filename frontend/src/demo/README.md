# Journal.IO Demo Mode

Demo Mode is a development-only data adapter for repeatable filming. It replays
fictional outputs previously produced by the real backend AI pipeline. Product
screens, navigation, animations, and selectors do not contain demo branches.

## Run Demo Mode

Start Metro and the app with the explicit demo build flag:

```sh
npm --prefix frontend run start:demo
npm --prefix frontend run ios:demo
```

Use `android:demo` for Android.

To run Demo Mode on a physical iPhone instead of the Simulator, use the
`local-test` variants, which keep `APP_ENV=local` and expose Metro on the LAN:

```sh
npm --prefix frontend run start:demo:local-test
npm --prefix frontend run ios:demo:local-test -- --device "<device name>"
```

Demo Mode is selected by the Metro process, not by the installed binary: the
`rewriteRequestUrl` hook in `metro.config.js` swaps `/index.bundle` for
`/index.demo.bundle`, and a Debug build always requests `index` from Metro. So
switching an already-installed Debug app between demo and normal only means
restarting Metro with or without the flag and reloading. A Debug device build
does embed a non-demo fallback bundle, which is what launches if the phone cannot
reach Metro.

Open the React Native developer menu with a shake gesture. Captured scenarios can be selected there; draft scenarios are
listed as requiring capture. Scenario changes, Film Mode changes, and Reset to
normal reload JavaScript so the in-memory overlay always begins clean.

Film Mode mutes app haptics, cancels local reminder banners, hides LogBox, and
forces the app connectivity indicator online. It does not change the user's
persisted haptics or reminder preferences. Reset to normal clears both demo
flags and lets the existing services load real data again.

## Author A Scenario

Each scenario lives in `src/demo/scenarios/<scenario-id>.json`. Only authored
inputs may be edited by hand. A capture owns `generatedAt`, `sourceModels`,
hashes, and the complete `captured` object; never edit those fields to improve
copy.

Before capture, provide exactly 30 fictional entries with unique contiguous
`dayOffset` values from `-29` through `0`, a valid `HH:mm` time, a mood score
from 1 through 5, and three non-empty guided answers. Also provide 3-5 Ask Jade
questions, the generic fallback question, `filmingEntryDayOffset`, and
`goalSourceDayOffset`.

Validate authored and captured fixtures with:

```sh
yarn demo:validate
```

A draft with any authored content gets the full structural check, so an authoring
mistake surfaces before a capture run is paid for. Empty drafts stay valid as
placeholders — `start:demo` and `ios:demo` run this script first.

## Capture Real Output

Capture requires the normal backend OpenAI and field-encryption environment plus
`DEMO_CAPTURE_MONGO_URI`. The URI must name a dedicated database matching
`journal_io_demo_capture_<name>` and must not equal any application database
URI. The tool creates one fictional Premium scratch user, runs the compiled
services, writes the fixture atomically, and drops the database even on failure.

```sh
DEMO_CAPTURE_MONGO_URI=mongodb://localhost:27017/journal_io_demo_capture_emotional_eating \
  yarn demo:capture emotional-eating
```

The capture fails rather than writing a fixture when an entry is missing, an AI
surface falls back, the weekly/Mind Map payload is not ready, or a required model
call did not run. Logs contain offsets and safe model metadata only, never entry
text or model output. If copy is weak, fix the production prompt/model and run
capture again.

## Release Exclusion

When `DEMO_MODE_ENABLED=true` outside production, Metro rewrites the native
`index` request to `index.demo.js`. That entry waits for the adapter bootstrap,
then loads the normal app entry. Production always bundles `index.js`, which
never imports the scenario registry.

```sh
yarn demo:verify-release
```

The verifier first confirms a debug control bundle contains the Demo Mode marker,
then builds iOS and Android production bundles with the demo flag deliberately
set. It fails if either bundle or source map contains the bootstrap marker,
scenario IDs, labels, or fixture prose.
