---
name: Just Chess
description: A board and a clock for two players sharing one device, and nothing else.
colors:
  brass: "#d4a24c"
  brass-press: "#bf8e3c"
  on-brass: "#1c160c"
  flag-red: "#d4473f"
  low-time-red: "#f08a84"
  dot-black: "#0d0c0b"
  knob: "#f6f4f0"
  knob-off: "#cfcac3"
  charcoal-ground: "#1b1a18"
  charcoal-bar: "#262422"
  charcoal-raised: "#322f2c"
  charcoal-raised-2: "#3e3a36"
  clock-idle-bg: "#2d2a27"
  clock-idle-fg: "#a39d96"
  bone: "#ece9e4"
  ash: "#aaa49d"
  ash-faint: "#827c75"
  hairline: "rgb(255 255 255 / 0.07)"
  board-wood-light: "#f0d9b5"
  board-wood-dark: "#b58863"
  board-green-light: "#ebecd0"
  board-green-dark: "#739552"
  board-blue-light: "#dee3e6"
  board-blue-dark: "#8ca2ad"
  board-gray-light: "#dcdad6"
  board-gray-dark: "#a19d97"
  arrow-blue: "rgb(0 48 136)"
typography:
  clock:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "calc(var(--bar-h) * 0.46)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  headline:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.35
    letterSpacing: "-0.015em"
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.005em"
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.35
  player-name:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0.005em"
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.35
  eval:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.35
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  engine-line:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  tool-label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0.01em"
rounded:
  board: "2px"
  clock: "9px"
  control: "12px"
  tool: "14px"
  group: "16px"
  card: "18px"
  sheet: "20px"
  pill: "999px"
  round: "50%"
spacing:
  hairline-gap: "4px"
  stack: "8px"
  bar-gap: "12px"
  group: "14px"
  gutter: "16px"
  sheet: "18px"
  section: "22px"
  landscape-gutter: "28px"
components:
  button-primary:
    backgroundColor: "{colors.brass}"
    textColor: "{colors.on-brass}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "50px"
  button-primary-active:
    backgroundColor: "{colors.brass-press}"
  button-secondary:
    backgroundColor: "{colors.charcoal-raised}"
    textColor: "{colors.bone}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "50px"
  button-secondary-active:
    backgroundColor: "{colors.charcoal-raised-2}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ash}"
    rounded: "{rounded.control}"
    height: "44px"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.ash}"
    rounded: "{rounded.round}"
    size: "44px"
  tool:
    backgroundColor: "transparent"
    textColor: "{colors.ash}"
    typography: "{typography.tool-label}"
    rounded: "{rounded.tool}"
    height: "60px"
  clock-idle:
    backgroundColor: "{colors.clock-idle-bg}"
    textColor: "{colors.clock-idle-fg}"
    typography: "{typography.clock}"
    rounded: "{rounded.clock}"
    padding: "0 0.42em"
  clock-active:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.charcoal-ground}"
  clock-low-idle:
    backgroundColor: "{colors.clock-idle-bg}"
    textColor: "{colors.low-time-red}"
  clock-low-active:
    backgroundColor: "{colors.flag-red}"
    textColor: "#ffffff"
  time-control-tile:
    backgroundColor: "{colors.charcoal-raised}"
    textColor: "{colors.bone}"
    rounded: "{rounded.control}"
    height: "66px"
  sheet:
    backgroundColor: "{colors.charcoal-bar}"
    rounded: "{rounded.sheet}"
    padding: "18px 16px"
  result-card:
    backgroundColor: "{colors.charcoal-bar}"
    rounded: "{rounded.card}"
    padding: "26px 18px 14px"
  settings-group:
    backgroundColor: "{colors.charcoal-bar}"
    rounded: "{rounded.group}"
  settings-row:
    typography: "{typography.body}"
    padding: "10px 16px"
    height: "58px"
  switch-off:
    backgroundColor: "{colors.charcoal-raised-2}"
    rounded: "{rounded.group}"
    width: "48px"
    height: "28px"
  switch-on:
    backgroundColor: "{colors.brass}"
  status-button:
    backgroundColor: "transparent"
    textColor: "{colors.ash}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  engine-score-white:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.charcoal-ground}"
    rounded: "6px"
    padding: "3px 6px"
    width: "56px"
  engine-score-black:
    backgroundColor: "{colors.dot-black}"
    textColor: "{colors.bone}"
    rounded: "6px"
    padding: "3px 6px"
    width: "56px"
  eval-gauge:
    backgroundColor: "{colors.dot-black}"
    rounded: "4px"
    height: "8px"
  toast:
    backgroundColor: "{colors.charcoal-raised-2}"
    textColor: "{colors.bone}"
    rounded: "{rounded.pill}"
    padding: "10px 18px"
