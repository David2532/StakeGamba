# BLACKSITE // BREACH — AAA Art Bible V28

Status: **DESIGN LOCK — PASS**
Lifecycle scope: presentation specification only; **not** runtime-art approval, candidate approval, or release readiness
Owners: Creative Director, Asset Director, Animation Director, UX Director
Locked: 2026-08-20
Identity amendment: 2026-08-21 — the user's explicit `PINGUIN, NICHT DEN DUDE` direction supersedes the adult-male identity only. All mechanics, authority, material, layout, motion, safety, and evidence gates remain binding.

## 1. Binding direction

The one selected direction is **OBSIDIAN VAULT / CONTROLLED BREACH**.

BLACKSITE is a physically credible classified server-bunker built from heavy gunmetal, obsidian-black armor, hardened smoked glass, rubber seals, restrained cyan instrumentation, sparse warning red, and warm vault gold. The five-by-three reel window is a machine aperture built into the wall. One **tactical Penguin operative** stands to the left and directs attention toward the reels. The Penguin is treated as a grounded, coherent character rather than a floating sticker, comedy interruption, child-coded mascot, or gameplay authority.

The visual story is:

1. Base is a cold, controlled facility.
2. A confirmed BREACH escalates real mechanical security hardware.
3. BLACKOUT exposes a materially different gold-lit secure interior, not a color filter over Base.
4. The board, win path, amount, and required controls remain the first four readability priorities.

No competing neon-arcade, cartoon, military-propaganda, casino-gold, or generic sci-fi-hologram direction may be mixed into V28.

## 2. Canonical product boundary

This bible cannot alter the frozen `blacksite-book-events-v3` contract:

- five reels by three rows;
- ten always-active fixed paylines;
- eleven regular symbols plus `ghost_wild` and non-paying `breach`;
- three BREACH symbols on distinct opening-spin reels award exactly eight BLACKOUT free spins;
- one authoritative regular target may expand on reels containing it during BLACKOUT;
- no retrigger;
- modes `base` at 1x, `deep_access` at 4x, and `blackout` at 80x;
- complete-round maximum 10,000x;
- RGS/book events remain payout authority.

Presentation never adds cascades, tumbles, clusters, a new buy mechanic, fake near-misses, urgency, probability claims, or result states absent from the authoritative event stream. Client-side thresholds below only select presentation intensity; they never change payout or settlement.

## 3. Hierarchy and composition

Fixed visual priority, highest first:

1. Authoritative winning cells, BREACH trigger cells, or expanding target.
2. Current step win and authoritative total/final win.
3. Entire five-by-three board and active payline path.
4. Primary Spin/Replay action and required balance/bet/total/win information.
5. Feature counter and selected expansion target.
6. Operative reaction.
7. Environment, particles, and ambient motion.

The operative may frame the board but may not overlap the reel aperture, win amount, feature counter, mode cost, or controls. If space is constrained, reduce or hide the operative before shrinking the board below its readable floor.

Desktop uses one horizontal HUD row. Portrait, short landscape, and Popout may recompose into two compact rails; they may not preserve desktop merely by uniform scaling.

## 4. Color tokens

All values are sRGB hex. Alpha is specified separately. Runtime implementations must expose semantic tokens rather than scattering near-duplicate colors.

| Token | Value | Locked use |
|---|---:|---|
| `--bsb-void-950` | `#050709` | outermost background and deep apertures |
| `--bsb-obsidian-900` | `#090D10` | main armor fields |
| `--bsb-obsidian-800` | `#10161A` | raised panel fields |
| `--bsb-gunmetal-700` | `#20292F` | structural plates |
| `--bsb-gunmetal-600` | `#303C43` | bevel mids and inactive controls |
| `--bsb-steel-500` | `#53636C` | exposed edges, bolts, separators |
| `--bsb-steel-300` | `#8E9CA2` | secondary labels on dark fields |
| `--bsb-glass-900` | `#071218` | smoked reel glass base |
| `--bsb-glass-line` | `#7EA0A8` | glass edge at 22–38% alpha only |
| `--bsb-cyan-500` | `#36D5E6` | selected/active instrumentation |
| `--bsb-cyan-300` | `#8CECF2` | focus, confirmed informational highlight |
| `--bsb-cyan-700` | `#168A99` | inactive cyan channels and deep glow |
| `--bsb-red-500` | `#F05252` | danger, error, confirmed security alert only |
| `--bsb-red-700` | `#8E252B` | alert backing and recessed warning LEDs |
| `--bsb-gold-500` | `#F0C36A` | BLACKOUT reward light and confirmed award |
| `--bsb-gold-300` | `#FFE2A2` | gold core highlight and final award digits |
| `--bsb-gold-700` | `#9B6B28` | warm shadow and brass edge |
| `--bsb-text-100` | `#F3F6F5` | primary functional copy |
| `--bsb-text-300` | `#B5C0C1` | secondary copy |
| `--bsb-text-500` | `#7D8A8D` | tertiary copy; never required text below AA |
| `--bsb-focus-ring` | `#A7F4FA` | 2 px keyboard focus ring plus 2 px dark offset |

