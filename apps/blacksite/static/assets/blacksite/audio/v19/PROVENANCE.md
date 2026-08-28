# BLACKSITE V19 audio provenance

All three runtime files in this directory come from **Dark Sci-Fi Audio Pack** by SRG774:

- Source: https://opengameart.org/content/dark-sci-fi-audio-pack
- License: Creative Commons CC0 1.0 Universal
- License deed: https://creativecommons.org/publicdomain/zero/1.0/
- Attribution: not required. The source author states that credit to SRG774 or a link to the pack is appreciated.
- Redistribution: permitted by CC0, including copying, modifying and distributing the work for commercial purposes.
- Downloaded: 2026-08-12 from the direct OpenGameArt file links listed below.

| Runtime file | Upstream file | Runtime role | SHA-256 |
| --- | --- | --- | --- |
| `base-ambience.mp3` | `sector.mp3` | Low-profile base-game ambience, started after the first Spin user gesture | `4f5e7f035dad8ce32d8c04393ec11470da52383dce0ffd421220c2de0ee2bf5d` |
| `vault-anticipation.mp3` | `urgent.mp3` | Shared Vault anticipation, BLACKOUT transition and free-spin bed | `4aba1f1a01f328e0337a3764eb89d8d69e13ea2a86929840c787f4d736565b82` |
| `free-spins-award.mp3` | `victory.mp3` | Award, win and extraction sting | `208916af7b2b26ee70171a964595ace1ccaf4534abfbfa816d340179e13fe289` |

The files are retained in the upstream MP3 encoding. No transcoder was available in the workspace, so this pass avoided a lossy re-encode. UI and reel transients remain lightweight Web Audio synthesis. Runtime playback uses package-local URLs only; there are no third-party runtime requests.
