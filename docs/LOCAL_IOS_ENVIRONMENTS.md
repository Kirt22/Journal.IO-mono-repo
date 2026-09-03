# Local iOS Environments

This is the source of truth for running Journal.IO in the three supported iOS environments.

## Environment Map

| Environment | App target                    | Backend target            | Frontend env file          | API URL shape                      |
| ----------- | ----------------------------- | ------------------------- | -------------------------- | ---------------------------------- |
| Simulator   | iOS Simulator                 | Backend on this Mac       | `frontend/.env.simulator`  | `http://127.0.0.1:3001/api/v1`     |
| Local test  | Physical iPhone Debug build   | Backend on this Mac       | `frontend/.env.local`      | `http://<mac-lan-ip>:3001/api/v1`  |
| Local prod  | Physical iPhone Release build | Hosted production backend | `frontend/.env.production` | `https://api.journalio.app/api/v1` |

`APP_ENV` selects the frontend file:

- `APP_ENV=simulator` loads `frontend/.env.simulator`.
- `APP_ENV=local` loads `frontend/.env.local`.
- `APP_ENV=production` loads `frontend/.env.production`.

The selected env file is the primary source for `API_BASE_URL`. The optional `frontend/src/utils/devLaunchConfig.json` URL is only a development fallback when the selected env file has no API URL.

## Development Premium Access

The local backend supports one global Premium override in `backend/.env`:

```env
DEV_PREMIUM_ACCESS_OVERRIDE=free
```

Use `pro` to force effective Premium access, `free` to force the Free experience, or `default` to use the account's server-verified RevenueCat entitlement. This is the only development access bypass: AI, Mind Map, widgets, biometric lock, and every other Premium gate use the same effective value. It changes runtime authorization and the `isPremium` value returned in authenticated profiles without modifying stored subscription data, and it is ignored when `NODE_ENV=production`.

Restart the backend after changing the value, then refresh or relaunch the app so it reloads the authenticated profile. Authentication, ownership, and safety checks remain enforced in every mode.

## Important URL Rule

`0.0.0.0` is a server listen address. It means the backend accepts connections through all of the Mac's network interfaces. It is not an address the app should request.

Use these client addresses instead:

- iOS Simulator on the same Mac: `127.0.0.1`.
- Physical iPhone on the same Wi-Fi: the Mac's LAN IP, such as `192.168.1.226`.
- Production: the hosted HTTPS domain.

The local backend may log `http://0.0.0.0:3001`; that is compatible with both `http://127.0.0.1:3001` from the simulator and `http://<mac-lan-ip>:3001` from a phone.

## 1. Simulator

Use this when the iOS Simulator and backend both run on the Mac.

Confirm `frontend/.env.simulator` contains:

```env
FRONTEND_ENV=simulator
API_BASE_URL=http://127.0.0.1:3001/api/v1
```

Terminal 1, start the backend:

```bash
cd backend
npm run dev:simulator
```

Terminal 2, start Metro with a clean simulator bundle:

```bash
cd frontend
npm run start:simulator
```

Terminal 3, build or relaunch the simulator without starting another Metro process:

```bash
cd frontend
npm run ios:simulator-debug
```

For a first launch when Metro is not already running, this shorter frontend command starts the normal simulator flow:

```bash
cd frontend
npm run ios:simulator
```

`npm run ios:local-debug` is kept as a backwards-compatible simulator alias. It now selects `APP_ENV=simulator`, so it resolves `http://127.0.0.1:3001/api/v1` rather than the physical-device LAN URL.

## 2. Local Test

Use this when the app runs as a Debug build on a real iPhone and the backend runs on the Mac.

The Mac and iPhone must be on the same network. Find the Mac's Wi-Fi IP:

```bash
ipconfig getifaddr en0
```

If that prints nothing, try:

```bash
ipconfig getifaddr en1
```

Set `frontend/.env.local` using the returned address:

```env
FRONTEND_ENV=dev
API_BASE_URL=http://<mac-lan-ip>:3001/api/v1
```

Terminal 1, expose the backend on the Mac's network interfaces:

```bash
cd backend
npm run dev:local-test
```

Terminal 2, expose Metro to the phone and reset its cache:

```bash
cd frontend
npm run start:local-test
```

