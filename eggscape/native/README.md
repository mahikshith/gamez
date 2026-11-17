# Eggscape native app (Godot 4)

The mobile version of Eggscape: a native Godot 4.5 game, not a wrapper around the web build. Plan and app-loop
design: the "Eggscape native app plan" doc in the project.

Status: 0.5, World 1 (5 levels) as the production-quality slice. Rings are lit, bevelled bars drawn by a shader
(`shaders/ring.gdshader`), the vault sits on a shader back plate, eggs have form, squash and faces, particles are GPU
particles with baked textures (`assets/fx`, `tools/make-fx.py`), the backdrop is a parallax farm that follows the
camera, and the camera has an intro crane, damped follow, push-in on the nest, punch, hit-stop and trauma shake
(`scripts/cam_rig.gd`). UI kit in `scripts/ui_kit.gd` (Lilita One display face). Glow is done with additive light
pools, not WorldEnvironment glow (that washed out the whole frame under the mobile renderer).

## Layout
- `scripts/main.gd` app flow, camera, hen reactions. `vault.gd` physics level and rules. `egg.gd` egg body,
  impact measuring, face. `hen.gd` the mascot rig. `celebrate.gd` win/fail stage. `hud.gd`, `backdrop.gd`,
  `ring_art.gd`, `ground_art.gd`, `orb.gd`, `iris.gd`, `hint.gd`, `sfx.gd` (autoload `Sfx`), `bot.gd` (soak test).
- `cam_rig.gd` level camera, `fx.gd` particle effects, `shaders/` ring, plate and vignette shaders.
- Debug args also: `--reduce-motion` (no shake, punch, hit-stop or intro), `--bot N --botfx` (bot with camera effects on).
- `data/levels.json` comes from the web game: `node tools/export-levels.mjs` in `eggscape/`. Do not hand-edit.

## Run, test, build (Godot 4.5.1 binary as `$GD`)
- Play: `$GD --path .` (debug args after `--`: `--level 1`, `--henlab`, `--autowin`).
- Physics soak: `$GD --headless --fixed-fps 60 --quit-after 7200 -- --level 1 --bot 3` prints saves, breaks,
  frames with an egg inside a ring wall away from a gap (`tunnel_frames`, must be 0) and peak speed.
- Screens: `xvfb-run -a $GD --rendering-driver opengl3 --resolution 720x1280 --write-movie out/f.png --fixed-fps 30 --quit-after 150 -- --level 1 --autowin`
- Icons: `GODOT=$GD tools/make-icons.sh` (renders them from the in-game hen).
- APK: needs Android SDK (platform-tools, build-tools 35), JDK 17+, the 4.5.1 Android export templates and a
  debug keystore set in editor settings. Then `$GD --headless --export-debug Android build/eggscape-debug.apk`.