---

# Design System: Just Chess

## Overview

**Creative North Star: "The Club Table at Night"**

A warm charcoal room with one lit wooden board in it. The chrome is dark, warm and recessive (charcoal ground and bars, brown-grey neutrals, never blue-grey) so the board and the running clock are the only things that read at a glance. The board itself is the category standard played straight: lichess wood squares, cburnett pieces, the familiar highlight vocabulary. Nothing about the board or its controls is reinvented, because the players should never have to learn anything.

The system is dense where it must be and empty everywhere else. The game screen holds exactly four kinds of thing: two player bars, the board, a toolbar of labelled stroke icons, and (only after a game ends) a single tappable status line. After a game the players can also switch into analysis, where an on-device Stockfish replaces the player bars with an evaluation header and up to three engine lines, and draws its candidate moves as blue arrows on the board. Overlays (time-control sheet, end-game sheet, result card, settings page) slide in over the board and leave again. Feel matters as much as look: pieces slide on a 140ms ease-out, a dragged piece lifts under the finger, after each move the pieces spin in place to face the player to move (or, in the alternate mode, the whole board dips and turns), and every move lands with a synthesized wooden "tock" whose pitch varies a few percent so repeated moves never sound mechanical. Capture, castle, check and game end each have their own voice (sharper wood, a double knock, a knock under a bell, a two-note chime); a short bright ping warns at 10 seconds.

The type is the platform's own sans (Roboto inside the Android WebView), chosen because this is an operated tool on a native device. Its one expressive use is the clock: heavy tabular numerals sized from the bar height so they read from arm's length.

**Key Characteristics:**
- Warm charcoal chrome that recedes; the board is the only light surface.
- The lit clock is the turn indicator: an off-white slab for the side to move, a dim slab for the side waiting.
- One brass accent, reserved for the primary action and chosen state.
- Labelled 2px round-stroke SVG icons; no glyph or emoji icons.
- Canon chess-app conventions at full fidelity, with motion and sound doing the polish.

## Colors

A warm, nearly monochrome charcoal-and-bone palette with one brass accent and one red, surrounding a light, saturated board.

### Primary
- **Brass** (`brass`): the primary action ("Start game", "Rematch"), and every chosen state in the chrome: on switches, checked radios, the filled part of sliders, the ring around the selected board-colour swatch, the inset ring on the last-used time control, and the focus outline. Pressed state darkens to **Brass Press**; text on brass is the near-black **On Brass**. Text selection uses brass at 35%. The Android native accent matches it. Brass replaced an earlier leaf green that read too close to chess.com.

### Secondary
- **Flag Red** (`flag-red`): time trouble and flag-fall only. The active clock turns to a red slab with white numerals under 10 seconds and when flagged. The waiting clock under 10 seconds keeps its dim slab and shows **Low-Time Red** (`low-time-red`, the `--clock-low-fg` custom property) numerals instead.

### Neutral
- **Charcoal Ground** (`charcoal-ground`): the app background, the settings page, and the dark numerals on the lit clock. Also the Android theme-color.
- **Charcoal Bar** (`charcoal-bar`): sheets, the result card, and settings groups; one step up from the ground.
- **Charcoal Raised / Raised 2** (`charcoal-raised`, `charcoal-raised-2`): fills for secondary buttons and time-control tiles; Raised 2 is their pressed state, the off-switch track, and the unfilled slider track. Raised 2 is also the toast fill.
- **Clock Idle** (`clock-idle-bg`, `clock-idle-fg`): the waiting clock's slab and numerals; deliberately quiet but still legible (about 5:1).
- **Bone** (`bone`): primary text, the lit clock slab, and the white player dot.
- **Dot Black** (`dot-black`): the black player dot, always with a 1px white 35% ring so it holds on the charcoal bar.
- **Knob** (`knob`) and **Knob Off** (`knob-off`): the light physical knobs. Knob is the slider thumb and the switch knob when on; Knob Off is the dimmer switch knob when off.
- **Ash** (`ash`): secondary text: idle player names, tool labels, descriptions, group titles, the status line.
- **Ash Faint** (`ash-faint`): non-text indicators only (the unchecked radio ring). At about 4.2:1 on the ground it is below body-text contrast, so text never uses it; the faintest text, such as the about line, is Ash.
- **Hairline** (`hairline`): 1px dividers between settings rows and the scrolled page-header edge.

