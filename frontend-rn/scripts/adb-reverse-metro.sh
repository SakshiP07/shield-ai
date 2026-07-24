#!/usr/bin/env bash
# Fix "Unable to load script" for a USB-connected Android device.
set -euo pipefail
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

echo "Devices:"
adb devices -l

if ! adb devices | grep -qE $'\tdevice$'; then
  echo ""
  echo "No device in 'device' state."
  echo "1) Plug phone via USB"
  echo "2) Enable USB debugging (+ Security settings on OPPO)"
  echo "3) Set USB mode to File transfer / MTP"
  echo "4) Accept the Allow USB debugging prompt"
  echo "5) Put phone on the SAME Wi‑Fi as this Mac (not mobile data/5G)"
  echo "6) Re-run: npm run android:reverse"
  exit 1
fi

adb reverse tcp:8081 tcp:8081
adb reverse tcp:8000 tcp:8000
echo ""
echo "Port reverse active:"
adb reverse --list
echo ""
echo "Reload the app (shake device → Reload, or press R in Metro)."
echo "If it still fails, Dev Settings → Debug server host → localhost:8081"
