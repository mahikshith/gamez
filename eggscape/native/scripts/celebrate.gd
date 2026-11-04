# Level end page: a clean full-screen page over the game (nothing of the vault shows through), laid out in fixed
# zones so text, cards and the button can never overlap, on any phone shape:
#   mascot stage (top) | title + subtitle | stars | stat cards | big button (bottom, safe area aware)
# Win beat sheet (about 2.4 s, a tap skips to the end): page fades in -> hen jumps in and starts her celebration
# routine + fanfare + confetti -> title pops -> stars land one by one (rising chime, haptic tick, sparkle) ->
# cards rise and their numbers count up -> button rises and breathes.
# Fail: hen is sad, kind title, one card with the eggs saved, "Try again" plus a quiet "Back to the farm".
extends Control

const G = preload("res://scripts/g.gd")
const Hen = preload("res://scripts/mascot.gd")
const UI = preload("res://scripts/ui_kit.gd")
signal next_pressed
signal retry_pressed
signal home_pressed

var won = false
var n_stars = 0
var bg_a = 0.0
var glow = 0.0
var spin = 0.0
var star_k = [0.0, 0.0, 0.0]
var _tw: Tween
var _hen
var _title: Label
var _sub: Label
var _cards = []
var _btn: Button
var _btn2: Button
var _done = false
var Z = {} # layout zones (Rect2), see _layout()

func _init() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP

func _layout() -> void:
	var sz = get_viewport_rect().size
	var top = UI.safe_top() + 12.0
	var bottom = sz.y - UI.safe_bottom() - 24.0
	var W = minf(sz.x, 640.0)
	var x0 = (sz.x - W) / 2.0
	var btn_h = 76.0
	var gap = 18.0
	Z.button = Rect2(x0 + 24, bottom - btn_h - (64.0 if not won else 0.0), W - 48, btn_h)
	Z.button2 = Rect2(x0 + 24, bottom - 52.0, W - 48, 52.0)
	Z.cards = Rect2(x0 + 24, Z.button.position.y - gap * 2 - 118.0, W - 48, 118.0)
	Z.stars = Rect2(x0, Z.cards.position.y - gap - 120.0, W, 120.0) if won else Rect2(x0, Z.cards.position.y, W, 0.0)
	Z.sub = Rect2(x0 + 24, Z.stars.position.y - gap - 34.0, W - 48, 34.0)
	Z.title = Rect2(x0 + 24, Z.sub.position.y - 66.0, W - 48, 64.0)
	Z.stage = Rect2(x0, top, W, Z.title.position.y - top - gap)

func open(is_win: bool, stars: int, stats: Array, title: String, sub: String) -> void:
	won = is_win
	n_stars = stars
	_layout()
	var st: Rect2 = Z.stage
	_hen = Hen.new()
	_hen.H = clampf(st.size.y * 0.72, 150.0, 430.0)
	_hen.position = Vector2(st.get_center().x, st.end.y - 14.0)
	_hen.scale = Vector2.ZERO
	add_child(_hen)
	_hen.set_mood("celebrate" if won else "sad")
	_title = UI.label(self, title, 50, UI.BRAND if won else UI.RED, 900)
	_place(_title, Z.title)
	_title.pivot_offset = _title.size / 2
	_title.scale = Vector2.ZERO
	_sub = UI.label(self, sub, 22, UI.MUTED, 800)
	_place(_sub, Z.sub)
	_sub.modulate.a = 0.0
	var n = stats.size()
	var cw = (Z.cards.size.x - 14.0 * (n - 1)) / n
	var x = Z.cards.position.x + (Z.cards.size.x - (cw * n + 14.0 * (n - 1))) / 2.0
	for i in n:
		var c = UI.StatCard.new()
		c.label_text = stats[i][0]
		c.value_to = stats[i][1]
		c.fmt = stats[i][2]
		c.color = stats[i][3]
		c.icon = stats[i][4]
		c.position = Vector2(x + i * (cw + 14.0), Z.cards.position.y)
		c.size = Vector2(cw, Z.cards.size.y)
		c.modulate.a = 0.0
		add_child(c)
		_cards.append(c)
	_btn = UI.button(self, "CONTINUE" if won else "TRY AGAIN", UI.GREEN if won else UI.BRAND, 30)
	_place(_btn, Z.button)
	_btn.pivot_offset = _btn.size / 2
	_btn.scale = Vector2.ZERO
	_btn.pressed.connect(func():
		Sfx.play("grab")
		Sfx.buzz(15, 0.4)
		if won: next_pressed.emit()
		else: retry_pressed.emit())
	if not won:
		_btn2 = UI.flat_button(self, "BACK TO THE FARM", Color("1899D6"), 22)
		_place(_btn2, Z.button2)
		_btn2.modulate.a = 0.0
		_btn2.pressed.connect(func():
			Sfx.play("grab")
			home_pressed.emit())
	if won:
		_play_win()
	else:
		_play_fail()

