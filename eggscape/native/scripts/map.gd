# The farm map (saga path), the home screen between levels. A winding dirt road climbs the meadow with one chunky
# node per level: done (green, its stars above), current (brand orange, bigger, breathing, a START bubble, the hen
# standing beside it), locked (grey with a padlock). The boss level wears a red crown. World 2 waits behind a gate at
# the top. After a win the map opens with the hen hopping from the old node to the new one, which pops open.
# Tap an unlocked node or the big PLAY button to start a level.
extends Control

const G = preload("res://scripts/g.gd")
const UI = preload("res://scripts/ui_kit.gd")
const Hen = preload("res://scripts/mascot.gd")
signal play(index: int)

var levels: Array = []
var save: Dictionary = {}
var playable = 1
var from_level = -1 # set after a win: the hen hops from this node to the current one
var nodes = [] # [{c: Vector2, i: int}]
var current = 0
var t = 0.0
var pop = 0.0
var _hen
var _btn: Button
var _road = PackedVector2Array()
var _tap_ok = false

const WORLD := 5 # nodes on this map (World 1)

func _init() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP

func open() -> void:
	var sz = get_viewport_rect().size
	current = clampi(int(save.get("level", 1)), 1, playable) - 1
	var top = UI.safe_top() + 230.0
	var bottom = sz.y - UI.safe_bottom() - 210.0
	var step = (bottom - top) / float(WORLD - 1)
	nodes.clear()
	for i in WORLD:
		var y = bottom - step * i
		var x = sz.x / 2 + sin(i * 1.25 + 0.3) * sz.x * 0.24
		nodes.append({"c": Vector2(x, y), "i": i})
	# road: a smooth curve through every node, from below the screen to the gate at the top
	var ctrl = [Vector2(sz.x / 2, sz.y + 40)]
	for n in nodes:
		ctrl.append(n.c)
	ctrl.append(Vector2(sz.x / 2, top - 120))
	_road = PackedVector2Array()
	for k in ctrl.size() - 1:
		var p0 = ctrl[maxi(0, k - 1)]
		var p1 = ctrl[k]
		var p2 = ctrl[k + 1]
		var p3 = ctrl[mini(ctrl.size() - 1, k + 2)]
		for j in 16:
			var u = j / 16.0
			_road.append(0.5 * ((2.0 * p1) + (-p0 + p2) * u + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * u * u + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * u * u * u))
	_road.append(ctrl[-1])
	# the hen beside the current node (or the node she is hopping from)
	_hen = Hen.new()
	_hen.H = 118.0
	var start_i = from_level if from_level >= 0 and from_level < current else current
	_hen.position = _hen_spot(start_i)
	_hen.face = -1 if nodes[start_i].c.x > sz.x / 2 else 1
	add_child(_hen)
	_hen.set_mood("idle")
	# play button
	var lv: Dictionary = levels[current]
	_btn = UI.button(self, "PLAY  LEVEL %d" % int(lv.id), UI.GREEN, 32)
	_btn.size = Vector2(minf(520.0, sz.x - 64.0), 84)
	_btn.position = Vector2(sz.x / 2 - _btn.size.x / 2, sz.y - UI.safe_bottom() - 84 - 40)
	_btn.pivot_offset = _btn.size / 2
	_btn.pressed.connect(func(): _start(current))
	var br = create_tween().set_loops()
	br.tween_property(_btn, "scale", Vector2(1.03, 1.03), 0.7).set_trans(Tween.TRANS_SINE)
	br.tween_property(_btn, "scale", Vector2.ONE, 0.7).set_trans(Tween.TRANS_SINE)
	if start_i != current:
		_hop_to(current)
	else:
		_tap_ok = true

func _hen_spot(i: int) -> Vector2:
	var c: Vector2 = nodes[i].c
	var side = -1.0 if c.x > get_viewport_rect().size.x / 2 else 1.0
	return c + Vector2(side * 108.0, 30.0)

