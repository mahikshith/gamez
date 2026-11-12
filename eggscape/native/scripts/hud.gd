# Top bar, in three pieces with a clear order of importance: the egg rack in the middle (one socket per egg: it
# fills with a pop when that egg is home, shows a broken shell when one is lost, and a flag marks how many the level
# needs), the fuse timer on the right (red and pulsing in the last 15 s, purple under a curse), and a round restart
# button on the left. Sits below the phone's status bar / notch (safe area).
extends Control

const G = preload("res://scripts/g.gd")
const UI = preload("res://scripts/ui_kit.gd")
signal restart

var title = ""
var n_eggs = 3
var target = 2
var saved = 0
var broken = 0
var pop = 0.0
var shake = 0.0
var time_limit = 0.0
var time_left = 0.0
var cursed = false
var _in = 0.0

func _init() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_PASS

func _top() -> float:
	return UI.safe_top() + 20.0

func _process(dt: float) -> void:
	pop = maxf(0.0, pop - dt * 2.5)
	shake = maxf(0.0, shake - dt * 3.0)
	_in = minf(1.0, _in + dt * 2.5)
	queue_redraw()

func _btn_rect() -> Rect2:
	return Rect2(20, _top(), 72, 72)

func _gui_input(ev: InputEvent) -> void:
	if ev is InputEventScreenTouch and ev.pressed and _btn_rect().grow(10).has_point(ev.position):
		Sfx.play("grab")
		Sfx.buzz(10, 0.3)
		restart.emit()
		accept_event()

func _has_point(p: Vector2) -> bool:
	return _btn_rect().grow(10).has_point(p)

func _draw() -> void:
	var W = get_viewport_rect().size.x
	var slide = (1.0 - (1.0 - pow(1.0 - _in, 3.0))) * -140.0
	draw_set_transform(Vector2(0, slide))
	var y = _top()
	# restart: a round blue slab with a white arrow
	var r = _btn_rect()
	UI.slab(self, Rect2(r.position, Vector2(r.size.x, r.size.y - 2)), UI.BLUE, 36.0, 6.0)
	var c = r.get_center() + Vector2(0, -4)
	for pass_i in 2:
		var col = Color("0B4F7A") if pass_i == 0 else Color.WHITE
		var wd = 13.0 if pass_i == 0 else 7.0
		draw_arc(c, 15, -PI * 0.15, PI * 1.45, 24, col, wd, true)
		var tip = c + Vector2.from_angle(-PI * 0.15) * 15
		var g = 3.0 if pass_i == 0 else 0.0
		draw_colored_polygon(PackedVector2Array([tip + Vector2(-10 - g, -8 - g), tip + Vector2(10 + g, -6 - g * 0.5), tip + Vector2(1, 10 + g)]), col)
	# timer pill (right)
	var right = W - 20.0
	if time_limit > 0.0:
		var secs = int(ceil(time_left))
		var low = time_left <= 15.0
		var pk = 1.0 + (0.07 * absf(sin(Time.get_ticks_msec() / 160.0)) if low else 0.0)
		var tr = Rect2(W - 20.0 - 150.0, y + 8, 150.0, 56.0)
		right = tr.position.x - 14.0
		draw_set_transform(Vector2(tr.get_center().x, tr.get_center().y + slide), 0.0, Vector2(pk, pk))
		var tr0 = Rect2(-tr.size / 2, tr.size)
		UI.pill(self, tr0, Color("FFE1DC") if low else (Color("EBDDFF") if cursed else UI.CREAM))
		var tc = UI.RED if low else (Color("7A3FC7") if cursed else UI.INK)
		UI.icon(self, "clock", tr0.position + Vector2(30, 26), 32.0, tc)
		UI.text(self, Vector2(tr0.position.x + 98, 9), "%d:%02d" % [secs / 60, secs % 60], 32, tc)
		draw_set_transform(Vector2(0, slide))
	# egg rack (centre): navy tray with a socket per egg
	var left = r.end.x + 14.0
	var half = minf(W / 2.0 - left, right - W / 2.0)
	var slot = minf(58.0, (half * 2.0 - 36.0) / maxf(1.0, n_eggs))
	var rw = slot * n_eggs + 36.0
	var rack = Rect2(W / 2.0 - rw / 2.0 + sin(shake * 40.0) * 6.0 * shake, y + 2, rw, 68.0)
	UI.rounded(self, Rect2(rack.position + Vector2(0, 7), rack.size).grow(3), Color(0.05, 0.03, 0.02, 0.28), 37)
	UI.rounded(self, rack.grow(3), Color("0C1F33"), 37)
	UI.rounded(self, rack, Color("1D4468"), 34)
	UI.rounded(self, Rect2(rack.position + Vector2(0, 5), rack.size - Vector2(0, 5)), Color("28587F"), 34)
	UI.rounded(self, Rect2(rack.position + Vector2(24, 4), Vector2(rack.size.x - 48, 3)), Color(1, 1, 1, 0.25), 2)
	for i in n_eggs:
		var ec = Vector2(rack.position.x + 18.0 + slot * (i + 0.5), rack.get_center().y + 3)
		var s = slot * 0.74
		draw_colored_polygon(G.ellipse(ec, s * 0.42, s * 0.52, 20), Color("10283F"))
		draw_colored_polygon(G.ellipse(ec + Vector2(0, 2), s * 0.37, s * 0.46, 20), Color("17385A"))
		if i < saved:
			var k = 1.0 + (pop * 0.45 if i == saved - 1 else 0.0)
			UI.icon(self, "egg", ec + Vector2(0, -1), s * k, UI.BRAND)
			if i == saved - 1 and pop > 0.0:
				for q in 6:
					draw_circle(ec + Vector2.from_angle(TAU * q / 6.0 + 0.3) * s * (0.6 + 0.5 * (1.0 - pop)), 3.5 * pop, Color("FFF2A0"))
		elif i >= n_eggs - broken:
			UI.icon(self, "broken", ec, s, UI.RED)
	# target flag: stands after the last egg the level needs
	if target < n_eggs:
		var fx = rack.position.x + 18.0 + slot * target
		var ok = saved >= target
		var fy = rack.end.y - 4.0
		draw_line(Vector2(fx, fy - 2), Vector2(fx, fy + 22), Color("0C1F33"), 7.0, true)
		draw_line(Vector2(fx, fy - 2), Vector2(fx, fy + 22), Color.WHITE, 3.0, true)
		var fl = PackedVector2Array([Vector2(fx, fy + 22), Vector2(fx + 22, fy + 15), Vector2(fx, fy + 8)])
		draw_colored_polygon(fl, UI.GREEN if ok else UI.RED)
		draw_polyline(G.closed(fl), Color("0C1F33"), 2.5, true)
	draw_set_transform(Vector2.ZERO)
