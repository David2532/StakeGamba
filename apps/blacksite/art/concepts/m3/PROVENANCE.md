# BLACKSITE // BREACH — M3 Concept Provenance

Generation date: **2026-08-07**
Generation mode: **OpenAI built-in `image_gen`**
Input policy: **project-authored text prompts plus project-owner-supplied BLACKSITE targets and repository-owned BLACKSITE derivatives as visual references**; no third-party casino assets
Lifecycle: **historical concept sources plus the current raster-v4 runtime asset record — no external rights or release approval claim**

The three retained PNG files were copied into this directory without pixel modification after generation and were visually re-opened from their repository paths. Their exact dimensions and SHA-256 identities are recorded in `../../asset-manifest.json`.

## 2026-08-08 historical runtime-preview derivatives

The former v1 interactive preview used two derivatives generated with the retained environment concept as the only visual reference:

- `static/assets/blacksite/environment/server-bunker-desktop-v1.png`: a targeted edit that removes the baked operator while preserving the bunker, console, camera, lighting and blank monitor aperture.
- `static/assets/blacksite/character/operative-male-v1.png`: a separate adult male operator plate facing screen-right in matching bunker lighting. It was generated on flat chroma magenta and converted to alpha with the Codex `remove_chroma_key.py` helper.

The former runtime symbol sheet was a byte-identical copy of the retained six-symbol concept. Its sheet and duplicate character files were removed from the v3 runtime package when the exact thirteen-master library replaced them. Historical source identities remain recoverable from Git history. Human rights/originality review, dedicated responsive plates and a real Spine 4.2 rig remain pending.

## 2026-08-08 front-facing reaction pose pack v2

The interactive preview previously included six separately rendered, front-facing operator poses under `static/assets/blacksite/character/`:

- `operative-front-idle-v2.png`
- `operative-front-anticipation-v2.png`
- `operative-front-win-small-v2.png`
- `operative-front-win-big-v2.png`
- `operative-front-loss-v2.png`
- `operative-front-feature-v2.png`

Generation mode was OpenAI built-in `image_gen`, using the repository-owned male operative plate only as the outfit, lighting and general identity reference. Each prompt requested the same adult tactical operator, a straight-on eye-level full-body view, direct eye contact with the player, stable 1122-by-1402 framing, cool-cyan left rim light, restrained red right rim light, and a flat `#00ff00` chroma background. The six pose-specific directions were: calm ready stance; focused anticipation with clenched fists; happy compact fist-pump; jubilant both-arms-raised win; disappointed loss with lowered shoulders; and surprised feature reaction with an illuminated wrist device and one hand reaching toward the player. Prompts explicitly excluded text, logos, weapons, scenery, shadows, duplicate bodies and extra limbs.

The chroma background was converted to alpha with the Codex `remove_chroma_key.py` helper. Every file had the same 1122-by-1402 RGBA canvas and a distinct SHA-256 identity. This six-pose pack was superseded and removed from the shipped runtime tree on 2026-08-09 when the user-supplied Runtime RGBA v1 sequence package was integrated; the hashes and prompt record remain here as historical provenance only.

## 2026-08-09 historical classic-reel special symbols v2

The versioned 5-by-3 line-game prototype temporarily used two original, separately rendered special symbols under `static/assets/blacksite/symbols/`:

- `ghost-wild-v2.png`: a red emissive classified-operative mask and breach sigil used only as the GHOST WILD visual.
- `breach-core-v2.png`: a cyan containment core used only as the BREACH free-spin trigger visual.

Both were generated with OpenAI built-in `image_gen` from project-authored text briefs without third-party image references. The prompts required a single centered industrial sci-fi slot symbol on a perfectly flat `#00ff00` chroma background, a strong silhouette at 64 pixels, worn gunmetal materials, no text/logos/trademarks/watermarks, and explicit avoidance of Egyptian, book, explorer, shark, coin, fruit or other copied casino imagery. The GHOST WILD brief specified a dark angular mask with a dominant red breach sigil and restrained cyan accents. The BREACH brief specified a cyan-white reactor/access core in a gunmetal containment frame with small amber warnings and no dominant red.

