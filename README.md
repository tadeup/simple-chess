# Simple Chess

A no-nonsense chess board for two people sharing one phone or tablet. Pick a time control and play. There is no online play, no account and no ads, and it works fully offline.

- **Two players, one device.** The board stays still and the pieces turn around after each move to face whoever plays next. Black's clock faces the far side. Settings also offers:
  - *Board turns each move*, for passing the phone back and forth
  - *Face to face*: Black's pieces always face the far side
  - *Fixed*
- **Chess clock.** Twelve presets from 1+0 to 30+20, plus *No clock* and a custom setting. White's first move starts the clock, increments are added after each move, and a flag fall against a side that can no longer mate is scored as a draw (the lichess rule).
- **All the rules.** Castling, en passant, under-promotion, check, checkmate, stalemate, insufficient material, threefold repetition and the 50-move rule.
- **Feel.** Tap-to-move or drag. Dragged pieces lift above your finger. Each move plays a short synthesized wooden *tock*, with a light vibration on Android.
- **Fischer Random (Chess960).** A toggle in the custom game settings starts from one of the 960 shuffled back-rank setups. To castle, move the king onto its rook. A rematch replays the same setup.
- **Analyse the game afterwards.** Once a game is over, **Analyze** opens a local Stockfish 19. It shows the evaluation, the three best lines and arrows for the best moves, for every position as you step through the game. It runs on the device and is never available during play.
- **Undo, pause, resign, draw.** Games survive app switches: the clock pauses automatically and resumes with a tap.
- **Settings.** Orientation, four board colors, legal-move dots, coordinates, auto-queen, the undo button, sound and vibration.

## Stack

