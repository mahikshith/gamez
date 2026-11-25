# Test Eggscape on an iPhone (xtool)

The iPhone app is `eggscape/ios`: the web game in a full-screen web view, like the Android app.
You build it and put it on your iPhone with [xtool](https://github.com/xtool-org/xtool). No Mac is needed.
A free Apple ID is enough.

What the iPhone app does today:
- The whole game, with its save kept on the phone.
- Vibration through the iPhone's Taptic Engine (Settings > Vibration in the game).
- Sound follows the silent switch, like other games.
- The speed log opens the iPhone's share sheet.
- No purchases, ads or reminders yet. The app runs the web version's rules: the shop sells for coins only, and a
  bonus "video" pays out after a short wait.

## 1. Set up your computer (once)

Pick the part for your computer: A (Windows), B (Mac) or C (Linux).

### A. Windows (WSL + usbipd)

1. In PowerShell as administrator: `wsl --install -d Ubuntu-24.04`. Restart if asked. Open "Ubuntu".
2. In PowerShell as administrator: `winget install --interactive --exact dorssel.usbipd-win`.
3. In Ubuntu, do every step of C (Linux) below.
4. Plug in the iPhone. In PowerShell as administrator:
   - `usbipd list` and find the line "Apple Mobile Device USB". Note its BUSID (for example `2-3`).
   - `usbipd bind --busid 2-3` (once).
   - `usbipd attach --wsl --busid 2-3 --auto-attach` (each time you install; leave this window open).
5. In Ubuntu, `ideviceinfo` must print your iPhone's details. If it says no device, run `sudo usbmuxd` and try again.

If xtool later fails with `AFCClient.Error.muxError`, follow
[this comment](https://github.com/xtool-org/xtool/issues/19#issuecomment-2898986718) (it connects through iTunes on
Windows instead of usbipd).

### B. Mac

1. Install Xcode from the App Store. Open it once and accept everything it asks.
2. Install [Homebrew](https://brew.sh), then: `brew install xtool-org/tap/xtool node`.
3. Run `xtool setup`. Choose `1` (Password) and sign in with your Apple ID and its 2FA code.

### C. Linux

1. Install Swift 6.4: follow https://swift.org/install/linux. Then `swift --version` must say `Swift version 6.4`.
2. Install the iPhone USB tools: `sudo apt-get install usbmuxd libimobiledevice-utils`.
3. Install Node.js 22: https://nodejs.org/en/download (the nvm steps work in WSL too). `node --version` must say v22.
4. Download Xcode in a browser: the version on
   [xtool's Linux page](https://github.com/xtool-org/xtool/blob/main/Documentation/xtool.docc/Installation-Linux.md)
   (Xcode 27.1 today) from https://developer.apple.com/download/all/?q=Xcode. You sign in with your Apple ID.
   On Windows, copy it into Ubuntu: `cp /mnt/c/Users/<you>/Downloads/Xcode_27.1.xip ~/`.
5. Install xtool:
   ```bash
   curl -fL "https://github.com/xtool-org/xtool/releases/latest/download/xtool-$(uname -m).AppImage" -o xtool
   chmod +x xtool
   sudo mv xtool /usr/local/bin/
   xtool --help
   ```
   If it says FUSE is missing: `sudo apt-get install libfuse2t64` (Ubuntu 24.04) or `libfuse2` (22.04).
6. Run `xtool setup`.
   - Choose `1` (Password). Sign in with your Apple ID and its 2FA code. A spare Apple ID is fine.
   - When it asks for `Xcode.xip`, give the path from step 4 (for example `~/Xcode_27.1.xip`). This takes a while.
   - `swift sdk list` must now show `darwin`.

## 2. Build and install (each time)

1. Get the code and build the game page for iOS:
   ```bash
   git clone <this repository> gamez
   cd gamez/eggscape
   npm ci
   node tools/build.mjs --target ios
   ```
   This writes the page to `ios/Resources/game/`. Run it again after every change to the game.
2. Unlock the iPhone and plug it in (Windows: run the `usbipd attach` line from A.4 first).
3. Install:
   ```bash
   cd ios
   xtool dev
   ```
   The first build takes a few minutes. Later ones are fast.
4. The iPhone asks "Trust This Computer?". Tap Trust and enter your passcode. If xtool then stops with an error, run
   `xtool dev` again.

## 3. On the iPhone (first time)

1. If xtool says Developer Mode is off: on the iPhone open Settings > Privacy & Security > Developer Mode, turn it on,
   restart, and confirm. Then run `xtool dev` again.
2. Tap Eggscape on the home screen. It says "Untrusted Developer". Open Settings > General > VPN & Device Management,
   tap your Apple ID, tap Trust.
3. Tap Eggscape again. It plays.

## Good to know

- With a free Apple ID the app stops opening after 7 days. Plug in and run `xtool dev` again. Your progress stays.
- A free Apple ID can have 3 such apps on a phone at a time.
- On a Mac you can also try it without a phone: `xtool dev run --simulator`.
- GitHub Actions has an "iOS build check" workflow. It runs when the iPhone app changes and proves it still compiles. It does not install anything.