The chroma backgrounds were converted to alpha with the Codex `remove_chroma_key.py` helper using border auto-key, soft matte and despill. These two v2 runtime files were removed when the v3 GHOST WILD and BREACH master designs replaced them; their historical identities remain recoverable from Git. That historical prototype used DOM captions. V19 removes all visible reel captions and exposes the current WILD and VAULT meanings through accessible labels and the Game Guide instead.

## 2026-08-09 historical premium thirteen-symbol source library v3

The premium 5-by-3 rebuild replaces the temporary six-symbol sheet and the two
v2 special images with exactly thirteen unique master assets. No Book of Ra,
Stake, third-party casino, or user-supplied screenshot pixels were passed to the
generator. The supplied screenshot and written brief were used only to establish
layout goals: recognizable classic-slot grammar, dominant reels, a left-side
operative, and a restrained Black Ops material language.

Eight high/special masters were created with OpenAI built-in `image_gen` from
project-authored text prompts. Each request asked for one centered, isolated,
AAA-stylized realistic slot symbol; a strong silhouette at 64 pixels; consistent
front/three-quarter product lighting; gunmetal, charcoal, restrained amber/red,
and selective cyan; no casino-franchise motifs, brand marks, watermark, copied
UI, extra objects, or alternate versions. The individual subjects were:

1. the same adult male BLACKSITE operative as a direct-eye-contact portrait in a premium tactical frame;
2. a thick encrypted military data drive with a large physical lock motif;
3. a rugged tactical radio with a tall antenna and protected green display;
4. a sealed black classified dossier with red security band and wax-like seal;
5. front-facing night-vision goggles with two unmistakable green lenses;
6. a heavy olive supply crate with reinforced black latches and one amber indicator;
7. a shield-shaped GHOST WILD skull patch with bone-metal mask and restrained gold/cyan rim accents;
8. a closed armored BREACH blast door with a dominant red central seam and circular lock core.

The radio and night-vision prompts used a flat magenta key so their genuine green
display/lenses would survive key removal. The remaining isolated masters used a
flat chroma key appropriate to their palette. Backgrounds were converted to alpha
with the Codex image helper and every result was deterministically normalized to
the same 512-by-512 RGBA canvas and centered pivot. These eight files are retained
as source objects for the raster-v4 state builder; they are no longer the direct
runtime symbol URLs:

- `art/generated/symbols-v4/source-masters-v3/sym_01_operative-master-v3.png`
- `art/generated/symbols-v4/source-masters-v3/sym_02_encrypted_drive-master-v3.png`
- `art/generated/symbols-v4/source-masters-v3/sym_03_tactical_radio-master-v3.png`
- `art/generated/symbols-v4/source-masters-v3/sym_04_classified_folder-master-v3.png`
- `art/generated/symbols-v4/source-masters-v3/sym_05_night_vision_goggles-master-v3.png`
- `art/generated/symbols-v4/source-masters-v3/sym_06_supply_crate-master-v3.png`
- `art/generated/symbols-v4/source-masters-v3/sym_07_ghost_wild-master-v3.png`
- `art/generated/symbols-v4/source-masters-v3/sym_08_breach_scatter-master-v3.png`

The five low symbols in this historical set were code-native SVG masters. They
were removed from the runtime tree on 2026-08-10 and are recoverable from Git
history only. They are not referenced by the raster-v4 asset registry.

## 2026-08-10 premium thirteen-symbol raster state library v4

The current runtime exposes exactly thirteen symbol IDs and loads only dedicated
alpha WebP state files. Every symbol has `base-v4.webp`, `win-v4.webp` and
`dim-v4.webp` on a 512-by-512 transparent delivery canvas. `ghost_wild` and `breach`
also have `anticipation-v4.webp` and `triggered-v4.webp`. This is 43 runtime WebPs
in total. The files live in each symbol directory under `states-v4/`; their
exact counts, byte totals and canonical tree hashes are recorded in
`../../asset-manifest.json`.

The first eight source objects are the retained v3 PNGs listed above. Five new
low-value source objects replace the removed SVGs:

- `art/generated/symbols-v4/objects/sym_09_a-object-v4.png`
- `art/generated/symbols-v4/objects/sym_10_k-object-v4.png`
- `art/generated/symbols-v4/objects/sym_11_q-object-v4.png`
- `art/generated/symbols-v4/objects/sym_12_j-object-v4.png`
- `art/generated/symbols-v4/objects/sym_13_ten-object-v4.png`

