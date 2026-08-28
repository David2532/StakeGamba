# BLACKSITE // BREACH — Kling boot-intro production record

Status: **NOT_GENERATED**
Checked: **2026-08-22**

The Kling MCP OAuth connection is valid and exposes Kling VIDEO 3.0, but the
connected Free account reported **0.0 available credits**. No paid generation
request was submitted, no candidate exists, and there is no generation ID,
seed, or downloadable video to record.

The game must therefore use the V30 poster fallback contract until a real,
watermark-free candidate is generated and approved. The runtime contract is:

- `apps/blacksite/static/assets/blacksite/v30/intro/blacksite-intro-manifest.json`
- desktop fallback: `assets/blacksite/v28/environment/blackout-interior-desktop.webp`
- portrait fallback: `assets/blacksite/v28/environment/blackout-interior-portrait.webp`
- short-landscape fallback: `assets/blacksite/v28/environment/blackout-interior-short-landscape.webp`
- end-frame references: the matching V28 Base environment plates

The existing V26 Vault film is a separate feature cinematic. It remains
untouched and must not be presented as the requested boot intro.

## Production status and reproducibility boundary

| Item | Recorded value |
| --- | --- |
| Provider | Kling AI through the authorized MCP connection |
| Requested model | Kling VIDEO 3.0 |
| Requested mode | Professional |
| Model currently exposed | `kling-video-v3_0` |
| Current resolution exposed by the connected account | 720p |
| Requested duration | 10–12 seconds, never more than 15 seconds |
| Requested candidates | 3 |
| Submitted candidates | 0 |
| Blocker | Free account, 0.0 available credits |
| Runtime video status | Not shipped; poster fallback only |

Kling's current MCP schema does not expose a seed parameter for this model.
Reproducibility must therefore record the exact prompt, model, arguments,
uploaded reference hashes, returned generation IDs, download hashes, and
transcode commands for each future candidate. A seed must be recorded only if
Kling actually returns one; it must never be invented.

## Master prompt

```text
Create a premium cinematic AAA game intro for an original dark tactical casino slot titled “BlackSite Breach”. A secret underground military vault facility at night, photorealistic high-end game cinematic, grounded industrial production design, wet black concrete, brushed gunmetal, reinforced blast doors, subtle condensation, sparse red emergency lights, cold cyan security illumination and warm golden vault light. Controlled cinematic motion, realistic scale, physically plausible materials, volumetric haze, restrained anamorphic lens bloom, deep blacks with preserved shadow detail, subtle film grain, sharp subject detail, 4K-quality composition.

Shot 1: exterior establishing shot of an isolated fortified blacksite during heavy night rain, low clouds and thin ground fog. The camera performs a slow stabilized dolly push toward the sealed entrance. Security lights activate in sequence. No people, no text, no logos.

Shot 2: seamless transition into a narrow underground security corridor. The camera performs a smooth low tracking movement forward. Red warning lights pulse gradually along the corridor, condensation drifts from metal pipes, tiny dust particles move through the light. The movement remains controlled and deliberate, never shaky.

Shot 3: reveal a gigantic circular high-security vault door directly ahead. Mechanical locking bars retract one after another with realistic heavy movement. Short controlled sparks, falling dust and a compressed pressure wave. A narrow line of intense warm gold light appears around the door. The camera slowly pushes closer while the machinery unlocks.

Shot 4: the vault door rotates open with immense weight. Golden light expands into the corridor. The camera accelerates smoothly through the circular doorway, passes through a brief full-frame golden flare, then decelerates and settles into a perfectly centered frontal view inside a dark fortified vault chamber. The final composition must be symmetrical, stable and suitable as the background transition into a slot-game interface. Hold the final frame briefly. No written words anywhere in the video.

Cinematic sound direction: distant rain and low industrial ambience, secure electronic activation tones, deep metallic locking impacts, servo motors, a restrained alarm pulse that builds gradually, one powerful sub-bass breach impact, heavy vault-door movement, then a short low-frequency resolve. No dialogue, no vocals, no trailer voice, no generic heroic music.
```

## Negative prompt

```text
text, letters, subtitles, captions, logos, watermark, Stake branding, casino branding, distorted symbols, random UI, deformed humans, extra limbs, malformed hands, inconsistent character, cartoon style, anime style, cheap cyberpunk, excessive neon, rainbow colors, excessive glitch, constant camera shake, whip pan, fisheye lens, unstable geometry, melting metal, rubber-like vault door, floating objects, unrealistic explosion, giant fireball, oversaturated orange, crushed shadows, low resolution, blurry details, flicker, frame warping, temporal inconsistency, abrupt cut, random scene change, duplicate doors, changing architecture
```

## Requested Kling settings

- Modell: Kling VIDEO 3.0
- Modus: Professional
- Dauer: 10–12 Sekunden, maximal 15 Sekunden
- Seitenverhältnis: 16:9
- Ausgabe: höchste verfügbare Auflösung, bevorzugt natives 4K oder mindestens 1080p
- Framerate: 30 FPS
- Multi-Shot: aktiviert
- Native Audio: aktiviert, sofern zuverlässig
- Prompt Adherence: hoch
- Creativity: mittel
- Camera Motion: kontrolliert
- Start Frame: vorhandenes BlackSite-Key-Art, falls geeignet
- End Frame: aus der realen Slot-Ansicht abgeleitetes UI-freies Hintergrundbild
- Character Reference: nur verwenden, wenn ein sauberes Referenzasset existiert
- Seed und vollständige Einstellungen dokumentieren

The currently connected account exposes only 720p for Kling VIDEO 3.0. That is
the highest callable resolution in the audited session; the requested
Professional/1080p-or-higher output cannot be claimed until the account makes
that value available.

