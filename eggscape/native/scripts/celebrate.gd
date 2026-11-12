# Level end page: a clean full-screen page over the game (nothing of the vault shows through), laid out in fixed
# zones so text, cards and the button can never overlap, on any phone shape:
#   mascot stage (top) | title + subtitle | stars | stat cards | big button (bottom, safe area aware)
# Win beat sheet (about 2.4 s, a tap skips to the end): page fades in -> hen jumps in and starts her celebration
# routine + fanfare + confetti -> title pops -> stars land one by one (rising chime, haptic tick, sparkle) ->
# cards rise and their numbers count up -> button rises and breathes.
# Fail: hen is sad, kind title, one card with the eggs saved, "Try again" plus a quiet "Back to the farm".
extends Control

const G = preload("res://scripts/g.gd")
const Hen = preload("res://scripts/mama.gd")
const Cheer = preload("res://scripts/cheer.gd")
const UI = preload("res://scripts/ui_kit.gd")
const FX = preload("res://scripts/fx.gd")
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
var _u = 0.0
var _stars_at = [0.9, 1.15, 1.4]
var _fx = []
var _fx_done = {}
var _star_done = [false, false, false]
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
	var btn_h = 92.0
	var gap = 18.0
	Z.button = Rect2(x0 + 24, bottom - btn_h - (64.0 if not won else 0.0), W - 48, btn_h)
	Z.button2 = Rect2(x0 + 24, bottom - 52.0, W - 48, 52.0)
	Z.cards = Rect2(x0 + 24, Z.button.position.y - gap * 2 - 124.0, W - 48, 124.0)
	Z.stars = Rect2(x0, Z.cards.position.y - gap - 136.0, W, 136.0) if won else Rect2(x0, Z.cards.position.y, W, 0.0)
	Z.sub = Rect2(x0 + 24, Z.stars.position.y - gap - 34.0, W - 48, 34.0)
	Z.title = Rect2(x0 + 24, Z.sub.position.y - 86.0, W - 48, 84.0)
	Z.stage = Rect2(x0, top, W, Z.title.position.y - top - gap)

func open(is_win: bool, stars: int, stats: Array, title: String, sub: String, routine := "cheer") -> void:
	won = is_win
	n_stars = stars
	_layout()
	var st: Rect2 = Z.stage
	_hen = Hen.new()
	_hen.H = clampf(minf(st.size.y * 0.6, st.size.x * 0.5), 140.0, 400.0)
	_hen.position = Vector2(st.get_center().x, st.end.y - _hen.H * 0.05)
	_hen.stage_top = st.position.y - _hen.position.y
	_hen.shadow = 0.0
	add_child(_hen)
	_hen.cue.connect(_on_cue)
	if won:
		_hen.play(routine, Cheer.power(stars))
	else:
		_hen.play("encourage", 0.5)
	var info = _hen.routine_info()
	if won:
		_stars_at = info.stars
	_fx = info.fx
	_title = UI.title(self, title, 68, Color("FFD21F") if won else Color("FFE9DC"), Color("7A3A06") if won else Color("5A1F2E"), 14)
	_place(_title, Z.title)
	_title.pivot_offset = _title.size / 2
	_title.scale = Vector2.ZERO
	_sub = UI.label(self, sub, 24, Color.WHITE, 900)
	_sub.add_theme_color_override("font_outline_color", Color(0.05, 0.12, 0.25, 0.55))
	_sub.add_theme_constant_override("outline_size", 6)
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
		_btn2 = UI.flat_button(self, "BACK TO THE FARM", Color("E8E2FF"), 24)
		_place(_btn2, Z.button2)
		_btn2.modulate.a = 0.0
		_btn2.pressed.connect(func():
			Sfx.play("grab")
			home_pressed.emit())
	if won:
		_play_win()
	else:
		_play_fail()
	get_viewport().size_changed.connect(_relayout)

