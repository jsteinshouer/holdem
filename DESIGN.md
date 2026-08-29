---
name: Friendly Hold'em
description: A card room printed flat — a private-link, play-money Texas Hold 'em table that tells a stranger exactly what is legal.
colors:
  felt-900: "#0A3527"
  felt-700: "#0F4B36"
  felt-600: "#16694C"
  felt-500: "#1C8160"
  felt-300: "#7FBFA5"
  brass-700: "#8A6420"
  brass-500: "#C4952F"
  brass-400: "#D9AF57"
  paper: "#FBF7EE"
  paper-edge: "#E3DCCB"
  card-ink: "#16181A"
  card-suit-red: "#B4262B"
  room-light: "#F2EEE6"
  panel-light: "#FBF9F4"
  ink-light: "#161A18"
  ink-muted-light: "#5A6360"
  room-dark: "#0F1412"
  panel-dark: "#161C19"
  ink-dark: "#EDEFEC"
  ink-muted-dark: "#96A09B"
  chip-1: "#F2F0EA"
  chip-5: "#C0392F"
  chip-25: "#1E7A4D"
  chip-100: "#202426"
  chip-500: "#6B3FA0"
  state-good-light: "#1A7A4A"
  state-good-dark: "#2E9E63"
  state-error-light: "#B4262B"
  state-error-dark: "#E8756F"
typography:
  display:
    fontFamily: "Bitter, Rockwell, 'Roboto Slab', Georgia, serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Bitter, Rockwell, 'Roboto Slab', Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.06em"
  money:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.2
    fontFeature: "tnum"
  rank:
    fontFamily: "Bitter, Rockwell, 'Roboto Slab', Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 0.9
rounded:
  sm: "6px"
  md: "10px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  xxxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.brass-500}"
    textColor: "{colors.card-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.brass-400}"
    textColor: "{colors.card-ink}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink-light}"
    typography: "{typography.title}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
    height: "44px"
  button-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted-light}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
  playing-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.card-ink}"
    typography: "{typography.rank}"
    rounded: "{rounded.sm}"
    width: "92px"
    height: "128px"
  seat-plate:
    backgroundColor: "{colors.panel-light}"
    textColor: "{colors.ink-light}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  seat-plate-acting:
    backgroundColor: "{colors.panel-light}"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  input-text:
    backgroundColor: "{colors.panel-light}"
    textColor: "{colors.ink-light}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    height: "44px"
---

<!-- PARTIAL SEED: the world, palette, type and layout grammar below were committed with the user
     on 2026-08-29 and are normative. The Components section mixes shipped primitives (the playing
     card, buttons, inputs) with specified-not-yet-built ones (the seat ring, chip stacks, the
     action bar). Re-run /impeccable document after the table rebuild to carbonize real tokens. -->

# Design System: Friendly Hold'em

## Overview

**Creative North Star: "The House Rules Card"**

Every card room props a laminated rules card on the table. It is quiet, exact, and unglamorous, and its entire job is to tell a stranger precisely what is legal right now. That card — not the chandelier, not the felt, not the neon outside — is what this product is. Friendly Hold'em is a table where someone who has never played can sit down mid-game and act correctly, because the surface states the rules rather than assuming them.

The world is the card-room canon, played straight: broadcloth green, brass, paper cards. It is deliberately not reinterpreted, not ironic, and not a themed variation. It is also **printed flat**. There is no light source in this system — no gradients standing in for depth, no photographic texture, no rendered chips catching a highlight. The card room is delivered as a graphic system: flat inks, exact registration, hairline rules. This is what keeps a card room from becoming a casino.

Color follows a **committed** strategy: one saturated field, the felt, owns the table region outright, and everything else is neutral room, paper, or brass. The room around the table is what changes between themes; the felt and the cards barely move. A card room is a lit room with a green table in it, and at night it is a dark room with the same green table in it.

**Key Characteristics:**
- Flat at rest — shadow is a state signal, never decoration
- One saturated field (the felt), everything else neutral
- Cards and chips are theme-invariant physical objects
- Money is always tabular; digits never jitter
- Every state readable in grayscale
- Density serves scanning; chrome recedes and data leads

## Colors