Color balance in Base is approximately 78% obsidian/gunmetal, 14% neutral text/steel, 7% cyan, and at most 1% red. BLACKOUT introduces gold over 12–18% of the visible scene while cyan falls below 4%; red is limited to fading security remnants. Gold never signals an unconfirmed trigger.

Functional text must meet WCAG AA: 4.5:1 below 24 CSS px or below 18.66 px bold, and 3:1 at or above large-text thresholds. Focus indicators and meaningful non-text boundaries target at least 3:1 against adjacent colors. Meaning is never color-only: icon, label, shape, or motion state accompanies hue.

## 5. Material grammar

| Material | Locked construction | Forbidden treatment |
|---|---|---|
| Gunmetal | coarse dark base, 2–4 px directional brushed grain at master scale, narrow cool edge, localized wear only at contacts | uniform gray gradient, chrome mirror, random scratches everywhere |
| Obsidian armor | near-black satin plate, broad 6–10% roughness variation, deep contact shadow, almost no specular bloom | pure flat black, glossy plastic, blue neon fill |
| Hardened glass | smoked cyan-black body, one upper-right reflection band, subtle inner dust, crisp mask, visible depth to symbols | full-panel glare, blur over symbols, opaque bloom |
| Rubber seal | charcoal matte strip with compressed corners and zero emissive response | bright outline or soft toy-like bevel |
| Steel hardware | machined desaturated edge, readable bolt head, localized cool key and black occlusion | clean silver jewelry or oversized ornament |
| Vault gold | warm volumetric source plus brass/amber reflections on nearby metal; reward-only | global yellow overlay, casino filigree, constant Base accents |

Contact shadows are mandatory where the machine meets the wall, glass meets the inner bezel, plates overlap, and the operative meets the floor plane. Floating panels, impossible double shadows, and perspective conflicts fail review.

## 6. Lighting lock

- Primary Base key: cool neutral light from upper right at approximately 35 degrees downward and 20 degrees toward camera.
- Board instrument light: restrained cyan from the reel aperture, strongest on the inner bezel, never washing symbol faces.
- Operative separation: narrow cool rim from the board-facing side; face key remains neutral and readable.
- Base practicals: server/rack points may pulse slowly but stay below the board's average luminance.
- Alert light: sparse red sources enter only during confirmed anticipation, error, or vault lock phases.
- BLACKOUT source: warm gold from behind the opened vault door, casting physically coherent reflections and volumetric falloff toward camera.
- Shadow direction must remain lower-left from the upper-right Base key. Gold may add a secondary forward shadow during the open-door phase; it does not erase Base contact shadows.

No essential symbol, amount, or control may depend on bloom. Bloom radius is capped at 12 CSS px on desktop and 6 CSS px on phone; opaque cores remain readable when bloom is disabled.

## 7. Board and symbol language

The board is a rectangular wall aperture with a heavy outer armor frame, rubber seal, inner machined bezel, smoked glass, five reel separators, and a controlled bottom contact shadow. It is never a free-floating tablet.

Symbol rules:

- canonical art canvas: 512 × 512 with a protected 40 px inner margin;
- common three-quarter product perspective: horizontal axis within ±2 degrees and vertical view approximately 12 degrees above center;
- one upper-right key, one lower-left occlusion shadow, one restrained cyan environmental rim;
- thick silhouette readable at 72 × 72 CSS px and at 200% text zoom;
- no tiny decorative copy as the primary identifier;
- card ranks use authored thick glyph shapes, but all accessible names remain live UI text;
- high-value objects use denser material detail and brighter controlled edge contrast than card ranks;
- `ghost_wild` uses a fractured cyan spectral core and distinct hard silhouette;
- `breach` uses a heavy circular/hexagonal physical lock silhouette and never receives a line-win treatment;
- dim states retain silhouette at 45–58% luminance rather than disappearing;
- win states lift 3–5%, sharpen the edge, and add one bounded halo; no uncontrolled scale bounce.