The app is vanilla TypeScript with no UI framework at runtime. The whole game is about 16 KB of gzipped JavaScript plus 7 KB of CSS, including the piece set. Vite builds it. A small custom rules engine (`src/engine/chess.ts`) generates moves in microseconds, so touch input never waits on the rules. Android packaging is [Capacitor 8](https://capacitorjs.com), the standard route from a web app to the Play Store, with existing plugins for in-app purchases. The same build also works as an installable offline PWA.

## Requirements

- Node.js 22 or newer. Capacitor 8 and Vite 8 need it; Node 20 is end-of-life.
- For the Android build: JDK 21 and the Android SDK (platform 36). Android Studio ships both; its bundled JDK is in `Android Studio/jbr`.

## Develop

```bash
npm install
npm run dev        # dev server with instant reload; prints a "Network" address for your phone
npm test           # engine perft suites, chess.js differential fuzz, rules, sounds
npm run build      # type-check + production build into dist/
```

### Trying changes on your phone without reinstalling

Run `npm run dev` on the PC and keep it running. The phone needs to be on the same Wi-Fi. The first time, Windows asks whether Node.js may accept connections: allow it on **private** networks, and make sure your Wi-Fi is set to Private in Windows.

- **In the phone's browser (nothing to install).** Open the `Network` address that `npm run dev` prints, e.g. `http://192.168.0.72:5173`, in Chrome on the phone. Code changes appear immediately, and CSS changes don't even reload the page. The few native-only features (Capacitor haptics, keep-awake, the back button) use their web fallbacks here.
- **Inside the real Android app.** `npm run dev:android` builds **Simple Chess Dev**, a separate app (`com.tadeupassos.simplechess.dev`) that sits next to the real one and loads the dev server instead of its bundled files. Install it once; this is automatic if the phone is plugged in with USB debugging on, otherwise copy over the APK it prints. From then on, open the app while `npm run dev` is running and every change shows up live, with the native plugins working. Rebuild it only if your PC's local address changes or you add a native plugin. If the dev server isn't running, the app shows a page explaining what to start.

`node scripts/smoke.mjs http://localhost:4173/` drives the production build (`npx vite preview --port 4173`) in headless Chrome. It plays real games with taps and touch drags and writes screenshots to `.impeccable/review/`.

## Android

```bash
npm run android:apk      # APK to install directly: android/app/build/outputs/apk/release/app-release.apk
npm run android:bundle   # Play Store bundle:       android/app/build/outputs/bundle/release/app-release.aab
```

Both commands rebuild the web app, copy it into `android/` (`npm run android:sync`), and run the Gradle wrapper on any OS. `JAVA_HOME` must point at a JDK 21. You can also open `android/` in Android Studio and use *Build › Generate Signed App Bundle*.

### Signing

Release builds are signed with the upload key described in `android/keystore.properties` (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`). Both that file and `android/app/upload-keystore.jks` are git-ignored on purpose. **Back them up somewhere safe**: Google Play identifies your updates by this key. If `keystore.properties` is missing, release builds fall back to the debug key, so they still install for testing but can't be uploaded.

### Publishing to Google Play

1. Decide the application ID before the first upload; it can never change afterwards. It is currently `com.tadeupassos.simplechess`. To change it, edit `appId` in `capacitor.config.json` plus `namespace`/`applicationId` in `android/app/build.gradle`, and move `MainActivity.java` to the matching package folder.
2. Create the app in Play Console and keep **Play App Signing** on. Upload `app-release.aab`.
3. Store listing: the 512×512 icon is `public/icons/icon-512.png`. Four phone screenshots (1080×1920 JPEG) are in `store/screenshots/`; regenerate them with `node scripts/store-shots.mjs` while `npx vite preview --port 4173` is running. Play also asks for a 1024×500 feature graphic, which isn't included.
4. **Data safety:** the app collects and shares no data. Play Console still asks for a privacy policy URL.
5. For each update, bump `versionCode` and `versionName` in `android/app/build.gradle` (and `version` in `package.json`).

## Adding a "support me" purchase later

Google Play requires its own billing system for in-app tips and donations to the developer. The least work is:

1. `npm install @revenuecat/purchases-capacitor` (RevenueCat handles receipts; free tier), or `cordova-plugin-purchase` if you'd rather talk to Play Billing directly.
2. Create a one-time in-app product (e.g. `supporter`) in Play Console.
3. Add a "Support the app" row to the Settings page (`index.html`, `#page-settings`) that calls the plugin from `src/platform.ts`, which is where the other native integrations live.

## Project layout

```
src/engine/chess.ts     rules engine (0x88 board, legal moves incl. Chess960 castling, SAN/PGN, draws, flag-fall)
src/game/clock.ts       chess clock (monotonic time, increments, pause, flag)
src/game/settings.ts    settings + persistence helpers
src/ui/board.ts         board view: diffing renderer, tap/drag input, promotion picker, turn animation
src/ui/sound.ts         procedural move sounds (Web Audio)
src/analysis/           Stockfish worker wrapper and UCI parsing for post-game analysis
public/engine/          Stockfish 19 WebAssembly build, its GPL license and source notice
src/app.ts              game controller, player bars, dialogs, persistence
src/platform.ts         Capacitor bridges (haptics, keep-awake, back button) with web fallbacks
scripts/                icon rasterizer, service-worker generator, smoke test, Chess960 Stockfish cross-check
android/                Capacitor Android project
```

## The analysis engine

`public/engine/` holds Stockfish 19 compiled to WebAssembly by [Stockfish.js](https://github.com/nmrugg/stockfish.js) v19.0.1, in its "lite single-threaded" build: 1.9 MB, with no special server headers needed. The files are unmodified copies from the `stockfish` npm package. The app starts it in a Web Worker only when analysis opens, and talks to it over UCI.

Stockfish is free software under the **GNU GPL v3**. You may ship it in your app, including a paid one, as long as you:

- keep `COPYING.txt` with it
- point people to the exact source (`SOURCE.txt` and the Settings → about text do this)
- publish any changes you make to the engine

The app's own code can stay under your license, because it only talks to the engine as a separate program. For a commercial launch, a short check with someone who knows open-source licensing is cheap insurance.

To update the engine, run `npm pack stockfish@<version>`, copy the two `stockfish-*-lite-single.*` files and `Copying.txt` into `public/engine/`, then update the file name in `src/analysis/engine.ts` and the version, hashes and source link in `SOURCE.txt`.

## Credits

The chess pieces are the cburnett set by Colin M. L. Burnett. Icons are adapted from Lucide. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
