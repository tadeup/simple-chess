# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated, with the user's constraints: "whichever solution is fastest and easiest to deploy to the Play Store, and maybe add a 'purchase to support me' option in the future."

Chosen: vanilla TypeScript built with Vite (no UI framework at runtime, so startup and input latency stay minimal), wrapped for Android with Capacitor 8 (the standard Play Store path, with existing plugins for a future in-app "support me" purchase, e.g. RevenueCat). The same build also ships as an offline-capable PWA.

## Users

Two friends sitting together with one Android phone or tablet. They pass the device back and forth, or lay it flat between them, and want to start a game in seconds.

## Product Purpose

A no-nonsense chess board for over-the-board play on a single device: choose a time control and play. Success means opening the app and making the first move within a couple of seconds, with no sign-up, no network and no distractions.

## Positioning

Just the board and the clock. There is no online play, no accounts, no engine during play, no puzzles, no ads and no feed. Everything a neighbouring chess app adds around the board is deliberately absent. The one exception is a local engine for analysing a game once it's over (added 2026-10-14 at the user's request).

## Operating Context

- The device usually stays put between the players. By default the board stays still and the pieces turn around after each move to face the player to move. The user changed this on 2026-10-13: "the board flipping every time by default actually sucks".
- The other modes stay available in Settings:
  - the whole board turns each move, for passing the phone
  - face to face: Black's pieces always face the far side
  - fixed
- Games are played under a chess clock (bullet through classical, or no clock).
- Sessions are interrupted (calls, app switches), so games must survive backgrounding and pause safely.

## Capabilities and Constraints

- Full legal chess: castling, en passant, promotion, check, checkmate, stalemate, insufficient material, threefold repetition, 50-move rule, and flag-fall (drawn when the side with time left cannot mate).
- Time-control picker with common presets plus a custom setting. The custom setting has a Fischer Random (Chess960) toggle, added 2026-10-14 at the user's request. Castling is entered king-onto-rook, and a rematch replays the same setup.
- A settings page, kept out of the way, holding only a few reasonable options.
- Undo (takeback) is visible on the main screen by default (user's choice).
- Plays a minimal, satisfying sound when a piece moves.
- Post-game analysis, available only after a game ends:
  - A local Stockfish 19 (lite single-threaded WebAssembly, about 1.9 MB) shows the evaluation, the top 3 lines and best-move arrows for any position of the finished game. It runs offline, on the device only, and loads only when analysis opens.
  - Stockfish is GPLv3. The app ships it unmodified as a separate program that the app talks to over UCI, with COPYING.txt and a pointer to its exact source in public/engine/.
- Must feel fast on Android: instant start, no jank while dragging pieces.
- Works fully offline and needs no account.
- Future (not built now): an optional "purchase to support me" in-app product. On the Play Store this must go through Google Play Billing.

## Brand Commitments

- Visual direction, as the user put it: "pretty but minimalistic (2d, nothing too unlike chess.com or lichess)". Familiar conventions are the commitment. The craft bar is chess.com's and lichess's boards.
- Don't use chess.com's signature green on interface accents. The user said the green buttons made the app "too uncomfortably close to chess.com". The accent is brass, from the wood-board world. The board color themes stay as they are; the user said they're fine.
- Name: "Simple Chess" (the user's Play Store listing name, 2026-10-16). Package name: com.tadeupassos.simplechess (com.justchess.app was already taken on Android).

## Evidence on Hand

None. There are no testimonials, ratings or store listing copy, and none may be invented.

## Product Principles

1. The board is the product. Anything that is not the board or the clock must earn its place or move into Settings.
2. Zero to first move in one tap.
3. Speed is a feature: every interaction responds in the same frame.
4. Familiar beats novel. Chess players should never have to relearn a control.
5. Offline, private, single device. Nothing leaves the phone.

## Accessibility & Inclusion

No product-specific requirement was established. Baseline: readable clocks at arm's length, sufficient contrast, and touch targets of at least 44px.
