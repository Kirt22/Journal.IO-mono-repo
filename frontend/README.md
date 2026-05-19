This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

## iOS Build Notes

### Xcode says `iOS 26.4 is not installed`

If `npm run ios` fails before compilation with an error like:

```sh
Unable to find a destination matching the provided destination specifier
... iOS 26.4 is not installed
```

install the matching iOS platform/runtime from `Xcode > Settings > Components`, then rerun:

```sh
cd ios
pod install
cd ..
npm run ios
```

### Xcode 26.4 fails in the `fmt` pod with `consteval` / `not a constant expression`

If iOS compilation reaches the native pods and fails in `Pods/fmt/src/format.cc` with errors like:

```sh
call to consteval function ... is not a constant expression
```

this repo already includes the fix in `ios/Podfile`. Keep the `fmt` post-install override in place and rerun:

```sh
cd ios
pod install
cd ..
npm run ios
```

The fix forces the `fmt` pod to:

- use `gnu++17`
- set `FMT_USE_CONSTEVAL=0`

This is a local compatibility workaround for the Xcode 26.4 simulator toolchain with the current React Native pod graph.

## Production iPhone Build

Use this path when you want a Release build on a real iPhone without changing the local development defaults in `frontend/.env`.

1. Edit `frontend/.env.production` with the production values you want to test.

Minimum for the live backend:

```env
API_BASE_URL=https://api.journalio.app/api/v1
```

Optional fallback store-rating links. The onboarding rating step uses the native in-app review prompt first; these values are only used if the native review bridge is unavailable.

```env
IOS_APP_STORE_ID=1234567890
ANDROID_PLAY_STORE_PACKAGE_NAME=app.journalio
```

2. Install pods if needed:

```sh
cd ios
pod install
cd ..
```

3. Build the Release app for your connected iPhone:

```sh
npm run ios:release -- --device "Your iPhone Name"
```

Release builds now export `BABEL_ENV=production` from `ios/.xcode.env`, so the React Native bundle resolves `frontend/.env.production` automatically.

### Xcode requirements for a real device

Before the build will install on a physical iPhone, you still need to confirm these native settings in Xcode:

- open `frontend/ios/JournalFrontend.xcworkspace`
- select the `JournalFrontend` target
- set your Apple development team under `Signing & Capabilities`
- use a real bundle identifier instead of the default example identifier if you want Google sign-in or App Store style signing to match your production setup
- make sure the iOS OAuth client in Google Cloud matches that bundle identifier and that its reversed client ID is present in the target URL schemes

## Debug On iPhone Against Production Backend

Use this path when you want Metro, console logs, and the RN dev menu on your physical iPhone while still sending API requests to the production backend.

1. Keep production values in `frontend/.env.production`.

2. Start Metro in production-app-env mode:

```sh
npm run start:prod-debug
```

3. In a second terminal, install or relaunch the Debug build on your phone without starting another packager:

```sh
npm run ios:prod-debug -- --device "Your iPhone Name"
```

Why this works:

- `npm run ios` alone is still a normal Debug build and Metro reads `frontend/.env`
- `npm run start:prod-debug` and `npm run ios:prod-debug` set `APP_ENV=production`, so `react-native-dotenv` resolves `frontend/.env.production` even in Debug
- this gives you live Metro logs while the app talks to `https://api.journalio.app/api/v1`

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