func _place(c: Control, r: Rect2) -> void:
	c.position = r.position
	c.size = r.size

func _confetti(at: Vector2, dir: Vector2, n := 70) -> void:
	var ps = CPUParticles2D.new()
	ps.position = at
	ps.one_shot = true
	ps.explosiveness = 0.9
	ps.amount = n
	ps.lifetime = 2.6
	ps.direction = dir
	ps.spread = 30.0
	ps.initial_velocity_min = 650.0
	ps.initial_velocity_max = 1150.0
	ps.gravity = Vector2(0, 1100)
	ps.damping_min = 160.0
	ps.damping_max = 300.0
	ps.scale_amount_min = 8.0
	ps.scale_amount_max = 14.0
	ps.angle_min = 0.0
	ps.angle_max = 360.0
	ps.angular_velocity_min = -500.0
	ps.angular_velocity_max = 500.0
	var gr = Gradient.new()
	gr.offsets = PackedFloat32Array([0.0, 0.2, 0.4, 0.6, 0.8, 1.0])
	gr.colors = PackedColorArray([UI.RED, UI.GOLD, UI.GREEN, UI.BLUE, UI.PURPLE, UI.BRAND])
	gr.interpolation_mode = Gradient.GRADIENT_INTERPOLATE_CONSTANT
	ps.color_initial_ramp = gr
	var fade = Gradient.new()
	fade.offsets = PackedFloat32Array([0.0, 0.8, 1.0])
	fade.colors = PackedColorArray([Color.WHITE, Color.WHITE, Color(1, 1, 1, 0)])
	ps.color_ramp = fade
	add_child(ps)
	move_child(ps, 0)
	ps.emitting = true
	ps.finished.connect(ps.queue_free)

func _sparkle(at: Vector2) -> void:
	var ps = CPUParticles2D.new()
	ps.position = at
	ps.one_shot = true
	ps.explosiveness = 1.0
	ps.amount = 14
	ps.lifetime = 0.55
	ps.spread = 180.0
	ps.initial_velocity_min = 180.0
	ps.initial_velocity_max = 320.0
	ps.damping_min = 350.0
	ps.damping_max = 450.0
	ps.scale_amount_min = 5.0
	ps.scale_amount_max = 9.0
	var fade = Gradient.new()
	fade.set_color(0, UI.GOLD.lightened(0.4))
	fade.set_color(1, Color(1, 0.8, 0.2, 0))
	ps.color_ramp = fade
	add_child(ps)
	ps.emitting = true
	ps.finished.connect(ps.queue_free)

func _star_pos(i: int) -> Vector2:
	var r: Rect2 = Z.stars
	return Vector2(r.get_center().x + (i - 1) * 140.0, r.get_center().y + (0.0 if i == 1 else 10.0))