# the screen size can change after the page opens (Android immersive mode, rotation lock, cutouts): re-place everything
func _relayout() -> void:
	_layout()
	var st: Rect2 = Z.stage
	_hen.H = clampf(minf(st.size.y * 0.6, st.size.x * 0.5), 140.0, 400.0)
	_hen.position = Vector2(st.get_center().x, st.end.y - _hen.H * 0.05)
	_hen.stage_top = st.position.y - _hen.position.y
	_place(_title, Z.title)
	_title.pivot_offset = _title.size / 2
	_place(_sub, Z.sub)
	var n = _cards.size()
	var cw = (Z.cards.size.x - 14.0 * (n - 1)) / n
	var x = Z.cards.position.x
	for i in n:
		_cards[i].position = Vector2(x + i * (cw + 14.0), Z.cards.position.y)
		_cards[i].size = Vector2(cw, Z.cards.size.y)
	_place(_btn, Z.button)
	_btn.pivot_offset = _btn.size / 2
	if _btn2:
		_place(_btn2, Z.button2)

func _place(c: Control, r: Rect2) -> void:
	c.position = r.position
	c.size = r.size

func _confetti(at: Vector2, dir: Vector2, n := 70) -> void:
	var ps = FX.confetti(self, at, dir, n)
	move_child(ps, 0)

func _sparkle(at: Vector2) -> void:
	FX.sparks(self, at, 14, Color(1.0, 0.95, 0.6), 420.0, 34.0)

func _star_pos(i: int) -> Vector2:
	var r: Rect2 = Z.stars
	return Vector2(r.get_center().x + (i - 1) * 150.0, r.get_center().y + (-6.0 if i == 1 else 12.0))

