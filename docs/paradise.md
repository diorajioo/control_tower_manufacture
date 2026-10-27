<!-- ============================================================
     AI OPERATING INSTRUCTIONS — READ FIRST (paste-first block)
     ============================================================
This file is the single source of truth for building **Paradise**-looking UI
(ParagonCorp · PT Paragon Technology and Innovation · CX Team). Any AI tool
(Cursor / v0 / Claude / etc.) building Paradise UI must obey the following:
1. NEVER invent values. Every color, size, radius, spacing, shadow, and type
   value must come from the `colors / typography / rounded / spacing / elevation`
   maps in the YAML below. If something you need is not here, it is listed in
   **Known Gaps** — do not fill it with a guess.
2. TWO BUILD MODES:
   • Kit present — if the project has the Paradise React kit (components under
     `components/**` importing the token CSS), emit the REAL component with its
     real props: `<Button variant="primary" size="md">`. Do NOT re-implement a
     component's internals. Each component's `kit:` field below is its real API.
   • No kit — generate self-contained HTML + CSS driven by the token CSS custom
     properties (`var(--action-primary)`, `var(--space-8)`, `var(--radius-medium)`,
     …). There is NO utility-class layer (no `pdx-*` classes) — compose from the
     variables. Paste the `:root` block from the Paradise Style Guide to get them.
3. GUARDRAILS (enforce on every screen):
   • One primary action per view. Everything else is secondary/outline/ghost.
   • White text ONLY on `action-primary` and `action-danger` fills. NEVER white on
     `fill-success` / `fill-warning` (they fail contrast — see Accessibility). Use
     the subtle-tint + dark-text treatment for those statuses.
   • A visible focus ring (`elevation.focus`) on EVERY interactive control.
   • Status is never color-only — always pair it with an icon or text label.
   • Calm and under-decorated: flat surfaces on off-white, 1px hairlines, soft
     slate-tinted shadows. No gradients in product UI (the AI label is the one
     sanctioned exception). Max 1–2 background colors per screen.
4. Reference colors by their SEMANTIC ALIAS (`action-primary`, `surface-card`,
   `text-secondary`, `border-focus`), never a ramp step (`brand.500`,
   `neutral.100`) and never a raw hex. In the `colors:` map, ramps are raw
   material and the aliases at the bottom are the interface. Components below
   already obey this; follow the same discipline.
5. The `brand` ramp is SWAPPABLE — it is whichever product `activeBrand` names
   (Paragon by default), and every accent alias follows it. Re-skinning for
   another product means changing `activeBrand`, not hunting call sites. Never
   hardcode Paragon blue.
     ============================================================ -->
 