A single committed green field, warm neutral rooms on either side of the theme switch, brass used sparingly as the mark of authority and turn, and a functional chip palette that encodes value rather than mood.

### Primary
- **Broadcloth Green** (`felt-600` #16694C in light, `felt-700` #0F4B36 in dark): the table field itself. This is the one saturated color permitted to own a large region, and it should own 30–50% of the table view. `felt-900` (#0A3527) draws the rail and the inset ring; `felt-500` (#1C8160) marks a raised or hovered felt region; `felt-300` (#7FBFA5) is the only felt tone legible as small text on a dark felt ground.

### Secondary
- **Rail Brass** (`brass-500` #C4952F, `brass-400` #D9AF57 on dark, `brass-700` #8A6420 as text on light): the dealer button, the rail edge, the active-turn marker, and primary action fills. Brass means *authority or turn*, never emphasis in general.

### Tertiary
- **Chip denominations** (`chip-1` #F2F0EA, `chip-5` #C0392F, `chip-25` #1E7A4D, `chip-100` #202426, `chip-500` #6B3FA0): real card-room denominations, used as a functional encoding on chip stacks and bet amounts. These are not decorative colors and must never be borrowed for UI chrome.

### Neutral
- **Card Paper** (`paper` #FBF7EE, edge `paper-edge` #E3DCCB, ink `card-ink` #16181A, suit red `card-suit-red` #B4262B): the playing card, identical in both themes.
- **Room** (`room-light` #F2EEE6 / `room-dark` #0F1412): the ground the table sits in. Warm plaster by day, near-black with the faintest green cast by night.
- **Panel** (`panel-light` #FBF9F4 / `panel-dark` #161C19): rail, log, chat, seat plates.
- **Ink** (`ink-light` #161A18 / `ink-dark` #EDEFEC) and **Muted Ink** (`ink-muted-light` #5A6360 / `ink-muted-dark` #96A09B): text.

### Named Rules

**The Object Constancy Rule.** Cards and chips are physical objects and do not change with the theme. Card paper, card ink, suit red, and every chip denomination hold the same value in light and dark. Only the room around them flips. A card that inverts is not a card.

**The Brass Scarcity Rule.** Brass marks authority or turn and nothing else — dealer button, the acting seat, the primary action. If more than one brass element is visible per region, one of them is decoration and must be removed.

**The Chip Encoding Rule.** Chip colors mean denominations. Never reuse `chip-5` red for an error, `chip-25` green for success, or `chip-100` black for text. State colors are separate tokens for exactly this reason.

**The Brass Contrast Ceiling.** Brass on felt reaches roughly 3.1:1 — adequate for large text, icons and UI boundaries, never for body copy. Body text on felt is `paper`, which clears 6:1.

## Typography

**UI Font:** the native system stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`)
**Slab Font:** Bitter (with `Rockwell, "Roboto Slab", Georgia, serif`)

**Character:** the UI face is deliberately anonymous — it is the rules card's body copy, and it should have no opinion that competes with the table. The single slab carries the two things that are *printed objects* rather than interface: card rank corners and the name of the hand you hold. That contrast is the entire typographic idea.

Load Bitter self-hosted as a subset woff2, not from a font CDN. This is an installable PWA with a service-worker-cached app shell; an external font request undermines both the offline shell and first paint.

### Hierarchy
- **Display** (Bitter 700, 2rem, 1.1): the pot readout, and the hand result at showdown.
- **Headline** (Bitter 700, 1.5rem, 1.2): street name, hand number, dialog titles.
- **Title** (system 600, 1.125rem, 1.3): action buttons, seat names, panel headings.
- **Body** (system 400, 1rem, 1.5): chat, action log, tutorial copy, help text.
- **Label** (system 600, 0.75rem, 0.06em tracking, uppercase): metric captions — POT, TO CALL, STACK, BLINDS.
- **Money** (system 600, 1rem, `tabular-nums`): every currency figure in the interface.
- **Rank** (Bitter 700, 1.125rem, 0.9): card corner ranks and pips.

Scale is a 1.2 ratio: 0.75 / 0.875 / 1 / 1.125 / 1.5 / 2rem. Six steps, and no seventh.

### Named Rules

**The Tabular Money Rule.** Every figure that can change — stack, pot, current bet, to-call, raise amount — sets `font-variant-numeric: tabular-nums`. A stack that shifts width when it drops from $1,000 to $995 makes the table feel unstable during the exact moment a player is deciding.

**The Two Voices Rule.** The slab appears on card ranks and hand names. Nothing else. The moment it reaches a button or a panel heading, the distinction between object and interface collapses and the system reads as a generic themed app.

## Layout

**The ring is the layout.** Seats are positioned on a single elliptical field by a per-seat angle custom property, and the ring is always rotated so the viewer sits at 6 o'clock with opponents arcing above in clockwise turn order. There is one seat component and one topology; a phone and a desktop render the same DOM.

Reshaping is driven by **container queries on the table region**, not viewport media queries. The table adapts to its own box, so it behaves correctly in a phone, in a narrow desktop column, and in a test viewport, with no breakpoint cliff. Desktop widens the ellipse and places the rail as a column beside it; narrow widths compress the ellipse vertically and move the rail to a bottom sheet holding the same components.

**Four regions form a fixed mask. They never appear or disappear; only their proportions change.**

| Region | Wide | Narrow |
|---|---|---|
| Masthead | identity, connection, theme, invite | condensed bar |
| Table field | wide ellipse; opponents arced, board and pot centered | tall ellipse; opponents arc across the top |
| Your station | seat plate, hole cards, hand name, action bar | pinned bottom, thumb-reachable |
| Rail | column beside the table | tab-switched bottom sheet |

Container max width 1180px. Spacing is a 4px base scale (4 / 8 / 12 / 16 / 24 / 32 / 48) and nothing between the steps.

### Named Rules

**The One Tree Rule.** No element exists twice to serve two screen sizes. A component that has a `mobile-` twin toggled by `display: none` is a defect, not an adaptation. Where wide and narrow genuinely differ, the same component moves to a different container.

**The One Place Rule.** A player's identity and their position are the same drawn object. There is no roster panel listing people who are already visible on the table.

## Elevation & Depth

**The system is flat at rest.** No element carries a shadow in its resting state. Depth comes from tonal layering — room behind panel behind felt — and from hairline rules at `ink / 14%`.

Shadow exists, but only as a **response**: the acting seat, a focused control, an open sheet. This makes depth a channel that carries information rather than decoration, and it gives state a second signal that is independent of hue.

### Shadow Vocabulary
- **Turn lift** (`0 0 0 2px brass-500, 0 4px 12px rgb(0 0 0 / 18%)`): the seat whose turn it is. The only persistent shadow in the interface, and it moves as the action moves.
- **Sheet lift** (`0 -8px 24px rgb(0 0 0 / 22%)`): the narrow-width rail sheet over the table.
- **Focus ring** (`outline: 3px solid currentColor; outline-offset: 3px`): keyboard focus. An outline, not a shadow, so it survives forced-colors mode.

### Named Rules

**The Flat-At-Rest Rule.** If an element has a shadow while nothing is happening to it, delete the shadow. Gradients standing in for light are the same violation.

**The Grayscale Test.** Desaturate any screen. Whose turn it is, who has folded, who is all-in, and which actions are legal must all still be readable. This is a hard requirement from PRODUCT.md, not a preference — color is never the only indicator of state.

## Shapes

Corners are small and consistent: controls, inputs and cards at 6px (`rounded.sm`), panels and seat plates at 10px (`rounded.md`), status pills and chips fully round (`rounded.pill`). Nothing else.

The playing card is the system's fixed silhouette: 92 × 128px, a 0.72 ratio held at every size, a 6px corner, and a single `paper-edge` hairline. Chips are true circles with a dashed inner ring at 62% radius standing in for edge spots — drawn, not shaded.

The table is an ellipse with a `felt-900` rail 6px thick. It is a flat outline, not a bevel.

### Named Rules

**The Printed Edge Rule.** Every boundary is a 1px hairline or a flat fill. No bevels, no inner glows, no double borders, no gradient edges. If a boundary needs more emphasis, change its tone, not its dimensionality.

## Components

Character: **printed and exact.** Hairline rules, tight registration, everything aligned to the 4px grid. Chrome recedes; the data leads.

### Buttons
- **Shape:** 6px corners (`rounded.sm`), 44px minimum height — a hard floor for thumb targets and already honored by the incumbent.
- **Primary:** brass fill (#C4952F) with card-ink text, 12px/20px padding. Reserved for the turn-advancing action.
- **Secondary:** transparent with a 1px `ink / 20%` hairline and ink text. Every non-primary control.
- **Hover / Focus:** hover lifts the fill one step (`brass-400`); focus draws a 3px `currentColor` outline at 3px offset. No transform, no shadow.
- **Disabled:** transparent, muted ink, `ink / 6%` hairline — **and it stays visible.** Illegal actions are shown disabled with a reason, never hidden. That is how a first-timer learns the rules.

### Action Bar (signature)
The bar carrying fold / check / call / raise / all-in. Each button states its consequence on a second line in Money type: `Call $20` over `$480 left`. This is the product's central teaching device and the clearest place it beats its craft bar. Buttons hold fixed slots so they do not reorder between streets.

### Seat Plate (signature)
One component for all six seats and every state. A strict label template in fixed slot order — name, stack, state, last action — so six plates scan as aligned data rather than six small compositions. States: empty, seated-waiting, in-hand, folded (plate desaturates to 45% opacity), all-in (brass hairline plus an ALL IN label), sitting out, busted, disconnected (hairline goes dashed), bot (a small BOT label), and acting (turn lift plus a brass ring). Button, small blind and big blind ride as small brass discs on the plate edge.

### Playing Card (signature)
92 × 128px, `paper` ground, 6px corner, one `paper-edge` hairline, rank and suit in Bitter at two opposing corners with a rotational-symmetric pip field between them. Suit red is `card-suit-red` in both themes. **No gradient, no drop shadow** — the incumbent card's sheen and lift are retired by the Flat-At-Rest Rule. The face-down back is `felt-700` with a `felt-900` hairline lattice.

### Chip Stack (signature)
A stack renders as circles in real denominations, tallest denomination on top, with the figure beside it in Money type. Chips are drawn flat: solid fill, 1px darker hairline, dashed inner ring for edge spots. The white `chip-1` always carries its hairline so it survives on `panel-light`.

### Cards / Containers
- **Corners:** 10px (`rounded.md`)
- **Background:** `panel-light` / `panel-dark`
- **Border:** 1px `ink / 14%` hairline
- **Shadow:** none at rest — see Elevation
- **Padding:** 16px (`spacing.lg`)

### Inputs / Fields
- **Style:** panel fill, 1px `ink / 20%` hairline, 6px corners, 44px height, 10px/12px padding.
- **Focus:** 3px `currentColor` outline at 3px offset. The hairline does not change.
- **Error:** hairline goes `state-error`, and the message sits below in Body — never as a color change alone.

### Navigation
The rail's four sections (Log, Chat, Players, Manage) are tabs at narrow widths and stacked sections at wide. Tabs are Label type, uppercase, with the active tab carrying a 2px brass underline **and** `aria-selected`. Unread chat shows a count, not a dot.

## Do's and Don'ts

### Do:
- **Do** set `tabular-nums` on every figure that can change.
- **Do** keep illegal actions visible and disabled with a stated reason.
- **Do** state the consequence on action buttons (`Call $20` / `$480 left`).
- **Do** drive responsive behavior from container queries on the table region.
- **Do** hold cards and chips constant across themes — they are objects, not surfaces.
- **Do** run the Grayscale Test on any screen showing player state.
- **Do** keep the felt to 30–50% of the table view so the committed field reads as a field.

### Don't:
- **Don't** ship a `mobile-` twin of any component toggled by `display: none`.
- **Don't** add a shadow or gradient to anything at rest.
- **Don't** use brass for general emphasis — only authority and turn.
- **Don't** borrow chip denomination colors for UI state.
- **Don't** let the slab face escape card ranks and hand names.
- **Don't** introduce a font size outside the six-step scale or a gap outside the 4px scale.
- **Don't** render depth photographically — no beveled rails, no rendered chips, no felt texture images.
