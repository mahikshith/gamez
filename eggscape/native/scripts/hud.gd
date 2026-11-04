# Top bar: level pill on the left, egg tally in the middle (saved = gold, broken = cracked grey, target line),
# restart button on the right. Kept clear of the phone's notch via the safe area.
extends Control

const G = preload("res://scripts/g.gd")
signal restart

var font: Font
var title = ""
var n_eggs = 3
var target = 2
var saved = 0
var broken = 0
var pop = 0.0
var top = 24.0

func _init() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_PASS

func _ready() -> void:
	var safe = DisplayServer.get_display_safe_area()
	var win = DisplayServer.window_get_size()
	if win.y > 0 and safe.position.y > 0:
		top = 24.0 + safe.position.y * get_viewport_rect().size.y / win.y

func _process(dt: float) -> void:
	pop = maxf(0.0, pop - dt * 3.0)
	queue_redraw()

func _btn_rect() -> Rect2:
	var W = get_viewport_rect().size.x
	return Rect2(W - 96, top, 72, 72)

func _gui_input(ev: InputEvent) -> void:
	if ev is InputEventScreenTouch and ev.pressed and _btn_rect().has_point(ev.position):
		Sfx.play("grab")
		restart.emit()
		accept_event()

func _has_point(p: Vector2) -> bool:
	return _btn_rect().has_point(p)

func _draw() -> void:
	var W = get_viewport_rect().size.x
	# level pill
	var pill = Rect2(20, top + 6, 236, 60)
	_round(pill, Color(0.18, 0.1, 0.04, 0.55))
	draw_string(font, Vector2(38, top + 47), title, HORIZONTAL_ALIGNMENT_LEFT, 210, 30, Color.WHITE)
	# eggs
	var x0 = W / 2 - (n_eggs - 1) * 26.0 + 30.0
	for i in n_eggs:
		var c = Vector2(x0 + i * 52.0, top + 36)
		var s = 1.0 + (pop * 0.3 if i == saved - 1 else 0.0)
		var pts = G.egg(20, 70.0 * s)
		for k in pts.size():
			pts[k] += c
		var fill = Color("fffaf0")
		var line = Color("6b4a2a")
		if i < saved:
			fill = Color("ffd23a")
			line = Color("9a6400")
		elif i >= n_eggs - broken:
			fill = Color(0.55, 0.5, 0.45, 0.7)
		else:
			fill.a = 0.85
		G.shape(self, pts, fill, line, 3.0)
		if i >= n_eggs - broken and i >= saved:
			draw_polyline(PackedVector2Array([c + Vector2(-8, -6), c + Vector2(-1, 1), c + Vector2(-5, 5), c + Vector2(6, 12)]), Color("3a2a1a"), 2.5, true)
		if i == target - 1 and target < n_eggs:
			draw_line(c + Vector2(26, -22), c + Vector2(26, 22), Color(1, 1, 1, 0.7), 3.0, true)
	# restart
	var r = _btn_rect()
	var c = r.get_center()
	draw_circle(c + Vector2(0, 4), 34, Color(0.1, 0.05, 0.0, 0.35))
	draw_circle(c, 34, Color("ffffff"))
	draw_circle(c, 34, Color("6b4a2a"), false, 3.0, true)
	draw_arc(c, 16, -PI * 0.15, PI * 1.45, 24, Color("6b4a2a"), 6.0, true)
	var tip = c + Vector2.from_angle(-PI * 0.15) * 16
	draw_colored_polygon(PackedVector2Array([tip + Vector2(-10, -6), tip + Vector2(8, -4), tip + Vector2(0, 10)]), Color("6b4a2a"))

func _round(r: Rect2, col: Color) -> void:
	var sb = StyleBoxFlat.new()
	sb.bg_color = col
	sb.set_corner_radius_all(int(r.size.y / 2))
	sb.anti_aliasing = true
	draw_style_box(sb, r)
