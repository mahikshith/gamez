# Level end stage. Win: Duolingo-style beat sheet, under 2.2 s and skippable by a tap:
#   dim + sunburst -> hen jumps in dancing + fanfare + confetti -> title pops -> stars land one by one (rising bell,
#   haptic tick, sparkle each) -> coins roll up -> streak pill -> big button pops and breathes.
# Fail: hen cries, short sad chime, one orange "Try again" button.
extends Control

const G = preload("res://scripts/g.gd")
const Hen = preload("res://scripts/hen.gd")
signal next_pressed
signal retry_pressed

var font: Font
var won = false
var n_stars = 0
var dim = 0.0
var burst = 0.0
var spin = 0.0
var star_k = [0.0, 0.0, 0.0]
var coins_shown = 0
var pill = 0.0
var coins = 0
var streak = 0
var _tw: Tween
var _hen: Node2D
var _title: Label
var _sub: Label
var _coin_lbl: Label
var _btn: Button
var _skip_ready = false
var _done = false

func _init() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP

func open(is_win: bool, stars: int, coin_gain: int, streak_n: int, title: String, sub: String) -> void:
	won = is_win
	n_stars = stars
	coins = coin_gain
	streak = streak_n
	var sz = get_viewport_rect().size
	var cx = sz.x / 2
	var hen_y = sz.y * 0.5
	_hen = Hen.new()
	_hen.H = 290.0
	_hen.position = Vector2(cx - 10, hen_y)
	_hen.scale = Vector2.ZERO
	add_child(_hen)
	_hen.set_mood("celebrate" if won else "cry")
	_title = _label(title, 64, Color.WHITE, Color("5a3414"))
	_title.position = Vector2(0, sz.y * 0.1)
	_title.size = Vector2(sz.x, 90)
	_title.pivot_offset = _title.size / 2
	_title.scale = Vector2.ZERO
	_sub = _label(sub, 30, Color("fff2d6"), Color("5a3414"))
	_sub.position = Vector2(0, sz.y * 0.1 + 88)
	_sub.size = Vector2(sz.x, 50)
	_sub.modulate.a = 0.0
	_coin_lbl = _label("", 40, Color("ffe066"), Color("5a3414"))
	_coin_lbl.position = Vector2(0, sz.y * 0.72)
	_coin_lbl.size = Vector2(sz.x, 60)
	_coin_lbl.modulate.a = 0.0
	_btn = _button("CONTINUE" if won else "TRY AGAIN", Color("58cc02") if won else Color("ff9600"), Color("46a302") if won else Color("cc7800"))
	_btn.size = Vector2(minf(520.0, sz.x - 64.0), 96)
	_btn.position = Vector2(cx - _btn.size.x / 2, sz.y * 0.84)
	_btn.pivot_offset = _btn.size / 2
	_btn.scale = Vector2.ZERO
	_btn.pressed.connect(func():
		Sfx.play("grab")
		Sfx.buzz(15, 0.4)
		if won: next_pressed.emit()
		else: retry_pressed.emit())
	if won:
		_play_win()
	else:
		_play_fail()

func _label(text: String, size: int, col: Color, outline: Color) -> Label:
	var l = Label.new()
	l.text = text
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.add_theme_font_override("font", font)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_outline_color", outline)
	l.add_theme_constant_override("outline_size", int(size * 0.22))
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(l)
	return l

func _button(text: String, col: Color, edge: Color) -> Button:
	var b = Button.new()
	b.text = text
	b.add_theme_font_override("font", font)
	b.add_theme_font_size_override("font_size", 38)
	for st in ["normal", "hover", "pressed", "focus"]:
		var sb = StyleBoxFlat.new()
		sb.bg_color = col if st != "pressed" else col.darkened(0.06)
		sb.set_corner_radius_all(22)
		sb.border_color = edge
		sb.border_width_bottom = 2 if st == "pressed" else 9
		sb.content_margin_top = 10 if st == "pressed" else 4
		if st == "focus":
			sb.draw_center = false
			sb.border_width_bottom = 0
		b.add_theme_stylebox_override(st, sb)
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		b.add_theme_color_override(c, Color.WHITE)
	add_child(b)
	return b