### Board themes
Four user-selectable square pairs: **Wood** (default), **Green**, **Blue**, **Gray** (`board-*-light` / `board-*-dark`). Each theme also carries its own translucent highlight set (last move, selected square, legal-move dot, capture ring, drag target), tuned per theme rather than shared: wood and blue use the lichess yellow-green last-move wash with dark-green move hints; green uses chess.com's yellow wash with black-alpha hints; gray uses an amber wash with a blue selection. Coordinates are drawn in the opposite square colour. Check is a red radial glow under the king on every theme.

**Arrow Blue** (`arrow-blue`) is the one board overlay shared by every theme: engine arrows in analysis, at 78% opacity for the best line, 45% for the second and 30% for the third. It is a board marking, not an interface accent.

### Named Rules
**The One Light Rule.** The only light surfaces on the game screen are the board and the active clock. Chrome never gets a light fill.

**The Brass Is Earned Rule.** Brass marks the primary action or a chosen state, nothing else. It is never decoration, never a heading colour, never a background wash. Board highlights use the board theme's own colours, not the app accent.

## Typography

**UI Font:** system-ui (Roboto on Android, Segoe UI on Windows, SF on Apple), with Helvetica Neue and Arial fallbacks.

**Character:** one native sans in several weights. Hierarchy comes from weight (500 to 800) and size, not from a second family. Every number that changes (clocks, time-control tiles, slider outputs, material advantage, the move counter in the status line) uses tabular figures so nothing jitters.

### Hierarchy
- **Clock** (700, bar height x 0.46, which lands between about 24px and 37px; -0.01em; tabular): the clock numerals. The only large type on the game screen.
- **Headline** (800, 26px, -0.015em): the result card's outcome ("White wins").
- **Title** (700, 19 to 21px): sheet titles (19px), the settings page title (21px), the paused cover (20px).
- **Body** (500 to 600, 16px, line-height 1.35): settings row titles, button labels (600; primary buttons 700), the custom-time toggle.
- **Player name** (600, 15px, +0.005em): player bars; Ash while waiting, Bone on turn.
- **Eval** (800, 22px, -0.01em, tabular): the engine evaluation in the analysis header ("+0.84", "−1.20", "#3", "#−2", or "1–0" / "0–1" on a mated position). Signs use a true minus.
- **Engine line** (400, 14px, line-height 1.5): engine lines in Ash, with the first move and its number in 700 Bone. The score pill beside it is 13px/700 tabular; the engine meta ("Stockfish 19 · depth N") is 13px/500 in Ash.
- **Label** (600, 14px): settings group titles and the status line (Ash, with the key phrase in Bone at 700). Descriptions run 13.5px at 400 in Ash.
- **Tool label** (600, 11.5px, +0.01em): the word under each toolbar icon.

### Named Rules
**The Tabular Rule.** Any digit that can change while you look at it is set in tabular figures.

**The Weight Ladder Rule.** Emphasis is a step up in weight or from Ash to Bone, never a new colour or an all-caps label.

## Layout

The layout is computed, not breakpointed. On every resize the app measures the safe-area-inset viewport and sets four custom properties: board size, bar height, side-column width, and toolbar height (fixed 60px). The board is always a whole multiple of 8px (never under 160px) so squares land on whole pixels.

- **Portrait** (the default): a single centred column. Top player bar, board, bottom player bar, a flexible band, then the toolbar on the bottom edge. The board runs edge to edge on phones and gains a 28px margin from 600px wide. Bar height is 52 to 80px, taken from the spare vertical space. Leftover space sits above the top bar and in the band below the bottom bar; the status line, when present, sits centred in that band.
- **Landscape** (when width is over 1.15 x height and at least 560px): board on the left at full height minus 24px; a 28px gutter; a side column 250 to 380px wide (30% of the width). Top to bottom, the column holds the opponent's bar, the status band, the toolbar, and the player's own bar. The toolbar sits directly above the player's bar so the controls stay next to the hand that is moving. Bar height here is 56 to 80px (16% of the board).
- **Analysis** (after a game only): the player bars and status line leave the grid. In portrait the engine header takes the opponent bar's row (board width, 10px side padding) and the engine lines take the rows below the board, scrolling if they overflow. In landscape the header sits at the top of the side column with the lines under it; the toolbar keeps its row. The board shows White at the bottom with no piece flip, whatever the orientation setting.
- **Short landscape** (landscape and at most 560px tall): sheets widen to 720px and the time-control grid becomes six columns of 60px tiles.
- **Short screens** (at most 700px tall): engine lines clamp to one line instead of two and their rows tighten from 8px to 5px vertical padding.
- **Overlays:** sheets are bottom-anchored, max 520px wide, 18px top padding, 16px sides, safe-area padding at the bottom. The settings page is full-screen with a 560px content column and a sticky 60px header. The result card is centred, max 340px.

