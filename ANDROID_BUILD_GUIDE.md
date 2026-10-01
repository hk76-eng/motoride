# MotoRide Android Native Floating Overlay – Setup & Build Guide

This document describes the native Android system-wide floating overlay button ("chat-head" style) implemented for MotoRide.

---

## 1. Feature Overview

The **Floating Ride Button** is a true native Android system overlay that runs above all other applications (Uber, inDrive, WhatsApp, Chrome, Google Maps, etc.) using Android's `SYSTEM_ALERT_WINDOW` permission and a persistent `ForegroundService`.

### Key Behaviors:
1. **MotoRide Open (Foreground)**: The floating overlay is automatically hidden so it never blocks the map or UI.
2. **MotoRide Minimized / Another App Open (Background)**: The circular MotoRide floating icon appears above other applications.
3. **Draggable Chat-Head**: The user can drag the floating icon anywhere on the screen. Releasing it snaps smoothly to the nearest edge (left or right).
4. **Tap to Return**: Tapping the floating icon brings MotoRide to the foreground immediately with `FLAG_ACTIVITY_REORDER_TO_FRONT | FLAG_ACTIVITY_SINGLE_TOP` (preventing duplicate activities) and hides the overlay.
5. **No Duplicates**: Single-instance guarantee (`sInstance` check & `isAttachedToWindow()` check) prevents duplicate floating icons.
6. **Graceful Permission Handling**: If `SYSTEM_ALERT_WINDOW` is not yet granted, MotoRide directs the user to Android Settings ("Display over other apps") and continues running without crashing.

---

## 2. Native Project Structure

The native Android files are located in `/android`:

```
android/
├── build.gradle                                            # Top-level Gradle config
├── variables.gradle                                        # SDK versions (compileSdk 34, minSdk 22)
└── app/
    ├── build.gradle                                        # Android app module config
    └── src/
        └── main/
            ├── AndroidManifest.xml                         # Permissions & Service declaration
            ├── java/com/motoride/app/
            │   ├── MainActivity.java                       # Activity lifecycle hooks & web bridge
            │   ├── FloatingOverlayService.java             # System overlay window manager & drag listener
            │   └── FloatingOverlayPlugin.java              # Capacitor native bridge plugin
            └── res/
                ├── drawable/
                │   ├── ic_motoride_floating.xml            # Vector logo for floating chat-head
                │   └── bg_floating_overlay.xml             # Circular background shape with ripple & emerald ring
                ├── layout/
                │   └── floating_overlay_layout.xml         # Floating view hierarchy
                └── values/
                    └── strings.xml                         # Notification & app strings
```

---

## 3. Required Android Permissions in `AndroidManifest.xml`

```xml
<!-- Required for native system-wide overlay over other apps -->
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.WAKE_LOCK" />

<!-- Foreground Service declaration -->
<service
    android:name=".FloatingOverlayService"
    android:enabled="true"
    android:exported="false"
    android:foregroundServiceType="specialUse">
    <property
        android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
        android:value="MotoRide quick-access floating chat-head overlay over other applications." />
</service>
```

---

## 4. How to Build the Android APK

### Step A: Build the Web App Production Bundle
In your terminal, compile the React Vite bundle:

```bash
npm run build
```

This outputs production web assets into the `dist/` folder.

### Step B: Sync with Capacitor (if using Capacitor CLI)
If Capacitor CLI is installed on your development machine:

```bash
npx cap sync android
```

### Step C: Build Debug APK via Gradle

Using command line inside the `android/` directory:

```bash
cd android
./gradlew assembleDebug
```

The compiled APK will be located at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Step D: Build Release APK via Android Studio
1. Open **Android Studio**.
2. Select **Open an Existing Project** and choose the `android` folder.
3. Wait for Gradle sync to complete.
4. Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
5. Transfer `app-release.apk` or `app-debug.apk` to your Android device.

---

## 5. Testing the Floating Ride Button on Device

1. Install the APK on your Android device:
   ```bash
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```
2. Open **MotoRide**.
3. Open the **Passenger Profile** or **Captain Profile** drawer.
4. Under **App & Display Settings**, toggle:
   **"Floating Ride Button" -> ON**
5. If prompted, Android will open the **Display over other apps** screen for MotoRide. Toggle **Allow display over other apps**.
6. Switch back to MotoRide.
7. Press the Android **Home** button or open another app (e.g. Uber, inDrive, WhatsApp, or Google Chrome).
8. You will see the circular **MotoRide Floating Icon** floating smoothly on your screen above that app.
9. **Drag** it anywhere to position it. It will snap cleanly to the left or right edge.
10. **Tap** the floating icon: MotoRide opens immediately to the foreground and the floating icon disappears!
11. Leave MotoRide again: the floating icon reappears over other apps.