Those five objects were generated with OpenAI built-in `image_gen`, using the
project-owner-supplied premium BLACKSITE target only as a material and lighting
reference. Each request isolated one exact `A`, `K`, `Q`, `J` or `10` glyph on a
flat `#ff00ff` field. The shared direction specified a large centered, deeply
extruded forged-metal character; antique-gold face and dark gunmetal sides;
restrained cyan left and red right rim light; no frame, plaque, label, extra
text, copied interface, logo, watermark or particle effect. `J` used a colder
steel/cyan face with a gold edge to preserve the established value hierarchy.
The A output is 1254-by-1254; K, Q, J and 10 are 1024-by-1024.

The flat background was converted to alpha with the Codex
`remove_chroma_key.py` helper. The retained generated A source before key
removal is `art/generated/symbols-v4/a-chroma-v4.png`; the other four built-in
generation outputs were converted directly into their repository object files.
The deterministic builder in `scripts/build-blacksite-raster-symbols.py`
normalizes each source object to a shared 1024-square authoring pivot, renders
the three common states, and downsamples each runtime delivery to 512 square.
`win` adds baked amber outer light and controlled
brightness; `dim` bakes the grayscale/value reduction. The same builder adds
red or cyan anticipation light and a hot triggered state only to the two
special symbols. Runtime styling does not synthesize alternate symbol art.

All image-generated source objects and their derived state packs remain
AI-assisted project assets. Human originality and final-use rights review is
still required before any external release claim.

## Environment concept

Retained file: `environment-server-bunker-board-aperture-concept-v1.png`

Initial generation prompt:

```text
Use case: stylized-concept
Asset type: BLACKSITE // BREACH game environment concept art, desktop composition reference
Primary request: an original premium cyber-heist slot-game environment inside a physical classified underground server bunker; a large integrated square 7-by-7 game-board aperture is the unmistakable primary focal point, built into dense machinery and armored rack architecture; one adult cyber operative appears as a secondary side silhouette at a console, observing but never obscuring the board
Scene/backdrop: deep industrial server facility with concrete, brushed gunmetal, cable conduits, rack doors, cooling vents, subtle haze and practical warning fixtures
Style/medium: cinematic stylized realism, high-end game concept art, authored industrial materials, cohesive and production-oriented rather than generic neon sci-fi
Composition/framing: wide 16:9 establishing composition; square board aperture centered slightly off-axis with generous readable negative space inside it; operative confined to one outer side; clear foreground/midground/background separation; suitable for later responsive layer extraction
Lighting/mood: restrained cold cyan utility light with sparse amber/red security accents, deep but readable shadows, volumetric shafts used sparingly, tense classified atmosphere
Color palette: charcoal, oxidized gunmetal, muted blue-green, bone-gray concrete, limited amber and red accents
Materials/textures: worn painted steel, glass server doors, rubber cable sleeves, concrete dust, subtle condensation; no glossy fantasy chrome
Constraints: original design only; board remains dominant; adult character only; no UI controls, no reels, no symbols, no readable text, no letters, no numbers, no logos, no trademarks, no watermark; no Stake branding; no weapon aimed at viewer
Avoid: purple neon wallpaper, cyberpunk city streets, floating hologram overload, generic casino imagery, coins, gems, slot-machine cabinet, childish character, anime style, copied franchise silhouettes, illegible fake typography
```

The first output was not retained in the project because it invented an incorrect internal cell grid. Targeted edit prompt used for the retained file:

```text
Use case: precise-object-edit
Asset type: BLACKSITE // BREACH game environment concept art, desktop composition reference
Primary request: change only the large central board interior. Remove every internal panel, cell, grid line, seam, tile, and subdivision from inside the heavy square machinery frame. Replace the interior with one perfectly empty, uninterrupted, matte near-black square recessed aperture with very subtle uniform metal texture and even edge falloff, ready for an exact code-rendered 7-by-7 board overlay.
Constraints: preserve the entire industrial bunker environment, camera, lighting, frame geometry, cables, side operative, console, colors, materials and all outer details unchanged; the central aperture must contain no grid and no objects; no text, no symbols, no letters, no numbers, no logos, no watermark; do not add anything elsewhere.
```

