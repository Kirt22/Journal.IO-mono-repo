# Google Sign-In Setup

## Required environment variables

Frontend `frontend/.env`:

- `API_BASE_URL`
- `GOOGLE_WEB_CLIENT_ID`
- `GOOGLE_IOS_CLIENT_ID`

Backend `backend/.env`:

- `GOOGLE_WEB_CLIENT_ID`

## Google Cloud console

1. Create or reuse a Google Cloud project.
2. Configure the OAuth consent screen.
3. Create a Web OAuth client and place its client ID in:
   - `frontend/.env` as `GOOGLE_WEB_CLIENT_ID`
   - `backend/.env` as `GOOGLE_WEB_CLIENT_ID`
4. Create an Android OAuth client for package name `com.journalfrontend`.
5. Add the Android SHA-1 fingerprints for every build you use:
   - debug keystore
   - release keystore
6. Create an iOS OAuth client for your app bundle ID.
7. Place the iOS client ID in `frontend/.env` as `GOOGLE_IOS_CLIENT_ID`.

## Android

1. Confirm the Android package name in [build.gradle](/Users/kirtansolanki/Desktop/Journal.IO/frontend/android/app/build.gradle) is the one registered in Google Cloud.
2. If you use a custom release keystore later, register its SHA-1 before testing release builds.

## iOS

1. In Xcode, open the `JournalFrontend` target and confirm the bundle identifier matches the iOS OAuth client you created.
2. Add the reversed iOS client ID as a URL scheme in the target's `Info` tab.
3. Run `cd frontend/ios && pod install` after installing dependencies.

## Notes

- The mobile app sends only the Google `idToken` to the backend.
- The backend verifies the token and issues the normal Journal.IO access and refresh tokens.