All 13 symbols must remain distinguishable in grayscale and in a full mixed board. A mobile contact sheet at actual reel size is an acceptance artifact.

## 8. Typography and numeric display

No external runtime font requests are allowed. V28 uses:

- UI/body: `"Segoe UI", Arial, Helvetica, sans-serif`;
- numeric/readout: `ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace`;
- `font-variant-numeric: tabular-nums lining-nums` for balance, bet, total, win, counters, RTP, and max win.

Type scale at 100% browser text size:

| Role | Size / line height | Weight | Rules |
|---|---:|---:|---|
| primary amount | 20–28 / 1.05 | 800 | never letterspaced; preserve exact currency precision |
| HUD value | 14–18 / 1.15 | 750 | tabular, one line with safe ellipsis only where full value remains accessible |
| HUD label | 10–12 / 1.2 | 700 | uppercase, `0.08em` maximum tracking |
| modal title | 24–32 / 1.1 | 800 | no raster-baked title |
| section heading | 16–20 / 1.2 | 750 | sentence or concise uppercase |
| body/rules | 14–16 / 1.45 | 450–550 | never below 14 CSS px in a scrollable dialog |
| helper/legal | 12–14 / 1.4 | 450 | required text must still pass AA |

All prices, currencies, labels, RTP, mode costs, counters, rules, and localized copy are live DOM text. They are never baked into raster art. At 200% text scaling, dialogs scroll internally and the main game frame does not gain unintended scrolling.

## 9. Desktop HUD lock

Wide desktop uses exactly one horizontal control row in this order:

`BALANCE | BET [− value +] | MODE | TOTAL | WIN | AUTO | SOUND | INFO | TURBO | SETTINGS | SPIN`

Rules:

- Spin is 112 × 112 CSS px, circular, and the only oversized control.
- Every secondary round control uses the same 56 × 56 CSS px hit box and 28 × 28 optical icon box.
- Bet minus/plus use 48 × 48 CSS px hit boxes and the same 20 × 20 icon box.
- Icon art is centered by its optical bounds, not raw transparent canvas; centroid error must be ≤1 CSS px at DPR 1 and ≤2 device pixels at DPR 2/3.
- Adjacent secondary buttons share identical outer dimensions, border radius, baseline, and 12 px gap.
- Mode appears only when more than one mode is actually selectable under the current authoritative configuration/jurisdiction. Otherwise the selected mode is a readout, not a dead button.
- AUTO is retained only where allowed and opens one confirmation/count dialog; it is not a duplicate settings route.
- SETTINGS opens the single settings surface. There is no additional hamburger/menu button and no second settings navigation.
- INFO opens one structured Game Guide with `How to play`, `Paytable`, `Modes`, `BLACKOUT`, `Controls & legal` tabs/sections.
- SOUND is directly available and exposes muted/unmuted state with `aria-pressed`.

The selected mode, total cost, and primary action cannot be visually mistaken for one another. No two hit boxes may overlap; a 1 CSS px clear gap is the absolute geometric floor, with 8–12 px the intended rhythm.

## 10. Control states

Every interactive control has the following visually distinct states without moving its layout box:

| State | Surface | Icon/copy | Motion |
|---|---|---|---|
| Idle | gunmetal 700, steel edge at 35% | text 100 or text 300 | none |
| Hover | surface +6% luminance, cyan inner line at 35% | icon +8% luminance | 120 ms fade; pointer-capable devices only |
| Focus-visible | idle/hover surface plus 2 px focus ring and 2 px void offset | unchanged | no pulsing |
| Pressed | surface −7%, inset 1 px; bounds unchanged | translate Y 1 px | 80 ms attack, 120 ms release |
| Selected/active | cyan 700 recess plus cyan 500 2 px indicator | text 100 | one 180 ms confirmation, then static |
| Disabled | 42% opacity with lower contrast edge | icon and label 55%; cursor state | none; reason remains programmatically available |
| Loading | idle surface, bounded spinner inside 24 px optical box | stable label or `Loading` live text | 900 ms rotation; reduced-motion uses static progress glyph |
| Error | red 700 recess, red 500 edge | explicit error icon/text | one 180 ms flash only; no continuous shake |