func _hop_to(i: int) -> void:
	# hen hops node to node along the road, then the new node pops open with a chime
	var tw = create_tween()
	tw.tween_interval(0.5)
	tw.tween_callback(func(): _hen.set_mood("happy"))
	var a = _hen.position
	var b = _hen_spot(i)
	tw.tween_method(func(u):
		_hen.position = a.lerp(b, u) + Vector2(0, -sin(u * PI) * 120.0)
		_hen.face = 1 if b.x > a.x else -1, 0.0, 1.0, 0.8).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.tween_callback(func():
		Sfx.play("fanfare", -6.0)
		Sfx.buzz(30, 0.6)
		pop = 1.0
		_hen.set_mood("cheer")
		_tap_ok = true)

func _start(i: int) -> void:
	if not _tap_ok or i > current:
		return
	_tap_ok = false
	Sfx.play("grab")
	Sfx.buzz(15, 0.4)
	_hen.set_mood("cheer")
	play.emit(i)

func _gui_input(ev: InputEvent) -> void:
	var pressed = (ev is InputEventScreenTouch and ev.pressed) or (ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT)
	if not pressed:
		return
	for n in nodes:
		if ev.position.distance_to(n.c) < 62.0:
			if n.i <= current:
				_start(n.i)
			else:
				Sfx.play("click", -6.0, 0.6)
				Sfx.buzz(8, 0.2)
			accept_event()
			return

func _process(dt: float) -> void:
	t += dt
	pop = maxf(0.0, pop - dt * 1.6)
	queue_redraw()

