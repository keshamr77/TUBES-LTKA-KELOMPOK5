# 🚀 Setup & Run Guide — Absensi Lokasi

## Current Situation

The `Mobile/` folder has all the **Dart source code** (lib/, widgets/, services/, screens/) and `pubspec.yaml`, but is **missing the Flutter project scaffold** — the native platform files (gradle, Kotlin, Swift, etc.) that Flutter needs to build and run.

---

## Step 1: Install Flutter SDK

> [!IMPORTANT]
> Flutter is **not installed** on this machine. You need to install it first.

### Option A: Manual Install (Recommended)
1. Download from [flutter.dev/docs/get-started/install/windows](https://docs.flutter.dev/get-started/install/windows)
2. Extract to a folder (e.g., `C:\flutter`)
3. Add `C:\flutter\bin` to your **PATH** environment variable
4. Restart terminal

### Option B: Via Chocolatey
```powershell
choco install flutter
```

### Verify Installation
```powershell
flutter --version
flutter doctor
```

`flutter doctor` will also tell you if you're missing Android Studio, Android SDK, etc.

---

## Step 2: Install Android Studio (for Android Emulator)

1. Download [Android Studio](https://developer.android.com/studio)
2. During install, ensure these are checked:
   - Android SDK
   - Android Virtual Device (AVD)
3. Open Android Studio → **SDK Manager** → Install **Android SDK Command-line Tools**
4. Accept licenses:
   ```powershell
   flutter doctor --android-licenses
   ```

---

## Step 3: Create the Flutter Project Scaffold

Since the `Mobile/` folder is missing native platform files, we need to regenerate them. Run these commands:

```powershell
# 1. Go to your project root directory
cd "D:\Kuliah\Sem 6\LTKA\Tubes\Code\TUBES-LTKA-KELOMPOK5"

# 2. Create a fresh Flutter project in a temp folder
flutter create --org com.kelompok5 temp_project

# 3. Copy native scaffold INTO Mobile/
# Copy android folder
Copy-Item -Path "temp_project\android" -Destination "Mobile\" -Recurse -Force

# Copy ios folder
Copy-Item -Path "temp_project\ios" -Destination "Mobile\" -Recurse -Force

# Copy web folder (optional)
Copy-Item -Path "temp_project\web" -Destination "Mobile\" -Recurse -Force

# Copy other scaffold files
Copy-Item -Path "temp_project\analysis_options.yaml" -Destination "Mobile\" -Force
Copy-Item -Path "temp_project\.gitignore" -Destination "Mobile\" -Force

# 4. Delete the temp project
Remove-Item -Path "temp_project" -Recurse -Force
```

> [!WARNING]
> Do **NOT** copy `temp_project\lib\` or `temp_project\pubspec.yaml` — those would overwrite your actual app code!

---

## Step 4: Update AndroidManifest.xml Permissions

The generated `AndroidManifest.xml` will be overwritten with the scaffold default. You need to ensure our permissions are in place. The file at `Mobile/android/app/src/main/AndroidManifest.xml` should already have the correct permissions (INTERNET, ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION). Verify after copying.

---

## Step 5: Install Dependencies

```powershell
cd d:\Kuliah\Sem 6\LTKA\Tubes\Code\TUBES-LTKA-KELOMPOK5\Mobile
flutter pub get
```

This downloads all packages listed in `pubspec.yaml` (geolocator, http, shared_preferences, etc.)

---

## Step 6: Configure Backend API URL

Open `lib/config/constants.dart` and update line 9:

```dart
// TODO: Ganti dengan URL backend production Anda
static const String baseUrl = 'https://your-api-server.com/api';
```

Replace with your actual backend URL (check the `Backend/` folder in this repo if your team has one).

---

## Step 7: Run the App

### Option A: Android Emulator
```powershell
# List available emulators
flutter emulators

# Launch an emulator
flutter emulators --launch <emulator_name>

# Run the app
cd Mobile
flutter run
```

### Option B: Physical Android Device
1. Enable **Developer Options** on your phone (Settings → About → tap Build Number 7 times)
2. Enable **USB Debugging**
3. Connect via USB cable
4. Run:
   ```powershell
   flutter devices          # Verify device is detected
   flutter run              # Build & deploy
   ```

### Option C: Chrome (Web - for quick testing without emulator)
```powershell
flutter run -d chrome
```
> Note: GPS features won't work properly on web.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `flutter` not recognized | Add Flutter `bin/` to PATH, restart terminal |
| `No devices found` | Start Android emulator or connect physical device |
| `Gradle build failed` | Run `flutter clean` then `flutter pub get` again |
| `SDK not found` | Run `flutter doctor` and follow its recommendations |
| `minSdkVersion` error | In `Mobile/android/app/build.gradle`, set `minSdk` to `21` |

---

## Quick Summary (TL;DR)

```
1. Install Flutter SDK + Android Studio
2. flutter create --org com.kelompok5 temp_project
3. Copy android/, ios/ from temp_project → Mobile/
4. cd Mobile && flutter pub get
5. Update lib/config/constants.dart with your API URL
6. flutter run
```