Visual QA: retained as a direction anchor because the board aperture is dominant and empty, the operative remains secondary, and no visible text/logo/watermark was found. It is not a production background: portrait/Popout recompositions, separable layers, final perspective alignment, optimization and human originality/rights review remain open.

## Operative concept

Retained file: `operative-spine-anchor-concept-v1.png`

Final prompt:

```text
Use case: stylized-concept
Asset type: BLACKSITE // BREACH adult operative character concept and Spine-rig visual anchor
Primary request: an original adult cyber-security operative for a premium classified server-bunker game; practical specialist who monitors and reacts to an intrusion, never a superhero and never the source of game outcomes
Subject: adult woman in her late thirties, grounded athletic build, distinct angular silhouette; short practical dark hair with one subtle gray streak; alert intelligent expression; layered matte-black and dark slate technical workwear with a compact shoulder harness, insulated forearm sleeves, small amber diagnostic module at the wrist, utility belt, soft knee protection and practical boots; hands suitable for terminal interaction; no exposed midriff; no helmet
Style/medium: cinematic stylized realism, high-end game character concept render, coherent with industrial gunmetal server-bunker art direction, anatomically credible and rig-friendly
Composition/framing: full body three-quarter neutral stance, entire silhouette and both hands visible, feet visible, facing slightly toward an implied game board outside frame; include one clean waist-up crop inset for portrait-mobile composition; plain restrained charcoal studio backdrop, ample separation around limbs for Spine bone planning
Lighting/mood: cool cyan rim light with a restrained amber practical key; calm focused readiness, not aggressive
Color palette: charcoal, slate, muted blue-green fabric, tiny amber/red equipment accents, natural skin tone
Materials/textures: worn technical fabric, rubberized seams, brushed metal fasteners, subtle scuffs; no glossy latex
Constraints: original adult character only; one consistent identity across full-body and inset; realistic hands and anatomy; readable silhouette at small size; no weapon, no tactical brand patches, no logos, no letters, no numbers, no readable text, no trademarks, no watermark; no cybernetic body replacement; no sexualized styling
Avoid: anime, comic-book superhero, military fetish gear, gas mask, glowing eyes, hooded hacker cliché, purple neon, excessive cables, exposed skin, childlike proportions, extra fingers, duplicated limbs, multiple unrelated characters
```

Visual QA: one consistent adult identity, complete full-body silhouette, readable hands/feet and compatible waist-up inset were observed; no visible logo or text was found. This is not a turnaround, layered source, transparent cutout, fallback pose or Spine skeleton. Human anatomy/likeness/originality review and a production rig remain open.

## Six-symbol material concept

Retained file: `symbols-material-language-concept-v1.png`

Final prompt:

```text
Use case: stylized-concept
Asset type: BLACKSITE // BREACH six-symbol material-language concept sheet
Primary request: design one cohesive original family of exactly six square game symbols for a premium physical server-bunker cluster game, corresponding by reading order to: BYTE, RELAY, PROXY, CIPHER, DAEMON, VAULT
Subject: a clean 2-by-3 grid of six separate square industrial icon plaques. Reading order visual concepts: 1) compact data block made of four interlocking memory cubes; 2) hardened signal relay coil with two linked nodes; 3) layered mirrored routing mask with forward and shadow paths; 4) mechanical cipher rotor with offset locking teeth; 5) contained red security process core with a restrained horn-like circuit silhouette but no face; 6) massive sealed vault iris with concentric armored locks
Style/medium: high-end stylized-realistic game symbol concept art; coherent industrial gunmetal construction; bold silhouettes and simplified internal shapes readable at 48 pixels; consistent three-quarter frontal perspective and identical lighting
Composition/framing: exactly six equal isolated plaques in a precise 2-column by 3-row sheet, generous gutters, each symbol centered and fully visible, no overlap, flat dark neutral presentation background
Lighting/mood: cool cyan rim light; value hierarchy rises from muted steel for the first symbol toward limited amber and deep security red accents for higher-value symbols
Color palette: charcoal, gunmetal, muted blue-green, bone-gray metal, limited amber, deep red only on higher symbols
Materials/textures: brushed and worn painted steel, ceramic insulators, matte glass, rubber seals; controlled emissive seams only
Constraints: exactly six symbols; one coherent family; no alphabet letters, no words, no numbers, no labels, no logos, no trademarks, no watermark; no coins, gems, crowns, card suits, fruit, guns, skulls, faces or casino clichés; each silhouette must remain distinct without relying only on color; no Wild, Scatter or Mystery icon
Avoid: tiny circuitry noise, purple neon, emoji icons, flat clip art, unrelated art styles, photoreal objects on different backgrounds, excessive glow, illegible microdetails
```