func _confetti(at: Vector2, dir: Vector2) -> void:
	var ps = CPUParticles2D.new()
	ps.position = at
	ps.one_shot = true
	ps.explosiveness = 0.92
	ps.amount = 90
	ps.lifetime = 2.4
	ps.direction = dir
	ps.spread = 38.0
	ps.initial_velocity_min = 700.0
	ps.initial_velocity_max = 1250.0
	ps.gravity = Vector2(0, 1300)
	ps.damping_min = 120.0
	ps.damping_max = 260.0
	ps.scale_amount_min = 9.0
	ps.scale_amount_max = 16.0
	ps.angle_min = 0.0
	ps.angle_max = 360.0
	ps.angular_velocity_min = -540.0
	ps.angular_velocity_max = 540.0
	var gr = Gradient.new()
	gr.offsets = PackedFloat32Array([0.0, 0.2, 0.4, 0.6, 0.8, 1.0])
	gr.colors = PackedColorArray([Color("ff4b4b"), Color("ffc800"), Color("58cc02"), Color("1cb0f6"), Color("ce82ff"), Color("ff86d0")])
	gr.interpolation_mode = Gradient.GRADIENT_INTERPOLATE_CONSTANT
	ps.color_initial_ramp = gr
	add_child(ps)
	ps.emitting = true
	ps.finished.connect(ps.queue_free)

func _sparkle(at: Vector2) -> void:
	var ps = CPUParticles2D.new()
	ps.position = at
	ps.one_shot = true
	ps.explosiveness = 1.0
	ps.amount = 16
	ps.lifetime = 0.6
	ps.spread = 180.0
	ps.initial_velocity_min = 160.0
	ps.initial_velocity_max = 320.0
	ps.gravity = Vector2.ZERO
	ps.damping_min = 300.0
	ps.damping_max = 400.0
	ps.scale_amount_min = 4.0
	ps.scale_amount_max = 8.0
	var fade = Gradient.new()
	fade.set_color(0, Color("fff7b0"))
	fade.set_color(1, Color(1, 0.9, 0.4, 0))
	ps.color_ramp = fade
	add_child(ps)
	ps.emitting = true
	ps.finished.connect(ps.queue_free)

func _star_pos(i: int) -> Vector2:
	var sz = get_viewport_rect().size
	var cx = sz.x / 2
	var y = sz.y * 0.645
	return Vector2(cx + (i - 1) * 150.0, y - (18.0 if i == 1 else 0.0))

