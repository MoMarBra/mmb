# BBE 1.6.0 audio additions

42 original fictional German consulting-comedy lines, rendered locally with Microsoft Windows speech synthesis (Stefan, Katja, Hedda). These are bundled synthetic voices, not human studio actors or imitations of real people. Speech is filtered, compressed, loudness-normalized, peak-limited and MP3-encoded. The former intro narration remains archived in the catalog but is not requested or played by the intro.

## Recorded nonverbal impact vocals
- HaelDB — Male Grunt/Yelling sounds. CC0-1.0, selected from the author's offered licenses. https://opengameart.org/content/male-gruntyelling-sounds . Used files: 3grunt3.wav, 1yell2.wav, 2yell3.wav, 3yell4.wav. Runtime IDs v160_impact_yell_01 through 04.
- AuraVoice / Nocturnal_Vanguard — Female Scream 1. CC0-1.0. https://opengameart.org/content/female-scream-1 . Used file: female_scream_1.ogg. Runtime IDs v160_impact_yell_05 and 06.
- License: https://creativecommons.org/publicdomain/zero/1.0/ . Sources verified on 2026-09-15. Recordings are trimmed to brief nonverbal reactions, converted to mono, filtered and mastered with gentle onset/tail fades. Variant 06 also uses 0.92x rate variation.

## Effects
Kenney — Impact Sounds, CC0-1.0. https://kenney.nl/assets/impact-sounds . Metal, glass and wood foley is layered into original synthesized explosion and glass-stein effects. The bundled after-hours-credits.json records sources, modifications and file hashes.

All remaining fire, liquid, pressure-wave and debris layers were newly designed with deterministic synthesis. They are designed effects, not claimed as field recordings. Fire loops have matched boundaries; individual collisions and explosions are spatializable mono assets.

## User-supplied music
The user supplied `ton.mp3` on 2026-09-15 for the revised intro. Runtime ID `intro_theme_1_6_1`. The bundled MP3 is byte-identical to the supplied file. The game applies playback gain and a brief fade-in; the audio has not been re-encoded. This replaces the previous intro music.

## Runtime manifest

The game includes 57 runtime additions. See after-hours-credits.json for per-file attribution and SHA-256 hashes. No raw recordings or duplicate originals are included.

## Intro-Update 1.6.1

Die Intro-Musik wurde durch die am 15.09.2026 bereitgestellte `ton.mp3` ersetzt. `intro_theme_1_6_1.mp3` ist eine bytegleiche Kopie. Keine Nachcodierung, keine Intro-Sprecherstimmen. Prüfsumme: `777da4b639052dfb0a6bf144878c235b1de5e6924135f621fbd2c9899ac01dee`. Der frühere Intro-Musiktrack ist nicht mehr im Spielpaket enthalten.

## User-supplied title music · 1.6.7

The user supplied `menu.mp3` on 2026-09-15. Runtime ID `title_menu_1_6_7`. The bundled file is byte-identical; SHA-256 `1b9582ac5db8ce3a12f9acf2ce8033fbf986899873f6df6b6784d98159756658`. Decoded duration is approximately 138.182 seconds. Playback is very quiet and uses a 0.20–136.90 second loop range to omit the baked trailing silence. The complete preceding intro score is retained through the title screen, with the menu source scheduled after the score ends. No audio re-encoding or early crossfade from the intro.