Visual QA: exactly six coherent plaques appear in the required reading order with distinct silhouettes and no visible text/logo/watermark. This sheet is not a runtime atlas: separate alpha sprites, exact crop/pivots, dim/win states, 48-pixel readability proof, color-vision review and book/rules visual mapping remain open.

## 2026-08-09 supplied Runtime RGBA animation package v1

Source archive: `Blacksite_Breach_ALLES_WAS_DU_BRAUCHST_v1.zip`, supplied by the
project owner as a generated BLACKSITE animation delivery. No external download
or third-party reference asset was introduced during repository intake. The
archive's internal review sheets and prompts are not shipped as runtime assets.

The import process first rejected absolute paths, traversal segments, duplicate
destinations and ZIP symlinks, then extracted into a workspace-owned staging
directory. The manifest contract was validated against every declared source
file. Only the 215 declared alpha PNG authoring files and
`animation_manifest.json` entered the production pipeline; pink backgrounds,
previews, contact sheets, concept keyframes and source sheets were excluded.
The deployable runtime copies were then converted transactionally to alpha WebP,
and the manifest paths were rewritten to those WebP identities.

Validation identity:

- manifest SHA-256: `6edcd12d0508b4bcace16a577a25266b0d6d18807fd869a39133f8d8b51b49f7`
- canonical runtime-tree SHA-256: `6d0efd216cf2dad5ad5c9a030c77f7664418acd1a3913ff53d27747b86a4c503`
- runtime static size including manifest: 16,873,330 bytes
- runtime delivery: 215 alpha WebPs plus one JSON manifest

The supplied/generated status does not establish release rights or production
approval. Human likeness, anatomy, originality and final-use rights review is
still required, as are responsive composition and measured loading/memory QA.

## 2026-08-10 production WebP delivery v5

All 353 deployable runtime PNGs were converted to same-basename WebPs by
`scripts/blacksite-convert-runtime-webp.py`; the static asset tree remains
exactly 354 files (353 WebPs plus the runtime animation JSON). Pillow WebP uses
quality 90 for `runtime-rgba-v1`, quality 92 for environment, symbols and UI,
method 6, alpha quality 100 and exact transparent-pixel handling. The converter
stages and validates the complete tree before an atomic sibling swap. It checks
RIFF/WebP decode, source dimensions and byte-identical alpha for every image.

The complete raster payload changed from 104,545,489 PNG bytes to 21,141,848
WebP bytes, a reduction of 83,403,641 bytes (79.7774%). Across all 353 files the
alpha channel has zero changed pixels. Visible-pixel RGB mean absolute error is
2.0119 with p99 17; alpha-premultiplied RGB mean absolute error is 0.3870 with
p99 6. Source and generated master PNGs under `apps/blacksite/art/` remain the
authoring record and are not part of the deployable static tree.

## 2026-08-09 premium machine target integration v1

The project owner supplied `premium-machine-target-v1.png` as the exact visual
composition target. It is retained under `apps/blacksite/art/reference/` for
review only and is not loaded by the game. OpenAI's built-in image generation
tool was used in image-edit mode to create the empty machine plate, retained as
PNG authoring input and delivered at runtime as
`static/assets/blacksite/environment/premium-machine-shell-v1.webp`.

Final edit prompt:

```text
Use case: precise-object-edit. Treat the supplied 1672×941 BLACKSITE // BREACH
target as a locked layout and material reference. Preserve the exact camera,
perspective, bunker walls, armored monitor, four upper rule panels, 5×3 reel
frame, twenty side line-marker housings, result bar, physical bottom console,
button wells, large central spin bezel, lower utility rail, proportions,
lighting and dark brushed-gunmetal realism. Remove only the operator, all reel
symbols, all readable text, all icons and every dynamic value. Leave those
areas clean and empty for authoritative runtime DOM and animation overlays.
Do not redesign, reframe, add UI, add people, add symbols, add text, add logos,
add a watermark, flatten the materials or introduce a vector/prototype look.
Output one opaque 1672×941 production raster plate.
```