Spacing rhythm: 8px between stacked buttons and grid tiles, 12px inside player bars, 14px inside padded groups, 16px horizontal padding in rows and sheets, 22px above each settings group title.

### Named Rules
**The Whole Square Rule.** The board size is floored to a multiple of 8px. Never let a layout produce fractional squares.

## Elevation & Depth

The game screen is flat: depth there comes from tonal steps (ground, bar, raised) and from the lit clock. Shadows appear only on things that float above the board, and they are soft, dark and diffuse, never hard or offset.

### Shadow Vocabulary
- **Sheet lift** (`box-shadow: 0 -12px 40px rgb(0 0 0 / 0.4)`): bottom sheets, cast upward over the board.
- **Card lift** (`box-shadow: 0 24px 64px rgb(0 0 0 / 0.5)`): the centred result card.
- **Float** (`box-shadow: 0 8px 24px rgb(0 0 0 / 0.35)`): the toast and the round play button on the paused cover.
- **Knob** (`box-shadow: 0 1px 5px rgb(0 0 0 / 0.45)` slider thumb; `0 1px 3px rgb(0 0 0 / 0.35)` switch knob): small physical controls.
- **Inset rings** (`inset 0 0 0 1px rgb(255 255 255 / 0.14)` on the eval gauge, `/ 0.16` on Black score pills): keep Dot Black shapes visible on the charcoal ground. Rings, not shadows.
- **Lifted piece** (`filter: drop-shadow(0 board*1.2% board*1.4% rgb(0 0 0 / 0.38))`): a piece being dragged.
- **Scrolled header** (`0 1px 0 hairline, 0 8px 16px -8px rgb(0 0 0 / 0.5)`): the settings header once its page has scrolled.

Scrims: dialogs dim the screen to `rgb(10 9 8 / 0.55)`; the promotion picker covers the board with `rgb(22 21 19 / 0.6)`; the paused cover uses `rgb(27 26 24 / 0.78)`.

### Named Rules
**The Flat Board Rule.** Nothing on the game screen casts a shadow at rest. Depth is earned by floating (sheet, card, toast) or by being picked up (a dragged piece).

## Shapes

The board is a near-square slab (2px corners) and everything around it is softly rounded, with the radius growing as the object gets larger: clock 9px, buttons and tiles 12px, tool press pads 14px, settings groups 16px, result card 18px, sheet top corners 20px. Pills (999px) for the toast and the untimed clock; full circles for icon buttons, player dots, radio buttons, switch knobs, promotion choices and the paused play button. Promotion choices morph from circle to a 6% rounded square on press. Borders are almost absent: rows are divided by a 1px hairline, and selection is shown with inset or offset rings (2px brass ring) rather than outlines.

## Components

### Player bar
Quiet identity, loud clock.
- **Structure:** a 10px colour dot and the player name on the left, captured pieces (18px, overlapped by half, grouped by type, with a "+N" material advantage) under the name, the clock on the right. No avatars, ratings or chips.
- **Dot:** Bone for White; Dot Black with a 1px white 35% ring for Black.
- **Turn state:** the side to move shows its name in Bone and its dot at full opacity. The waiting side is dimmed: name in Ash, dot at 55% opacity. Changes take 160ms.
- **Facing the far side:** in the default "pieces face the player to move" mode and in face-to-face mode, Black's bar (the top bar) is rotated 180 degrees so the far player reads it upright.

### Clock (signature)
- **Shape:** a slab as tall as the bar minus 12px, 9px corners, min-width 4.1em, numerals right-aligned.
- **Idle:** Clock Idle slab and numerals. **Active:** Bone slab, Charcoal Ground numerals. **Under 10s:** active turns Flag Red with white numerals; idle keeps its slab with Low-Time Red numerals. **Flagged:** Flag Red slab.
- **Untimed games:** the clock collapses to a 32px pill that is invisible while waiting and lit (Bone) on turn, so the lit pill alone carries whose move it is.