func _play_win() -> void:
	var sz = get_viewport_rect().size
	_tw = create_tween()
	_tw.tween_property(self, "bg_a", 1.0, 0.18)
	_tw.tween_callback(func():
		Sfx.play("fanfare")
		Sfx.buzz(45, 0.8)
		_confetti(Vector2(-10, Z.stage.end.y), Vector2(0.8, -1.2))
		_confetti(Vector2(sz.x + 10, Z.stage.end.y), Vector2(-0.8, -1.2)))
	_tw.tween_property(_hen, "scale", Vector2.ONE, 0.45).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_tw.parallel().tween_property(self, "glow", 1.0, 0.5)
	_tw.parallel().tween_property(_title, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT).set_delay(0.15)
	_tw.parallel().tween_property(_sub, "modulate:a", 1.0, 0.25).set_delay(0.3)
	for i in 3:
		_tw.tween_method(func(v): star_k[i] = v, 0.0, 1.0, 0.28).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		if i < n_stars:
			_tw.parallel().tween_callback(func():
				Sfx.play("star%d" % i)
				Sfx.buzz(20 + i * 10, 0.5 + i * 0.15)
				_sparkle(_star_pos(i))).set_delay(0.1)
	for i in _cards.size():
		var c = _cards[i]
		var y0 = c.position.y
		c.position.y += 40.0
		_tw.parallel().tween_property(c, "position:y", y0, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT).set_delay(0.06 * i)
		_tw.parallel().tween_property(c, "modulate:a", 1.0, 0.2).set_delay(0.06 * i)
	_tw.tween_callback(func():
		for c in _cards:
			c.count_up())
	_tw.tween_interval(0.55)
	_tw.tween_property(_btn, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_tw.tween_callback(_finish)

func _play_fail() -> void:
	_tw = create_tween()
	_tw.tween_property(self, "bg_a", 1.0, 0.25)
	_tw.tween_callback(func():
		Sfx.play("fail")
		Sfx.buzz(70, 0.6))
	_tw.tween_property(_hen, "scale", Vector2.ONE, 0.4).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_tw.parallel().tween_property(_title, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT).set_delay(0.1)
	_tw.parallel().tween_property(_sub, "modulate:a", 1.0, 0.3).set_delay(0.2)
	for c in _cards:
		_tw.parallel().tween_property(c, "modulate:a", 1.0, 0.3).set_delay(0.3)
	_tw.tween_callback(func():
		for c in _cards:
			c.count_up())
	_tw.tween_property(_btn, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_tw.parallel().tween_property(_btn2, "modulate:a", 1.0, 0.3)
	_tw.tween_callback(_finish)

func _finish() -> void:
	_done = true
	star_k = [1.0, 1.0, 1.0]
	bg_a = 1.0
	glow = 1.0
	_hen.scale = Vector2.ONE
	_title.scale = Vector2.ONE
	_sub.modulate.a = 1.0
	for c in _cards:
		c.modulate.a = 1.0
		c.finish()
	if _btn2:
		_btn2.modulate.a = 1.0
	_btn.scale = Vector2.ONE
	var breathe = create_tween().set_loops()
	breathe.tween_property(_btn, "scale", Vector2(1.03, 1.03), 0.6).set_trans(Tween.TRANS_SINE)
	breathe.tween_property(_btn, "scale", Vector2.ONE, 0.6).set_trans(Tween.TRANS_SINE)

func _gui_input(ev: InputEvent) -> void:
	if not _done and ev is InputEventScreenTouch and ev.pressed:
		if _tw:
			_tw.kill()
		_finish()

func _process(dt: float) -> void:
	spin += dt * 0.25
	queue_redraw()

func _draw() -> void:
	var sz = get_viewport_rect().size
	draw_rect(Rect2(Vector2.ZERO, sz), Color(1, 0.985, 0.955, bg_a))
	if glow > 0.0 and won:
		var c = Vector2(Z.stage.get_center().x, Z.stage.end.y - _hen.H * 0.45)
		var R = minf(Z.stage.size.y * 0.62, sz.x * 0.46) * glow
		for i in 12:
			var a = spin + TAU * i / 12.0
			draw_colored_polygon(PackedVector2Array([c, c + Vector2.from_angle(a - 0.13) * R * 1.25, c + Vector2.from_angle(a + 0.13) * R * 1.25]), Color(1.0, 0.8, 0.35, 0.10))
		draw_circle(c, R * 0.9, Color(1.0, 0.86, 0.5, 0.22))
		draw_circle(c, R * 0.62, Color(1.0, 0.9, 0.62, 0.35))
	if not won:
		return
	for i in 3:
		var p = _star_pos(i)
		var big = 60.0 if i == 1 else 50.0
		G.shape(self, G.star(p, big, big * 0.5), Color(0.9, 0.88, 0.85), Color(0, 0, 0, 0), 0.0)
		if i < n_stars and star_k[i] > 0.0:
			var k: float = star_k[i]
			var r = big * k
			var rot = (1.0 - k) * -0.7
			G.shape(self, G.star(p + Vector2(0, 4), r, r * 0.5, rot), UI.GOLD_D, Color(0, 0, 0, 0), 0.0)
			G.shape(self, G.star(p, r, r * 0.5, rot), UI.GOLD, Color(0, 0, 0, 0), 0.0)
			G.shape(self, G.star(p + Vector2(-r * 0.1, -r * 0.12), r * 0.42, r * 0.21, rot), Color(1, 0.93, 0.6), Color(0, 0, 0, 0), 0.0)