---
version: 2.0
name: Paradise
website: internal — no public design-system URL; source of truth is the Paradise Figma library + the imported token CSS (tokens/*.css) and React kit (components/**)
description: >
  Paradise is the blue-forward, engineered platform system behind ParagonCorp's
  internal tools, dashboards, mobile apps, and storefronts. It reads as calm,
  trustworthy, and utilitarian. The canvas is a barely-cool off-white #F8F9FD;
  surfaces are flat white #FFFFFF cards separated by 1px hairlines (#EBEBEB /
  #D6D6D6) and lifted with soft, slate-tinted shadows — never harsh black, never
  gradients in product UI. The primary voltage is a single brand blue #215AA8:
  one filled primary action per view, everything else outline, ghost, or subtle.
  Body text is slate #2A3D4A, never pure black; secondary copy is grey #5C5C5C.
  Type is a SINGLE family — Lato — for everything: display, headings, body,
  buttons, labels, data, and tables, at a 16px body baseline with bold headings
  and a slight +0.005em tracking on display sizes. Shape language is soft but
  boxy: 1px borders, a restrained radius scale (2px tags → 6px inputs → 8px
  cards → 9999px pills), and a 2px spacing grid (no arbitrary values). Motion is
  restrained — ~150ms ease, hover darkens one step, press two. The result looks
  like documentation-grade software: precise, quiet, dependable.
 
# ============================================================
# COLORS
#
# Two kinds of entry, and the difference matters:
#
#   RAMPS   — compact 50→900 tables. Raw material. Do NOT reference
#             these from a component.
#   ALIASES — one per line, at the bottom. THIS IS THE INTERFACE.
#             Components reference aliases only, never a ramp step,
#             never a raw hex.
#
# Every value below is the final resolved color — nothing to look up.
# The `→` comment on an alias says which ramp step it follows, which is
# what makes a brand swap work.
#
# BRAND SWAP: `brand` is the accent ramp every accent alias follows.
# To re-skin for another product, set `activeBrand` and copy that
# product's ramp into `brand`. Nothing else changes.
# ============================================================

activeBrand: Paragon

colors:

  # ---- The accent ramp. Currently Paragon. ----
  brand: { 50: "#E9EFF6", 100: "#D3DEEE", 200: "#A6BDDC", 300: "#7A9CCB", 400: "#4D7BB9", 500: "#215AA8", 600: "#1A4886", 700: "#143665", 800: "#0D2443", 900: "#071222" }

  # ---- Product ramps · swap targets for `brand`, and the accent when you are
  #      building that product's own surface. On a generic Paradise screen the
  #      accent is always `brand`. SFM mirrors Paragon; Exagon mirrors Heron.
  #      Nova is TWO separate ramps — do not conflate them.
  paragon:        { 50: "#E9EFF6", 100: "#D3DEEE", 200: "#A6BDDC", 300: "#7A9CCB", 400: "#4D7BB9", 500: "#215AA8", 600: "#1A4886", 700: "#143665", 800: "#0D2443", 900: "#071222" }
  sfm:            { 50: "#E9EFF6", 100: "#D3DEEE", 200: "#A6BDDC", 300: "#7A9CCB", 400: "#4D7BB9", 500: "#215AA8", 600: "#1A4886", 700: "#143665", 800: "#0D2443", 900: "#071222" }
  heron:          { 50: "#F1EFF6", 100: "#D5CEE3", 200: "#B9AED1", 300: "#9C8EBF", 400: "#806DAC", 500: "#725DA3", 600: "#675493", 700: "#504172", 800: "#392F52", 900: "#221C31" }
  exagon:         { 50: "#F1EFF6", 100: "#D5CEE3", 200: "#B9AED1", 300: "#9C8EBF", 400: "#806DAC", 500: "#725DA3", 600: "#675493", 700: "#504172", 800: "#392F52", 900: "#221C31" }
  digiso:         { 50: "#FAF9FD", 100: "#F9F8FC", 200: "#F2E6F1", 300: "#EDD6E7", 400: "#CC9AC6", 500: "#A773B0", 600: "#864A9C", 700: "#763694", 800: "#5C2E90", 900: "#3E246A" }
  magpie:         { 50: "#E6F1FF", 100: "#CCE2FF", 200: "#99C5FF", 300: "#66A8FF", 400: "#338BFF", 500: "#006EFF", 600: "#0C4AC0", 700: "#0A3EA0", 800: "#062560", 900: "#001633" }
  siglive:        { 50: "#E6F1FF", 100: "#CCE2FF", 200: "#99C5FF", 300: "#66A8FF", 400: "#338BFF", 500: "#006EFF", 600: "#0056CC", 700: "#004199", 800: "#002B66", 900: "#001633" }
  nova-mobile:    { 50: "#ECF2FA", 100: "#EDF3FC", 200: "#E4EDFB", 300: "#C7DAF7", 400: "#4B87E4", 500: "#447ACD", 600: "#3C6CB6", 700: "#3865AB", 800: "#2D5189", 900: "#223D67" }
  nova-dashboard: { 50: "#E6EEFA", 100: "#CCDDF5", 200: "#99BBEB", 300: "#669AE0", 400: "#3378D6", 500: "#0056CC", 600: "#0045A3", 700: "#00347A", 800: "#002252", 900: "#1A2F50" }
  sagitarius:     { 50: "#E9F1F6", 100: "#E6EFF5", 200: "#B0CCDF", 300: "#8AB4D0", 400: "#337CAD", 500: "#005B99", 600: "#00538B", 700: "#00416D", 800: "#003254", 900: "#002640" }
  gro:            { 50: "#EFEBFF", 100: "#CDC0FF", 200: "#B4A2FF", 300: "#9277FF", 400: "#7D5DFF", 500: "#5D34FF", 600: "#552FE8", 700: "#4225B5", 800: "#331D8C", 900: "#27166B" }
  shipgo:         { 50: "#FDFCFF", 100: "#FAF9FD", 200: "#D8D7F0", 300: "#B4B1E2", 400: "#918DD5", 500: "#6E69C7", 600: "#4B45BA", 700: "#3E3999", 800: "#312D79", 900: "#242158" }

  # ---- Status ramps. Reserved for status — never decorative.
  info:    { 50: "#E7F1FF", 100: "#CCDDF5", 200: "#99BBEB", 300: "#669AE0", 400: "#3378D6", 500: "#0056CC", 600: "#0045A3", 700: "#00347A", 800: "#002252", 900: "#000914" }
  success: { 50: "#E9FFF2", 100: "#D9F2E3", 200: "#B3E5C8", 300: "#8CD9AC", 400: "#66CC91", 500: "#40BF75", 600: "#33995E", 700: "#267346", 800: "#1A4C2F", 900: "#06130C" }
  warning: { 50: "#FFFCEB", 100: "#FFFBE4", 200: "#FFF2AB", 300: "#FFE86E", 400: "#FFDD0C", 500: "#FFCD00", 600: "#D1A400", 700: "#9D7B00", 800: "#695200", 900: "#342900" }
  error:   { 50: "#FFF1F3", 100: "#FFEDEF", 200: "#F599A4", 300: "#F06677", 400: "#EB3349", 500: "#E6001C", 600: "#B80016", 700: "#8A0011", 800: "#5C000B", 900: "#170003" }
  neutral: { 50: "#F1F1F1", 100: "#EBEBEB", 200: "#D6D6D6", 300: "#C2C2C2", 400: "#ADADAD", 500: "#999999", 600: "#7A7A7A", 700: "#5C5C5C", 800: "#3D3D3D", 900: "#1F1F1F" }

  # ---- Slate · the cool pair Paradise is built on. Only two steps exist.
  #      Never substitute neutral.900 for body text — see Colors prose.
  slate: { 50: "#F8F9FD", 900: "#2A3D4A" }

  # ---- Overlay · the only tokens carrying alpha. 50 is the lone black step;
  #      100–900 are all slate.900 differing only in alpha.
  overlay:
    50:  "rgba(0,0,0,0.10)"
    100: "rgba(42,61,74,0.08)"
    200: "rgba(42,61,74,0.10)"
    300: "rgba(42,61,74,0.12)"
    400: "rgba(42,61,74,0.14)"
    500: "rgba(42,61,74,0.16)"
    600: "rgba(42,61,74,0.18)"
    700: "rgba(42,61,74,0.20)"
    800: "rgba(42,61,74,0.50)"
    900: "rgba(42,61,74,0.70)"

  white: "#FFFFFF"
  black: "#000000"         # reference only — never a text color

  # ══════════════════════════════════════════════════════════════
  # ALIASES — the interface. Components use ONLY these.
  # ══════════════════════════════════════════════════════════════

  # ---- Surfaces ----
  surface-background: "#F8F9FD"        # → slate.50 · app canvas
  surface-card: "#FFFFFF"              # → white · cards, panels, sheets, inputs, knobs
  surface-raised: "#FFFFFF"            # → white · popovers, dropdowns, toasts, menus
  surface-sunken: "#EBEBEB"            # → neutral.100 · wells, disabled fills, skeleton base
  surface-disabled: "#EBEBEB"          # → neutral.100 · disabled field fills
  surface-inverse: "#2A3D4A"           # → slate.900 · tooltips, dark banners, inverse bars
  surface-primary: "#215AA8"           # → brand.500 · solid brand blocks / primary banner
  surface-primary-subtle: "#D3DEEE"    # → brand.100 · selected/hover wash, icon tiles, avatar bg
  surface-primary-subtle-strong: "#A6BDDC" # → brand.200 · pressed wash on tinted controls
  surface-info-subtle: "#CCDDF5"       # → info.100 · info alert surface
  surface-success-subtle: "#D9F2E3"    # → success.100 · success alert / badge surface
  surface-warning-subtle: "#FFFBE4"    # → warning.100 · warning alert / badge surface
  surface-error-subtle: "#FFEDEF"      # → error.100 · error alert / danger-menu-hover
  surface-bezel: "#1F1F1F"             # → neutral.900 · DeviceFrame bezel (the one near-black surface)

  # ---- Text ----
  text-primary: "#2A3D4A"              # → slate.900 · body + headings. NOT #000, NOT neutral.900
  text-secondary: "#5C5C5C"            # → neutral.700 · supporting copy, table headers
  text-tertiary: "#7A7A7A"             # → neutral.600 · captions, placeholders, meta, separators
  text-disabled: "#ADADAD"             # → neutral.400
  text-on-primary: "#FFFFFF"           # → white · label on filled blue / danger / dark
  text-on-dark: "#FFFFFF"              # → white
  text-link: "#215AA8"                 # → brand.500
  text-link-hover: "#1A4886"           # → brand.600
  text-accent: "#215AA8"               # → brand.500 · accent labels/icons (ghost & secondary label, active tab, brand, CTA icon)
  text-accent-emphasis: "#1A4886"      # → brand.600 · data accents (slider value, segmented-selected, fileupload link, icon-tile glyph)
  text-accent-strong: "#143665"        # → brand.700 · text on surface-primary-subtle (badge, avatar, sidebar-selected)
  text-error: "#E6001C"                # → error.500 · inline error/helper text
  text-danger: "#B80016"               # → error.600 · destructive menu item, negative delta
  text-on-error-subtle: "#8A0011"      # → error.700 · text on surface-error-subtle
  text-success: "#267346"              # → success.700 · positive delta, text on surface-success-subtle
  text-on-info-subtle: "#00347A"       # → info.700 · text on surface-info-subtle
  text-on-warning-subtle: "#342900"    # → warning.900 · text on warning surfaces (yellow ALWAYS takes dark text)
  text-strong: "#3D3D3D"               # → neutral.800 · micro-label (BrandPill); ProductLabel neutral-solid fill

  # ---- Borders (non-text boundaries; see Accessibility 1.4.11) ----
  border-default: "#D6D6D6"            # → neutral.200 · standard 1px hairline
  border-subtle: "#EBEBEB"             # → neutral.100 · card / row dividers
  border-strong: "#ADADAD"             # → neutral.400 · checkbox/radio/dropzone outline
  border-focus: "#215AA8"              # → brand.500 · focused field border
  border-error: "#E6001C"              # → error.500
  border-accent: "#215AA8"             # → brand.500 · secondary-button outline, checked control ring
  border-accent-subtle: "#7A9CCB"      # → brand.300 · DatePicker "today" ring

  # ---- Interactive · primary action ----
  action-primary: "#215AA8"            # → brand.500
  action-primary-hover: "#1A4886"      # → brand.600 (one step darker)
  action-primary-active: "#143665"     # → brand.700 (two steps darker)
  action-primary-disabled: "#C2C2C2"   # → neutral.300
  # ---- Interactive · destructive ----
  action-danger: "#E6001C"             # → error.500
  action-danger-hover: "#B80016"       # → error.600
  action-danger-active: "#8A0011"      # → error.700
  # ---- Interactive · neutral (tertiary / ghost-neutral) ----
  action-neutral-hover: "#EBEBEB"      # → neutral.100
  action-neutral-active: "#D6D6D6"     # → neutral.200

  # ---- Solid semantic fills (status dots, ratings, solid badges) ----
  fill-info: "#0056CC"                 # → info.500
  fill-success: "#40BF75"              # → success.500 · WHITE TEXT FAILS — see Accessibility
  fill-warning: "#FFCD00"              # → warning.500 · WHITE TEXT FAILS — dark text only
  fill-error: "#E6001C"                # → error.500
  fill-neutral: "#D6D6D6"              # → neutral.200 · "+N" overflow chip, skeleton shimmer
  fill-neutral-subtle: "#C2C2C2"       # → neutral.300 · empty rating stars, pending nodes, carousel dot, drag handle
  fill-neutral-strong: "#ADADAD"       # → neutral.400 · offline status dot, disabled slider fill

  # ---- Status accents (4px bars on Alert/Toast; ring/fill on Timeline) ----
  accent-info: "#0056CC"               # → info.500
  accent-success: "#33995E"            # → success.600
  accent-warning: "#D1A400"            # → warning.600
  accent-error: "#E6001C"              # → error.500
  accent-warning-strong: "#695200"     # → warning.800 · ConfirmationState warning glyph

  # ---- Controls / tracks ----
  control-track: "#D6D6D6"             # → neutral.200 · slider / progress / spinner track
  control-track-off: "#C2C2C2"         # → neutral.300 · switch OFF track

  # ---- Overlays & effects ----
  overlay-scrim: "rgba(42,61,74,0.45)" # modal / drawer / sheet scrim — slate @45%, NOT black.
                                       # The one alias with no ramp step (nearest is overlay.800 @50%).
  focus-ring: "rgba(33,90,168,0.35)"   # brand.500 @35% · inside elevation.focus. No ramp step either.
  gradient-ai: "linear-gradient(90deg, #725DA3, #864A9C)" # heron.500 → digiso.600 · the ONE sanctioned gradient (AILabel)
 
# ============================================================
typography:
  fontFamily: '"Lato", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'  # the ONLY family (tokens/typography.css --font-sans)
  weights: { regular: 400, medium: 500, semibold: 600, bold: 700 }
 
  display-xl:   { fontSize: "60px", lineHeight: 1.333, fontWeight: 700, letterSpacing: "0.005em" }  # Figma Display 1 (60/80). Use: Cover/marketing hero
  display-lg:   { fontSize: "52px", lineHeight: 1.346, fontWeight: 700, letterSpacing: "0.005em" }  # Figma Display 2 (52/70). Use: Cover section hero
  title-2xl:    { fontSize: "48px", lineHeight: 1.333, fontWeight: 700, letterSpacing: "0.005em" }  # Figma Heading 1 (48/64). Use: top-level page title
  title-xl:     { fontSize: "32px", lineHeight: 1.313, fontWeight: 700, letterSpacing: "0" }        # Figma Heading 4 (32/42). Use: StatCard value (heading-4-size)
  title-lg:     { fontSize: "24px", lineHeight: 1.333, fontWeight: 700, letterSpacing: "0" }        # Figma Heading 6 (24/32). Use: section / large card heading
  title-md:     { fontSize: "20px", lineHeight: 1.30,  fontWeight: 700, letterSpacing: "0" }        # Figma Heading 7 (20/26). Use: Modal/Drawer/BottomSheet title
  title-sm:     { fontSize: "18px", lineHeight: 1.333, fontWeight: 700, letterSpacing: "0" }        # Figma Heading 8 (18/24). Use: Card.Header title, AppBar title, PinInput glyph
  body-lg:      { fontSize: "16px", lineHeight: 1.375, fontWeight: 400, letterSpacing: "0" }        # Figma Body 1 (16/22). Use: default body, Input/Select value, nav-link, table cell
  body-md:      { fontSize: "14px", lineHeight: 1.286, fontWeight: 400, letterSpacing: "0" }        # Figma Body 2 (14/18). Use: dense body, Card subtitle, table-sm cell
  body-sm:      { fontSize: "12px", lineHeight: 1.333, fontWeight: 400, letterSpacing: "0" }        # Figma Body 3 (12/16). Use: helper/meta text
  label:        { fontSize: "14px", lineHeight: 1.286, fontWeight: 600, letterSpacing: "0" }        # Figma Body 2 @ semibold. Use: form field label
  button-lg:    { fontSize: "16px", lineHeight: 1.0,   fontWeight: 700, letterSpacing: "0.01em" }   # Use: Button size lg label (Button.jsx)
  button-md:    { fontSize: "14px", lineHeight: 1.0,   fontWeight: 700, letterSpacing: "0.01em" }   # Use: Button size sm/md label
  button-sm:    { fontSize: "12px", lineHeight: 1.0,   fontWeight: 700, letterSpacing: "0.01em" }   # Use: Button size xs label
  nav-link:     { fontSize: "16px", lineHeight: 1.0,   fontWeight: 500, letterSpacing: "0" }        # Use: SidebarNav item (700 when active)
  nav-section:  { fontSize: "10px", lineHeight: 1.4,   fontWeight: 700, letterSpacing: "0.06em" }   # Figma Caption 1 @ bold uppercase. Use: SidebarNav section header
  table-header: { fontSize: "14px", lineHeight: 1.286, fontWeight: 700, letterSpacing: "0.01em" }   # Use: Table header row (Table.jsx)
  badge:        { fontSize: "12px", lineHeight: 1.4,   fontWeight: 700, letterSpacing: "0" }        # Use: Badge label (10px in size sm), Tag
  caption:      { fontSize: "10px", lineHeight: 1.4,   fontWeight: 400, letterSpacing: "0" }        # Figma Caption 1 (10/14). Use: BottomNav label, ProductCard brand, Tabs count
 
# ============================================================
# ROUNDED — tokens/radius.css (Figma "Radius"). Verbatim.
# ============================================================
rounded:
  none: "0px"
  small: "2px"      # tags, badges
  base: "4px"       # compact controls (button md/sm, checkbox, list rows, menu items)
  medium: "6px"     # inputs, select, alert, small tiles (default field radius)
  large: "8px"      # cards, modals, panels, calendars
  xl: "12px"        # floating / large elements
  2xl: "16px"       # hero cards, banners, bottom-sheet top corners
  3xl: "24px"       # feature blocks (sparingly)
  full: "9999px"    # avatars, pills, switch track, round icons
 
# ============================================================
# SPACING — 2px base grid. tokens/spacing.css. Never emit off-grid.
# ============================================================
spacing:
  space-0: "0px"
  space-1: "2px"
  space-2: "4px"
  space-3: "6px"
  space-4: "8px"
  space-5: "10px"
  space-6: "12px"
  space-7: "14px"
  space-8: "16px"
  space-9: "18px"
  space-10: "20px"
  space-11: "24px"
  space-12: "28px"
  space-13: "32px"
  space-14: "36px"
  space-15: "40px"
  space-16: "48px"
  space-17: "56px"
  space-18: "64px"
  space-19: "80px"
  space-20: "96px"
  space-21: "112px"
  space-22: "128px"
  space-23: "144px"
  space-24: "160px"
 
# ============================================================
# ELEVATION — tokens/shadow.css. Bottom-direction, tinted
# rgba(42,61,74,α) — the same slate as text. Never black.
# ============================================================
elevation:
  none: "none"
  xs: "0px 4px 4px -2px rgba(42,61,74,0.08)"        # resting cards, StatCard
  s: "0px 8px 8px -4px rgba(42,61,74,0.10)"          # slider thumb, carousel arrows
  m: "0px 8px 16px -6px rgba(42,61,74,0.12)"         # dropdowns, popovers, toasts, hover cards
  l: "0px 8px 24px -14px rgba(42,61,74,0.16)"        # calendars, large popovers
  xl: "0px 10px 32px -4px rgba(42,61,74,0.12)"
  2xl: "0px 12px 42px -4px rgba(42,61,74,0.14)"      # modals, drawers
  3xl: "0px 14px 64px -4px rgba(42,61,74,0.16)"
  top-s: "0px -8px 8px -4px rgba(42,61,74,0.10)"     # bottom nav, upward menus
  top-m: "0px -8px 16px -6px rgba(42,61,74,0.12)"    # bottom sheets
  focus: "0 0 0 3px rgba(33,90,168,0.35)"            # focus ring (colors.focus-ring)
  card: "inset 0 0 0 1px #EBEBEB, 0px 4px 4px -2px rgba(42,61,74,0.08)"  # = border-subtle hairline + xs lift
 
# ============================================================
# MOTION — INFERRED from component transition strings (not a token
# set in the import). See Motion section + Known Gaps.
# ============================================================
motion:
  duration-fast: "120ms"    # inferred (.12s) — micro state on small controls
  duration-base: "150ms"    # inferred (.15s) — default for nearly everything
  duration-slow: "200ms"    # inferred (.2s)  — sidebar width, larger spatial
  easing: "ease"            # inferred — CSS default; no custom curve except Carousel
  carousel-slide: "0.35s cubic-bezier(.4,0,.2,1)"  # read from Carousel.jsx (one-off)
 
# ============================================================
# COMPONENTS — token specs (aliases only, no ramp steps, no raw hex)
# + kit bridge (real React API from components/**/*.d.ts). The kit
# ships NO utility CSS classes; in no-kit mode compose from the
# token CSS variables. States are separate entries.
# ============================================================
components:
 
  # ---------- Accordion ----------
  accordion:
    kit: "<Accordion items={[…]} type='single'/>"
    do:
      - "Use a chevron down icon to signify the accordion can be expanded and a chevron up icon to signify it can be collapsed."
      - "Use icon right for collapsed and icon down for expand when using the icon-left template."
      - "Use left icon to emphasize the title of the accordion."
    dont:
      - "Don't use neither or use another variant of the icon to signify an expand-collapse interaction."
      - "Don't use icon down for collapsed and icon up for expand in the icon-left template."
      - "Don't place icon inconsistently or use unrelated icons with the title."
    borderColor: "{colors.border-default}"
    rounded: "{rounded.medium}"
    itemDividerColor: "{colors.border-subtle}"
    headerBg: "{colors.surface-card}"
    headerTypography: "{typography.body-lg}"
    headerColor: "{colors.text-primary}"
    headerPadding: "{spacing.space-7} {spacing.space-8}"
    chevronColor: "{colors.text-secondary}"
    bodyTypography: "{typography.body-lg}"
    bodyColor: "{colors.text-secondary}"
  accordion-header-open:
    backgroundColor: "{colors.surface-background}"
  # focus-visible (header button): NOT implemented in kit — see Known Gaps (a11y)
 
  # ---------- AILabel (AI pill) ----------
  ailabel-solid:
    kit: "<AILabel variant='solid' size='md'/>"
    background: "{colors.gradient-ai}"     # the ONE sanctioned gradient (heron-500 → digiso-600)
    textColor: "{colors.text-on-primary}"
    rounded: "{rounded.full}"
    height: "22px"                         # sm 18 · md 22 · lg 26
    typography: "{typography.body-sm}"
    fontWeight: 700
    padding: "0 {spacing.space-4}"
  ailabel-subtle:
    kit: "<AILabel variant='subtle'/>"
    # The ONE sanctioned ramp reference in this file: these DigiSO tints have no
    # alias because the variant renders on a DigiSO surface only. The kit still
    # falls back to hardcoded hex for bg/border — repoint it at these. See Known Gaps.
    backgroundColor: "{colors.digiso.100}" # #F9F8FC
    borderColor: "{colors.digiso.400}"     # #CC9AC6 — 1px
    textColor: "{colors.digiso.700}"       # #763694
 
  # ---------- Alert (inline) ----------
  alert:
    kit: "<Alert status='info' title='…'>body</Alert>"
    do:
      - "Remove the close button if the alert requires the user to take action, ensuring they complete the necessary steps."
      - "Use the appropriate alert state that matches the content (success, warning, error, or info)."
      - "Use clear, concise, and informative messages that help users understand the alert."
      - "Place alerts stacked within the canvas/container structure of a section to keep them visible."
      - "Integrate the banner into the page layout and place it at the top of the page content."
    dont:
      - "Don't include a close button when action is required, as it may cause users to dismiss the alert and lose access to necessary action."
      - "Don't use an alert state that doesn't match the content, as it can confuse users and reduce clarity."
      - "Don't use short and unclear messages that make it hard for users to understand the alert."
      - "Don't use floating alerts like Toasts that disappear after a certain time, as important messages may be missed."
      - "Don't let the banner float or overlap UI elements, and don't place it in the middle of a workflow."
    backgroundColor: "{colors.surface-info-subtle}"  # status→matching subtle surface
    accentColor: "{colors.accent-info}"              # 4px left bar
    borderLeftWidth: "4px"
    rounded: "{rounded.medium}"
    padding: "{spacing.space-6} {spacing.space-7}"
    titleTypography: "{typography.body-lg}"
    titleColor: "{colors.text-primary}"
    bodyTypography: "{typography.body-md}"
    bodyColor: "{colors.text-secondary}"
  # status: success→surface-success-subtle/accent-success · warning→surface-warning-subtle/accent-warning · error→surface-error-subtle/accent-error
 
  # ---------- AndroidNavBar ----------
  androidnavbar:                       # type=buttons, theme=light
    kit: "<AndroidNavBar type='buttons' theme='light'/>  ·  type='gesture'"
    backgroundColor: "{colors.surface-card}"
    iconColor: "{colors.text-primary}"
    height: "48px"                     # gesture 40
  androidnavbar-dark:
    backgroundColor: "{colors.surface-inverse}"
    iconColor: "{colors.text-on-dark}"
 
  # ---------- AppBar (mobile top bar) ----------
  appbar:                            # variant=light
    kit: "<AppBar title leading actions variant='light'/>"
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    borderBottomColor: "{colors.border-default}"
    height: "56px"
    titleTypography: "{typography.title-sm}"
  appbar-primary:                    # blue surface
    backgroundColor: "{colors.surface-primary}"
    textColor: "{colors.text-on-primary}"
    borderBottomColor: transparent
 
  # ---------- Avatar ----------
  avatar:
    kit: "<Avatar name='…' src='…' size='md' status='online' shape='circle'/>"
    do:
      - "Change text, icon, and multiuser backgrounds with the appropriate common tokens if your design requires it."
      - "Use only 2 characters containing capitalized alphabet only."
    dont:
      - "Don't change text or icons within the avatar."
      - "Don't use more than 2 characters or special characters."
    backgroundColor: "{colors.surface-primary-subtle}"
    textColor: "{colors.text-accent-strong}"
    rounded: "{rounded.full}"                  # shape=square → {rounded.medium}
    size: "40px"                               # xs 24 · sm 32 · md 40 · lg 48 · xl 64
    typography: "{typography.badge}"           # bold, size = px×0.4
    statusOnline: "{colors.fill-success}"
    statusBusy: "{colors.fill-error}"
    statusAway: "{colors.fill-warning}"
    statusOffline: "{colors.fill-neutral-strong}"
    statusRingColor: "{colors.surface-card}"
 
  # ---------- AvatarGroup ----------
  avatargroup:
    kit: "<AvatarGroup avatars={[…]} max={4}/>"
    avatarBg: "{colors.surface-primary-subtle}"
    avatarColor: "{colors.text-accent-strong}"
    ringColor: "{colors.surface-card}"        # 2px stroke between overlaps
    overlap: "32%"                             # of avatar size
    overflowBg: "{colors.fill-neutral}"
    overflowColor: "{colors.text-secondary}"   # "+N", bold
 
  # ---------- Badge ----------
  badge-subtle:           # default; tone swaps the tint/text pair
    kit: "<Badge tone='primary' variant='subtle' size='md'>Label</Badge>"
    do:
      - "Position the badge to the right or left of the icon or text."
      - "Use the default badge color (red)."
      - "Truncate badge label as needed."
      - "When there's an icon prior to text, place the badge on the ending edge of the lockup to avoid visual collisions."
      - "Use indicators sparingly to highlight new or unread content."
    dont:
      - "Don't change the position of the badge arbitrarily or place the badge over the icon or text."
      - "Don't use custom color roles for the badge container and label text unless they have good contrast ratio."
      - "Don't let the badge label get cut off or collide with another element."
      - "Don't use a large badge when it might overlap with a trailing element."
      - "Don't use indicators on every element, as they lose their meaning."
    backgroundColor: "{colors.surface-primary-subtle}"   # primary tone shown
    textColor: "{colors.text-accent-strong}"
    typography: "{typography.badge}"
    rounded: "{rounded.small}"
    padding: "{spacing.space-1} {spacing.space-4}"
  # tone tints: success→surface-success-subtle/text-success · warning→surface-warning-subtle/text-on-warning-subtle
  #             error→surface-error-subtle/text-on-error-subtle · info→surface-info-subtle/text-on-info-subtle
  badge-solid:
    kit: "<Badge variant='solid' tone='primary'>"
    backgroundColor: "{colors.action-primary}"   # tone fill
    textColor: "{colors.text-on-primary}"        # SAFE only on primary/error/info; success/warning must use subtle (see Accessibility)
    typography: "{typography.badge}"
    rounded: "{rounded.small}"
  badge-sm: { typography: "{typography.caption}", padding: "{spacing.space-1} {spacing.space-3}" }
 
  # ---------- Banner (full-width strip) ----------
  banner:                            # tone=primary shown
    kit: "<Banner tone='primary' title='…' action={<Button/>}/>"
    do:
      - "Integrate the banner into the page layout and place it at the top of the page content."
    dont:
      - "Don't let the banner float or overlap UI elements, and don't place it in the middle of a workflow."
    backgroundColor: "{colors.surface-primary}"
    textColor: "{colors.text-on-primary}"
    rounded: "{rounded.medium}"
    padding: "{spacing.space-7} {spacing.space-10}"
    titleTypography: "{typography.body-lg}"
    bodyTypography: "{typography.body-md}"
  # tone overrides: neutral→surface-inverse/text-on-dark · success→accent-success/text-on-primary
  #                 warning→fill-warning + text-on-warning-subtle (dark-on-yellow — NEVER white)
 
  # ---------- BottomNav (mobile tab bar) ----------
  bottomnav:
    kit: "<BottomNav items={[…]} activeKey onSelect/>"
    backgroundColor: "{colors.surface-card}"
    borderTopColor: "{colors.border-default}"
    elevation: "{elevation.top-s}"
    height: "60px"
    itemColor: "{colors.text-tertiary}"
    labelTypography: "{typography.caption}"
    badgeBg: "{colors.fill-error}"
    badgeColor: "{colors.text-on-primary}"
  bottomnav-item-active:
    itemColor: "{colors.text-accent}"    # activeIcon (filled) swaps in
    fontWeight: 700
 
  # ---------- BottomSheet ----------
  bottomsheet:
    kit: "<BottomSheet open onClose title footer dragHandle>…</BottomSheet>"
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.2xl}"           # top corners only
    elevation: "{elevation.top-m}"
    scrimColor: "{colors.overlay-scrim}"
    maxWidth: "480px"
    maxHeight: "88vh"
    dragHandleColor: "{colors.fill-neutral-subtle}"
    titleTypography: "{typography.title-md}"
    bodyTypography: "{typography.body-lg}"
    bodyColor: "{colors.text-secondary}"
    footerBorderColor: "{colors.border-subtle}"
    # slide-up 0.22s ease
 
  # ---------- BrandPill (brand chip) ----------
  brandpill:
    kit: "<BrandPill label='Wardah' logo={src}/>"
    backgroundColor: "{colors.surface-card}"
    borderColor: "{colors.border-subtle}"   # inset 1px hairline
    rounded: "{rounded.full}"
    height: "24px"
    padding: "{spacing.space-2} {spacing.space-4}"
    labelTypography: "{typography.caption}"  # 8px in code (below scale min); label uses caption role
    labelColor: "{colors.text-strong}"
    logoPlaceholderColor: "{colors.fill-neutral}"
 
  # ---------- BrandSquare (brand tile) ----------
  brandsquare:
    kit: "<BrandSquare logo={src} name='Emina' size='md'/>"
    backgroundColor: "{colors.surface-card}"
    borderColor: "{colors.border-subtle}"   # inset 1px hairline
    rounded: "{rounded.medium}"
    size: "40px"                       # sm 32 · md 40 · lg 48 · xl 64
    fallbackInitialColor: "{colors.text-disabled}"
 
  # ---------- Breadcrumb ----------
  breadcrumb:
    kit: "<Breadcrumb items={[…]}/>"
    do:
      - "Use a chevron icon to separate breadcrumb items for clear hierarchy."
      - "Keep breadcrumb labels short and consistent with page titles."
    dont:
      - "Don't use another variant of the icon to signify navigation."
      - "Don't use long or unclear labels that confuse the user about their location."
    linkTypography: "{typography.body-md}"
    linkColor: "{colors.text-secondary}"
    separatorColor: "{colors.text-disabled}"
    gap: "{spacing.space-4}"
  breadcrumb-link-hover:
    color: "{colors.text-link}"
  breadcrumb-current:
    color: "{colors.text-primary}"
    fontWeight: 600
 
  # ---------- Button ----------
  button-primary:
    kit: "<Button variant='primary' size='md'>Label</Button>"
    do:
      - "Use concise and clear text inside the button to indicate the next action to the user. Keep it to a single line."
      - "Choose icons that clearly represent the button's function."
      - "Use one primary button to highlight the main action on the page/pop-up."
      - "Place the primary button with the highest priority to the right in a side-by-side button group."
      - "Provide additional information on why a button is disabled by using a tooltip component when hovering."
    dont:
      - "Don't use too long text inside, or make it wrap to a double line of text inside the button."
      - "Don't use random or unrelated icons that don't clearly communicate the button's purpose."
      - "Don't use more than one primary button on the same page."
      - "Don't place the primary button with the highest priority to the left in a side-by-side button group."
      - "Don't use a disabled button without providing a clear explanation to users."
    backgroundColor: "{colors.action-primary}"
    textColor: "{colors.text-on-primary}"
    borderColor: transparent
    typography: "{typography.button-md}"
    rounded: "{rounded.base}"
    padding: "0 {spacing.space-11}"
    height: "42px"
  button-primary-hover:
    backgroundColor: "{colors.action-primary-hover}"
  button-primary-active:
    backgroundColor: "{colors.action-primary-active}"
  button-primary-focus-visible:
    boxShadow: "{elevation.focus}"
  button-primary-disabled:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.text-disabled}"
    borderColor: "{colors.border-default}"
  button-secondary:      # blue outline on white
    kit: "<Button variant='secondary'>"
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-accent}"
    borderColor: "{colors.border-accent}"
    typography: "{typography.button-md}"
    rounded: "{rounded.base}"
    height: "42px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-primary-subtle}"
  button-secondary-active:
    backgroundColor: "{colors.surface-primary-subtle-strong}"
  button-secondary-focus-visible:
    boxShadow: "{elevation.focus}"
  button-tertiary:       # neutral outline
    kit: "<Button variant='tertiary'>"
    backgroundColor: transparent
    textColor: "{colors.text-primary}"
    borderColor: "{colors.border-default}"
    typography: "{typography.button-md}"
    rounded: "{rounded.base}"
    height: "42px"
  button-tertiary-hover:
    backgroundColor: "{colors.action-neutral-hover}"
  button-tertiary-active:
    backgroundColor: "{colors.action-neutral-active}"
  button-ghost:          # text only
    kit: "<Button variant='ghost'>"
    backgroundColor: transparent
    textColor: "{colors.text-accent}"
    borderColor: transparent
    typography: "{typography.button-md}"
  button-ghost-hover:
    backgroundColor: "{colors.surface-primary-subtle}"
  button-ghost-active:
    backgroundColor: "{colors.surface-primary-subtle-strong}"
  button-danger:
    kit: "<Button variant='danger'>"
    backgroundColor: "{colors.action-danger}"
    textColor: "{colors.text-on-primary}"
    borderColor: transparent
    typography: "{typography.button-md}"
    rounded: "{rounded.base}"
    height: "42px"
  button-danger-hover:
    backgroundColor: "{colors.action-danger-hover}"
  button-danger-active:
    backgroundColor: "{colors.action-danger-active}"
  # size variants (apply to any variant) — Button.jsx SIZES
  button-xs: { height: "28px", padding: "0 {spacing.space-4}", typography: "{typography.button-sm}", rounded: "{rounded.small}", iconSize: "16px" }
  button-sm: { height: "34px", padding: "0 {spacing.space-8}", typography: "{typography.button-md}", rounded: "{rounded.base}", iconSize: "16px" }
  button-md: { height: "42px", padding: "0 {spacing.space-11}", typography: "{typography.button-md}", rounded: "{rounded.base}", iconSize: "18px" }   # DEFAULT
  button-lg: { height: "48px", padding: "0 {spacing.space-13}", typography: "{typography.button-lg}", rounded: "{rounded.medium}", iconSize: "20px" }
 
  # ---------- ButtonGroup (segmented / joined) ----------
  buttongroup:
    kit: "<ButtonGroup value={v} onChange={fn} options={[…]}/>"
    borderColor: "{colors.border-default}"
    rounded: "{rounded.medium}"      # outer corners; inner buttons square
    segmentBg: "{colors.surface-card}"
    segmentColor: "{colors.text-secondary}"
    segmentTypography: "{typography.button-md}"
    height: "42px"                   # sm 34 · md 42 · lg 48
    dividerColor: "{colors.border-default}"
  buttongroup-segment-selected:
    backgroundColor: "{colors.action-primary}"
    color: "{colors.text-on-primary}"
    fontWeight: 700
  # focus-visible: NOT implemented in kit — see Known Gaps (a11y)
 
  # ---------- Card ----------
  card:
    kit: "<Card padding={16} elevated interactive>…</Card>  ·  Card.Header / Card.Body / Card.Footer"
    do:
      - "Keep card content concise and scannable."
      - "Use cards to group related content visually."
    dont:
      - "Don't overload a card with too much information."
      - "Don't use cards for single isolated pieces of information."
    backgroundColor: "{colors.surface-card}"
    borderColor: "{colors.border-subtle}"
    rounded: "{rounded.large}"
    elevation: "{elevation.xs}"
    padding: "{spacing.space-8}"
    titleTypography: "{typography.title-sm}"
    subtitleTypography: "{typography.body-md}"
    subtitleColor: "{colors.text-tertiary}"
  card-elevated:
    elevation: "{elevation.m}"
  card-interactive-hover:
    elevation: "{elevation.m}"
    transform: "translateY(-2px)"
  card-footer:
    borderTopColor: "{colors.border-subtle}"
    paddingTop: "{spacing.space-7}"
    marginTop: "{spacing.space-8}"
 
  # ---------- Carousel ----------
  carousel:
    kit: "<Carousel showArrows showDots>…slides</Carousel>"
    rounded: "{rounded.large}"
    arrowBg: "{colors.surface-card}"
    arrowBorderColor: "{colors.border-default}"
    arrowColor: "{colors.text-primary}"
    arrowElevation: "{elevation.s}"
    dotColor: "{colors.fill-neutral-subtle}"
    dotActiveColor: "{colors.action-primary}"  # active dot widens to 20px
    # slide transition {motion.carousel-slide}
  # focus-visible (arrows): NOT implemented in kit — see Known Gaps (a11y)
 
  # ---------- Checkbox ----------
  checkbox:
    kit: "<Checkbox label='…' checked={v} onChange={fn} size='md'/>"
    do:
      - "Use checkboxes when multiple options can be selected."
      - "Stack options vertically to create larger touch targets and prevent selection errors."
      - "Checkboxes can have a parent-child relationship. When the parent is checked, all children are checked; when the parent is unchecked, all children are unchecked."
      - "Use labels to toggle the checkbox."
    dont:
      - "Don't use checkboxes when only one option can be chosen — use Radio instead."
      - "Don't place options horizontally, as cramped layouts cause confusion and increase accidental clicks."
      - "Don't add extra interactions (e.g. links) within the checkbox label."
    size: "20px"          # sm 16 · md 20 · lg 24
    borderColor: "{colors.border-strong}"   # 1.5px unchecked
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.base}"
    labelTypography: "{typography.body-lg}"
    labelColor: "{colors.text-primary}"
  checkbox-selected:      # checked / indeterminate
    backgroundColor: "{colors.action-primary}"
    borderColor: "{colors.border-accent}"
    checkColor: "{colors.text-on-primary}"
  checkbox-disabled:
    backgroundColor: "{colors.surface-disabled}"
    labelColor: "{colors.text-disabled}"
  # focus-visible: NOT implemented in kit — see Known Gaps (a11y)
 
  # ---------- Checkpoints (lightweight progress track) ----------
  checkpoints:
    kit: "<Checkpoints steps={[{label}]} current={i} orientation='horizontal'/>"
    nodeSize: "28px"
    pendingNodeBg: "{colors.surface-card}"
    pendingRingColor: "{colors.fill-neutral-subtle}"   # 2px
    pendingLabelColor: "{colors.text-tertiary}"
    connectorPendingColor: "{colors.border-default}"
    labelTypography: "{typography.body-sm}"
  checkpoints-active:
    ringColor: "{colors.border-accent}"
    dotColor: "{colors.action-primary}"
    labelColor: "{colors.text-primary}"
  checkpoints-complete:
    nodeBg: "{colors.action-primary}"
    checkColor: "{colors.text-on-primary}"
    connectorColor: "{colors.action-primary}"
 
  # ---------- Combobox (searchable select) ----------
  combobox:
    kit: "<Combobox options={[…]} value={v} onChange={fn} emptyText='…'/>"
    backgroundColor: "{colors.surface-card}"
    borderColor: "{colors.border-default}"
    rounded: "{rounded.medium}"
    height: "42px"                   # sm 34 · md 42 · lg 48
    typography: "{typography.body-lg}"
    searchIconColor: "{colors.text-tertiary}"
  combobox-focus-visible:            # open
    borderColor: "{colors.border-focus}"
    boxShadow: "{elevation.focus}"
  combobox-menu:
    backgroundColor: "{colors.surface-raised}"
    borderColor: "{colors.border-default}"
    rounded: "{rounded.medium}"
    elevation: "{elevation.m}"
    maxHeight: "220px"
  combobox-option-hover:
    backgroundColor: "{colors.action-neutral-hover}"
  combobox-option-selected:
    backgroundColor: "{colors.surface-primary-subtle}"
  combobox-empty:
    textColor: "{colors.text-tertiary}"
 
  # ---------- ConfirmationState (outcome block) ----------
  confirmationstate:
    kit: "<ConfirmationState tone='success' icon title description actions/>"
    iconTileSize: "72px"
    iconTileRounded: "{rounded.full}"
    iconTileBg: "{colors.surface-success-subtle}"   # tone=success shown
    iconTileColor: "{colors.accent-success}"
    titleTypography: "{typography.title-md}"
    titleColor: "{colors.text-primary}"
    descriptionTypography: "{typography.body-lg}"
    descriptionColor: "{colors.text-tertiary}"
    padding: "{spacing.space-13} {spacing.space-11}"
  # tone tints: warning→surface-warning-subtle/accent-warning-strong · error→surface-error-subtle/text-danger
  #             info→surface-info-subtle/fill-info · primary→surface-primary-subtle/text-accent-emphasis
 
  # ---------- DashboardHeader ----------
  dashboardheader:
    kit: "<DashboardHeader title subtitle actions avatar divider/>"
    titleTypography: "{typography.title-lg}"   # 26px heading-5 in code; title-lg (24px) is the nearest role
    titleColor: "{colors.text-primary}"
    subtitleTypography: "{typography.body-md}"
    subtitleColor: "{colors.text-secondary}"
    dividerColor: "{colors.border-subtle}"
    padding: "0 0 {spacing.space-8}"
 
  # ---------- DatePicker ----------
  datepicker-trigger:
    kit: "<DatePicker label='…' value={d} onChange={fn}/>"
    backgroundColor: "{colors.surface-card}"
    borderColor: "{colors.border-default}"
    rounded: "{rounded.medium}"
    height: "42px"
    typography: "{typography.body-lg}"
    placeholderColor: "{colors.text-tertiary}"
    iconColor: "{colors.text-secondary}"
  datepicker-trigger-focus-visible:   # open
    borderColor: "{colors.border-focus}"
    boxShadow: "{elevation.focus}"
  datepicker-calendar:
    backgroundColor: "{colors.surface-card}"
    borderColor: "{colors.border-default}"
    rounded: "{rounded.large}"
    elevation: "{elevation.l}"
    monthTypography: "{typography.body-lg}"
    dowTypography: "{typography.caption}"
    dowColor: "{colors.text-tertiary}"
    dayTypography: "{typography.body-md}"
    dayColor: "{colors.text-primary}"
    dayRounded: "{rounded.base}"
  datepicker-day-hover:
    backgroundColor: "{colors.surface-primary-subtle}"
  datepicker-day-today:
    ringColor: "{colors.border-accent-subtle}"
    textColor: "{colors.text-accent-emphasis}"
  datepicker-day-selected:
    backgroundColor: "{colors.action-primary}"
    textColor: "{colors.text-on-primary}"
 
  # ---------- DeviceFrame (mobile bezel) ----------
  deviceframe:
    kit: "<DeviceFrame platform='ios' width={320} height={640} statusBar homeIndicator>…</DeviceFrame>"
    bezelColor: "{colors.surface-bezel}"
    bezelRadius: "44px"                # ios 44 · android 28
    bezelPadding: "10px"
    elevation: "{elevation.l}"
    screenBg: "{colors.surface-background}"
 
  # ---------- DiscountBadge (promo badge) ----------
  discountbadge:
    kit: "<DiscountBadge percent={30} variant='chip'/>  ·  variant='ribbon'"
    backgroundColor: "{colors.fill-error}"
    textColor: "{colors.text-on-primary}"
    typography: "{typography.caption}"   # bold
    rounded: "{rounded.small}"           # ribbon: top-left large + bottom-right medium corner
    padding: "{spacing.space-1} {spacing.space-4}"
 
  # ---------- Divider ----------
  divider:
    kit: "<Divider>label?</Divider>"
    do:
      - "Only use the defined colour for dividers — Semantic/outline (#D6D6D6)."
      - "Use one divider only to separate a section."
    dont:
      - "Don't use any harsh colour for dividers."
      - "Don't use more than one divider to separate the same section."
      - "Don't inset a divider in a way that causes it to be free-floating or separated from content."
    color: "{colors.border-default}"
    thickness: "1px"
    labelTypography: "{typography.body-sm}"
    labelColor: "{colors.text-tertiary}"
 
  # ---------- DotLoader (inline loader) ----------
  dotloader:
    kit: "<DotLoader size={8} tone='primary' gap={6}/>"
    do:
      - "Ensure loaders are consistent with brand colors and style."
      - "Understand the difference between using loaders and skeletons — loaders for actions, skeletons for content."
    dont:
      - "Don't leave users without feedback if the process takes longer than 1 second."
      - "Don't break brand consistency with random loader colors or styles."
      - "Don't use skeletons instead of loaders for action-based processes."
    dotColor: "{colors.action-primary}"   # tone swaps the fill (role=status)
    dotSize: "8px"
    gap: "{spacing.space-3}"
    # pulse 1.2s ease-in-out, 0.16s stagger
 
  # ---------- Drawer (side panel) ----------
  drawer:
    kit: "<Drawer open onClose side='right' width={400}>…</Drawer>"
    do:
      - "Use drawers for secondary navigation or detailed forms that don't require full-page navigation."
      - "Provide a clear way to close the drawer (close icon or backdrop click)."
    dont:
      - "Don't use drawers for critical flows that require the user's full focus — use modals instead."
      - "Don't trap users inside the drawer without a visible exit."
    backgroundColor: "{colors.surface-card}"
    elevation: "{elevation.2xl}"
    scrimColor: "{colors.overlay-scrim}"
    width: "400px"
    headerBorderColor: "{colors.border-subtle}"
    titleTypography: "{typography.title-md}"
    titleColor: "{colors.text-primary}"
    bodyTypography: "{typography.body-lg}"
    bodyColor: "{colors.text-secondary}"
    footerBorderColor: "{colors.border-subtle}"
    # slide-in 0.24s ease
 
  # ---------- DropdownMenu ----------
  dropdownmenu:
    kit: "<DropdownMenu trigger={<IconButton/>} items={[{key,label,icon,onClick,danger,divider,disabled}]}/>"
    do:
      - "Use disabled state for any unavailable options instead of removing them."
      - "Keep the options range between 5–7 items."
    dont:
      - "Don't enable all the options even when users can't choose some of them."
      - "Don't list all the options with no limitation — consider alternative components for large lists."
    backgroundColor: "{colors.surface-raised}"
    borderColor: "{colors.border-default}"
    rounded: "{rounded.medium}"
    elevation: "{elevation.m}"
    width: "200px"
    padding: "{spacing.space-2}"
    itemTypography: "{typography.body-lg}"
    itemColor: "{colors.text-primary}"
    itemRounded: "{rounded.base}"
    dividerColor: "{colors.border-subtle}"
    shortcutColor: "{colors.text-tertiary}"
  dropdownmenu-item-hover:
    backgroundColor: "{colors.surface-background}"
  dropdownmenu-item-danger:
    color: "{colors.text-danger}"
  dropdownmenu-item-danger-hover:
    backgroundColor: "{colors.surface-error-subtle}"
  dropdownmenu-item-disabled:
    color: "{colors.text-disabled}"
  # focus-visible (menu items): NOT implemented in kit — see Known Gaps (a11y)
 
  # ---------- EmptyState ----------
  emptystate:
    kit: "<EmptyState icon title description actions/>"
    do:
      - "Use the title to give a short and clear definition about what happened — keep it one line only. Use the description to guide users by offering solutions or what to do next."
      - "Use a CTA to clarify what the user can do next."
      - "Keep the title to one line and one sentence only (max 50 characters). Limit body text to a maximum of 2 lines."
    dont:
      - "Don't use system icons, images, or any other type of graphic to illustrate an empty state."
      - "Don't use error codes or technical jargon in the content as it may confuse common users."
      - "Don't use more than one primary button. Don't write the title on more than one line."
    iconTileSize: "72px"                # compact 48
    iconTileBg: "{colors.surface-primary-subtle}"
    iconTileColor: "{colors.text-accent}"
    iconTileRounded: "{rounded.full}"
    titleTypography: "{typography.title-md}"   # compact → title-sm
    titleColor: "{colors.text-primary}"
    descriptionTypography: "{typography.body-lg}"
    descriptionColor: "{colors.text-tertiary}"
    padding: "{spacing.space-16} {spacing.space-11}"
 
  # ---------- FileUpload (dropzone) ----------
  fileupload-zone:
    kit: "<FileUpload accept='…' multiple onFiles={fn}/>"
    do:
      - "Clearly communicate accepted file types and size limits."
      - "Show upload progress and success/error states clearly."
    dont:
      - "Don't hide file restrictions until after the user attempts to upload."
      - "Don't leave users without feedback during or after the upload process."
    backgroundColor: "{colors.surface-background}"
    borderColor: "{colors.border-strong}"      # 1.5px dashed
    borderStyle: dashed
    rounded: "{rounded.large}"
    padding: "{spacing.space-12} {spacing.space-11}"
    iconTileBg: "{colors.surface-primary-subtle}"
    iconTileColor: "{colors.text-accent-emphasis}"
    promptColor: "{colors.text-secondary}"
    promptAccentColor: "{colors.text-accent-emphasis}"  # "Click to upload"
    hintTypography: "{typography.body-sm}"
    hintColor: "{colors.text-tertiary}"
  fileupload-zone-dragging:
    backgroundColor: "{colors.surface-primary-subtle}"
    borderColor: "{colors.border-accent}"
  fileupload-file-row:
    backgroundColor: "{colors.surface-card}"
    borderColor: "{colors.border-default}"
    rounded: "{rounded.medium}"
    fileIconColor: "{colors.text-accent}"
    nameTypography: "{typography.label}"
    metaColor: "{colors.text-tertiary}"
  # focus-visible (dropzone button): NOT implemented in kit — see Known Gaps (a11y)
 
  # ---------- HomeIndicator (mobile gesture bar) ----------
  homeindicator:                       # theme=light
    kit: "<HomeIndicator platform='ios' theme='light'/>"
    barColor: "{colors.text-primary}"
    barWidth: "134px"                  # android 108
    barHeight: "5px"
    rounded: "{rounded.full}"
  homeindicator-dark:
    barColor: "{colors.text-on-dark}"
 
  # ---------- IconButton ----------
  iconbutton:                # default variant = ghost
    kit: "<IconButton icon={<Icon/>} variant='ghost' size='md' aria-label='…'/>"
    do:
      - "Always provide an `aria-label` for accessibility when there is no visible text."
      - "Use tooltips to reveal the icon button's purpose on hover."
    dont:
      - "Don't use icon buttons without an accessible label."
      - "Don't use icons that are ambiguous or unfamiliar to users."
    backgroundColor: transparent
    iconColor: "{colors.text-secondary}"
    borderColor: transparent
    rounded: "{rounded.base}"    # rounded prop → {rounded.full}
    box: "42px"                  # xs 28 · sm 34 · md 42 · lg 48
    iconSize: "20px"
  iconbutton-ghost-hover:
    backgroundColor: "{colors.action-neutral-hover}"
  iconbutton-primary:
    backgroundColor: "{colors.action-primary}"
    iconColor: "{colors.text-on-primary}"
  iconbutton-primary-hover:
    backgroundColor: "{colors.action-primary-hover}"
  iconbutton-secondary:
    backgroundColor: "{colors.surface-card}"
    iconColor: "{colors.text-accent}"
    borderColor: "{colors.border-accent}"
  iconbutton-danger:
    backgroundColor: "{colors.action-danger}"
    iconColor: "{colors.text-on-primary}"
  iconbutton-focus-visible:
    boxShadow: "{elevation.focus}"
  iconbutton-disabled:
    backgroundColor: "{colors.surface-sunken}"
    iconColor: "{colors.text-disabled}"
    borderColor: "{colors.border-default}"
 
  # ---------- Illustration (spot-art slot) ----------
  illustration:
    kit: "<Illustration src alt name size='md' tone='primary'/>"
    size: "160px"                      # sm 96 · md 160 · lg 220
    rounded: "{rounded.large}"
    backgroundColor: "{colors.surface-background}"   # placeholder
    placeholderStripeColor: "{colors.border-subtle}"
    glyphColor: "{colors.action-primary}"   # tone: neutral→fill-neutral-strong · success→accent-success · warning→accent-warning · error→fill-error
    captionColor: "{colors.text-tertiary}"
    # reserved for empty/error/confirmation states only (brand rule)
 
  # ---------- Input ----------
  input:
    kit: "<Input label='…' placeholder='…' size='md'/>"
    do:
      - "Input labels should be in Sentence Case (capitalize only the first letter of the first word)."
      - "Keep label text concise, clear, and easy to understand."
      - "Use clear and easy-to-understand placeholders to avoid confusion."
      - "Replace helper text with informative error messages when needed."
    dont:
      - "Don't use Camel Case (capitalize the first letter of every word) for input labels."
      - "Don't use too-long label text or truncate it."
      - "Don't use unclear or unhelpful placeholders."
      - "Don't show both helper text and error messages at the same time."
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    placeholderColor: "{colors.text-tertiary}"
    borderColor: "{colors.border-default}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.medium}"
    padding: "0 {spacing.space-6}"
    height: "42px"
    labelTypography: "{typography.label}"
    labelColor: "{colors.text-primary}"
    helperTypography: "{typography.body-sm}"
    helperColor: "{colors.text-tertiary}"
    gap: "{spacing.space-3}"
  input-focus-visible:
    borderColor: "{colors.border-focus}"
    boxShadow: "{elevation.focus}"
  input-error:
    borderColor: "{colors.border-error}"
    helperColor: "{colors.text-error}"
  input-disabled:
    backgroundColor: "{colors.surface-disabled}"
    textColor: "{colors.text-disabled}"
  input-sm: { height: "34px", padding: "0 {spacing.space-5}", typography: "{typography.body-md}" }
  input-lg: { height: "48px", padding: "0 {spacing.space-7}", typography: "{typography.body-lg}" }
 
  # ---------- Label ----------
  label:
    kit: "<Label required>Field</Label>"
    typography: "{typography.label}"            # md; sm→body-sm, lg→body-lg
    color: "{colors.text-primary}"
    requiredMarkColor: "{colors.text-error}"
    optionalHintColor: "{colors.text-tertiary}"
  label-disabled:
    color: "{colors.text-disabled}"
 
  # ---------- List ----------
  list:
    kit: "<List items={[…]} interactive/>"
    backgroundColor: "{colors.surface-card}"
    borderColor: "{colors.border-default}"
    rounded: "{rounded.medium}"
    rowDividerColor: "{colors.border-subtle}"
    rowPadding: "{spacing.space-6} {spacing.space-8}"
    titleTypography: "{typography.label}"
    titleColor: "{colors.text-primary}"
    subtitleTypography: "{typography.body-sm}"
    subtitleColor: "{colors.text-tertiary}"
    leadingColor: "{colors.text-secondary}"
    trailingColor: "{colors.text-tertiary}"
  list-row-hover:                    # interactive rows only
    backgroundColor: "{colors.surface-background}"
 
  # ---------- Modal ----------
  modal:
    kit: "<Modal open onClose title footer size='md'>body</Modal>"
    do:
      - "Use modals for prompts that block an app's normal operation, and for critical information that requires a specific user task, decision, or acknowledgement."
      - "Make the title clear about what action users are expected to take or what they're agreeing to. Keep it short."
      - "Use an overlay #000000 with opacity 25% to give a sense of elevation and catch the user's attention."
    dont:
      - "Don't use dialogs for non-critical information that doesn't need to interrupt a workflow. Use a toast (auto-dismissed) or banner (dismissible) instead."
      - "Don't use questions in modal titles (e.g., \"Delete conversation?\") — reframe to focus on the outcome."
      - "Don't use a modal without an overlay, as this makes the modal indistinguishable from the page."
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.large}"
    elevation: "{elevation.2xl}"
    scrimColor: "{colors.overlay-scrim}"       # promoted token (was raw rgba)
    width: "540px"                             # sm 400 · md 540 · lg 720
    maxHeight: "90vh"
    headerPadding: "{spacing.space-8} {spacing.space-10}"
    headerBorderColor: "{colors.border-subtle}"
    titleTypography: "{typography.title-md}"
    titleColor: "{colors.text-primary}"
    bodyPadding: "{spacing.space-10}"
    bodyTypography: "{typography.body-lg}"
    bodyColor: "{colors.text-secondary}"
    footerBorderColor: "{colors.border-subtle}"
 
  # ---------- NavDrawer (off-canvas mobile nav) ----------
  navdrawer:
    kit: "<NavDrawer header sections={[{label,items:[{key,label,icon,badge,active}]}]} onSelect footer/>"
    do:
      - "Keep navigation item labels short and descriptive."
      - "Use icons to support the label meaning."
    dont:
      - "Don't use long labels that wrap to multiple lines."
      - "Don't use icons that are ambiguous or unrelated to the navigation destination."
    backgroundColor: "{colors.surface-card}"
    borderRightColor: "{colors.border-default}"
    width: "288px"
    headerBorderColor: "{colors.border-subtle}"
    sectionLabelTypography: "{typography.nav-section}"
    sectionLabelColor: "{colors.text-tertiary}"
    itemTypography: "{typography.body-lg}"
    itemColor: "{colors.text-secondary}"
    itemRounded: "{rounded.medium}"
    footerBorderColor: "{colors.border-subtle}"
  navdrawer-item-hover:
    backgroundColor: "{colors.surface-background}"
  navdrawer-item-selected:
    backgroundColor: "{colors.surface-primary-subtle}"
    itemColor: "{colors.text-accent-strong}"
    fontWeight: 700
  navdrawer-badge:
    backgroundColor: "{colors.fill-error}"
    textColor: "{colors.text-on-primary}"
    rounded: "{rounded.full}"
  # focus-visible (items): NOT implemented in kit — see Known Gaps (a11y)
 
  # ---------- Notification (toast/snackbar; guidance only — no token spec in the import) ----------
  notification:
    kit: "<Notification variant='success' size='md' multiline message='…' onClose={fn}/>"
    # No token spec in the Paradise import; see Toast for the tokenized treatment.
    do:
      - "Limit the toast queue to a maximum of 4 toasts. If a new toast appears, the first one in the queue should disappear."
      - "Place toasts according to the defined placement rules to maintain consistency and visibility."
      - "Use the one-line variant if the toast message fits within two lines."
      - "Keep toast messages short and informative, as they only appear for a limited time."
    dont:
      - "Don't allow too many toasts to stack, as it can block the UI."
      - "Don't block the navbar or other navigation components by not following the designated placement."
      - "Don't use the multiline variant for a single-line toast message."
      - "Don't use long, detailed explanations that users may not have enough time to read."
 
  # ---------- NumberInput (stepper) ----------
  numberinput:
    kit: "<NumberInput label='…' value={n} onChange={fn} suffix='kg'/>"
    backgroundColor: "{colors.surface-card}"
    borderColor: "{colors.border-default}"
    rounded: "{rounded.medium}"
    height: "42px"                   # sm 34 · md 42 · lg 48
    valueTypography: "{typography.body-lg}"   # semibold, centered
    valueColor: "{colors.text-primary}"
    stepperColor: "{colors.text-secondary}"
    innerDividerColor: "{colors.border-subtle}"
    suffixColor: "{colors.text-tertiary}"
  numberinput-disabled:
    backgroundColor: "{colors.surface-disabled}"
    stepperColor: "{colors.text-disabled}"
  # focus-visible: NOT implemented in kit — see Known Gaps (a11y)
 
  # ---------- NumericKeypad ----------
  numerickeypad:
    kit: "<NumericKeypad onKey onDelete leftAction/>"
    keyBg: transparent
    keyColor: "{colors.text-primary}"
    keyTypography: "{typography.title-lg}"   # semibold (heading-6 24px)
    keyHeight: "56px"
    keyRounded: "{rounded.medium}"
    gap: "{spacing.space-4}"
  numerickeypad-key-active:
    backgroundColor: "{colors.action-neutral-hover}"
 
  # ---------- OptionCard (selectable tile) ----------
  optioncard:
    kit: "<OptionCard title description icon selected onSelect value/>  (role=radio)"
    backgroundColor: "{colors.surface-card}"
    borderColor: "{colors.border-subtle}"      # 1.5px
    rounded: "{rounded.large}"
    elevation: "{elevation.xs}"
    padding: "{spacing.space-8}"
    titleTypography: "{typography.title-sm}"
    titleColor: "{colors.text-primary}"
    descriptionTypography: "{typography.body-md}"
    descriptionColor: "{colors.text-tertiary}"
    iconTileSize: "40px"
    iconTileRounded: "{rounded.medium}"
    iconTileBg: "{colors.surface-primary-subtle}"
    iconTileColor: "{colors.text-accent-emphasis}"
  optioncard-hover:
    borderColor: "{colors.border-strong}"
  optioncard-selected:
    backgroundColor: "{colors.surface-primary-subtle}"
    borderColor: "{colors.border-accent}"
    iconTileBg: "{colors.surface-card}"
    checkBg: "{colors.action-primary}"
    checkColor: "{colors.text-on-primary}"
  optioncard-disabled:
    opacity: "0.6"
  # focus-visible: NOT implemented in kit — see Known Gaps (a11y)
 
  # ---------- Pagination ----------
  pagination:
    kit: "<Pagination page={p} pageCount={n} onChange={fn}/>"
    do:
      - "Use clear and recognizable navigation labels or icons, like \"Previous\" and \"Next.\""
      - "Use ellipsis (…) to simplify the display when there are many pages."
    dont:
      - "Don't put only one navigation label — always provide both for a seamless navigation experience."
      - "Don't display too many page numbers at once — only show a few around the active page."
    cellSize: "34px"
    backgroundColor: "{colors.surface-card}"
    borderColor: "{colors.border-default}"
    rounded: "{rounded.base}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-md}"
    ellipsisColor: "{colors.text-tertiary}"
  pagination-cell-active:
    backgroundColor: "{colors.action-primary}"
    borderColor: "{colors.border-accent}"
    textColor: "{colors.text-on-primary}"
    fontWeight: 700
  pagination-arrow-disabled:
    textColor: "{colors.text-disabled}"
  # focus-visible: NOT implemented in kit — see Known Gaps (a11y)
 
  # ---------- PinInput ----------
  pininput:
    kit: "<PinInput length={4} value={v} onComplete={fn} size='md'/>"
    box: "48px"                      # sm 40 · md 48 · lg 56
    gap: "{spacing.space-4}"
    backgroundColor: "{colors.surface-card}"
    borderColor: "{colors.border-default}"   # 1.5px
    rounded: "{rounded.medium}"
    typography: "{typography.title-sm}"       # bold, centered (heading-8-size)
    textColor: "{colors.text-primary}"
  pininput-focus-visible:
    borderColor: "{colors.border-focus}"
    boxShadow: "{elevation.focus}"
  pininput-error:
    borderColor: "{colors.border-error}"
  pininput-disabled:
    backgroundColor: "{colors.surface-disabled}"
 
  # ---------- Popover ----------
  popover:
    kit: "<Popover trigger content placement='bottom'/>"
    do:
      - "Use a popover when you need to provide a long description of a page element or control, along with a clickable action."
      - "Put the CTA button in the bottom section of the component."
    dont:
      - "Don't use popover for a brief label with few words — use a tooltip instead."
      - "Don't put a link button within the text."
    backgroundColor: "{colors.surface-card}"
    borderColor: "{colors.border-default}"
    rounded: "{rounded.large}"
    elevation: "{elevation.l}"
    width: "260px"
    padding: "{spacing.space-8}"
    typography: "{typography.body-lg}"
    textColor: "{colors.text-secondary}"
 
  # ---------- PriceTag (formatted price) ----------
  pricetag:
    kit: "<PriceTag price={35000} original={50000} discountPercent={30} currency='Rp' size='md'/>"
    priceTypography: "{typography.body-lg}"   # bold (16px; sm 14 · lg 20)
    priceColor: "{colors.text-primary}"
    originalColor: "{colors.text-tertiary}"   # strikethrough, 0.8×
    discountColor: "{colors.text-error}"      # bold, 0.8×
 
  # ---------- ProductCard (storefront) ----------
  productcard:
    kit: "<ProductCard image brand title price originalPrice discount rating sold onAdd/>"
    width: "220px"
    backgroundColor: "{colors.surface-card}"
    borderColor: "{colors.border-subtle}"
    rounded: "{rounded.large}"
    elevation: "{elevation.xs}"
    imageBg: "{colors.surface-background}"     # 1:1 aspect
    brandTypography: "{typography.caption}"    # bold, uppercase
    brandColor: "{colors.text-accent}"
    titleTypography: "{typography.label}"      # 2-line clamp
    priceTypography: "{typography.body-lg}"    # bold
    priceColor: "{colors.text-primary}"
    originalPriceColor: "{colors.text-tertiary}"  # strikethrough
    discountBadgeBg: "{colors.fill-error}"
    discountBadgeColor: "{colors.text-on-primary}"
    ratingStarColor: "{colors.fill-warning}"
    metaColor: "{colors.text-tertiary}"
    addButtonBg: "{colors.action-primary}"
    addButtonColor: "{colors.text-on-primary}"
  productcard-hover:
    elevation: "{elevation.m}"
    transform: "translateY(-2px)"
  productcard-add-hover:
    backgroundColor: "{colors.action-primary-hover}"
 
  # ---------- ProductLabel (merchandising label) ----------
  productlabel-subtle:                 # default; tone swaps the tint/text pair
    kit: "<ProductLabel tone='primary' variant='subtle'>New</ProductLabel>"
    backgroundColor: "{colors.surface-primary-subtle}"   # primary tone shown
    textColor: "{colors.text-accent-strong}"
    typography: "{typography.caption}"   # bold, uppercase, +0.02em
    rounded: "{rounded.small}"
    padding: "{spacing.space-1} {spacing.space-4}"
  # subtle tones: success→surface-success-subtle/text-success · warning→surface-warning-subtle/text-on-warning-subtle
  #               error→surface-error-subtle/text-on-error-subtle · neutral→surface-sunken/text-secondary
  productlabel-solid:
    kit: "<ProductLabel variant='solid' tone='primary'>"
    backgroundColor: "{colors.action-primary}"
    textColor: "{colors.text-on-primary}"
  # solid tones: success→accent-success/text-on-primary · warning→fill-warning/text-on-warning-subtle (never white)
  #              error→fill-error/text-on-primary · neutral→text-strong(as fill)/text-on-primary
 
  # ---------- ProgressBar ----------
  progressbar:
    kit: "<ProgressBar value={60} tone='primary' showValue/>"
    do:
      - "Use the appropriate variant of progress bar (e.g., green color to indicate a completed task)."
    dont:
      - "Don't use an inappropriate variant of progress bar (e.g., red color to indicate a completed task)."
    trackColor: "{colors.control-track}"
    fillColor: "{colors.action-primary}"   # tone swaps fill
    rounded: "{rounded.full}"
    height: "8px"                           # sm 4 · md 8 · lg 12
    labelTypography: "{typography.body-sm}"
    labelColor: "{colors.text-secondary}"
 
  # ---------- Radio ----------
  radio:
    kit: "<Radio label='…' name='g' checked={v} onChange={fn}/>"
    do:
      - "Use radio buttons when users can only select one option from a list."
      - "Ensure there is a default value selected when using the radio button component."
      - "Use a dropdown for a single selection when there are 5 or more options available."
      - "Display all radio buttons visibly without requiring scrolling."
    dont:
      - "Don't use radio buttons when users can select more than one option — use Checkbox instead."
      - "Don't leave radio buttons empty without a default value."
      - "Don't use radio buttons for more than 3–4 choices."
    size: "20px"                     # sm 16 · md 20 · lg 24
    borderColor: "{colors.border-strong}"   # 1.5px unchecked
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.full}"
    labelTypography: "{typography.body-lg}"
    labelColor: "{colors.text-primary}"
  radio-selected:
    borderColor: "{colors.border-accent}"
    dotColor: "{colors.action-primary}"
  radio-disabled:
    backgroundColor: "{colors.surface-disabled}"
    dotColor: "{colors.text-disabled}"
    labelColor: "{colors.text-disabled}"
  # focus-visible: NOT implemented in kit — see Known Gaps (a11y)
 
  # ---------- Rating (stars) ----------
  rating:
    kit: "<Rating value={4.5} readOnly showValue/>"
    emptyColor: "{colors.fill-neutral-subtle}"
    filledColor: "{colors.fill-warning}"
    size: "20px"
    valueTypography: "{typography.body-md}"   # bold
    valueColor: "{colors.text-secondary}"
 
  # ---------- Scrollbar ----------
  scrollbar:
    kit: "<Scrollbar orientation='vertical' size='md' value={0} thumb={0.3}/>"
    trackColor: "{colors.surface-card}"
    trackThickness: "16px"             # xs 12 · sm 14 · md 16 · lg 18 · xl 20
    thumbColor: "{colors.fill-neutral}"
    rounded: "{rounded.full}"
  scrollbar-thumb-hover:
    thumbColor: "{colors.fill-neutral-strong}"
 
  # ---------- SegmentedControl ----------
  segmentedcontrol:
    kit: "<SegmentedControl options={[…]} value onChange size='md'/>"
    trackBg: "{colors.surface-sunken}"
    trackRounded: "{rounded.medium}"
    trackPadding: "{spacing.space-2}"
    segmentRounded: "{rounded.base}"
    segmentColor: "{colors.text-secondary}"
    segmentTypography: "{typography.body-md}"
    height: "36px"                     # sm 30 · md 36 · lg 42
  segmentedcontrol-segment-selected:
    backgroundColor: "{colors.surface-card}"
    color: "{colors.text-accent-emphasis}"
    elevation: "{elevation.xs}"
    fontWeight: 700
  # focus-visible: NOT implemented in kit — see Known Gaps (a11y)
 
  # ---------- Select (custom dropdown) ----------
  select:
    kit: "<Select label='…' options={[…]} value={v} onChange={fn}/>"
    do:
      - "Use disabled state for any unavailable options instead of removing them."
      - "Keep the options range between 5–7 items."
      - "Let users type in the content when it is quicker than scrolling through."
    dont:
      - "Don't enable all the options even when users can't choose some of them."
      - "Don't list all the options with no limitation."
      - "Don't use a dropdown for selecting a single value such as a day, month, or year — use an appropriate component instead (e.g., Date Picker)."
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    placeholderColor: "{colors.text-tertiary}"
    borderColor: "{colors.border-default}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.medium}"
    padding: "0 {spacing.space-6}"
    height: "42px"
  select-focus-visible:  # open state
    borderColor: "{colors.border-focus}"
    boxShadow: "{elevation.focus}"
  select-error:
    borderColor: "{colors.border-error}"
  select-disabled:
    backgroundColor: "{colors.surface-disabled}"
  select-menu:
    backgroundColor: "{colors.surface-raised}"
    borderColor: "{colors.border-default}"
    rounded: "{rounded.medium}"
    elevation: "{elevation.m}"
    padding: "{spacing.space-2}"
    maxHeight: "240px"
  select-option:
    textColor: "{colors.text-primary}"
    rounded: "{rounded.base}"
    padding: "{spacing.space-4} {spacing.space-5}"
  select-option-hover:
    backgroundColor: "{colors.action-neutral-hover}"
  select-option-selected:
    backgroundColor: "{colors.surface-primary-subtle}"
    checkColor: "{colors.text-accent}"
 
  # ---------- SidebarNav ----------
  sidebarnav:
    kit: "<SidebarNav sections={[…]} collapsed activeKey onSelect/>"
    do:
      - "Reserve the sidebar for top-level, global destinations that represent the core pillars of the app's functionality."
      - "Keep navigation item labels short and descriptive."
      - "Use icons to support the label meaning."
    dont:
      - "Don't use the sidebar for temporary actions or deeply nested sub-pages."
      - "Don't use long labels that wrap to multiple lines."
      - "Don't use icons that are ambiguous or unrelated to the navigation destination."
    backgroundColor: "{colors.surface-card}"
    borderRightColor: "{colors.border-default}"
    width: "256px"                             # collapsed rail: 72px
    sectionLabelTypography: "{typography.nav-section}"
    sectionLabelColor: "{colors.text-tertiary}"
    itemTypography: "{typography.nav-link}"
    itemColor: "{colors.text-secondary}"
    itemRounded: "{rounded.medium}"
    itemPadding: "{spacing.space-3} {spacing.space-5}"
  sidebarnav-item-hover:
    backgroundColor: "{colors.surface-background}"
  sidebarnav-item-selected:
    backgroundColor: "{colors.surface-primary-subtle}"
    itemColor: "{colors.text-accent-strong}"
    fontWeight: 700
  sidebarnav-badge:
    backgroundColor: "{colors.fill-error}"
    textColor: "{colors.text-on-primary}"
    rounded: "{rounded.full}"
 
  # ---------- Skeleton ----------
  skeleton:
    kit: "<Skeleton variant='text'/>"
    do:
      - "Use skeletons instead of loaders for loading text, images, cards, or lists."
      - "Match the skeleton shape with the final content (text → line, avatar → circle)."
    dont:
      - "Don't use loaders when displaying loading states for text, images, cards, or lists."
      - "Don't create skeletons that are random or inconsistent with the actual shape and structure of the content."
    baseColor: "{colors.surface-sunken}"
    shimmerColor: "{colors.fill-neutral}"
    rounded: "{rounded.medium}"             # text→base, circle→full
    # shimmer 1.4s ease infinite
 
  # ---------- Slider ----------
  slider:
    kit: "<Slider value={n} onChange={fn} showValue/>"
    do:
      - "Use sliders on values that do not need to be specific/precise."
      - "In scenarios where multiple sliders share the same adjustable metric, use vertical sliders for easier readability."
    dont:
      - "Don't use sliders on values that need to be specific/precise."
      - "Don't use horizontal sliders in scenarios where multiple sliders share the same adjustable metric."
    trackColor: "{colors.control-track}"
    trackHeight: "6px"
    rounded: "{rounded.full}"
    fillColor: "{colors.action-primary}"
    thumbColor: "{colors.surface-card}"
    thumbBorderColor: "{colors.border-accent}"    # 2px
    thumbSize: "18px"
    thumbElevation: "{elevation.s}"
    labelTypography: "{typography.body-md}"
    valueColor: "{colors.text-accent-emphasis}"
  slider-disabled:
    fillColor: "{colors.fill-neutral-strong}"
    thumbBorderColor: "{colors.fill-neutral-strong}"
  # focus-visible: NOT implemented in kit — see Known Gaps (a11y)
 
  # ---------- Spinner ----------
  spinner:
    kit: "<Spinner size={24} tone='primary'/>"
    do:
      - "Ensure loaders are consistent with brand colors and style."
      - "Understand the difference between using loaders and skeletons — loaders for actions, skeletons for content."
    dont:
      - "Don't leave users without feedback if the process takes longer than 1 second."
      - "Don't break brand consistency with random loader colors or styles."
      - "Don't use skeletons instead of loaders for action-based processes."
    trackColor: "{colors.control-track}"
    indicatorColor: "{colors.action-primary}"
    size: "24px"
    thickness: "3px"                        # 0.8s linear
 
  # ---------- StatCard ----------
  statcard:
    kit: "<StatCard label='…' value='…' delta={4.2} tone='primary' icon={<Icon/>}/>"
    backgroundColor: "{colors.surface-card}"
    borderColor: "{colors.border-subtle}"
    rounded: "{rounded.large}"
    elevation: "{elevation.xs}"
    padding: "{spacing.space-8}"
    valueTypography: "{typography.title-xl}"
    valueColor: "{colors.text-primary}"
    labelTypography: "{typography.body-md}"
    labelColor: "{colors.text-tertiary}"
    iconTileSize: "38px"
    iconTileRounded: "{rounded.medium}"
    iconTileBg: "{colors.surface-primary-subtle}"    # tone=primary; tone swaps to that product/status tint
    iconTileFg: "{colors.text-accent-emphasis}"
    deltaUpColor: "{colors.text-success}"
    deltaDownColor: "{colors.text-danger}"
 
  # ---------- StatusBar (mobile) ----------
  statusbar:                           # theme=light
    kit: "<StatusBar platform='ios' theme='light' time='9:41'/>"
    height: "44px"                     # ios 44 · android 24
    textColor: "{colors.text-primary}"
    glyphColor: "{colors.text-primary}"
    typography: "{typography.body-md}"   # semibold; 15px ios / 12px android
  statusbar-dark:
    textColor: "{colors.text-on-dark}"
    glyphColor: "{colors.text-on-dark}"
 
  # ---------- Stepper ----------
  stepper:
    kit: "<Stepper steps={[…]} current={i} orientation='horizontal'/>"
    do:
      - "Use steppers for linear, sequential processes where each step must be completed before moving to the next."
      - "Clearly indicate the current step and steps already completed."
    dont:
      - "Don't use steppers for non-linear processes where steps can be completed in any order."
      - "Don't show all steps as equal without distinguishing current, completed, and upcoming states."
    nodeSize: "28px"
    pendingRingColor: "{colors.fill-neutral-subtle}"
    pendingTextColor: "{colors.text-tertiary}"
    connectorPendingColor: "{colors.border-default}"
    labelTypography: "{typography.body-md}"
    descriptionTypography: "{typography.body-sm}"
    descriptionColor: "{colors.text-tertiary}"
  stepper-active:
    ringColor: "{colors.border-accent}"
    textColor: "{colors.text-accent}"
    labelColor: "{colors.text-primary}"
  stepper-complete:
    nodeBg: "{colors.action-primary}"
    checkColor: "{colors.text-on-primary}"
    connectorColor: "{colors.action-primary}"
 
  # ---------- Switch (Toggle) ----------
  switch:
    kit: "<Switch label='…' checked={v} onChange={fn}/>"
    do:
      - "Always put text on the left of the toggle component."
      - "Provide concise, nonneutral labels that are short and direct."
    dont:
      - "Don't put the toggle component to the left of text, and/or on different columns in a row."
      - "Don't make users second-guess the label."
    trackColor: "{colors.control-track-off}"
    knobColor: "{colors.surface-card}"
    rounded: "{rounded.full}"
    height: "22px"        # sm 18 · md 22 · lg 28; width = height × 1.75
    labelTypography: "{typography.body-lg}"
  switch-selected:        # on
    trackColor: "{colors.action-primary}"
  switch-disabled:
    trackColor: "{colors.border-default}"
    labelColor: "{colors.text-disabled}"
  # focus-visible: NOT implemented in kit — see Known Gaps (a11y)
 
  # ---------- Table ----------
  table:
    kit: "<Table columns={[…]} data={[…]} striped hoverable size='md'/>"
    do:
      - "Right-align numerical data; left-align text data."
      - "For nested tables, place the accordion icon next to the main content, after the checkbox."
      - "Use column dividers sparingly."
      - "Use an en dash (–) for missing or null values."
    dont:
      - "Don't use left-aligned formatting for numerical data in columns."
      - "Don't place any actionable component (such as a checkbox) between the accordion icon and the main text component."
      - "Don't use zebra stripes."
      - "Don't use inconsistent representations for null or not applicable (N/A) values."
    borderColor: "{colors.border-default}"
    rounded: "{rounded.medium}"
    headerBg: "{colors.surface-background}"
    headerTypography: "{typography.table-header}"
    headerColor: "{colors.text-secondary}"
    headerBorderColor: "{colors.border-default}"
    cellTypography: "{typography.body-lg}"
    cellColor: "{colors.text-primary}"
    cellPadding: "{spacing.space-6} {spacing.space-8}"
    rowDividerColor: "{colors.border-subtle}"
  table-row-hover:
    backgroundColor: "{colors.surface-primary-subtle}"
  table-row-striped:
    backgroundColor: "{colors.surface-background}"
  table-sm: { cellPadding: "{spacing.space-4} {spacing.space-6}", cellTypography: "{typography.body-md}" }
  table-lg: { cellPadding: "{spacing.space-8} {spacing.space-8}" }
 
  # ---------- Tabs ----------
  tabs:
    kit: "<Tabs items={[…]} value={k} onChange={fn} size='md'/>"
    borderBottomColor: "{colors.border-default}"
    tabTypography: "{typography.body-lg}"
    tabColor: "{colors.text-secondary}"
    tabHeight: "44px"
    tabPadding: "0 {spacing.space-7}"
    gap: "{spacing.space-2}"
  tabs-tab-hover:
    tabColor: "{colors.text-primary}"
  tabs-tab-selected:
    tabColor: "{colors.text-accent}"
    indicatorColor: "{colors.text-accent}"     # inset 2px underline
    fontWeight: 700
  tabs-sm: { tabHeight: "36px", tabTypography: "{typography.body-md}" }
  # focus-visible: NOT implemented in kit — see Known Gaps (a11y)
 
  # ---------- Tag (chip) ----------
  tag:
    kit: "<Tag tone='neutral' size='md' onRemove={fn}>Label</Tag>"
    do:
      - "Tags should fit within the display, stacked horizontally."
      - "Keep text in a Tag short and concise for better readability."
      - "Use the same sized tags within a tag group."
      - "Use one color for tags, and apply multiple colors only when they have clear meaning for users."
      - "Keep chip labels short and descriptive."
      - "Use chips for filtering or selecting multiple values."
    dont:
      - "Don't allow your display to cut off Tags or force users to scroll to see other options."
      - "Don't use long text in a Tag."
      - "Don't use different sized tags within a group of tags."
      - "Don't use multiple tag colors unless they represent meaningful distinctions, such as status."
      - "Don't use chips for primary actions — use buttons instead."
      - "Don't nest chips inside other interactive components."
    backgroundColor: "{colors.surface-sunken}"   # neutral tone; tone swaps the tint/text/border triple
    textColor: "{colors.text-secondary}"
    borderColor: "{colors.border-default}"
    typography: "{typography.body-md}"
    rounded: "{rounded.small}"
    height: "28px"
    padding: "0 {spacing.space-5}"
  tag-sm: { height: "22px", typography: "{typography.body-sm}" }
 
  # ---------- Textarea ----------
  textarea:
    kit: "<Textarea label='…' rows={4}/>"
    do:
      - "Input labels and placeholder should be in Sentence Case (capitalize only the first letter of the first word)."
      - "Use clear and easy-to-understand placeholders to avoid user confusion."
      - "Use a text area when the input is expected to span multiple lines."
      - "Replace helper text with informative error messages when needed."
    dont:
      - "Don't use Camel Case for input labels and placeholders."
      - "Don't use unclear or unhelpful placeholders."
      - "Don't use a text area when only short text input is needed."
      - "Don't show both helper text and error messages at the same time."
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    borderColor: "{colors.border-default}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.medium}"
    padding: "{spacing.space-5} {spacing.space-6}"
    labelTypography: "{typography.label}"
    helperTypography: "{typography.body-sm}"
    helperColor: "{colors.text-tertiary}"
    resize: vertical
  textarea-focus-visible:
    borderColor: "{colors.border-focus}"
    boxShadow: "{elevation.focus}"
  textarea-error:
    borderColor: "{colors.border-error}"
    helperColor: "{colors.text-error}"
  textarea-disabled:
    backgroundColor: "{colors.surface-disabled}"
 
  # ---------- Thumbnail (fixed-ratio media) ----------
  thumbnail:
    kit: "<Thumbnail src alt ratio='1:1' rounded='large' overlay/>"
    backgroundColor: "{colors.surface-background}"   # placeholder canvas
    rounded: "{rounded.large}"                       # rounded prop → any radius token
    placeholderGlyphColor: "{colors.fill-neutral-subtle}"
    placeholderStripeColor: "{colors.border-subtle}"   # 45° repeating stripe
    ratios: "1:1 · 4:3 · 16:9 · 3:4"
 
  # ---------- Timeline ----------
  timeline:
    kit: "<Timeline items={[…]}/>"
    nodeSize: "28px"                   # tone swaps ring/fill
    nodeRingColor: "{colors.border-accent}"    # 2px
    nodeFillColor: "{colors.action-primary}"   # when icon present
    connectorColor: "{colors.border-default}"
    titleTypography: "{typography.body-lg}"
    titleColor: "{colors.text-primary}"
    timeColor: "{colors.text-tertiary}"
    descriptionTypography: "{typography.body-md}"
    descriptionColor: "{colors.text-secondary}"
 
  # ---------- TimePicker ----------
  timepicker-trigger:
    kit: "<TimePicker label='…' value={t} onChange={fn} hour12/>"
    backgroundColor: "{colors.surface-card}"
    borderColor: "{colors.border-default}"
    rounded: "{rounded.medium}"
    height: "42px"
    typography: "{typography.body-lg}"
    placeholderColor: "{colors.text-tertiary}"
    iconColor: "{colors.text-secondary}"
  timepicker-trigger-focus-visible:  # open
    borderColor: "{colors.border-focus}"
    boxShadow: "{elevation.focus}"
  timepicker-popover:
    backgroundColor: "{colors.surface-card}"
    borderColor: "{colors.border-default}"
    rounded: "{rounded.large}"
    elevation: "{elevation.l}"
    columnDividerColor: "{colors.border-subtle}"
    optionTypography: "{typography.body-md}"
  timepicker-option-hover:
    backgroundColor: "{colors.surface-primary-subtle}"
  timepicker-option-selected:
    backgroundColor: "{colors.action-primary}"
    textColor: "{colors.text-on-primary}"
 
  # ---------- Toast ----------
  toast:
    kit: "<Toast status='success' title='…'>body</Toast>  (render in a fixed stack)"
    do:
      - "Keep toast messages short and informative, as they only appear for a limited time."
      - "Use the correct state to enhance user clarity and awareness."
    dont:
      - "Don't use long, detailed explanations that users may not have enough time to read."
      - "Don't use toasts for critical information that requires user action — use modals or alerts instead."
    backgroundColor: "{colors.surface-raised}"
    accentColor: "{colors.accent-info}"        # status accent, 4px left bar
    borderLeftWidth: "4px"
    rounded: "{rounded.medium}"
    elevation: "{elevation.m}"
    padding: "{spacing.space-6} {spacing.space-7}"
    minWidth: "280px"
    maxWidth: "420px"
    titleTypography: "{typography.body-lg}"
    bodyTypography: "{typography.body-md}"
    bodyColor: "{colors.text-secondary}"
 
  # ---------- Tooltip ----------
  tooltip:
    kit: "<Tooltip content='…'>trigger</Tooltip>"
    do:
      - "Use tooltips when you need to provide a short description of a page element or control."
      - "Place tooltips close to the element they are related to."
      - "Use a brief label on the tooltip, preferring one or two words. Use a definition only when you can't say it with few words."
    dont:
      - "Don't use a tooltip to give essential information needed to understand the interface, or for communicating critical information including errors. Use a Notification or Alert instead."
      - "Don't include links or buttons inside the tooltip."
      - "Don't overload tooltips — they should contain no more than 3 sentences."
    backgroundColor: "{colors.surface-inverse}"
    textColor: "{colors.text-on-dark}"
    typography: "{typography.body-sm}"
    fontWeight: 500
    rounded: "{rounded.base}"
    elevation: "{elevation.m}"
    padding: "{spacing.space-3} {spacing.space-5}"