func _play_win() -> void:
	var sz = get_viewport_rect().size
	_tw = create_tween()
	_tw.tween_property(self, "dim", 0.8, 0.22)
	_tw.parallel().tween_property(self, "burst", 1.0, 0.45).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_tw.parallel().tween_callback(func(): Sfx.play("whoosh", -4.0))
	_tw.tween_callback(func():
		Sfx.play("fanfare")
		Sfx.buzz(45, 0.8)
		_confetti(Vector2(-20, sz.y * 0.55), Vector2(1, -1.3))
		_confetti(Vector2(sz.x + 20, sz.y * 0.55), Vector2(-1, -1.3)))
	_tw.tween_property(_hen, "scale", Vector2.ONE, 0.42).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_tw.parallel().tween_property(_title, "scale", Vector2.ONE, 0.32).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT).set_delay(0.12)
	_tw.parallel().tween_property(_sub, "modulate:a", 1.0, 0.25).set_delay(0.25)
	for i in 3:
		var earned = i < n_stars
		_tw.tween_method(func(v): star_k[i] = v, 0.0, 1.0, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		if earned:
			_tw.parallel().tween_callback(func():
				Sfx.play("star%d" % i)
				Sfx.buzz(22 + i * 8, 0.5 + i * 0.15)
				_sparkle(_star_pos(i))).set_delay(0.12)
		_tw.tween_interval(0.06)
	_tw.tween_property(_coin_lbl, "modulate:a", 1.0, 0.15)
	_tw.tween_method(_roll_coins, 0, coins, 0.5)
	_tw.tween_property(self, "pill", 1.0, 0.2)
	_tw.tween_property(_btn, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_tw.tween_callback(_finish)

func _play_fail() -> void:
	_tw = create_tween()
	_tw.tween_property(self, "dim", 0.8, 0.3)
	_tw.tween_callback(func():
		Sfx.play("fail")
		Sfx.buzz(80, 0.7))
	_tw.tween_property(_hen, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_tw.parallel().tween_property(_title, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_tw.parallel().tween_property(_sub, "modulate:a", 1.0, 0.3)
	_tw.tween_property(_btn, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_tw.tween_callback(_finish)

func _roll_coins(v: int) -> void:
	if v != coins_shown and v % 3 == 0:
		Sfx.play("coin", -10.0, 1.0 + v * 0.004)
	coins_shown = v
	_coin_lbl.text = "+%d coins" % v

func _finish() -> void:
	_done = true
	star_k = [1.0, 1.0, 1.0]
	dim = 0.8
	burst = 1.0
	_hen.scale = Vector2.ONE
	_title.scale = Vector2.ONE
	_sub.modulate.a = 1.0
	if won:
		_coin_lbl.modulate.a = 1.0
		_coin_lbl.text = "+%d coins" % coins
	_btn.scale = Vector2.ONE
	pill = 1.0
	var breathe = create_tween().set_loops()
	breathe.tween_property(_btn, "scale", Vector2(1.04, 1.04), 0.55).set_trans(Tween.TRANS_SINE)
	breathe.tween_property(_btn, "scale", Vector2.ONE, 0.55).set_trans(Tween.TRANS_SINE)

func _gui_input(ev: InputEvent) -> void:
	# a tap skips straight to the end of the sequence
	if not _done and ev is InputEventScreenTouch and ev.pressed:
		if _tw:
			_tw.kill()
		_finish()

func _process(dt: float) -> void:
	spin += dt * 0.35
	queue_redraw()

func _draw() -> void:
	var sz = get_viewport_rect().size
	draw_rect(Rect2(Vector2.ZERO, sz), Color(0.08, 0.04, 0.02, dim))
	if won and burst > 0.0:
		var c = Vector2(sz.x / 2, sz.y * 0.4)
		var R = sz.x * 0.75 * burst
		for i in 16:
			var a = spin + TAU * i / 16.0
			draw_colored_polygon(PackedVector2Array([c, c + Vector2.from_angle(a - 0.1) * R, c + Vector2.from_angle(a + 0.1) * R]), Color(1, 0.86, 0.35, 0.06))
		draw_circle(c, 230.0 * burst, Color(1, 0.85, 0.4, 0.12))
		draw_circle(c, 180.0 * burst, Color(1, 0.88, 0.45, 0.14))
		draw_circle(c, 130.0 * burst, Color(1, 0.95, 0.65, 0.2))
	if not won:
		return
	for i in 3:
		var p = _star_pos(i)
		var big = 64.0 if i == 1 else 54.0
		# empty slot
		G.shape(self, G.star(p, big, big * 0.48), Color(0, 0, 0, 0.35), Color(1, 1, 1, 0.25), 3.0)
		if i < n_stars and star_k[i] > 0.0:
			var k: float = star_k[i]
			var r = big * k
			var rot = (1.0 - k) * -0.8
			draw_circle(p, r * 1.15, Color(1, 0.85, 0.2, 0.25 * k))
			G.shape(self, G.star(p + Vector2(0, 5), r, r * 0.48, rot), Color("d68a00"), Color("d68a00"), 0.0)
			G.shape(self, G.star(p, r, r * 0.48, rot), Color("ffc800"), Color("b86e00"), 4.0)
			G.shape(self, G.star(p + Vector2(-r * 0.12, -r * 0.14), r * 0.45, r * 0.22, rot), Color("ffe680"), Color(0, 0, 0, 0), 0.0)
	if streak >= 2 and pill > 0.0:
		var pr = Rect2(sz.x / 2 - 130, sz.y * 0.775, 260, 50)
		var sb = StyleBoxFlat.new()
		sb.bg_color = Color(1.0, 0.59, 0.0, pill)
		sb.set_corner_radius_all(25)
		sb.anti_aliasing = true
		draw_style_box(sb, pr)
		var fl = Vector2(pr.position.x + 34, pr.position.y + 27)
		var fc = Color(1.0, 0.87, 0.23, pill)
		draw_colored_polygon(G.ellipse(fl + Vector2(0, 4), 10, 13, 16), fc)
		draw_colored_polygon(PackedVector2Array([fl + Vector2(-9, 1), fl + Vector2(0, -20), fl + Vector2(9, 1)]), fc)
		draw_string(font, Vector2(pr.position.x + 56, pr.position.y + 35), "%d wins in a row" % streak, HORIZONTAL_ALIGNMENT_LEFT, -1, 27, Color(1, 1, 1, pill))
