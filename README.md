# Katiba Jam — native app project

This wraps the Katiba Jam web app (an accessible civics guide to the
Constitution of Kenya, 2010, and its government) in a real native shell for
the App Store and Google Play, using [Capacitor](https://capacitorjs.com/).
It follows the same pattern as the earlier Constitution Jam app.

## What's already done

- ✅ Web app at `www/index.html`, with constitutional text loaded from
  `www/data/constitution.js` (kept separate so content can be updated
  without touching the app shell)
- ✅ Android native project generated at `android/`
- ✅ iOS native project generated at `ios/`
- ✅ App icon and splash screen generated for both platforms (source art in
  `assets-src/`, rendered at every required size under
  `android/app/src/main/res` and `ios/App/App/Assets.xcassets` — regenerate
  any time with `node assets-src/generate.mjs && npx @capacitor/assets
  generate`)
- ✅ `codemagic.yaml` — a CI pipeline that builds *and* signs both the Android
  and iOS release, entirely in the cloud (this is how the iOS build happens
  without a Mac)
- ✅ Privacy policy, published and hosted:
  https://claude.ai/artifact/QVYHq211DvpiyAL8w3vz4J
- ✅ Store listing copy drafted in `STORE_LISTING.md`

## ⚠️ Content accuracy — read this before publishing

`www/data/constitution.js` is compiled from public sources (primarily Kenya
Law / kenyalaw.org). Before you submit this app to real users, **spot-check
a sample of articles against the official published Constitution** — legal
text needs to be exactly right, and any automated compilation can introduce
transcription errors. The file's header comment lists the sources used and
flags any chapter that couldn't be fully verified.

## ⚠️ Before anything else: set up signing and back up the keystore

Unlike the Constitution Jam project, this one does **not** yet have an
Android release keystore generated (Java wasn't available in this
environment when this project was scaffolded). Before your first Android
release build:

```bash
keytool -genkey -v -keystore keystore/katiba-jam-release.keystore \
  -alias katibajam -keyalg RSA -keysize 2048 -validity 10000
```

Then **copy the `keystore/` folder somewhere durable** — a password
manager's file storage, an encrypted USB drive, a private cloud folder — and
record the passwords you set, e.g. in `keystore/SECRETS_DO_NOT_COMMIT.txt`
(gitignored). If this file is lost, there is no way to recover it, and no
way to ever ship an update to the same Play Store listing again — you'd have
to publish as a brand new app.

## What you need to do (these steps require your own accounts — I can't do
them for you)

### 1. Push this project to GitHub
Codemagic builds from a git repository. Initialize git here if you haven't
already, create an empty repository on GitHub (don't initialize it with a
README), and push:

```bash
git init
git add -A
git commit -m "Initial native app scaffold for Katiba Jam"
git remote add origin https://github.com/<your-username>/katiba-jam-app.git
git branch -M main
git push -u origin main
```

(The keystore folder won't be pushed — it's gitignored, which is correct.)

### 2. Set up Codemagic
1. Go to [codemagic.io](https://codemagic.io) and sign up (free tier covers
   this comfortably).
2. Connect your GitHub account and add the `katiba-jam-app` repository.
3. Codemagic will detect `codemagic.yaml` automatically — you don't need to
   configure workflows by hand.
4. Add these **environment variable groups** (Codemagic dashboard → your app
   → Environment variables), matching the group names in `codemagic.yaml`:

   **Group `android_signing`** (mark each as "Secret"):
   - `KJ_KEYSTORE_BASE64` — the keystore file itself, base64-encoded
     (Codemagic's env vars are text-only, so binaries go in base64). Once
     you've generated the keystore (see above), produce this with:
     `certutil -encode keystore\katiba-jam-release.keystore keystore\katiba-jam-release.keystore.base64.txt`
     (Windows) — open the `.txt` file, strip the `-----BEGIN/END
     CERTIFICATE-----` lines, and paste the remaining base64 as the value.
   - `KJ_KEYSTORE_PASSWORD` — the password you set when generating the
     keystore
   - `KJ_KEY_ALIAS` — `katibajam`
   - `KJ_KEY_PASSWORD` — the key password you set when generating the
     keystore

   (`KJ_KEYSTORE_PATH` is already set as a plain, non-secret value directly
   in `codemagic.yaml` — nothing to add for it.)

   **Group `google_play`**:
   - `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS` — a Google Cloud service account
     JSON key with Play Console API access. Create it via Play Console →
     Setup → API access → Create new service account, following
     [Google's guide](https://developers.google.com/android-publisher/getting_started).

   **iOS: App Store Connect integration** (not an env var group — a named
   integration):
   - In App Store Connect, go to Users and Access → Integrations → App Store
     Connect API → generate a new API key with the "App Manager" role.
     Download the `.p8` key file (you only get one download).
   - In Codemagic, go to your Team settings → Integrations → App Store
     Connect → "Add integration", upload that key, and name the integration
     **`codemagic_asc`** — this exact name must match the
     `integrations.app_store_connect` value in `codemagic.yaml`. Codemagic
     uses this both to sign the build and to upload it — no certificates or
     provisioning profiles to manage by hand.

### 3. Create the app listings
- **App Store Connect** (appstoreconnect.apple.com): "My Apps" → "+" → New
  App. Bundle ID `com.rkigano.katibajam`, name "Katiba Jam".
- **Google Play Console** (play.google.com/console): "Create app", same name
  and package `com.rkigano.katibajam`.
- Fill in the listing fields using `STORE_LISTING.md` — description,
  keywords, category, age rating, and the privacy policy URL above.
- Both stores require screenshots before you can submit — see the note at
  the bottom of `STORE_LISTING.md`.

### 4. Trigger the builds
Once the above is connected, start a build in Codemagic for both the
`android-release` and `ios-release` workflows. On success:
- Android: an `.aab` is uploaded to the Play Console **Internal testing**
  track as a draft (per `codemagic.yaml` — you'll review and publish it from
  there).
- iOS: an `.ipa` is uploaded to **TestFlight** automatically.

### 5. Test, then submit for review
Install via TestFlight (iOS) and the Internal testing link (Android) on real
phones first. Once you're happy, promote each to production/public review
from App Store Connect and Play Console directly — that's the step that
starts Apple/Google's review process.

## Local development (optional)

To build locally instead of via CI, you'll need:
- **Android**: JDK 17+ and Android Studio (the SDK it installs).
- **iOS**: a Mac with Xcode. Not available in this environment — Codemagic
  is the path for iOS until/unless you get access to one.

Once set up, the usual Capacitor loop is:
```bash
npm install
npx cap sync
npx cap open android   # opens Android Studio
npx cap open ios       # opens Xcode (Mac only)
```

If you edit `www/index.html` or `www/data/constitution.js` in the future,
run `npx cap sync` again before rebuilding so the native projects pick up
the change.

To preview the web app directly in a browser during development (no
Capacitor needed):
```bash
npx http-server www -p 8934 -c-1
```
then open `http://localhost:8934`.