Terminal 3, install or relaunch the Debug app on the connected iPhone:

```bash
cd frontend
npm run ios:local-test -- --device "Kirtan’s iPhone"
```

If the phone cannot connect, verify the LAN IP has not changed, allow Node/backend connections through the Mac firewall, accept iOS local-network permission, and confirm the backend health endpoint from another device at `http://<mac-lan-ip>:3001/health`.

### Replay Onboarding In The Normal App

Set `replayOnboarding` to `true` in
`frontend/src/utils/devLaunchConfig.json`, then use the regular local-test
commands above. In a Debug build, an existing authenticated account will open
Onboarding after its session is validated even if the backend profile already
completed the current onboarding version. Authentication is never bypassed, and
release builds continue to use the backend profile as the source of truth.

This is a routing-only development replay. It does not reset the account or mark
onboarding incomplete. Completing the full journey can still write test data to
the selected local backend. Set `replayOnboarding` to `false` to restore normal
server-driven routing. The replay follows the complete production journey; it
does not expose a fixture-backed skip button. Do not start a `start:demo:*` Metro
command for this workflow.

### Demo Mode On The Phone

Demo Mode is not limited to the Simulator. It is a Metro-side bundle swap, not a
property of the installed app: `metro.config.js` rewrites `/index.bundle` to
`/index.demo.bundle` whenever `DEMO_MODE_ENABLED=true` and the build is not a
production one. A Debug build always asks Metro for `index`, so the Metro process
you start decides whether the phone gets Demo Mode. Reinstalling is not required
to switch it on or off.

Replace the terminal 2 and terminal 3 commands with the demo variants:

```bash
cd frontend
npm run start:demo:local-test
```

```bash
cd frontend
npm run ios:demo:local-test -- --device "Kirtan’s iPhone"
```

Open the developer menu with a shake gesture. The `Demo:` entries appear once the
demo bundle has loaded; `[DemoMode] ... ready` in the Metro log confirms the
bootstrap ran. Only captured scenarios activate, and drafts are listed as
`(capture required)`.

Demo Mode serves every API call from a fixture through the `apiClient` adapter
seam, so the local backend is not used while a scenario is active. The Debug
device build still embeds a non-demo fallback bundle, so if the phone cannot
reach Metro it silently launches the normal app instead of the demo one. Treat a
missing `Demo:` entry as a Metro connection problem first.

## 3. Local Prod

Use this when a production-configured Release app runs on a real iPhone and talks to the hosted production backend. No local backend or Metro process is required.

Confirm `frontend/.env.production` contains the production values, including:

```env
API_BASE_URL=https://api.journalio.app/api/v1
```

Install the Release build on the connected iPhone:

```bash
cd frontend
npm run ios:local-prod -- --device "Your iPhone Name"
```

This command sets `APP_ENV=production`, uses the Release Xcode configuration, and bundles `frontend/.env.production` into the app.

If production API behavior needs Metro logs and the React Native dev menu, use a Debug build instead:

```bash
# Terminal 1
cd frontend
npm run start:local-prod-debug

# Terminal 2
cd frontend
npm run ios:local-prod-debug -- --device "Your iPhone Name"
```

The debug variant uses production environment values but is not a production frontend build. Use `ios:local-prod` for the full Release-style check.

## Xcode Device Setup

Before building for a real iPhone:

1. Open `frontend/ios/JournalFrontend.xcworkspace` in Xcode.
2. Select the `JournalFrontend` target.
3. Set the Apple development team under `Signing & Capabilities`.
4. Confirm the bundle identifier matches the configured Google iOS OAuth client and URL scheme.
5. Connect and trust the iPhone, then enable Developer Mode if iOS requests it.

## Stale URL Troubleshooting

If the app logs an API URL from a different environment:

1. Stop every running Metro process.
2. Start Metro with the exact `start:*` command for the target environment. These commands use `--reset-cache` where cross-device switching needs it.
3. Rebuild or relaunch with the matching `ios:*` command.
4. Check Metro output for `[babel] react-native-dotenv loading ...`.
5. Check the first development API request log for `[apiClient] base URL resolved` and confirm its source is `env`.

Do not run a simulator `start:*` command with a local-test or production `ios:*` command. Metro creates the JavaScript bundle, so both terminals must select the same environment.

