# Renders the app icons from the in-game hen (run: tools/make-icons.sh). Writes icon.png (512, full square),
# icon_fg.png (432, adaptive foreground, art inside the 66% safe zone, transparent) and icon_bg.png (432).
extends Node2D

const Hen = preload("res://scripts/hen.gd")
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
		var zone = s.x * (0.6 if mode == "fg" else 0.86)
		var h = Hen.new()
		h.H = zone * 0.78
		h.position = Vector2(s.x * 0.47, s.y * 0.5 + zone * 0.42)
		h.set_mood("idle")
		add_child(h)
		var egg = Node2D.new()
		egg.position = Vector2(s.x * 0.5 + zone * 0.36, s.y * 0.5 + zone * 0.32)
		egg.draw.connect(func():
			var pts = G.egg(28, zone * 0.34)
			G.shape(egg, pts, Color("fffaf0"), G.LINE, zone * 0.012))
		add_child(egg)

func _draw() -> void:
	if mode == "fg":
		return
	var s = get_viewport_rect().size
	draw_polygon(PackedVector2Array([Vector2.ZERO, Vector2(s.x, 0), s, Vector2(0, s.y)]),
		PackedColorArray([Color("ffd85e"), Color("ffc24a"), Color("e8742a"), Color("f59a36")]))
	draw_circle(s * Vector2(0.5, 0.42), s.x * 0.36, Color(1, 0.95, 0.7, 0.35))

func _process(_dt: float) -> void:
	frames += 1
	if frames == 6:
		var img = get_viewport().get_texture().get_image()
		var out = {"icon": "res://icon.png", "fg": "res://icon_fg.png", "bg": "res://icon_bg.png"}[mode]
		img.save_png(ProjectSettings.globalize_path(out))
		get_tree().quit()