### Board (signature)
- **Squares** drawn with a single conic-gradient on the board element; pieces (cburnett SVG) and highlights are absolutely positioned 12.5% tiles.
- **Highlights:** last move wash, selected square, legal-move dots (18% radius), capture rings (outer 20%), red radial check glow, and a white inset square outline under a dragged piece.
- **Motion:** tap moves slide in 140ms on the system ease-out; captured pieces fade out in 140ms; new pieces fade in over 160ms. Dragging lifts the piece (1.45x on touch, 1.08x with a mouse) and gives it a soft drop shadow; on touch it also rides above the finger toward its owner's "up", so it moves down the screen when the piece is drawn upside down. The drag leaves a 28% ghost on its origin square, and shows a translucent circle (twice a square's size) under the finger over the target square.
- **Orientation modes:** four, chosen in Settings.
  - **Pieces face the player to move** (default): the board stays still and every piece spins 180 degrees in place toward the side to move, in 260ms on `cubic-bezier(0.4, 0, 0.2, 1)`. The spin starts about 160ms after a tap-move (once its slide lands) or 60ms after a drop.
  - **Board turns each move:** the whole board turns 180 degrees in 380ms on `cubic-bezier(0.65, 0, 0.35, 1)` and dips to 70% scale mid-turn so its corners stay inside the frame; coordinates fade out for the turn.
  - **Face to face:** White's pieces face the near side and Black's face the far side all game.
  - **Fixed:** White always at the bottom.
  - Under reduced motion, both the spin and the board turn are skipped.
- **Sound and touch:** each move plays a synthesized wood knock (pitch varies about 3.5% either way); captures are a sharper double knock, castling two knocks 88ms apart, check a sharp knock with a bell over it, and game end a two-note chime. Captures vibrate harder than quiet moves.

### Toolbar
- **Style:** up to five equal tools (max 104px each), a 24px stroke icon over an 11.5px label, Ash.
- **States:** press shows a 7% white pad and Bone text; hover (pointer devices only) lifts the text to Bone; disabled tools drop to 32% opacity. After a game, Back, Next and Analyze replace the in-game tools. Analyze is a toggle: while analysis is on, it is pressed and drawn in Brass, a chosen state under the Brass Is Earned Rule.

### Status line
A quiet button, shown only after a game ends: one centred line, 14px/600 in Ash with its key phrase in Bone (the result, or "Reviewing" and the move being shown), followed by a 16px chevron. It is 44px tall with 12px corners and has no fill; pressing it gives a 6% white tint. Tapping it reopens the result card. It is hidden during play and during analysis.

### Analysis panel
The engine's read on the position, in the player bars' place.
- **Header:** the evaluation (Eval type, Bone) left and the engine meta (Ash) right on one baseline, 12px apart; 8px below them, the gauge.
- **Gauge:** an 8px bar with 4px corners. Bone fills White's share over a Dot Black track with a light inset ring. The share follows lichess's winning-chances curve (mate pins it to 0% or 100%) and moves in 300ms on the ease-out.
- **Lines:** up to three rows, divided by hairlines, 10px between the score pill and the moves. The score pill (min 56px, 3px 6px padding, 6px corners, 13px/700 tabular) is Bone with ground-coloured text when the line favours White, and Dot Black with Bone text and a light inset ring when it favours Black. Moves are in SAN with move numbers, clamped to two lines.
- **Note row:** when there are no lines, a single 14px Ash row says what is happening: "Starting the engine…", "Thinking…", "Checkmate. White won.", "Stalemate." or the error message.
- **Entry:** the Analyze tool in the post-game toolbar, or "Analyze the game" (a secondary button with the search icon) on the result card.

### Engine arrows
An SVG layer above pieces and coordinates and below a dragged piece. One arrow per engine line, from the centre of the source square to the centre of the target, in Arrow Blue. The best line has a thicker shaft and a larger head (shaft 0.2 of a square, head 0.52 wide and 0.46 long, against 0.14, 0.4 and 0.36) and is drawn on top.