func _draw() -> void:
	var sz = get_viewport_rect().size
	var W = sz.x
	var H = sz.y
	# sky band and meadow with soft stripes, a few round trees and fences: flat farm
	draw_rect(Rect2(0, 0, W, H), Color("8FD46A"))
	for k in 9:
		var y0 = H * 0.08 + k * H * 0.11
		var pts = PackedVector2Array()
		for j in 21:
			var x = -20.0 + (W + 40.0) * j / 20.0
			pts.append(Vector2(x, y0 + sin(x * 0.012 + k * 1.7) * 18.0))
		pts.append(Vector2(W + 20, H + 10))
		pts.append(Vector2(-20, H + 10))
		draw_colored_polygon(pts, Color("86CC5B") if k % 2 == 0 else Color("8FD46A"))
	for tr in [[0.1, 0.30, 1.0], [0.88, 0.42, 1.2], [0.12, 0.62, 0.9], [0.9, 0.74, 1.1], [0.08, 0.88, 1.0], [0.86, 0.17, 0.9]]:
		var c = Vector2(W * tr[0], H * tr[1])
		var s: float = tr[2]
		draw_colored_polygon(G.ellipse(c + Vector2(0, 30 * s), 30 * s, 9 * s, 16), Color(0.1, 0.3, 0.1, 0.18))
		draw_rect(Rect2(c + Vector2(-5 * s, 4 * s), Vector2(10 * s, 26 * s)), Color("9A6334"))
		draw_circle(c, 30 * s, Color("4FA83A"))
		draw_circle(c + Vector2(-9 * s, -8 * s), 14 * s, Color("6DBE45"))
	# road: soft edge, sandy fill, dashed centre line
	draw_polyline(_road, Color("D9B47A"), 70.0, true)
	draw_polyline(_road, Color("F2D7A6"), 56.0, true)
	var acc = 0.0
	for k in _road.size() - 1:
		var a = _road[k]
		var b = _road[k + 1]
		acc += a.distance_to(b)
		if int(acc / 22.0) % 2 == 0:
			draw_line(a, b, Color("FFF3DC"), 6.0, true)
	# World 2 gate at the top of the road
	var gc = _road[_road.size() - 1] + Vector2(0, 40)
	UI.rounded(self, Rect2(gc + Vector2(-120, -46), Vector2(240, 70)), Color("6E5A4A"), 20)
	UI.rounded(self, Rect2(gc + Vector2(-120, -52), Vector2(240, 70)), Color("8C7462"), 20)
	_text("WORLD 2  ·  SOON", gc + Vector2(0, -6), 24, Color.WHITE)
	# header: world name pill and coins
	var top = UI.safe_top() + 20.0
	UI.rounded(self, Rect2(20, top, W - 40, 78), Color(1, 1, 1, 0.95), 26)
	_text("WORLD 1", Vector2(48, top + 34), 20, UI.MUTED, HORIZONTAL_ALIGNMENT_LEFT)
	_text("Sunny Farm", Vector2(48, top + 64), 32, UI.INK, HORIZONTAL_ALIGNMENT_LEFT)
	var coins = int(save.get("coins", 0))
	UI.icon(self, "coin", Vector2(W - 150, top + 39), 34.0, UI.GOLD)
	_text(str(coins), Vector2(W - 126, top + 50), 30, UI.INK, HORIZONTAL_ALIGNMENT_LEFT)
	# nodes
	var best: Dictionary = save.get("best", {})
	for n in nodes:
		var i: int = n.i
		var c: Vector2 = n.c
		var lv: Dictionary = levels[i]
		var boss = lv.has("boss")
		var done = best.has(str(int(lv.id))) and int(best[str(int(lv.id))]) > 0
		var cur = i == current
		var locked = i > current or i >= playable
		var R = 50.0 if cur else 42.0
		if cur:
			R *= 1.0 + 0.04 * sin(t * 4.0) + 0.25 * pop
			draw_circle(c, R + 16.0 + 6.0 * sin(t * 4.0), Color(1, 1, 1, 0.35))
		var col = Color("C9C2BA") if locked else (UI.BRAND if cur else UI.GREEN)
		draw_circle(c + Vector2(0, 9), R, col.darkened(0.25))
		draw_circle(c, R, col)
		draw_colored_polygon(G.ellipse(c + Vector2(-R * 0.3, -R * 0.42), R * 0.34, R * 0.16, 16, -0.4), Color(1, 1, 1, 0.35))
		if locked:
			# padlock
			UI.rounded(self, Rect2(c + Vector2(-15, -6), Vector2(30, 24)), Color("8C847C"), 6)
			draw_arc(c + Vector2(0, -6), 10.0, PI, TAU, 16, Color("8C847C"), 5.0, true)
		else:
			_text(str(int(lv.id)), c + Vector2(0, 14), 40 if cur else 34, Color.WHITE)
		if boss:
			var cr = c + Vector2(0, -R - 6)
			draw_colored_polygon(PackedVector2Array([cr + Vector2(-22, 8), cr + Vector2(-22, -10), cr + Vector2(-11, 0), cr + Vector2(0, -16), cr + Vector2(11, 0), cr + Vector2(22, -10), cr + Vector2(22, 8)]), UI.RED)
		if done and not cur:
			var st = int(best[str(int(lv.id))])
			for k in 3:
				var sp = c + Vector2((k - 1) * 26.0, -R - (22.0 if boss else 12.0) - (6.0 if k == 1 else 0.0))
				if k < st:
					UI.icon(self, "star", sp, 26.0, UI.GOLD)
				else:
					draw_colored_polygon(G.star(sp, 12.0, 6.0), Color(1, 1, 1, 0.6))
		if cur and _tap_ok:
			# START bubble
			var bc = c + Vector2(0, -R - 44 - 4.0 * sin(t * 4.0))
			UI.rounded(self, Rect2(bc + Vector2(-56, -22), Vector2(112, 44)), Color.WHITE, 16)
			draw_colored_polygon(PackedVector2Array([bc + Vector2(-9, 21), bc + Vector2(9, 21), bc + Vector2(0, 33)]), Color.WHITE)
			_text("START", bc + Vector2(0, 9), 24, UI.BRAND)

func _text(s: String, at: Vector2, size: int, col: Color, align := HORIZONTAL_ALIGNMENT_CENTER) -> void:
	var f = UI.font(900)
	var w = f.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
	var x = at.x - w / 2.0 if align == HORIZONTAL_ALIGNMENT_CENTER else at.x
	draw_string(f, Vector2(x, at.y), s, HORIZONTAL_ALIGNMENT_LEFT, -1, size, col)