The nine deterministic pixel crops of static button surfaces from the same
project-owner-supplied target are retained under
`art/generated/ui-v1/legacy-hud-crops/`. They are authoring inputs for the
current HUD builder and are not shipped as a second runtime control system.

## 2026-08-10 responsive machine shell set v1

Three additional opaque raster shells were generated with OpenAI built-in
`image_gen` as native responsive compositions rather than CSS/vector
reconstructions or crops of the desktop plate. The project-owner-supplied
`art/reference/premium-machine-target-v1.png` and the repository desktop shell
`static/assets/blacksite/environment/premium-machine-shell-v1.webp` were the
shared visual references. The phone request also used the generated portrait
source as a layout-family reference. Every prompt required a straight-on
physical BLACKSITE cabinet, exactly fifteen empty 5-by-3 reel wells, an empty
result ticker and complete premium control sockets in blackened steel,
gunmetal and restrained brass with cyan-left/red-right rim light. Operators,
symbols, text, numbers, labels, results, logos, coins, effects, watermarks,
flat UI, SVG and vector styling were explicitly excluded.

Runtime identities:

- `environment/premium-machine-shell-portrait-v1.webp`: 768x1024 opaque RGB,
  95,248 bytes, SHA-256
  `a67595963b54af270eeb43dc8cd5c044f9f827ea8ad8172b5b7baa31b672b03e`.
  The 1086x1448 source was proportionally resized with Pillow LANCZOS, without
  cropping. Aperture: x 9.77%, y 20.51%, w 79.69%, h 42.29%; HUD carrier:
  x 0%, y 71.78%, w 100%, h 28.22%.
- `environment/premium-machine-shell-phone-v1.webp`: 390x844 opaque RGB,
  53,030 bytes, SHA-256
  `41167f1683a0524762036e7a1bd0868920ebce88a73fa9a95eb793425f3e2ec9`.
  The 853x1844 source was uniformly resized to 390x843 and placed at y=1 on
  an opaque 390x844 canvas, without cropping or anisotropic stretch. Aperture:
  x 8.21%, y 18.48%, w 83.08%, h 36.49%; ticker: x 11.54%, y 57.70%,
  w 75.38%, h 4.03%; HUD carrier: x 2.56%, y 63.27%, w 95.13%, h 35.55%.
- `environment/premium-machine-shell-short-landscape-v1.webp`: 844x390 opaque
  RGB, 44,772 bytes, SHA-256
  `805fd8d095db6181b7993b6d3ef1d5c47f7630c97a528c41c7561e3e14f44bd1`.
  The 1846x852 source was resized directly with Pillow LANCZOS, without crop;
  the source/target aspect difference is approximately 0.12%. Aperture:
  x 16.11%, y 6.41%, w 66.59%, h 57.69%; HUD carrier: x 2.13%, y 78.21%,
  w 95.73%, h 21.79%.

The three runtime files total 193,050 bytes. Their canonical set tree
SHA-256 is
`3fc2f601e06fb69039bd1d444104ebe49f4b2df4f04df21dc362297d32cc41ab`.
The unscaled authoring files and their exact source hashes are retained under
`art/generated/compact-shells-v1/` and recorded in the asset manifest.

## 2026-08-10 premium raster UI packages

`static/assets/blacksite/ui/premium-hud-v2/` is produced by
`apps/blacksite/scripts/generate-premium-raster-ui-v2.py`. It contains eleven
controls (`menu`, `buy`, `auto`, `minus`, `plus`, `spin`, `turbo`, `info`,
`settings`, `close`, `resume`) with explicit `normal`, `hover`, `pressed`,
`active` and `disabled` WebP states. The nine target-derived controls are scaled
and sharpened deterministically before state treatment. Close and resume are
project-authored text-free raster controls generated by the same script. The
runtime package contains 68 WebPs: 55 control-state files and 13 mode-card,
value-meter, ticker and line-marker surfaces. It contains no generic modal
shell. Mode cards have normal, hover, selected and disabled files; markers have
normal, active and disabled files. Baked surfaces never
contain balance, wager, win or authoritative result values. Those values,
control labels, focus behavior and accessibility text remain live DOM governed
by the live/replay runtime. The WebP package totals 414,762 bytes; its canonical
tree SHA-256 is
`94900e6a99fe8a4a745f066232a3f917bf42d58ccbdea0c122f016506dfd97ac`.

