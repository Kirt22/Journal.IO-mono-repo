# Local iOS Environments

This is the source of truth for running Journal.IO in the three supported iOS environments.

## Environment Map

| Environment | App target | Backend target | Frontend env file | API URL shape |
| --- | --- | --- | --- | --- |
| Simulator | iOS Simulator | Backend on this Mac | `frontend/.env.simulator` | `http://127.0.0.1:3001/api/v1` |
| Local test | Physical iPhone Debug build | Backend on this Mac | `frontend/.env.local` | `http://<mac-lan-ip>:3001/api/v1` |
| Local prod | Physical iPhone Release build | Hosted production backend | `frontend/.env.production` | `https://api.journalio.app/api/v1` |

`APP_ENV` selects the frontend file:

- `APP_ENV=simulator` loads `frontend/.env.simulator`.
- `APP_ENV=local` loads `frontend/.env.local`.
- `APP_ENV=production` loads `frontend/.env.production`.

The selected env file is the primary source for `API_BASE_URL`. The optional `frontend/src/utils/devLaunchConfig.json` URL is only a development fallback when the selected env file has no API URL.

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
npm run ios:local-test -- --device "Your iPhone Name"
```

If the phone cannot connect, verify the LAN IP has not changed, allow Node/backend connections through the Mac firewall, accept iOS local-network permission, and confirm the backend health endpoint from another device at `http://<mac-lan-ip>:3001/health`.

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