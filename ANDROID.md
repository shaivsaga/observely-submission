
# Observely for Android

The Android prototype warns about suspicious text exposed in message notifications from supported SMS and chat apps. It uses the same bundled sanitized A0 derivative as the browser and requests no `INTERNET` permission. It does not block, delete, log, upload or store incoming messages. Warning notifications can include matched words. Their visibility is controlled by Android's notification settings.

## Build and install

Install JDK 17 and Android SDK Platform 34, Build-Tools 34.0.0 and Platform-Tools. Set `JAVA_HOME` to the JDK and `ANDROID_HOME` to the SDK. The repository includes the Gradle 8.7 wrapper. The first build may need internet access to resolve tools and dependencies.

From the repository root on macOS or Linux:

```sh
./gradlew :app:testDebugUnitTest :app:assembleDebug :app:lintDebug --no-daemon --max-workers=1
"$ANDROID_HOME/platform-tools/adb" install -r app/build/outputs/apk/debug/app-debug.apk
```

On Windows PowerShell with the default Android Studio SDK location:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
.\gradlew.bat :app:testDebugUnitTest :app:assembleDebug :app:lintDebug --no-daemon --max-workers=1
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r .\app\build\outputs\apk\debug\app-debug.apk
```

The second command in each block installs the debug APK on a connected device. Observely supports Android 8.0 (API 26) and up, targets API 34, and uses application ID `app.veritas.scamalerts`.

## Set up warnings

1. Enable Observely in Android's Notification access settings. The permission grants broad access to the notification stream. The app filters it to an allowlist of SMS apps and supported WhatsApp, Telegram, Messenger, Signal, Viber and LINE packages.
2. Allow Observely to post notifications on Android 13 and newer.
3. Check that Observely's app notifications and the **Scam warnings** channel are enabled.

A warning requires a supported notification whose preview contains the message text. Hidden, truncated or summarized previews can prevent detection. The setup indicators reflect permissions and channel settings. They do not establish that a device delivers notifications correctly.

## Verification and results

The Android JVM suite exercises setup decisions and listener settings parsing. The APK build and lint cover the source and package. Notification delivery, native rendering and TalkBack have not been verified on a device or emulator.

The sanitized derivative retains A0's 0.51 cutoff and eight-rule warning layer. In the historical 328-message half-split check, original A0 had 0.993 precision, 0.863 recall, 1 false alarm and 22 misses. The prior 0.58 configuration in that comparison had 1.000 precision, 0.825 recall, 0 false alarms and 28 misses. The dataset informed the app's cutoff and rules. This is a dataset-specific check. See [SUBMISSION.md](SUBMISSION.md) for the separate frozen M1 and full clean-D2 A0 results.