## Widgets Missing From The Simulator Widget Gallery

Symptom: searching "Journal.IO" in the add-widget sheet returns nothing, even though the app installs and runs fine.

This is almost always stale simulator state, not a project misconfiguration. Reinstalling the app places it in a new bundle container, but `launchd_sim` keeps the `app.journalio.widgets` XPC service registered against the previous container path. It then refuses to re-bootstrap, so `chronod` can never launch the extension to read its widget descriptors.

Confirm with:

```bash
xcrun simctl spawn booted log show --last 15m --style compact \
  --predicate 'subsystem == "com.apple.chrono"' | grep -i journalio
```

The signature lines are `Attempt to re-bootstrap service from different path, will use existing`, `Failed to launch extension`, and `unable to obtain widget extension session`.

Recover by shutting the simulator down — that is what clears `launchd_sim`'s in-memory service registry:

```bash
xcrun simctl uninstall booted app.journalio
xcrun simctl shutdown booted
xcrun simctl boot <device-udid>
cd frontend && npm run ios
```

To avoid it recurring, use `npm run ios:clean` instead of `npm run ios` when reinstalling after widget-target changes. It uninstalls first so the extension is deregistered cleanly.

Verify success by looking for `created from CHS widget descriptor` in the same log query.

## Archive Fails In `[CP] Copy XCFrameworks`

Symptom: a Release archive fails in the `react-native-skia` pod with
`rsync: .../libs/ios/libskia.xcframework/ios-arm64_arm64e/*: (l)stat: No such file or directory`,
often alongside bare `Command Libtool failed with a nonzero exit code` messages from
unrelated pods. Those usually carry no diagnostic of their own because Xcode is
cancelling in-flight tasks after the real failure — but a nearly full disk produces the
same silent Libtool failures, so check `df -h /System/Volumes/Data` before assuming they
are only collateral. `~/Library/Developer/Xcode/DerivedData` and `.../Archives` are the
usual reclaim targets; a Release archive of this app needs several GB of headroom.

The prebuilt Skia binaries are not in the `@shopify/react-native-skia` tarball. They
ship in `react-native-skia-apple-ios` / `-macos` / `-tvos` and are copied into
`node_modules/@shopify/react-native-skia/libs/<platform>/` by the Skia podspec during
`pod install`. Any `npm install` replaces the package directory and takes `libs/` with
it, and nothing warns: `Podfile.lock` and `Pods/Manifest.lock` still agree, so
CocoaPods sees no reason to run.

`frontend/scripts/install-skia-apple-libs.mjs` runs on `postinstall` and performs the
same copy, so this should no longer happen. If it does, confirm and repair with:

```bash
ls frontend/node_modules/@shopify/react-native-skia/libs/ios/libskia.xcframework
cd frontend/ios && pod install
```

Then delete the failed run's `ArchiveIntermediates` from DerivedData before archiving
again, since the aborted copy leaves a half-populated `XCFrameworkIntermediates`.

ok now we will go back work on the onboarding, it is still
not over. ok now when i go from the 'your personalisation is
ready' onboarding scrren and then the bottom sheet that
opens for agreeing terms and conditions to the first entry
screen have a loader taht appers on the begin my first
reflection button and have a 2-3 second delay to enter there
right now i immidieatly entr and also there is no screen
transition animation add that also.
now as for as the first reflection screen, everything is
fine but then when i click finsih entry there is no no
loader on that button and now i wnat to remocve the review
entry screen entirely. no need of taht screen. and also
remove the lodaer screens that you added like this one -
[Image #1] now need for all this. [Image #2] agian in this
image also i dont need a loader scfreen like this also, so
no once i cick finsih session then i will directly go to the
ai anamlysis screen and agian thereis no screeen transition
animation add alsl that and also make sure that the whole
onboarding which includes the first reflection is is done by
react navigation and make sure taht al the current animation
are not at all disturbed, and i believe it is alredy don ein
react-navition but if not add that strictly use react-
naivegiton acroos the app, no manual navigation. and aging
for the onboarding context the onbording beofr eth efirst
reflection is alredy set and i love how it has come so if
ther react-navigation is not set then add it but plz make
sure it stays exctly the same no chage in the animation and
the screen transtions.
