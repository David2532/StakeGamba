# BLACKSITE // BREACH — Asset, Art & Audio Standard

Owners: `creative_director`, `asset_director`  
Co-owners: Animation, Intro, Mobile/Performance, Compliance

Goal: final production assets must look like one authored game, be original, performant, traceable, and safe for Stake static/CDN delivery.

## 1. Art-direction north star

BLACKSITE is a premium cyber-heist / classified server-bunker slot.

Visual principles:
- physical industrial environment rather than abstract neon wallpaper;
- tactical, restrained emissive lighting;
- readable high-contrast symbol silhouettes;
- a coherent material language across board, symbols, UI and character;
- mature/adult cast only;
- no Stake branding/theme in production art;
- avoid generic AI gradient/emoji/icon aesthetic;
- avoid direct visual resemblance to an existing slot series.

## 2. Required asset manifest

Every production asset gets a manifest row with:
- stable asset ID;
- category;
- repo-relative source path;
- repo-relative runtime path;
- type/format;
- pixel dimensions or Spine rig version;
- intended viewport/use;
- alpha requirement;
- atlas group;
- compression/optimization state;
- provenance/originality note;
- license/rights note if applicable;
- owner;
- status: concept / placeholder / production / approved / superseded.

No release candidate may contain an untracked final asset.

## 3. Required groups

### Brand/title
- game logo/title lockup;
- compact logo variant;
- provider/studio logo;
- monochrome/low-size variants where required.

### Environment
- desktop background layers;
- portrait/mobile recomposition layers;
- Popout-compatible fallback/crops;
- foreground framing elements;
- lighting overlays;
- bonus/blackout environment states.

### Board
- reel/cluster frame;
- cell plates;
- breach cell states/levels;
- separators/masks;
- feature overlays;
- readable highlight/glow assets.

### Symbols
- complete low/high set;
- wild;
- scatter/trigger;
- feature/breach symbol(s);
- any mystery/collector/multiplier symbols;
- win/idle states only if they improve readability and remain optimized.

### Character
- production concept turnaround;
- Spine source/export package;
- atlas texture(s);
- skeleton data;
- animation list/events;
- mobile crop/bust strategy;
- fallback static pose.

### UI
- control icons;
- feature-mode art;
- information/paytable surfaces;
- confirmation/modal support art;
- sound/turbo/autoplay states;
- Replay-specific assets only when truly needed.

### FX
- sparks;
- breach pulses;
- network lines;
- impact frames;
- small smoke/dust/glitch details;
- particles and spritesheets.

### Audio
- base music/ambience;
- spin/stop;
- symbol/cascade impacts;
- breach cell activation/level-up;
- anticipation;
- feature trigger;
- bonus music/stem/state;
- win escalation;
- max win;
- UI interactions;
- error/confirmation cues.

## 4. Stake game tile package

Prepare current Stake-required tile deliverables:
- high-resolution environmental BG named according to current convention;
- high-resolution transparent PNG FG/key character/item;
- high-resolution transparent provider logo;
- combined BG+FG size within the current Stake limit;
- small-size preview proving silhouette/readability.

Tile should communicate the world and primary hook without needing UI text.

## 5. Originality and provenance

Allowed sources:
- original internal art;
- commissioned art with clear rights;
- procedurally/AI-assisted source work only when legally usable and substantially art-directed/retouched into a consistent original production set.

Final candidate cannot rely on:
- Stake sample-game art/audio;
- ripped game assets;
- copied character designs;
- trademarked brand imagery without rights;
- random web images;
- license-unclear fonts/audio;
- “temporary” placeholders hidden in obscure screens.

Keep source/provenance notes sufficient to answer a reviewer question later.

## 6. Character delivery contract

Spine runtime version must match repository integration.

Delivery includes:
- skeleton data (`.json` or supported binary according to chosen pipeline);
- `.atlas`;
- atlas textures;
- named animations matching `ANIMATION_BIBLE.md`;
- named events/markers;
- slot/skin naming conventions;
- origin/pivot/reference scale;
- fallback idle/static pose;
- export settings documented.

Animation Director validates runtime compatibility before production rig is considered accepted.

## 7. Symbol design standard

Every symbol must:
- remain identifiable at mobile reel size;
- use silhouette/material hierarchy, not tiny text;
- remain readable under win glow/dimming;
- avoid relying solely on hue where possible;
- have consistent perspective and lighting;
- not look like nine unrelated AI generations.

Test as a complete board, not isolated asset sheets only.

## 8. UI art standard

Required controls stay legible and conventional enough to understand quickly.

Do not make essential controls decorative puzzles.

UI may be distinct from sample UI but must preserve:
- balance/play amount/win readability;
- primary play/spin affordance;
- mode selection clarity;
- mute;
- rules/info;
- confirmation dialogs;
- Replay controls;
- touch-target and Popout needs.

## 9. Static build / path requirements

- all runtime asset paths are repo-relative/build-safe;
- no developer-machine absolute paths;
- no runtime web font/CDN image fetches outside the allowed Stake environment;
- final extracted frontend is scanned for broken asset URLs and unexpected external origins;
- asset filenames are stable and collision-safe;
- stale/superseded final assets are excluded from upload package.

## 10. Texture / bundle optimization

Rules:
- atlas related small textures;
- avoid giant transparent margins;
- size textures to actual maximum display needs plus reasonable headroom;
- use suitable modern compressed web image formats when compatible with target/browser requirements;
- do not ship raw PSD/Spine source/high-resolution concept files in frontend package;
- bonus-only assets may lazy-load only if feature entry cannot visibly hitch and restore/replay remain safe;
- measure bundle and first-interactive behaviour.

## 11. Audio production

Audio should reinforce state without becoming noisy.

Requirements:
- one mute control disables all game-owned sound/music;
- no audio starts outside browser policy constraints;
- resume/tab visibility does not create stacked duplicate music;
- turbo avoids machine-gun layering from unbounded SFX;
- important events have priority/ducking strategy;
- Replay respects sound setting;
- old mobile target is tested for audio lag/quality.

## 12. Asset acceptance review

A production asset group is accepted only after:
- manifest completeness;
- originality/provenance check;
- desktop composition check;
- portrait/mobile check;
- Popout impact check where relevant;
- extracted-build path/load check;
- performance/bundle review;
- Creative Director consistency review.

## 13. Forbidden final-state shortcuts

Do not ship:
- placeholder SVG wireframes;
- emoji icons;
- CSS gradients pretending to be production art;
- debug labels;
- generated image with obvious anatomy/perspective/text artifacts;
- mismatched photoreal + cartoon + flat-icon styles;
- oversized MP4 intro used as a substitute for integrated presentation unless explicitly approved and performance-tested;
- externally hosted fonts/assets.
