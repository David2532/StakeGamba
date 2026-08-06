# Golden Goal Rush cinematic intro

`apps/cluster/scripts/ggr-intro-config.mjs` is the single source of truth for
the optional Golden Goal Rush opening. It is generated into `preview.html` and
then into the published frontend; do not edit generated HTML as the source.

## Safety contract

- The intro starts RGS authentication and replay handling immediately; it never
  waits for cinematic media.
- Replay skips the intro by policy. An active restored round also dismisses it.
- Failed image or audio preloads advance the real progress indicator and expose
  the game with the configured fallback artwork.
- The start interaction is keyboard and touch accessible. Sound is only started
  after the user chooses **Play with sound**.
- `prefers-reduced-motion` goes straight to the ready screen. Low-memory devices
  use a smaller particle budget. `?intro=always`, `?intro=off`, and
  `?intro=ready` are developer/QA overrides only.

## Configuration fields

| Field | Meaning |
| --- | --- |
| `theme` / `themes` | Stable selected visual-variant identifier and its named release/event variants. A variant changes only presentation data. |
| `runPolicy` | `once-per-version`, `per-session`, or `always`. |
| `assets` | Desktop/mobile/fallback backdrops, raster logo, and optional audio paths. |
| `layers` / `parallax` | Ordered background and foreground planes plus their safe pointer-depth budget. Raster artwork remains the primary visual; parallax is disabled safely when unsupported. |
| `locales` | Player-visible text by language. English is mandatory. |
| `scenes` | Ordered scene list. `id`, `kind`, duration, transition, copy, camera and atmosphere are validated. |
| `camera` | Start/end scale and focal point for the artwork camera move. |
| `atmosphere` | Particle preset, light intensity and optional named audio accent. |
| `skip` | Earliest skip time, `ready-screen` or `enter-silent` behavior, and keyboard routes. |
| `quality` | Particle caps, 24–60 FPS cap and low-memory fallback threshold. |
| `mobile` | Portrait background and framing override. |
| `reducedMotion` | Immediate ready-screen policy and visual budget. |

`validateIntroConfig()` runs during every preview build. It rejects an unknown
theme, duplicate scene or layer identifiers, unsupported scene kinds, missing
core raster paths, invalid timing/camera data, invalid parallax data and missing
English action labels. Asset failures at runtime remain non-fatal: the loading
meter reports the degraded asset and the playable board is still reachable.

## Browser evidence

`node scripts/stake-qa-e2e.mjs intro` runs the real generated frontend in
Chromium. It saves raster screenshots for desktop arrival, desktop ready,
post-transition gameplay and mobile ready state; it also verifies keyboard
entry, actual image loading, progress completion, reduced-motion behavior and
replay-mode bypass. The complete `stake:qa:e2e` suite includes the same group.

New art must be original, raster-based and stored under
`apps/cluster/src/assets/golden-goal-rush/intro/`. The two current stadium
backdrops were generated for this project without text, team marks or brands.
