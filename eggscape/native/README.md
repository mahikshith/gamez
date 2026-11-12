# Eggscape native app (Godot 4)

The mobile version of Eggscape: a native Godot 4.5 game, not a wrapper around the web build. Plan and app-loop
design: the "Eggscape native app plan" doc in the project.

Status: feel prototype. Level 1 (Sunny Farm) with rings, gaps, thorns, sponge pads, the flame orb, nest and ground;
Mama Hen rig with six moods; Duolingo-style win stage; fail stage; title screen; iris transitions; synthesized
sound; haptics.

## Layout
- `scripts/main.gd` app flow, camera, hen reactions. `vault.gd` physics level and rules. `egg.gd` egg body,
  impact measuring, face. `hen.gd` the mascot rig. `celebrate.gd` win/fail stage. `hud.gd`, `backdrop.gd`,
  `ring_art.gd`, `ground_art.gd`, `orb.gd`, `iris.gd`, `hint.gd`, `sfx.gd` (autoload `Sfx`), `bot.gd` (soak test).
- `data/levels.json` comes from the web game: `node tools/export-levels.mjs` in `eggscape/`. Do not hand-edit.

## Run, test, build (Godot 4.5.1 binary as `$GD`)
- Play: `$GD --path .` (debug args after `--`: `--level 1`, `--henlab`, `--autowin`).
- Physics soak: `$GD --headless --fixed-fps 60 --quit-after 7200 -- --level 1 --bot 3` prints saves, breaks,
  frames with an egg inside a ring wall away from a gap (`tunnel_frames`, must be 0) and peak speed.
- Screens: `xvfb-run -a $GD --rendering-driver opengl3 --resolution 720x1280 --write-movie out/f.png --fixed-fps 30 --quit-after 150 -- --level 1 --autowin`
- Icons: `GODOT=$GD tools/make-icons.sh` (renders them from the in-game hen).
- APK: needs Android SDK (platform-tools, build-tools 35), JDK 17+, the 4.5.1 Android export templates and a
  debug keystore set in editor settings. Then `$GD --headless --export-debug Android build/eggscape-debug.apk`.