func _play_win() -> void:
	# the stars land on the hen's beats (see _process); the title pops first, cards and button follow the last star
	_tw = create_tween()
	_tw.tween_property(self, "bg_a", 1.0, 0.18)
	_tw.tween_callback(func():
		Sfx.play("fanfare")
		Sfx.buzz(45, 0.8))
	_tw.parallel().tween_property(self, "glow", 1.0, 0.5)
	_tw.parallel().tween_property(_title, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT).set_delay(0.15)
	_tw.parallel().tween_property(_sub, "modulate:a", 1.0, 0.25).set_delay(0.3)
	_tw.tween_interval(maxf(0.0, float(_stars_at[2]) + 0.1 - 0.18))
	for i in _cards.size():
		var c = _cards[i]
		var y0 = c.position.y
		c.position.y += 40.0
		_tw.parallel().tween_property(c, "position:y", y0, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT).set_delay(0.06 * i)
		_tw.parallel().tween_property(c, "modulate:a", 1.0, 0.2).set_delay(0.06 * i)
	_tw.tween_callback(func():
		for c in _cards:
			c.count_up())
	_tw.tween_interval(0.45)
	_tw.tween_property(_btn, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_tw.tween_callback(_finish)

func _land_star(i: int) -> void:
	if _star_done[i]:
		return
	_star_done[i] = true
	if i >= n_stars:
		star_k[i] = 1.0
		return
	var tw = create_tween()
	tw.tween_method(func(v): star_k[i] = v, 0.0, 1.0, 0.28).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	Sfx.play("star%d" % i)
	Sfx.buzz(20 + i * 10, 0.5 + i * 0.15)
	_sparkle(_star_pos(i))

func _on_cue(name: String) -> void:
	match name:
		"flap":
			Sfx.play("whoosh", -8.0, 1.7)
		"confetti":
			Sfx.play("pop", -2.0)
		_:
			Sfx.play(name, -3.0, randf_range(0.96, 1.06))

func _play_fail() -> void:
	_tw = create_tween()
	_tw.tween_property(self, "bg_a", 1.0, 0.25)
	_tw.tween_callback(func():
		Sfx.play("fail")
		Sfx.buzz(70, 0.6))
	_tw.tween_property(_title, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT).set_delay(0.1)
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
	if _hen:
		_hen.skip_routine()
	for i in 3:
		_star_done[i] = true
	star_k = [1.0, 1.0, 1.0]
	bg_a = 1.0
	glow = 1.0
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
	_u += dt
	if won and not _done:
		for i in 3:
			if _u >= float(_stars_at[i]):
				_land_star(i)
	var sz = get_viewport_rect().size
	for i in _fx.size():
		var f = _fx[i]
		if _fx_done.has(i) or _u < float(f[0]) or _done and _u > float(f[0]) + 0.3:
			continue
		_fx_done[i] = true
		var n = int(f[1] * 2.2)
		if f[2] == "sides":
			_confetti(Vector2(-10, Z.stage.end.y), Vector2(0.8, -1.2), n)
			_confetti(Vector2(sz.x + 10, Z.stage.end.y), Vector2(-0.8, -1.2), n)
		elif f[2] == "top":
			_confetti(Vector2(sz.x / 2, Z.stage.position.y - 20), Vector2(0, 1), n)
	queue_redraw()

func _draw() -> void:
	var sz = get_viewport_rect().size
	# the page: a deep sky for a win (rays and light behind the hen), dusk for a fail; a grass stage under her feet
	var top = Color("1B6FD0") if won else Color("3B3F78")
	var bot = Color("7FD2F8") if won else Color("8E7FB8")
	draw_polygon(PackedVector2Array([Vector2.ZERO, Vector2(sz.x, 0), Vector2(sz.x, sz.y), Vector2(0, sz.y)]),
		PackedColorArray([Color(top, bg_a), Color(top, bg_a), Color(bot, bg_a), Color(bot, bg_a)]))
	if bg_a <= 0.0:
		return
	var feet = Vector2(Z.stage.get_center().x, Z.stage.end.y - _hen.H * 0.05)
	var c = feet + Vector2(0, -_hen.H * 0.5)
	var R = maxf(sz.x, Z.stage.size.y) * (0.5 + 0.5 * glow)
	if won:
		for i in 14:
			var a = spin + TAU * i / 14.0
			draw_polygon(PackedVector2Array([c, c + Vector2.from_angle(a - 0.11) * R * 1.3, c + Vector2.from_angle(a + 0.11) * R * 1.3]),
				PackedColorArray([Color(1, 1, 0.8, 0.34 * glow * bg_a), Color(1, 1, 0.8, 0.0), Color(1, 1, 0.8, 0.0)]))
	var gs = _hen.H * (3.2 if won else 2.4)
	draw_texture_rect(FX.GLOW, Rect2(c - Vector2(gs, gs) / 2.0, Vector2(gs, gs)), false, Color(1.0, 0.95, 0.7, (0.9 if won else 0.35) * bg_a))
	# stage: a round grassy knoll with a soil lip and a soft shadow for the hen
	var kw = minf(sz.x * 0.46, _hen.H * 1.5)
	draw_colored_polygon(G.ellipse(feet + Vector2(0, 30), kw * 1.02, 40.0, 40), Color(0.05, 0.1, 0.3, 0.25 * bg_a))
	draw_colored_polygon(G.ellipse(feet + Vector2(0, 22), kw, 36.0, 40), Color(Color("7A4A1E"), bg_a))
	draw_colored_polygon(G.ellipse(feet + Vector2(0, 8), kw, 34.0, 40), Color(Color("3F9324"), bg_a))
	draw_colored_polygon(G.ellipse(feet + Vector2(0, 4), kw - 4, 30.0, 40), Color(Color("7FD44A") if won else Color("6FAE5A"), bg_a))
	draw_colored_polygon(G.ellipse(feet + Vector2(0, 6), _hen.H * 0.42, 12.0, 24), Color(0.05, 0.25, 0.05, 0.3 * bg_a))
	# lower panel: a navy glass sheet behind the stars, cards and button
	var pr = Rect2(Z.cards.position.x - 12, Z.title.position.y - 14, Z.cards.size.x + 24, Z.cards.end.y - Z.title.position.y + 30)
	UI.rounded(self, pr.grow(3), Color(0.03, 0.08, 0.2, 0.5 * bg_a), 37)
	UI.rounded(self, pr, Color(0.07, 0.16, 0.36, 0.55 * bg_a), 34)
	if not won:
		return
	for i in 3:
		var p = _star_pos(i)
		var big = 58.0 if i == 1 else 47.0
		var on = i < n_stars
		var k: float = star_k[i]
		UI.star(self, p, big, false)
		if on and k > 0.0:
			UI.star(self, p, big, true, k, (1.0 - k) * -0.7)