The production dialog package under
`static/assets/blacksite/ui/premium-panels-v1/` contains seven purpose-sized
RGBA shells. Its source master was separately generated with OpenAI built-in
`image_gen` as a text-free forged-black industrial frame with a deep empty
content well, restrained gold pinstripe and red security accents on flat
magenta, then converted to alpha with the Codex chroma-key helper. The retained
1672x941 pre-key source is `art/generated/ui-v1/modal-frame-chroma-v1.png`
(1,253,504 bytes; SHA-256
`0954744c217fee8ee32f5bb49feaf5729025d542442412b9189783a69bb27157`).
`apps/blacksite/scripts/generate-premium-dialog-pack.py` uses fixed production
sizes and deterministic nine-slice composition so corners remain pixel-exact,
horizontal and vertical rails scale on one axis only, and only the interior
surface scales in both axes. The seven runtime files are:

- `dialog-mode.webp`: 1640x640, 51,652 bytes, SHA-256
  `eafbf503686194a7d35bbec395d6def36e9da7b6ecb4c68768d63f5fa824fab9`.
- `dialog-menu.webp`: 1040x480, 37,036 bytes, SHA-256
  `2143cdf5df60cdd9cb21b7a5550beb916bc91d2ba0c7743d4bffacd4ab35662a`.
- `dialog-confirmation.webp`: 1040x680, 43,314 bytes, SHA-256
  `8102c7d991fa3580238eca0c3ceea2636bd2be0fea1afea4573d6d96944f5c42`.
- `dialog-rules.webp`: 1880x1640, 91,052 bytes, SHA-256
  `f2c7f9163841dad53464a9c59a3d700313aa1b5c736527ef8bac12db77917db7`.
- `dialog-auto.webp`: 1080x760, 46,438 bytes, SHA-256
  `cbd054ca1ae0f08c087286720ec87de3d86ebdd784acd2c6df583805860795ad`.
- `dialog-settings.webp`: 1040x520, 40,614 bytes, SHA-256
  `327409daa3203cd64579a0c8952ba9ecaf5f12d6911200a3d08a576243084f0c`.
- `dialog-runtime-error.webp`: 880x520, 36,734 bytes, SHA-256
  `ea7966db667eb443660df98dc0f4da98a5cca67d2cdb669b31ee533aeee37d9b`.

Together they total 346,840 bytes; their canonical package tree SHA-256 is
`563f40d352b34011894aa4643a9b3018f398ee4b403456dde075ba485c734f58`.
The former generic runtime modal frame is not part of the runtime package.
These shells contain no labels, values, icons, brand marks or game authority.

`static/assets/blacksite/ui/paylines-v1/` contains ten transparent 1000-by-600
WebP overlays built deterministically by
`scripts/build-blacksite-raster-symbols.py` from the authoritative fixed-line
row definitions. Each path bakes the red glow, gold trace, bright core and five
stops into one raster layer. No inline SVG payline drawing is part of this
delivery. The ten files total 181,362 bytes; their canonical package tree
SHA-256 is
`092df11a2f83df42b224cb47c66fb99f309851d5baa9d455a2647265f82b9dd7`.

`static/assets/blacksite/ui/reel-strips-v1/` contains five 320-by-3840 opaque WebP
spin strips, one per reel. Each strip has sixteen 320-by-240 stops: all thirteen
canonical base symbols in a deterministic reel-specific order plus the first
three stops repeated for a seamless loop. The same builder composites the
512-square base-state symbols into text-free industrial stop chrome. In V19 the
original stop order is preserved, and only the former BREACH stop is rebuilt
from the single Vault master at zero-based stops 4, 6, 8, 10 and 12. The runtime
animates these five consolidated rasters rather than constructing a large grid
of transient symbol elements during every spin. Exact per-file and package
hashes are recorded in `../../asset-manifest.json`. The five files total 611,200
bytes; their canonical package tree SHA-256 is
`829563c5c1ee693543c5a1b4786c4031aa718f6af1aab2e720011acdff8411f9`.

This integration does not establish external-release rights. Human originality,
likeness and final-use review remain required.

## 2026-08-10 V19 single-Vault runtime integration