Raster surfaces may supply material only. Focus rings, labels, values, and state semantics remain live UI.

## 11. Modal and information architecture

- One modal layer at a time; underlying controls are inert and visually dimmed 28–36%.
- Initial focus lands on the title or first safe action; Escape closes non-critical dialogs; focus returns to the invoking control.
- Confirmation dialogs place Cancel before Confirm in DOM order; destructive/danger action is not preselected.
- Paytable is a responsive card/grid grouped into high symbols, card ranks, GHOST WILD, and BREACH. It is not a prose wall.
- Mode cards show authoritative name, cost multiplier, total play amount, RTP, max win, and concise mechanic text from the shipped contracts.
- Offline/reconnect/session error uses a bounded error surface and one recovery action. It never starts a fixture or simulated paid play.
- Modal body maximum block size is `min(82dvh, 760px)` with internal scrolling and sticky close/title region.

## 12. Motion tokens

| Token | Duration | Easing | Use |
|---|---:|---|---|
| `motion-instant` | 80 ms | `cubic-bezier(.2,.8,.2,1)` | press attack, micro acknowledgment |
| `motion-fast` | 120 ms | `cubic-bezier(.2,.8,.2,1)` | hover, icon state |
| `motion-ui` | 180 ms | `cubic-bezier(.22,.75,.18,1)` | modal/control confirmation |
| `motion-settle` | 280 ms | `cubic-bezier(.16,1,.3,1)` | panel/symbol settle |
| `motion-read` | 420 ms | `cubic-bezier(.16,1,.3,1)` | line read, medium reaction |
| `motion-emphasis` | 650 ms | `cubic-bezier(.12,.86,.18,1)` | feature confirmation, big impact |
| `motion-mechanical` | 900 ms | `cubic-bezier(.35,.05,.2,1)` | weighted wheel/door segment |

Normal reel settle is 170 ms after its authoritative reveal, with five stop offsets of 82 ms. Turbo settle is 30 ms with 35 ms stop offsets. Turbo retains at least 160 ms for an awarded line and 900 ms for the eight-spin award. It removes idle gaps and long travel, not information.

No infinite animation is allowed except bounded ambient/idle loops. Every semantic sequence owns completion, a maximum-duration guard, skip/turbo path, reduced-motion path, teardown cancellation, and deterministic final state.

## 13. Vault and BLACKOUT timeline

The feature cinematic is synchronized phases, never an opaque uncontrolled full-sequence video:

| Phase | Normal | Visual lock | Audio marker |
|---:|---:|---|---|
| 1. Base hold | 280 ms | finish current readable state; freeze ambient flourish | `vault.hold` |
| 2. Focus | 360 ms | facility darkens 30%; board/vault receives red-cyan lock focus | `vault.focus` |
| 3. Six lock releases | 720 ms | six sequential physical lock indicators; 90 ms cadence | `vault.lock.1` … `.6` |
| 4. Wheel turn | 980 ms | weighted 210–250 degree turn with overshoot ≤2 degrees | `vault.wheel` |
| 5. Pressure release | 420 ms | vapor jet and gauge drop, no full-screen white flash | `vault.pressure` |
| 6. Bolt retract | 520 ms | bolts withdraw toward frame depth | `vault.bolts` |
| 7. Door open | 1,100 ms | hinged mass rotates on a credible side axis | `vault.door` |
| 8. Gold reveal | 620 ms | volumetric gold core, dust ≤36 live particles | `vault.gold` |
| 9. Camera entry | 600 ms | scale ≤1.06, translation ≤24 px desktop/12 px phone | `vault.camera` |
| 10. Award/handoff | 500 ms plus 1,000 ms readable hold | exact `8 FREE SPINS`, target, and counter resolve into BLACKOUT | `vault.handoff` |

Normal active movement is 6,100 ms plus the protected 1,000 ms award hold. A direct `blackout` entry starts only after authoritative `feature_start` and uses the same final state with phases 1–3 compressed to 360 ms total. Turbo target is 2,080 ms plus the 900 ms protected award hold. Skip is accepted only after the confirmed trigger/focus beat and resolves within 820 ms to the same board, target, counter, lighting, audio bus state, and interaction state. Reduced motion uses a 900–1,200 ms opacity/light-state sequence with no camera travel, shake, wheel spin, vapor burst, or parallax.