## Exact shot plan

| Time | Shot | Required picture and motion | Audio direction | Transition requirement |
| ---: | --- | --- | --- | --- |
| 0.0–2.5 s | Establishing | Rain-wet fortified blacksite exterior at night; slow stabilized push-in; sequential security lights; no people or marks | Rain, low industrial bed, restrained secure-link activation | Continuous forward intent, no hard cut |
| 2.5–5.0 s | Infiltration | Low controlled track through a secured corridor; red warnings wake in sequence; pipes, condensation, haze and dust | Alarm pulse rises gradually; electronic activation details | Architecture and camera axis remain stable |
| 5.0–8.5 s | Breach | One massive circular vault, frontally readable; locks retract in order; restrained sparks and dust; gold seam appears | Heavy locks, servo movement, pressure release, one sub impact | Door stays rigid and attached; no morphing or fireball |
| 8.5–12.0 s | Reveal / handoff | Door rotates open with weight; camera passes through gold flare and settles on a centered dark chamber; hold the final frame | Door mass, gold reveal, short low-frequency resolve | Final pose must visually accept the real slot UI within 400–700 ms |

## Reference-frame plan

There is currently no production-approved exterior start frame in the runtime
asset set. Do not mislabel an interior or the separate V26 feature film as that
shot. When credits are available:

1. Generate or approve one original 16:9 exterior start frame from the first
   shot direction, with no text, people, logo, or watermark.
2. Retain the exact source bytes and SHA-256 under the future V30 authoring
   package before uploading them to Kling.
3. Use the existing UI-free Base plate as the end-composition reference:
   `apps/blacksite/static/assets/blacksite/v28/environment/base-desktop.webp`.
4. For responsive review, use the existing portrait and short-landscape Base
   plates as composition references; do not bake game UI or text into video.

## Kling call plan after credits are available

1. Call `who_am_i` again and record the then-current model and allowed values.
2. Call `query_membership_and_credits`; do not submit unless sufficient credits
   are reported.
3. Upload the approved start frame and the V28 desktop end-frame reference with
   Kling's `file_upload` tool.
4. Submit three separate `image_to_video` requests using the same task trace,
   model `kling-video-v3_0`, duration `12`, resolution `720p` unless a higher
   allowed value is returned, `prefer_multi_shots=true`, and native audio only
   if the current model reliably supports it.
5. Record all three generation IDs and wait for each exact task result. Never
   auto-resubmit a failed charged request.
6. Score each candidate for geometry consistency, controlled camera movement,
   physically plausible door mechanics, absence of text/watermarks/artifacts,
   stable final-frame registration, and mobile crop safety.
7. Promote only the winning candidate after human creative, originality,
   rights, audio, desktop, mobile, and extracted-build review.

## Candidate ledger

| Candidate | Generation ID | Model / arguments | Result hash | Review status | Notes |
| --- | --- | --- | --- | --- | --- |
| 01 | — | Not submitted | — | NOT_GENERATED | 0 credits |
| 02 | — | Not submitted | — | NOT_GENERATED | 0 credits |
| 03 | — | Not submitted | — | NOT_GENERATED | 0 credits |

## Runtime promotion targets

The following names are reservations, not existing files:

- `apps/blacksite/static/assets/blacksite/v30/intro/blacksite-intro-desktop.webm`
- `apps/blacksite/static/assets/blacksite/v30/intro/blacksite-intro-desktop.mp4`
- `apps/blacksite/static/assets/blacksite/v30/intro/blacksite-intro-mobile.webm`
- `apps/blacksite/static/assets/blacksite/v30/intro/blacksite-intro-mobile.mp4`

All four remain `available: false` in the runtime manifest. The application
must not request them while `videoAvailable` is false.

## Reproducible transcode plan

Run from the repository root with a reviewed, watermark-free selected source.
The final bitrate/CRF may be tightened only after decoded visual QA, and the
combined future V30 video bytes must remain within the manifest's 4 MiB budget.

```powershell
ffmpeg -i selected-kling-source.mp4 -an -vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=30" -c:v libx264 -profile:v high -level 4.0 -pix_fmt yuv420p -crf 24 -maxrate 1800k -bufsize 3600k -movflags +faststart apps/blacksite/static/assets/blacksite/v30/intro/blacksite-intro-desktop.mp4

ffmpeg -i selected-kling-source.mp4 -an -vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=30" -c:v libvpx-vp9 -pix_fmt yuv420p -crf 35 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 apps/blacksite/static/assets/blacksite/v30/intro/blacksite-intro-desktop.webm

ffmpeg -i selected-kling-source.mp4 -an -vf "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=720:1280:flags=lanczos,fps=30" -c:v libx264 -profile:v high -level 4.0 -pix_fmt yuv420p -crf 25 -maxrate 1200k -bufsize 2400k -movflags +faststart apps/blacksite/static/assets/blacksite/v30/intro/blacksite-intro-mobile.mp4

ffmpeg -i selected-kling-source.mp4 -an -vf "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=720:1280:flags=lanczos,fps=30" -c:v libvpx-vp9 -pix_fmt yuv420p -crf 37 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 apps/blacksite/static/assets/blacksite/v30/intro/blacksite-intro-mobile.webm
```

After promotion, update the manifest with actual dimensions, duration, codec,
frame rate, audio-track state, bytes, SHA-256, generation ID, prompt hash,
reference hashes, chosen-candidate score, and rights-review status. Then add
only those exact files to the production pruner allowlist and rerun the full
asset, build, browser, reduced-motion, mobile, and package gates.