---
 
## Overview
 
Paradise is ParagonCorp's unified platform system — it dresses internal ops tools, analytics dashboards, mobile apps, and storefronts in one voice. Treat it as documentation-grade software UI, not a marketing brand: calm, precise, and quiet, with the personality showing through discipline rather than decoration.
 
Three decisions define the look. **One blue.** `{colors.action-primary}` (#215AA8) is the only saturated color a normal screen needs; it marks the single primary action and the active state, and everything else is neutral. **Flat surfaces on off-white.** The canvas is `{colors.surface-background}`, cards are flat white with 1px hairlines and a barely-there shadow — no gradients, no textures in product UI. **Slate, not black.** Body text is `{colors.text-primary}` (#2A3D4A), a desaturated slate that reads softer than #000 and matches the shadow tint, so text and elevation feel like one material.
 
Voice is instructional and neutral-professional — address the reader as a peer with imperative guidance. Headings and token names are Title Case; body is sentence case. No emoji, no slang. Product copy may mix Indonesian and English (e.g. "Troli" = cart); documentation stays English.
 
## Colors
 
**Ramps vs. aliases.** Two kinds of entry in the `colors:` map. **Ramps** (`brand`, `neutral`, `info`, `success`, `warning`, `error`, the product ramps) are compact 50→900 tables of raw material. **Aliases** (`action-primary`, `surface-card`, `text-secondary`, `border-focus`) are the interface — one per line, at the bottom of the map. Every component in this file references an alias, never a ramp step and never a raw hex, and you should too. A raw ramp value in application code is a smell: it means a missing alias. Each alias carries its resolved hex plus a `→` comment naming the ramp step it follows, so nothing needs looking up and a brand swap is legible at a glance.

**Swapping brands.** `brand` is the accent ramp; every accent alias (`action-primary`, `text-accent`, `border-focus`, `surface-primary-subtle`, …) follows it. To re-skin for another product, set `activeBrand` and copy that product's ramp into `brand` — nothing else changes. Base hues: Paragon/SFM #215AA8, Heron/Exagon #725DA3, DigiSO #A773B0, Magpie/Siglive #006EFF, Nova Mobile #447ACD, Nova Dashboard #0056CC, Sagitarius #005B99, Gro #5D34FF, Shipgo #6E69C7.
 
**Why slate text.** `#2A3D4A` is not on the neutral ramp — it is a deliberately cool, low-chroma slate. Pure `neutral.900` (#1F1F1F) reads as harsh near-black against the cool `#F8F9FD` canvas; the slate carries the same blue undertone as the background and the shadow tint (`rgba(42,61,74,α)`), so the whole surface feels tuned to one temperature. Never substitute `neutral.900` for body text.
 
**Full ramps, 10 steps.** Every ramp runs `50, 100, 200 … 900`. Base hues: **brand** #215AA8, **neutral** #999999, **info** #0056CC, **success** #40BF75, **warning** #FFCD00, **error/danger** #E6001C.

**Transparency lives in one place.** The `overlay` ramp is the only set of tokens carrying alpha: `overlay.50` is black at 10%, and `overlay.100`–`900` are all slate `#2A3D4A` differing only in alpha (8/10/12/14/16/18/20/50/70%). `overlay.100`–`500` are exactly the alphas the elevation shadows use — overlay and shadow are the same material at one temperature. Two aliases stay hand-written literals because no ramp step matches their alpha: `overlay-scrim` (slate @45%; nearest is `overlay.800` @50%) and `focus-ring` (brand @35%).
 
**Usage scarcity — this is what keeps Paradise calm:**
- **Primary blue fill:** at most **one** `action-primary` button per view (the main CTA). A second filled blue button competes with it — demote secondary actions to `button-secondary` (outline) or `button-ghost`. Blue also carries the active nav item and selected states; that is the same "this is where the action is" signal, so don't also fill unrelated blocks blue.
- **`surface-primary-subtle` (#D3DEEE):** earns its place only on selection/hover — active sidebar item, selected table row, selected option, hovered day, icon tiles, avatar fallback. It is not a decorative panel tint.
- **Semantic colors (info/success/warning/error):** reserved for status. Don't use success green as a brand accent or error red for a non-destructive control. Warning yellow is legible only with dark text — never white-on-yellow.
- **Product ramps:** use a product ramp only when designing that product's own surface. On a generic Paradise screen the accent is always `brand`. Watch three things: SFM mirrors Paragon and Exagon mirrors Heron (identical hex, separate ramps); **Nova is two ramps**, `nova-mobile` (base #447ACD) and `nova-dashboard` (base #0056CC), which must not be conflated; and Siglive and Magpie share 50–500 but diverge from 600 down.
- **Background count:** 1–2 background colors per screen maximum (`surface-background` canvas + `surface-card` white). Sunken wells are the rare third.

**Promoted raw values.** `overlay-scrim` (the modal/drawer/sheet scrim — slate at 45%, never black) and `gradient-ai` (the AILabel sweep) used to sit raw inside components and are now tokens. The canvas `#F8F9FD` and body slate `#2A3D4A` used to be undocumented literals and are now `slate.50` / `slate.900`. `overlay-scrim` and `focus-ring` are the last two literals standing.
 
## Typography
 
**Single family: Lato.** Every type token — display, headings, body, buttons, labels, table headers, data figures — is set in Lato with the fallback stack `"Lato", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` (from `tokens/typography.css` `--font-sans`). There is **no second brand face and no data-vs-prose split**: the role-named type tokens all resolve to Lato, and Paradise UI reads as one voice from KPI figure to caption. (The kit's `fonts.css` still ships an `Inter` face wired as `--font-ui`, and a handful of data components currently render their numerals in it — that is a divergence from this single-family target, tracked in Known Gaps; the target is Lato everywhere.)
 
Tokens are named by **role, not by size** so intent survives a scale change, and each cites the real component it is drawn from. The underlying Figma scale has 15 steps (Display 1 → Caption 2); this file exports the steps with confirmed usage and maps them to roles, reading sizes and line-heights verbatim from `tokens/typography.css`. Body baseline is `body-lg` (16px/22px). Headings are bold (700); body and caption are regular (400); form labels are semibold (600); nav links are medium (500). Apply `+0.005em` tracking on display/title-2xl sizes only — at large sizes Lato's default spacing looks loose; below that, tracking stays at 0, except button labels which carry a deliberate `+0.01em` for legibility at small sizes.
 
Line heights are unitless ratios (import line ÷ import size) so they scale: display/title sit at **~1.30–1.35** (tight, so multi-line headings don't drift apart), body at **~1.29–1.38** for comfortable reading, and interactive labels (button/nav) at **1.0** because those elements are single-line and vertically centered by their fixed height.
 
## Layout
 
Derived from real dashboard and console screens (Heron Console). Each number is labeled read (a token/constant in the import) or inferred (read off a production screen).
 
- **App shell** *(read: 256/72 sidebar constant; rest inferred)*: persistent left `SidebarNav` at **256px** (collapses to a **72px** icon rail), optional top `AppBar`, and a fluid content region on the `{colors.surface-background}` canvas.
- **Content max width** *(inferred)*: dashboards and data screens run near-fluid (fill the content region, generous side gutters); reading/form pages cap the primary column around **720–960px** so line length stays legible. Modals cap at 400 / 540 / 720px by size *(read: Modal.jsx)*.
- **Grid & gutters** *(inferred)*: cards lay out on a 12-column mental grid with **`{spacing.space-8}` (16px)** gutters and **`{spacing.space-8}`–`{spacing.space-11}` (16–24px)** section padding. StatCard rows are typically 3–4 across.
- **Internal vs layout spacing** *(read: grid; usage inferred)*: component internals use the tight end of the 2px grid (`space-1`–`space-8`, 2–16px); layout uses the wide end (`space-11`+, 24px+) between sections.
- **Whitespace philosophy:** Paradise buys calm with air, not lines. Prefer spacing and a single hairline over boxes-within-boxes. If two hairlines sit close together, delete one. The 2px grid exists so every gap is intentional — never emit `13px` or `27px`.
## Elevation
 
Seven bottom-direction tiers plus two upward and a focus ring, all tinted `rgba(42,61,74,α)` — the same slate as text — so shadows read as depth in the brand's temperature, never as grey haze (verbatim from `tokens/shadow.css`). **Semantics, not decoration:**
 
- **`xs`** — resting surface: cards, StatCards. Paired with a 1px `border-subtle` it forms the canonical `elevation.card` (hairline + soft lift). Most of the UI lives here.
- **`m`** — the "floating above the page" tier: dropdown menus, popovers, toasts, and cards on hover/interactive lift.
- **`l`** — calendars and large popovers. **`2xl`** — modals and drawers (the highest thing on screen over a scrim).
- **`s`, `xl`, `3xl`** — in the scale but rare; reserve for one-off large floating surfaces (`s` is used for the slider thumb and carousel arrows).
- **`top-s` / `top-m`** — upward shadows for bottom nav and bottom sheets.
- **`focus`** — the 3px `focus-ring` glow, applied on keyboard/active focus only (never as decoration).
Rule of thumb: if you can't name why an element is above the page, it belongs at `xs`.
 
## Components
 
Every component references tokens by alias in the frontmatter and carries a `kit:` field with its real React API. **The kit ships no utility CSS classes** — components style themselves with inline CSS custom properties, so in no-kit mode you compose from the token variables (`var(--action-primary)`, `var(--space-8)`, …), not from class names.

**Do's and Don'ts live in the frontmatter.** 36 of the component entries carry `do:` and `dont:` lists (203 rules total) directly under their `kit:` field — usage guidance imported from the Figma component documentation, covering things tokens cannot express: how many options a menu should hold, where a toggle's label belongs, when to reach for a Radio instead of a Checkbox. Read them alongside the token map; where a rule restates a guardrail (one primary button per view, never white on yellow) the guardrail wins. Components without these keys are not yet documented in Figma — see Known Gaps. Guidance on *when* to use each treatment:
 
**Alert / Toast / Banner.** Alert and Toast use a 4px left accent bar in the status color over a tinted (Alert) or white (Toast) surface. Banner is a bolder full-width strip with a solid tone fill. In all three, warning uses `text-on-warning-subtle` on yellow — never white. Pair status with an icon.
 
**Avatar / AvatarGroup.** Avatar fallback is `surface-primary-subtle` bg + `text-accent-strong` initials, `rounded.full` (square → `rounded.medium`), with a status dot (online→success, busy→error, away→warning, offline→neutral) ringed in white. AvatarGroup overlaps at 32% with white separator rings and a `fill-neutral` "+N" chip.
 
**Badge / Tag.** Badge is a status/count label (`rounded.small`) — `subtle` pairs a tint surface with dark tone text; `solid` fills the tone. Tag is a taller (28px) bordered chip, optionally removable. Warning always takes dark text — never white (see Accessibility).
 
**Button.** Five variants — `primary` (the one blue CTA), `secondary` (blue outline), `tertiary` (neutral outline, low-emphasis), `ghost` (text-only), `danger` (red, destructive only). Four sizes; **md (42px) is default**. Radius steps *up* with size (xs→small, sm/md→base, lg→medium) — a deliberate optical correction. Hover darkens the fill one step, press two; focus shows the ring; disabled drops to `surface-sunken` fill + `text-disabled`. One primary per view.
 
**Card / StatCard.** White `surface-card`, `rounded.large` (8px), 1px `border-subtle`, `elevation.xs`. Interactive cards lift to `elevation.m` + translateY(-2px). StatCard is the dashboard KPI tile: a toned icon tile, the value in `title-xl`, a `body-md` label, and a colored delta (▲ `text-success` / ▼ `text-danger`).
 
**Carousel / Timeline.** Carousel is a `rounded.large` slide clip with white `elevation.s` arrows and dots (active widens to a 20px blue pill; the one custom easing in the system). Timeline is a vertical event sequence: 28px tone-ringed nodes, `border-default` connector, `body-lg` titles, `text-tertiary` timestamps.
 
**Checkbox / Radio / Switch.** All go brand blue when active. Checkbox is a 20px square (`rounded.base`, 1.5px `border-strong` unchecked → `action-primary` fill checked/indeterminate). Radio is its circular sibling (ring + dot). Switch is a `rounded.full` pill, `control-track-off` off → `action-primary` on, white knob. Checkbox/Radio for form selection, Switch for immediate settings. **Note:** these three lack an explicit focus ring in the current kit (Known Gaps).
 
**Combobox.** Searchable Select — leading search glyph, type-to-filter, `emptyText` state. Same menu treatment; reach for it over Select past ~8–10 options.
 
**DatePicker / TimePicker.** Text triggers opening `elevation.l` popovers. DatePicker: today gets a `border-accent-subtle` ring, selected fills `action-primary`/white, hover washes `surface-primary-subtle`. TimePicker: two scrollable hour/minute columns split by a `border-subtle` divider, same selected/hover treatment.
 
**DropdownMenu / SidebarNav / Breadcrumb / Pagination / SegmentedControl / Stepper / AppBar / BottomNav.** Navigation & menu family. DropdownMenu is a click action menu (`surface-raised`, `elevation.m`; `danger` items in `text-danger`). SidebarNav is the 256px app rail (selected item washes `surface-primary-subtle` + `text-accent-strong` bold). Breadcrumb links are `body-md` `text-secondary`. Pagination uses 34px cells (active fills `action-primary`). SegmentedControl is a pill-track view switch (selected segment is a white pill with `elevation.xs`). Stepper shows multi-step progress (pending neutral, active blue ring, complete blue fill + check). AppBar (56px) and BottomNav (60px) are the mobile bars.
 
**EmptyState / AILabel.** EmptyState is a centered placeholder (circular `surface-primary-subtle` icon tile, `title-md` heading, capped description, up to two actions) — the sanctioned home for illustrations. AILabel is the inline "AI" pill and the **only sanctioned gradient** (`gradient-ai`, heron→digiso purple), off the blue axis so AI reads as distinct.
 
**FileUpload.** Dashed 1.5px `border-strong` dropzone on `surface-background` with a `surface-primary-subtle` upload-icon tile and a "Click to upload" accent link; dragging flips to a blue wash + `border-accent`. Selected files list below as `rounded.medium` rows.
 
**IconButton / ButtonGroup.** IconButton is a square icon-only action (ghost by default, `neutral-100`-equiv hover, focus ring), 28/34/42/48px, with a `rounded` flag for a circular pill — give it an `aria-label` and a ≥44px touch target. ButtonGroup joins related buttons into a segmented unit; the selected segment fills `action-primary`/white.
 
**Input / Textarea / Select.** 42px default, 6px radius, 1px `border-default`. Focus swaps the border to `border-focus` and adds the ring; error swaps to `border-error` and recolors helper to `text-error`; disabled fills `surface-disabled`. Label is `label` (14px semibold) above; helper/error is `body-sm` below. Select's open menu is a `surface-raised` panel at `elevation.m`; the selected option washes `surface-primary-subtle` with a blue check.
 
**Label.** The shared form-label primitive (semibold); required shows a red asterisk, optional a regular-weight `(optional)` hint.
 
**Modal / Drawer / BottomSheet.** All open over the `overlay-scrim`. Modal is a centered `rounded.large` `elevation.2xl` dialog (400/540/720). Drawer slides from a side edge (400px, `elevation.2xl`). BottomSheet slides up (mobile, `rounded.2xl` top corners, drag handle). Escape and overlay-click close.
 
**NumberInput / PinInput / Slider.** NumberInput is a −/+ stepper around a centered semibold value with a suffix slot. PinInput is a row of 48px OTP boxes (1.5px border, `title-sm` glyph, per-box focus ring, error recolors all). Slider is a 6px `control-track` rail, `action-primary` fill, 18px white thumb with a 2px blue ring and `elevation.s`; optional value read-out in `text-accent-emphasis`.
 
**ProductCard.** Storefront tile (220px): 1:1 image with a `fill-error` discount badge, uppercase `caption` brand in blue, 2-line title, bold price with strikethrough original, star rating + sold meta, and a full-width blue add-to-cart. Hover lifts to `elevation.m`.
 
**ProgressBar / Spinner / Skeleton / Rating.** ProgressBar: `control-track` rail, `action-primary` fill. Spinner: `control-track` ring with an `action-primary` arc. Skeleton: shimmer between `surface-sunken` and `fill-neutral`. Rating: empty `fill-neutral-subtle`, filled `fill-warning` (the one decorative use of warning-yellow).
 
**Table / List.** Table is dense: `surface-background` header (`table-header`, 14px bold), `body-lg` cells on `border-subtle` dividers, hover washes `surface-primary-subtle`, optional striping in `surface-background`, wrapped in a `rounded.medium` `border-default` frame. List is vertical rows (leading/trailing slots, `label` title, `body-sm` subtitle); interactive rows hover `surface-background`.
 
**Tabs / Accordion / Divider.** Tabs are underline-style — active is `text-accent` bold with a 2px inset underline; inactive `text-secondary` → `text-primary` on hover. Accordion is collapsible sections in a bordered container; open header washes `surface-background`. Divider is a hairline with an optional centered label.
 
**Tooltip / Popover.** Tooltip is a dark `surface-inverse` bubble, white `body-sm`, plain text only. Popover is a white `rounded.large` `elevation.l` panel for rich/interactive content.
 
## Motion
 
**Inferred, not tokenized** — the import specifies motion only as component transition strings; the numbers below are read off those strings (`.12s`/`.15s`/`.2s`), not a named token set (see Known Gaps). Paradise never bounces or overshoots.
 
- **duration-fast: 120ms** *(inferred)* — micro state on small controls (checkbox fill, row hover).
- **duration-base: 150ms** *(inferred)* — the default: button background/border/shadow, input border + ring, tab color + underline, card shadow/transform.
- **duration-slow: 200ms** *(inferred)* — larger spatial changes (sidebar collapse width).
- **easing: `ease`** *(inferred)* — no custom curve, except Carousel's `cubic-bezier(.4,0,.2,1)` (350ms) *(read: Carousel.jsx)*.
- **Animate only:** `background-color`, `border-color`, `box-shadow`, `color`, `transform`, `width`. Never layout-thrashing properties. Respect `prefers-reduced-motion`.
- **Interaction pattern:** hover = one-step-darker fill; press = two-steps-darker; focus = the 3px ring.
## Accessibility
 
Contrast ratios recomputed from the imported hex values (WCAG 2.1; normal text needs 4.5:1, large/bold ≥18.66px needs 3:1, non-text UI boundaries need 3:1 per 1.4.11).
 
**Text on solid surfaces:**
 
| Foreground | Background | Ratio | Normal | Large |
|---|---|---|---|---|
| text-primary #2A3D4A | surface-background #F8F9FD | 10.8:1 | Pass | Pass |
| text-primary #2A3D4A | surface-card #FFFFFF | 11.2:1 | Pass | Pass |
| text-secondary #5C5C5C | surface-card #FFFFFF | 7.0:1 | Pass | Pass |
| text-tertiary #7A7A7A | surface-card #FFFFFF | 4.5:1 | Pass (just) | Pass |
| text-tertiary #7A7A7A | surface-background #F8F9FD | 4.3:1 | **Fail** | Pass |
| text-disabled #ADADAD | surface-card #FFFFFF | 2.3:1 | Fail (intended) | Fail |
| white #FFFFFF | action-primary #215AA8 | 6.4:1 | Pass | Pass |
| white #FFFFFF | action-danger #E6001C | 4.8:1 | Pass | Pass |
| white #FFFFFF | fill-info #0056CC | 7.0:1 | Pass | Pass |
| white #FFFFFF | fill-success #40BF75 | 2.2:1 | **Fail** | **Fail** |
| white #FFFFFF | fill-warning #FFCD00 | 1.6:1 | **Fail** | **Fail** |
 
**Text on tinted surfaces (badges, alerts, hover/selected washes):**
 
| Foreground | Background | Ratio | Normal |
|---|---|---|---|
| text-accent-strong #143665 | surface-primary-subtle #D3DEEE | 8.9:1 | Pass |
| text-accent #215AA8 | surface-primary-subtle #D3DEEE | 3.4:1 | Fail normal / Pass large |
| text-primary #2A3D4A | surface-primary-subtle #D3DEEE (table/nav hover) | 7.5:1 | Pass |
| text-success #267346 | surface-success-subtle #D9F2E3 | 5.4:1 | Pass |
| text-on-warning-subtle #342900 | surface-warning-subtle #FFFBE4 | 13.9:1 | Pass |
| text-on-warning-subtle #342900 | fill-warning #FFCD00 | 9.6:1 | Pass |
| text-on-error-subtle #8A0011 | surface-error-subtle #FFEDEF | 8.7:1 | Pass |
| text-on-info-subtle #00347A | surface-info-subtle #CCDDF5 | 7.6:1 | Pass |
| text-danger #B80016 | surface-card #FFFFFF | 6.6:1 | Pass |
 
**Non-text boundaries (1.4.11 ≥ 3:1):**
 
| Boundary | Against | Ratio | Result |
|---|---|---|---|
| border-default #D6D6D6 | surface-card #FFFFFF | 1.5:1 | **Fail** (decorative hairline, not a state boundary) |
| border-strong #ADADAD | surface-card #FFFFFF | 2.3:1 | **Fail** — checkbox/radio unchecked outline is below 3:1 |
| border-focus #215AA8 | surface-card #FFFFFF | 6.4:1 | Pass |
| focus-ring (blue @35%) | surface-card #FFFFFF | ~2.4:1 effective | Borderline — see below |
| action-primary #215AA8 | surface-card #FFFFFF | 6.4:1 | Pass (filled controls read clearly) |
 
**Safe rule for semantic fills:** put **white text only where it passes** — `action-primary`, `action-danger`, `fill-info` (and `fill-neutral-strong`-darker). For **success and warning, never use white**: use the subtle tint + dark-text treatment (`surface-success-subtle`/`text-success`, `surface-warning-subtle`/`text-on-warning-subtle`). `badge-solid`/`banner` in success or warning tone must therefore switch to the subtle treatment or a darker fill (success → `success-700` behind white).
 
**Failures to enforce:**
- **White on `fill-success` (2.2:1) and `fill-warning` (1.6:1) fail.** Do not ship white-on-green or white-on-yellow. Yellow always takes `text-on-warning-subtle`.
- **`text-tertiary` is borderline** — 4.5:1 on white (passes by a hair), 4.3:1 on the off-white canvas (fails). Restrict it to large text, meta, and placeholders; use `text-secondary` for any small copy that must be read, especially on `surface-background`.
- **Unchecked checkbox/radio outline (`border-strong`, 2.3:1) is below the 3:1 UI-boundary minimum.** Pair the control with a visible label (always present in the kit) and consider darkening the unchecked outline; flagged as a real gap.
**Focus & targets:**
- **Focus-visible:** the 3px `focus-ring` must appear on keyboard focus for **every** interactive control. The kit implements it on Button, IconButton, Input, Textarea, Select, Combobox, PinInput, DatePicker, TimePicker — and is **missing** on Checkbox, Radio, Switch, Slider, Tabs, SegmentedControl, ButtonGroup, NumberInput, FileUpload, Pagination, Accordion, DropdownMenu items, and nav items (Known Gaps). Add it there before shipping.
- **Minimum touch target 44px.** Button md (42px) is fine on pointer devices; bump to `lg` (48px) or pad for primary mobile actions. Icon-only controls need a ≥44px hit area even when the glyph is 20–24px.
- **Color is never the only signal:** pair status color with an icon or text (Alert/Toast carry a status icon; delta carries ▲/▼).
- **Keyboard order** follows visual order; Modal/Drawer trap focus and restore it to the trigger on close; Escape closes.
## Responsive Behavior
 
**Inferred** from production screens — there is no formal breakpoint token set in the import (Known Gaps).
 
| Breakpoint | Width | Key changes |
|---|---|---|
| mobile | < 640px | Single column; SidebarNav → Drawer/BottomNav; StatCards stack 1-up; tables scroll horizontally or reflow to cards; modals near-full-width with `{spacing.space-6}` inset. |
| tablet | 640–1023px | 2-column card grids; SidebarNav collapses to the 72px icon rail; gutters tighten. |
| desktop | 1024–1439px | Full 256px SidebarNav; 3-up StatCards; standard gutters. |
| wide | ≥ 1440px | 4-up StatCards; content region caps rather than stretching line length. |
 
- **Collapsing strategy:** the sidebar is the primary lever — full rail → icon rail → off-canvas drawer. Card grids step 4→3→2→1. Data tables scroll within their container down to tablet, then reflow to stacked cards on mobile.
- **Touch:** promote controls to ≥44px on touch breakpoints.
- **Fluid vs capped:** dashboards stay fluid; reading/form columns cap (~720–960px).
## Patterns
 
Canonical layouts, drawn from the imported console/dashboard screens where possible. Each names its components, spacing, and responsive collapse.
 
1. **App Shell.** `SidebarNav` (256px, → 72px rail → Drawer) + optional `AppBar` + content region on `surface-background`. Content padding `{spacing.space-11}` (24px); section gap `{spacing.space-13}` (32px). Collapse: sidebar is the lever (see Responsive).
2. **Dashboard.** App Shell → a row of 3–4 `StatCard`s (grid, `{spacing.space-8}` gutter) → a 2-up region of `Card`s holding a `Table` and a chart/`Timeline`. StatCards step 4→3→2→1; the 2-up region stacks on tablet.
3. **Data Screen.** App Shell → header row (title + `Button` primary action + `SegmentedControl`/`Tabs` for views) → filter bar (`Select`/`Combobox`/`DatePicker` + `Input` search) → `Table` (hoverable, striped) in a `rounded.medium` frame → `Pagination`. Filters collapse into a `Drawer` on mobile; table scrolls then reflows to cards.
4. **Form.** Centered column capped ~720px → `Card` sections separated by `Divider` → `Label` + field pairs stacked with `{spacing.space-8}` gap, grouped in `{spacing.space-13}` section gaps → footer with one `Button` primary + a `secondary` cancel. One primary action; inline `input-error` + helper for validation.
5. **Detail.** App Shell → `Breadcrumb` → header (title + status `Badge` + action `Button`s) → 2-column split: main `Card`/`Tabs` content + a side rail of `List`/`StatCard` meta. Side rail drops below main on tablet.
6. **Empty / Loading.** Empty → `EmptyState` centered in the content region (icon tile, title, description, up to two actions). Loading → `Skeleton` blocks mirroring the target layout (StatCard rows, table rows), or a `Spinner` with `role=status` for short waits.
## Worked Example
 
**Prompt:** "a settings page with a profile section and a notifications section."
 
**On-brand output (shared intent):** App Shell (SidebarNav + AppBar), a form-pattern content column capped ~720px on `surface-background`. Two `Card` sections with `title-sm` headers separated by section spacing. Profile: an `Avatar` (lg) beside `Input` fields (Name, Email) with `Label`s, and a `Select` for role. Notifications: a `List` of rows, each a label + `body-sm` description + a `Switch`. Footer: one `Button variant="primary"` ("Save changes") + a `Button variant="tertiary"` ("Cancel"). One primary action; focus rings on every control; no gradients.
 
**Mode A — kit present (emit real components):**
```jsx
<Card padding={24}>
  <Card.Header title="Profile" />
  <div style={{ display: 'flex', gap: 'var(--space-11)', alignItems: 'center' }}>
    <Avatar name="Sari Dewi" size="lg" />
    <div style={{ display: 'grid', gap: 'var(--space-8)', flex: 1 }}>
      <Input label="Full name" defaultValue="Sari Dewi" />
      <Input label="Email" type="email" defaultValue="sari@paragon.id" />
      <Select label="Role" options={roles} value={role} onChange={setRole} />
    </div>
  </div>
</Card>
 
<Card padding={24} style={{ marginTop: 'var(--space-13)' }}>
  <Card.Header title="Notifications" />
  <List items={[
    { title: 'Email digests', subtitle: 'Weekly summary', trailing: <Switch checked={a} onChange={setA} /> },
    { title: 'Push alerts',   subtitle: 'Real-time',      trailing: <Switch checked={b} onChange={setB} /> },
  ]} />
</Card>
 
<div style={{ display: 'flex', gap: 'var(--space-6)', justifyContent: 'flex-end', marginTop: 'var(--space-13)' }}>
  <Button variant="tertiary">Cancel</Button>
  <Button variant="primary">Save changes</Button>
</div>
```
 
**Mode B — no kit (tokens + HTML/CSS, style from CSS variables):**
```html
<section class="card">
  <h2 class="card-title">Profile</h2>
  <div class="profile-row">
    <div class="avatar">SD</div>
    <div class="fields">
      <label class="lbl">Full name</label>
      <input class="field" value="Sari Dewi" />
      <label class="lbl">Email</label>
      <input class="field" value="sari@paragon.id" />
    </div>
  </div>
</section>
<div class="actions">
  <button class="btn btn-tertiary">Cancel</button>
  <button class="btn btn-primary">Save changes</button>
</div>
<style>
  .card{background:var(--surface-card);border:1px solid var(--border-subtle);border-radius:var(--radius-large);box-shadow:var(--shadow-xs);padding:var(--space-11);margin-bottom:var(--space-13)}
  .card-title{font:var(--weight-bold) var(--heading-8-size)/var(--heading-8-line) var(--font-sans);color:var(--text-primary);margin:0 0 var(--space-8)}
  .profile-row{display:flex;gap:var(--space-11);align-items:center}
  .fields{display:grid;gap:var(--space-8);flex:1}
  .avatar{width:48px;height:48px;border-radius:var(--radius-full);background:var(--surface-primary-subtle);color:var(--text-accent-strong);display:grid;place-items:center;font:var(--weight-bold) 19px var(--font-sans)}
  .lbl{font:var(--weight-semibold) var(--body-2-size)/var(--body-2-line) var(--font-sans);color:var(--text-primary)}
  .field{height:42px;padding:0 var(--space-6);border:1px solid var(--border-default);border-radius:var(--radius-medium);font:var(--body-1-size)/var(--body-1-line) var(--font-sans);color:var(--text-primary)}
  .field:focus{outline:none;border-color:var(--border-focus);box-shadow:var(--shadow-focus)}
  .actions{display:flex;gap:var(--space-6);justify-content:flex-end}
  .btn{height:42px;padding:0 var(--space-11);border-radius:var(--radius-base);font:var(--weight-bold) var(--body-2-size) var(--font-sans);letter-spacing:.01em;cursor:pointer;border:1px solid transparent}
  .btn-primary{background:var(--action-primary);color:var(--text-on-primary)}
  .btn-primary:hover{background:var(--action-primary-hover)}
  .btn-tertiary{background:transparent;color:var(--text-primary);border-color:var(--border-default)}
  .btn-tertiary:hover{background:var(--action-neutral-hover)}
</style>
```
 
Both modes obey the guardrails: one primary action, focus ring on fields, slate text, flat surfaces, no gradient.
 
## Theming & Substitution
 
### Font substitution
Lato is the single family. When it is unavailable, substitute **Roboto** (the documented, self-hosted fallback) or system-ui — both humanist sans with similar x-height; keep weights mapped 400/500/600/700. Declared stack: `"Lato", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. For dense numeric tables, enable `font-variant-numeric: tabular-nums` so columns align regardless of the substituted face.
 
### Dark mode
**Not supported in production.** A `:root[data-theme="dark"]` / `.dark` scope exists in the extracted Figma variable set, but it references raw brand-ramp variables rather than the curated semantic aliases (`surface-*`, `text-*`, `border-*`) that components consume, so components do not re-theme correctly under it today. Treat dark mode as *extracted-but-not-wired*: do not ship it. Wiring it up (redefining the semantic aliases inside the dark scope) is the intended path (Known Gaps).
 
### Divergence note (DESIGN.md vs. kit runtime)
This file is the **target brand**. Where it and the shipped kit disagree, **DESIGN.md leads on intent; the kit's runtime values win when the kit is actually used**, until reconciled:
- **Typography.** DESIGN.md declares single-family **Lato** everywhere. The kit's `fonts.css` still ships and wires **Inter** as `--font-ui`, and these components render numerals in it: `StatCard` value, `Table`, `NumberInput`, `PinInput`, `Slider` value, `ProductCard`/`NumericKeypad`. Reconcile by repointing `--font-ui` → `--font-sans` (or deleting it); until then, the kit shows Inter there.
- **Token discipline.** This file's components reference **semantic aliases only**. The kit's component source still hardcodes raw ramp vars (`var(--primary-500)`, `var(--neutral-100)`, `var(--error-500)`) and a raw scrim `rgba(42,61,74,0.45)`. The alias layer here is the target; the kit should adopt it.
- **Ramp naming.** The kit's CSS still exposes the Paragon ramp as `--primary-50…900`. This file calls it `paragon` (a product ramp) plus the swappable `brand`; `primary-*` is no longer a token name here. Until the kit is renamed, read `var(--primary-N)` in kit source as `brand.N`. Alias names (`action-primary`, `surface-primary`, `text-on-primary`) are unchanged — they name the *role*, not the ramp.
- **No utility classes.** There is no `pdx-*` (or any) CSS class layer in the kit — it styles via inline CSS variables. Any doc or prompt that references utility classes is describing something the kit does not ship.
- **Radius.** The Style Guide's prose calls 6px the "default everywhere," but the kit's Button radius is size-dependent (small/base/base/medium) and Card/Modal use `large` (8px). The per-component values in this file (read from code) are correct; the "6px everywhere" phrasing is inaccurate.
## Component Inventory — Reconciliation
 
Every component specced above resolves to a real imported kit file under `components/**`. **Fully specced with token map + kit bridge (72):** Button, IconButton, ButtonGroup, Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, NumberInput, PinInput, Slider, Label, DatePicker, TimePicker, FileUpload, NumericKeypad, Card, StatCard, Table, List, Tabs, Accordion, Divider, Avatar, AvatarGroup, Carousel, Timeline, ProductCard, Thumbnail, Scrollbar, OptionCard, BrandPill, BrandSquare, PriceTag, DeviceFrame, Badge, Tag, Alert, Toast, Banner, Tooltip, ProgressBar, Spinner, Skeleton, Rating, EmptyState, AILabel, ConfirmationState, DotLoader, Illustration, ProductLabel, DiscountBadge, Modal, Drawer, BottomSheet, DropdownMenu, Popover, SidebarNav, NavDrawer, Breadcrumb, Pagination, SegmentedControl, Stepper, Checkpoints, AppBar, BottomNav, DashboardHeader, StatusBar, HomeIndicator, AndroidNavBar (+ Card sub-parts Header/Body/Footer).
 
**Guidance-only entry (1):** `notification` carries a `kit:` bridge and its Do's/Don'ts but **no token map** — the import specs the toast/snackbar surface under `Toast`, so use `Toast`'s tokens and read `notification`'s rules for queue, placement, and message length. Total entries in the `components:` map: **73** (72 specced + 1 guidance-only).

**Imported but covered narratively, not as token tables:** the `Icon` component (~172 named glyphs via `assets/icons/icon-data.js`; see Iconography in the readme) and the brand marks `ParadiseLogo` / `ParadiseIcon` / `SidebarLogo` (asset components under `assets/logos/`, driven by product bitmaps rather than tokens). Everything the kit ships now resolves to a real imported component; no component here is referenced-but-missing.
 
## Known Gaps
 
Honest inventory of what is undocumented, extrapolated, or in conflict with the import.
 
- **Focus-visible missing on many interactive controls (real a11y gap).** The kit implements the focus ring on Button, IconButton, Input, Textarea, Select, Combobox, PinInput, DatePicker, TimePicker only. **Checkbox, Radio, Switch, Slider, Tabs, SegmentedControl, ButtonGroup, NumberInput, FileUpload, Pagination, Accordion, OptionCard, DropdownMenu items, SidebarNav/NavDrawer/BottomNav items** have no explicit `elevation.focus` ring in the source. Add one to each before shipping.
- **Semantic contrast failures (see Accessibility).** White on `fill-success` (2.2:1) and `fill-warning` (1.6:1) fail; `text-tertiary` is borderline (fails on the off-white canvas); the unchecked checkbox/radio outline (`border-strong`, 2.3:1) is below the 3:1 non-text minimum. `badge-solid`/`banner` in success/warning tone inherit the white-on-fill failure — use the subtle treatment.
- **AILabel subtle — token gap closed, kit not yet updated.** The `subtle` variant needs `digiso.100` (bg) and `digiso.400` (border); both are now defined, so the variant is fully specced here. The kit still falls back to hardcoded hex for those two — repoint it at the tokens. `gradient-ai` is the only sanctioned gradient in the system.
- **Two colors are still literals.** `overlay-scrim` (`rgba(42,61,74,0.45)`) and `focus-ring` (`rgba(33,90,168,0.35)`) match no step in the `overlay` ramp — the nearest to the scrim is `overlay.800` at 50%. Either add those two alphas to the ramp or move the scrim to `overlay.800` and accept the 5% shift. Every other alias resolves to a ramp step.
- **Typography — Inter still shipped in the kit.** Single-family Lato is the target; `fonts.css` still wires Inter as `--font-ui` and ~6 data components render in it (see Divergence). Not yet reconciled in the runtime.
- **Typography scale is partially extrapolated.** The 15-step Figma scale is real, but the largest steps (`display-xl` 60px, `display-lg` 52px, `title-2xl` 48px, and unexported Headings 2/3/5 at 42/38/26px) have no confirmed in-product usage — they are Cover/marketing sizes. The largest *verified* product usage is `title-xl` (32px, StatCard). Caption 2 (8px) has no located usage and is not exported.
- **Motion is inferred, not tokenized.** The import has no named motion tokens; `fast`/`base`/`slow` (120/150/200ms) are read off component transition strings, and Carousel's cubic-bezier is a one-off. Treat the `motion` block as inference.
- **Layout & Responsive are inferred.** Container max-widths, column counts, gutters, and breakpoints come from reading production screens and the 256/72px sidebar constant; there is no formal grid/breakpoint token set in the source.
- **Spacing referenced by value in kit code.** The 2px grid is a real token set, but component source hardcodes pixel values (`padding: 16`, `gap: 6`) instead of `var(--space-*)`. Padding handles here map to the nearest grid token; a few internal metrics (StatCard 38px icon tile, 3px gaps) are off-grid in code and noted inline.
- **`tier: reserved` aliases.** Every alias is used by at least one component — there are **no reserved (unused) aliases**. Ramps are raw material by design and are not referenced directly (one flagged exception: `ailabel-subtle` cites the DigiSO tints). The product ramps are product-surface-only, or swap targets for `brand`.
- **Icons.** In-house Outline/Filled pairs on a 24px grid (~811 glyphs), monochrome via `currentColor`. Not enumerated here; drive color from surrounding text color.
## Self-check
 
- ✅ **Every `{token}` reference resolves (0 unresolved).** All `{colors.*}` handles used by components are defined in the `colors:` map (including the promoted `overlay-scrim` and `gradient-ai`); all `{typography.*}`, `{spacing.*}`, `{rounded.*}`, `{elevation.*}` handles exist in their maps.
- ✅ **No raw hex/rgba inside components.** Every component value is either an alias handle or a non-color literal (px sizes, `transparent`, `dashed`). The two former raw literals (scrim, AI gradient) are promoted to `overlay-scrim` / `gradient-ai`.
- ✅ **No ramp step referenced by a component — aliases only.** One deliberate exception is flagged: `ailabel-subtle` cites `digiso.100/400/700`, because those product tints have no alias (the variant renders on a DigiSO surface only).
- ✅ **Every color verified 1:1 against the design system.** All ramp values were machine-compared against the source export — **0 mismatches** — and all 65 aliases were checked against the ramp step each `→` comment cites — **0 mismatches**. Five stale values were corrected in the process: `brand.200` (was `#A6BD45`, an olive green in a blue ramp), `info.900` (was `#001633`), `magpie.600` (was `#0056CC`), `siglive.500` (was `#447ACD`, actually Nova Mobile's base), and `nova-500` `#3378D6` dropped — it was Nova Dashboard's **400** step, and Nova is now two ramps.
- ✅ **Every alias is used or marked reserved.** All semantic aliases are consumed by ≥1 component; product-accent ramps are the only reserved (product-surface-only) set. No orphan aliases.
- ⚠️ **Every interactive component has a focus-visible entry, or is listed in Known Gaps.** Components with a kit-implemented ring carry a `*-focus-visible` entry; the 13 that lack one in the kit are listed explicitly under Known Gaps (a11y) rather than given a guessed entry.
- ✅ **Every contrast pair recomputed from imported hexes; every failure flagged.** Text-on-solid, text-on-tint, and non-text boundary tables are computed from the ramp hexes; white-on-success, white-on-warning, text-tertiary-on-canvas, and the unchecked-control outline are flagged.
- ✅ **Every component in the inventory resolves to a real imported component.** All 72 specced components map to files under `components/**`; `notification` is a guidance-only entry (Do's/Don'ts + kit bridge, tokens under `Toast`), and the only items not given token tables are the `Icon` glyph set and the three brand logos (covered narratively). Nothing is referenced-but-missing.
- ✅ **Operating header, kit bridge, Patterns, and Worked Example all present.**
- ✅ **Anything not in the import is in Known Gaps, not invented.** Motion, Layout, and Responsive numbers are labeled inferred; undefined DigiSO tints and the missing focus rings are gaps, not filled with guesses.
**Could not fully satisfy:** the focus-visible requirement is documentation-only — this file cannot add rings to the kit's runtime; it specs the ring where the kit already renders it and flags the 13 controls that need one. Contrast ratios are computed to one decimal via the standard WCAG relative-luminance formula; treat borderline values (`text-tertiary` 4.3–4.5:1, focus-ring alpha) as "verify in context." Dark-mode tokens exist in the Figma set but are not wired to the semantic aliases, so no dark theme is emitted.