BLACKOUT must introduce unique secure-interior geometry, exposed gold-lit depth, changed practical-light layout, target carrier, and a dedicated counter. Merely tinting Base gold/red fails.

## 14. Camera, shake, flash, and VFX limits

| Event | Max translation | Max rotation | Max duration | Reduced motion |
|---|---:|---:|---:|---|
| UI/reel stop/small win | 0 px | 0° | 0 ms | unchanged |
| medium win | 1 px | 0° | 70 ms | none |
| big/top win | 2 px | 0.08° | 120 ms | none |
| vault bolt/door impact | 3 px | 0.12° | 160 ms | none |
| max win | 4 px | 0.15° | 180 ms | none |

No continuous camera vibration, repeated screen shake, or operator root-motion displacement is allowed. Full-screen luminance change is capped at 35% per frame; flashes brighter than the surrounding scene last no more than 100 ms and never repeat above 3 Hz. Reduced motion disables flashes, shake, parallax, large scale changes, and long camera travel while preserving outlines, labels, counters, final amounts, and causal ordering.

Particle ceilings per semantic event:

- routine reel/symbol land: 0–4 particles;
- line win: 12 per line, 36 total live;
- BREACH trigger: 28 live;
- vault reveal: 36 dust/spark particles live;
- big/top win: 64 live;
- max win: 96 live, never combined with another full-screen emitter.

Only one full-stage filter may run at a time. Normal spins use no full-screen blur, displacement, or chromatic aberration.

## 15. Operative contract

Identity: tactical Penguin systems operative, grounded premium 3D rendering, coherent with the industrial environment. The character faces three-quarter toward the board; gaze and body motion support the reel event. No adult-male substitute, exaggerated chibi proportions, perpetual wobble, subpixel vibration, slapstick loop, or floating cutout.

V28 obeys the requested raster runtime contract:

- runtime frames only from semantic `rgba/` sequence folders;
- PNG RGBA, exactly 1280 × 1024;
- anchor `x=310`, `y=1000` in source pixels;
- fixed layout box and root position across every frame;
- no concurrent idle clips;
- deterministic result priority `rage > bonus > bigWin > win > lossStreak > loss > idle`;
- spin and anticipation are short non-result transients that may replace idle but never preempt a queued confirmed result reaction;
- every clip has entry, action/loop or hold, settle, exit/recover, interrupt rule, cooldown, repeat cap, and fallback frame.

Rage is off by default. If explicitly enabled, it is directed at the hostile facility/terminal after six deduplicated confirmed zero-payout live rounds, never at the player; it contains no pointing, ridicule, blame, loss copy, or aggressive voice. Replay and restore do not advance the session-local streak. Any ambiguity in human review removes Rage from production binding rather than weakening the no-shame rule.

## 16. Audio direction lock

The sound identity combines a low industrial pulse, short dry electromechanical transients, a restrained cyan-system tritone, and a warm gold fifth resolving only on confirmed feature/award states. It is not EDM wallpaper, orchestral trailer spam, speech-heavy military radio, or generic casino bells.

Six buses are mandatory: `Music`, `Ambience`, `Reels`, `Wins`, `UI`, `Voice`. `Voice` includes nonverbal operative reactions and may remain silent; cloned or rights-unclear voices are forbidden.

Mix targets:

- source masters: WAV, 48 kHz, 24 bit, true-peak ceiling ≤ −1 dBTP;
- base music/ambience combined target: approximately −24 to −20 LUFS short-term;
- one-shots: approximately −20 to −14 LUFS short-term according to priority;
- vault and big-win duck Music by 6–8 dB and Ambience by 3–5 dB with 60 ms attack and 280 ms release;
- Voice ducks Music/Ambience by 5 dB and Reels by 3 dB, only while active;
- low end below 120 Hz is effectively mono;
- no clipping, DC offset, click, hard-cut loop seam, or unbounded polyphony.

Complete cue, priority, cooldown, replay/restore, and coverage rules are binding in `BLACKSITE_AUDIO_EVENT_MATRIX_V28.md`.

## 17. Responsive lock and safe areas

