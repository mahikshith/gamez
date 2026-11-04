#!/bin/sh
# Renders the launcher icons from the game's own hen. Needs a display (xvfb-run on a server).
cd "$(dirname "$0")/.." || exit 1
GD=${GODOT:-godot}
xvfb-run -a "$GD" --rendering-driver opengl3 --resolution 512x512 res://tools/icon_maker.tscn -- icon
xvfb-run -a "$GD" --rendering-driver opengl3 --resolution 432x432 res://tools/icon_maker.tscn -- fg
xvfb-run -a "$GD" --rendering-driver opengl3 --resolution 432x432 res://tools/icon_maker.tscn -- bg
