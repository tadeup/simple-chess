---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# Game screen (index.html: the whole app)

Scope: the single game screen and its two overlays, the time-control sheet and the settings page. Visitor mode: Operate. Build path: code-led (Operate surfaces are always code-led; there is no image generation in this session).

Audience/job: two friends on one Android phone or tablet who want to play a timed game right now. Task frequency: every move, often under clock pressure.

Constraints: the look is pinned by the brief ("2d, nothing too unlike chess.com or lichess"). Familiar controls only. The app works offline. It runs in the Capacitor WebView on Android and as a PWA.

## Direction contract

THESIS: The board fills the screen and the clock is the only other element. This refuses the category default of a board boxed in by avatars, ratings, chat, banners and tab bars.

OWN-WORLD: Warm charcoal chrome that recedes (#1b1a18 ground, #262422 bars), with a lichess-wood board (#f0d9b5 / #b58863) and cburnett pieces. Type is the system sans (Roboto on Android), with heavy tabular clock numerals. The active clock lights up as an off-white slab and turns red under 10 s. One brass accent (#d4a24c, from the wooden-set world; never chess.com's green) marks only the primary action and the selection. Icons use a 2px round stroke.

STORY: Open the app, tap a time control, play. Nothing needs learning because every control behaves like chess.com or lichess. Whose turn it is can be read from arm's length from the lit clock alone.

FIRST VIEWPORT: Portrait phone. The opponent's clock bar sits above an edge-to-edge square board, your clock bar sits below it, and a slim toolbar of five icons runs along the bottom (new, undo, pause, end, settings). On first launch the time-control sheet (12 presets in a 3-column grid, plus a custom option) rises over the dimmed board, and one tap starts the game.

FORM: Canon, the category standard played straight at full fidelity. The brief pinned it, so no concept-seed roll was run and there is no seed key. Signature interaction: when dragged, a piece lifts (scales up, gains a soft shadow, and a target ring follows the finger). Taps get a 140 ms ease-out slide. Every move plays a synthesized wooden "tock" with a slight pitch variation. By default the board stays still and the pieces spin in place to face the player to move (260 ms). Black's bar always faces the far side. Turning the whole board between turns is an option.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Product name: working name "Just Chess", not confirmed.
- The "support me" purchase is deferred to a future version.