| Layout | Trigger | Composition |
|---|---|---|
| Wide desktop | width ≥1280 and height ≥720 | tactical Penguin operative in left 18–22%; board centered/right; single 112 px-class HUD row |
| Constrained desktop | width ≥1024 or height 560–719 | operative cropped to 12–16%; board grows; one-row HUD with labels compacted, not hit boxes |
| Tablet portrait | width 600–1023 and portrait | board centered; operative bust behind upper-left outside reel mask; two compact rails |
| Phone portrait | width ≤599 and portrait | board first, operative optional 18% corner bust, values above board, controls in bottom safe dock |
| Short landscape | height <560 and landscape | full operative hidden or reduced to nonessential cameo; board and Spin occupy safe center; compact bottom rail |
| Popout S | content box below 640 × 480 | operative omitted; feature identity, counters, values, board, and actions preserved |
| Popout L | content box at least 640 × 480 | compact operative bust allowed if geometry remains clear |

Each edge uses its matching safe inset, for example `max(12px, env(safe-area-inset-left))`; the primary bottom dock uses `max(16px, env(safe-area-inset-bottom))`. Touch targets are at least 48 × 48 CSS px with 8 px intended separation. The board minimum is 300 CSS px wide in portrait and 420 CSS px wide in landscape unless the viewport is physically narrower; in that exception it receives all available width before decoration.

Orientation changes cancel transient camera/particle transforms, recompute anchors once, and resume at the same authoritative presentation checkpoint. Main frame remains non-scrollable; long dialog content scrolls internally.

Mandatory exact-build review viewports are 360 × 800, 390 × 844, representative smartphone landscape (including 844 × 390), 768 × 1024, 1366 × 768, 1920 × 1080, 2560 × 1440, and the project Popout S/L dimensions. Asset and geometry evidence covers relevant DPR 1, 2, and 3. Emulator screenshots do not replace the older Android/iOS real-device gate.

## 18. Performance and file budgets

Existing stricter project gates take precedence. V28 locks these ceilings:

- full production static asset tree hard ceiling: **64 MiB**;
- target production asset tree: **≤60 MiB**, leaving at least 4 MiB headroom;
- first-play critical transfer: **≤12 MiB** compressed;
- audio runtime total: **≤8 MiB**, critical UI/reel bank ≤1.5 MiB;
- operative PNG sequences: **≤18 MiB** total and at most 96 runtime frames;
- symbols, all states: **≤9 MiB** total;
- environment plus board: **≤11 MiB** total;
- UI plus brand: **≤4 MiB** total;
- VFX/cinematic phased assets: **≤6 MiB** total;
- decoded texture target: ≤96 MiB desktop and ≤64 MiB representative phone;
- atlas pages: ≤4096 × 4096 desktop, ≤2048 × 2048 phone-targeted groups;
- no single opaque environment runtime file above 1.8 MiB;
- no single transparent symbol state above 180 KiB without measured exception;
- no uncontrolled 2160p/opaque full-sequence video in the production path.

Runtime targets are desktop p95 frame time ≤20 ms, representative phone ≤33 ms, visible input response p95 ≤100 ms, no interaction/spin Long Task above 200 ms, CLS ≤0.1, and no monotonic memory growth over 100 automated spins. These remain unproven until measured on the exact build; desktop emulation cannot close the older-device gate.

## 19. Production acceptance criteria

The V28 visual implementation is acceptable only when all are true:

- tactical Penguin operative and wall-integrated five-by-three machine are present in every applicable exact-build viewport;
- Base and BLACKOUT are materially distinct without obscuring canonical state;
- no adult-male substitute, watermark, placeholder, baked UI value/text, duplicate settings path, or generic hamburger remains in production;
- every icon state has equal geometry and ≤1 CSS px optical-centering error;
- all 13 symbols pass full-board, grayscale, dim, win, and 72 px mobile readability review;
- Vault phases, Skip, Turbo, restore, replay, and reduced motion converge on identical authoritative final state;
- no animation or asset failure blocks RGS flow, settlement, replay, or restore;
- geometry, keyboard, touch, AA contrast, 200% text, safe-area, and no-overlap checks pass;
- asset/audio manifests contain paths, rights, dimensions, budgets, and hashes for actual delivered files;
- exact package stays within budgets and passes browser, performance, and independent visual review.

Design Lock PASS means this specification is coherent and ready to implement. It does **not** approve any current runtime asset or close the production, manual-device, licensing, package, Stake, or release gates.