### Buttons
- **Shape:** gently rounded (12px), full width, 50px min height, 16px text with 10px gap to an icon or piece.
- **Primary:** Brass with On Brass text at 700. **Secondary:** Charcoal Raised with Bone text. **Quiet:** transparent with Ash text, 44px tall.
- **Press:** 120ms to the darker fill and a 98.5% scale. No hover lift.
- **Icon button:** 44px circle, transparent, Ash icon; press fills 8% white.
- **Piece badge:** resign buttons carry the king on a 30px light-square tile (7px corners).

### Time-control tiles
A 3-column grid (6 columns in short landscape) of 66px Charcoal Raised tiles: the time in 21px/700 tabular Bone, the kind (Bullet, Blitz...) in 12.5px Ash. Press darkens and scales to 98%. The last-used choice carries a 2px inset brass ring. A full-width "Custom" tile with a rotating chevron expands the custom panel: two sliders, then a Fischer Random (Chess960) option row, then the primary Start button. The option row reuses the settings-row anatomy without the group container: title 16px/500, description 13.5px Ash, a switch on the right, 14px gap, vertically centred, the whole row tappable. A Chess960 game always marks the Custom tile as last-used and shows the switch on; on the board, castling is shown as the ordinary capture ring on the king's own rook.

### Sheets, card and page
- **Sheet:** Charcoal Bar, 20px top corners, slides up in 260ms on the ease-out over a 55% scrim.
- **Result card:** Charcoal Bar, 18px corners, scales in from 95%, headline outcome, reason in Ash, then Rematch (primary), New game (secondary), Copy PGN (quiet).
- **Settings page:** full-screen Charcoal Ground, slides in from the right; grouped Charcoal Bar lists with 16px corners and 58px rows divided by hairlines. The closing about text (13px Ash) credits the pieces, icons and Stockfish; its links stay Ash, underlined 2px below the text with an Ash Faint underline.
- **Toast:** a Raised 2 pill (14.5px/500 Bone, 10px 18px padding) with the float shadow, rising 8px into place over 200ms just above the toolbar.

### Inputs
- **Switch:** 48 x 28 track (Raised 2 off, Brass on), 22px knob (Knob Off when off, Knob when on) that slides 20px in 200ms.
- **Radio:** 22px circle, a 2px Ash Faint ring that turns brass, with a brass dot scaling in.
- **Slider:** 6px track filled brass up to the value, 26px Knob thumb with a knob shadow.
- **Board-colour swatch:** a 2x2 mini-board (10px corners, max 76px), selected with a 2px brass ring offset by 2px.
- **Focus:** a 2px brass outline offset 2px on every focusable element.

## Do's and Don'ts

### Do:
- **Do** let the lit clock carry whose turn it is: Bone slab for the side to move, dim slab for the side waiting, and dim the waiting player's name and dot with it.
- **Do** keep chrome on the charcoal steps (ground, bar, raised, raised 2) and keep the board and the active clock as the only light surfaces.
- **Do** reserve brass for the primary action and chosen state.
- **Do** use tabular figures for every changing number.
- **Do** draw icons as 24px SVG strokes (2px, round caps and joins) with a text label in the toolbar.
- **Do** quantize the board to multiples of 8px and size bars and clock type from the board, not from fixed breakpoints.
- **Do** give every move motion and sound: 140ms ease-out slides, a lifted drag, and the wood knock.
- **Do** keep touch targets at least 44px.
- **Do** leave pinch-zoom enabled; stop accidental gestures with `touch-action: none` on the board and `manipulation` on the body instead of locking the viewport.
- **Do** honour reduced motion: every transition and animation collapses to 1ms.

### Don't:
- **Don't** add avatars, ratings, chat, banners or a tab bar around the board; the player bar is a dot, a name, captures and a clock.
- **Don't** put a status line on screen during normal play; it appears only after the game.
- **Don't** offer engine analysis during a game; it is reachable only after the game ends.
- **Don't** colour engine arrows with the app accent or per board theme; they are always Arrow Blue, ranked by opacity.
- **Don't** use brass for decoration, headings or backgrounds, or for board highlights.
- **Don't** use chess.com's signature green for any interface accent. The Green board theme is a board colour choice, not chrome.
- **Don't** use red for anything but time trouble, flag-fall, and the check glow.
- **Don't** set any text in Ash Faint; it is for non-text indicators.
- **Don't** cast shadows on the game screen at rest, and never use hard offset shadows.
- **Don't** add uppercase eyebrow labels or kickers above titles.
- **Don't** treat the system face as a display face: if a brand or marketing surface is added, it needs its own type decision.