The V19 feature visual is one consistent high-security Vault derived from the
same project master. The original generated master is retained at
`art/generated/v19/sources/master-vault-source.png` with SHA-256
`289a330d1db579c2f39cc0abd637dce85ecad78ff605aeeb964faf94bf071d5d`.
The generated prompts, source lineage, alpha-cleanup procedure and rebuild
command are recorded in `art/generated/v19/provenance/PROVENANCE.md`; the
machine-readable authority for dimensions, byte sizes and file hashes is
`art/generated/v19/provenance/asset-index.generated.json`.

The deployable V19 directory contains ten WebPs totaling 1,712,958 bytes. Its
canonical package tree SHA-256 is
`6057120303fd8eabe8e89c07c265c480b0580997de37c7c6c076750a601d5fc9`.
The complete runtime static tree now contains 358 WebPs plus one JSON animation
manifest, totals 22,518,832 bytes and has canonical tree SHA-256
`5d7b0c576056682ca7b6e5667d1959f80ed88e51f213a5469988a17164ce2eb7`.

### Vault symbol states

The internal authoritative math identifier remains `breach`; only the visible
runtime identity changes to Vault. Four 512-by-512 alpha WebPs total 298,072
bytes and have package tree SHA-256
`fa16d5b7086c4aeec343e7c65f3e7ccef713ed5d55c3662292f0a0cac1705bd7`:

- `anticipation.webp`: 84,970 bytes, SHA-256
  `00ee0debd5b0eaf8ad9de842d44b0cbfa03040875ad87a2d9204a973397a87e2`.
- `base.webp`: 83,552 bytes, SHA-256
  `9969f95eb5c1ebb5fb6e62147637ddae22d987e1f8661a0da4385a3bf0a5beb9`.
- `dim.webp`: 47,052 bytes, SHA-256
  `5eea9d13ee3481b4f3e03c33abefdd5887c173970057c8f2f61a1679818574df`.
- `triggered.webp`: 82,498 bytes, SHA-256
  `4d162aa568339b0e4b9bdf19b7a281448d481be64835bb1b62a44312f39df33d`.

Logical `win` intentionally aliases `triggered`; it is not a fifth file. The
five obsolete runtime files under
`static/assets/blacksite/symbols/sym_08_breach_scatter/states-v4/` were removed.
Their V18 authoring master remains under `art/generated/symbols-v4/` for audit
history and is not referenced by the V19 runtime.

### Cinematic scenes and mode key art

The three cinematic scene WebPs total 783,546 bytes and have package tree
SHA-256
`47154645cc62bf9d74f8ff2536352da194e70f0657278ccc77687b8c035f21a7`:

- `blackout-interior-desktop.webp`: 1672x941 opaque RGB, 279,766 bytes,
  SHA-256 `cd86b22ef9b8f037fc83018c8667b9df2ccb91b25eff05fa7452dd5b6c5d2128`.
- `extraction-report-desktop.webp`: 1536x1024 alpha RGBA, 184,704 bytes,
  SHA-256 `39562603b7c2533e531cd7c54caf827aaf0738248e94e7495000dd798d591424`.
- `vault-access-desktop.webp`: 1672x941 opaque RGB, 319,076 bytes,
  SHA-256 `9ae583684fa7cb9d3f3f12e1373bcebd7a59b137f901f8fb730df5dc0929483b`.

The three 768-square opaque mode-art WebPs total 631,340 bytes and have package
tree SHA-256
`d06312081e4d83e9c65467f575bb3341f0f806ee0193aaa496a782660536222b`:

- `base.webp`: 170,882 bytes, SHA-256
  `5b789bb6b588e7b88f9fe5c8d40145d75f33420d54cf5a1194e6cbb79ac504c9`.
- `blackout.webp`: 251,334 bytes, SHA-256
  `6a739224e183e29254a189678bff87cc2a5fe3743a5c867bfd956d212eff3b53`.
- `deep-access.webp`: 209,124 bytes, SHA-256
  `7dbf88d8f254cd2e28fad14a7b0562c78b15cd803f061167238ba814dc9f7c11`.

The ten V19 runtime assets have no baked copy, no external runtime dependency
and no visible magenta chroma residue according to the generated asset index.
This asset integration still requires human originality, likeness and final-use
rights review before any external release.
