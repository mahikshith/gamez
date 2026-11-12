# Renders the app icons from the game's hen, facing the player (run: tools/make-icons.sh). Writes icon.png (512, full square),
# icon_fg.png (432, adaptive foreground, art inside the 66% safe zone, transparent) and icon_bg.png (432).
extends Node2D

const Hen = preload("res://scripts/mama.gd")
const G = preload("res://scripts/g.gd")
var mode := "icon"
var frames := 0

func _ready() -> void:
	var ua = OS.get_cmdline_user_args()
	if ua.size() > 0:
		mode = ua[0]
	get_viewport().transparent_bg = mode == "fg"
	var s = get_viewport_rect().size
	if mode != "bg":
		var zone = s.x * (0.6 if mode == "fg" else 0.82)
		var h = Hen.new()
		h.H = zone * 1.05
		h.position = Vector2(s.x * 0.5, s.y * 0.5 + zone * 0.62)
		h.role = "front"
		h.shadow = 0.0
		add_child(h)
		h.set_mood("idle")

func _draw() -> void:
	if mode == "fg":
		return
	var s = get_viewport_rect().size
	draw_polygon(PackedVector2Array([Vector2.ZERO, Vector2(s.x, 0), s, Vector2(0, s.y)]),
		PackedColorArray([Color("8AD8FF"), Color("8AD8FF"), Color("3FA9E8"), Color("3FA9E8")]))
	draw_circle(s * Vector2(0.5, 0.46), s.x * 0.4, Color(1, 1, 1, 0.16))

func _process(_dt: float) -> void:
	frames += 1
	if frames == 6:
		var img = get_viewport().get_texture().get_image()
		var out = {"icon": "res://icon.png", "fg": "res://icon_fg.png", "bg": "res://icon_bg.png"}[mode]
		img.save_png(ProjectSettings.globalize_path(out))
		get_tree().quit()
