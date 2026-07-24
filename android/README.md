# Shield AI — Android SMS (Content Provider)

Android-only SMS inbox app that reads device SMS via the **Android SMS Content Provider**
and syncs parsed messages to the existing FastAPI backend.

**No Twilio. No third-party SMS gateways. No iOS support.**

Project path: `android/` (repo root).

---

## API_BASE_URL (single configuration point)

| Layer | File | Role |
|-------|------|------|
| Default | [`android/gradle.properties`](gradle.properties) → `API_BASE_URL=...` | Checked-in default (emulator) |
| Override | [`android/local.properties`](local.properties) → `API_BASE_URL=...` | Machine-specific (gitignored). Copy from [`local.properties.example`](local.properties.example) |
| Build | [`android/app/build.gradle.kts`](app/build.gradle.kts) | Reads local → gradle.properties → injects `BuildConfig.API_BASE_URL` |
| Runtime | [`ApiConfig.kt`](app/src/main/java/ai/shield/android/data/ApiConfig.kt) | App code reads `ApiConfig.BASE_URL` |
| HTTP | [`ShieldApi.kt`](app/src/main/java/ai/shield/android/data/ShieldApi.kt) | Retrofit `.baseUrl(ApiConfig.BASE_URL)` — **all network calls** |

**Do not hard-code hosts in Kotlin.** Change the URL only via properties files above.

### How to change the backend URL

**Android Emulator** (maps `10.0.2.2` → host `localhost`):

```properties
# android/gradle.properties  (or local.properties)
API_BASE_URL=http://10.0.2.2:8000/api/v1/
```

**Physical Android device** (same Wi‑Fi as your computer):

```properties
# android/local.properties
API_BASE_URL=http://192.168.x.x:8000/api/v1/
```

Replace `192.168.x.x` with your computer’s LAN IP. Ensure FastAPI CORS allows the app origin if needed, and that the phone can reach port `8000`.

**Production** (HTTPS):

```properties
API_BASE_URL=https://api.your-domain.com/api/v1/
```

After changing the URL, **Sync Gradle / rebuild** so `BuildConfig` regenerates.

---

## Features (verified)

- [x] `READ_SMS` permission in `AndroidManifest.xml`
- [x] Runtime permission request (`MainActivity` + `ActivityResultContracts`)
- [x] SMS Content Provider (`SmsContentProviderReader` → `Telephony.Sms.Inbox`)
- [x] Connect SMS button
- [x] Disconnect SMS toggle
- [x] Real-time monitoring (`SmsContentObserver` + `IncomingSmsReceiver`)
- [x] Sync to backend `POST /api/v1/sms/ingest` (auto fraud scan)
- [x] OTP detection (`OtpDetector`)
- [x] Fraud scan trigger via ingest `auto_scan=true`

---

## Prerequisites

1. **Backend running** on port 8000:
   ```bash
   cd backend
   source .venv/bin/activate
   uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
   ```
2. Apply SMS DB schema if needed:
   ```bash
   # Supabase SQL editor: backend/scripts/create-android-sms.sql
   # or: cd backend && npx prisma db push
   ```
3. Android Studio **Ladybug+** (or SDK 35 + JDK 17) with an emulator/device.

---

## Fix: “SDK location not found”

Create `android/local.properties` (gitignored) with your SDK path:

```properties
sdk.dir=/opt/homebrew/share/android-commandlinetools
API_BASE_URL=http://10.0.2.2:8000/api/v1/
```

If you use Android Studio, open the `android/` folder once — Studio writes `sdk.dir` automatically.

Homebrew SDK install (if you have no SDK yet):

```bash
brew install --cask android-commandlinetools
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
yes | sdkmanager --licenses
sdkmanager --install "platform-tools" "platforms;android-35" "build-tools;35.0.0"
```

Then:

```bash
cd android
./gradlew :app:assembleDebug
```

## How to run

### Option A — Android Studio (recommended)

1. **File → Open** → select the `android/` folder (not the monorepo root).
2. Let Gradle sync (wrapper uses Gradle 8.9).
3. Set `API_BASE_URL` as above.
4. Run configuration → **app** → pick emulator/device → Run.

### Option B — Command line

```bash
cd android

# First time: ensure local.properties has sdk.dir (Android Studio creates this), e.g.
# sdk.dir=/Users/YOU/Library/Android/sdk

./gradlew :app:assembleDebug
./gradlew :app:installDebug
```

#### `No connected devices!` on installDebug

The APK built successfully — Gradle just has nowhere to install it. Connect **one** of:

**Physical phone (fastest)**
1. Phone: Settings → About phone → tap Build number 7× → enable **Developer options**
2. Enable **USB debugging**
3. Plug in USB → allow debugging prompt
4. Verify: `adb devices` (should list your phone)
5. Re-run: `./gradlew :app:installDebug`

**Android Emulator**
1. Install Android Studio → Device Manager → Create Device (Pixel + API 35)
2. Start the emulator until the home screen appears
3. `adb devices` should show `emulator-5554`
4. `./gradlew :app:installDebug`

Or sideload the already-built APK:
```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Launch the app, paste a Shield AI JWT (from web login / `/api/v1/auth/...`), tap **Connect SMS**, grant **READ_SMS**.

---

## Backend endpoints used

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/sms/connection` | Connection status |
| POST | `/api/v1/sms/connect` | Mark connected |
| POST | `/api/v1/sms/disconnect` | Disconnect |
| POST | `/api/v1/sms/ingest` | Upsert parsed SMS + auto-scan |
| GET | `/api/v1/sms/inbox` | Paginated synced inbox |

---

## Project layout

```
android/
  gradle.properties              # API_BASE_URL default
  local.properties.example       # template for sdk.dir + URL override
  app/build.gradle.kts           # injects BuildConfig.API_BASE_URL
  app/src/main/java/ai/shield/android/
    MainActivity.kt              # UI + runtime permission
    data/ApiConfig.kt            # runtime BASE_URL
    data/ShieldApi.kt            # Retrofit client
    data/SessionStore.kt
    sms/SmsContentProviderReader.kt
    sms/SmsContentObserver.kt
    sms/IncomingSmsReceiver.kt
    sms/OtpDetector.kt
    ui/SmsViewModel.kt
```
