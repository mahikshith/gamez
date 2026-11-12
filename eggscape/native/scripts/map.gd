# The map, Angry Birds style, two screens:
#   WORLDS  big illustrated world cards in a row you swipe through (snap, rubber band at the ends, page dots). Each card
#           shows the world's scene, name, stars won and a lock ("Finish World N" or "Coming soon" for worlds the app
#           does not have yet). Tap a card to fly into it.
#   LEVELS  the world's scene full screen and a grid of chunky level tiles: number, three stars, padlock when locked,
#           a crown on the boss level, the next level breathing. Back arrow top left.
# After a win the map opens on that world's levels: the stars just won pop onto their tile, then the next tile's
# padlock shakes and bursts open. Mama Hen stands at the bottom (tap her), a big button continues the next level.
# The camera moves are tweens on `scroll` (the card row) and `zoom` (flying into a card).
extends Control

const G = preload("res://scripts/g.gd")
const UI = preload("res://scripts/ui_kit.gd")
const Hen = preload("res://scripts/mama.gd")
const C2D = preload("res://scripts/c2d.gd")
const Art = preload("res://scripts/world_art.gd")
signal play(index: int)

var levels: Array = []
var save: Dictionary = {}
var playable = 1
var from_level = -1

var mode := "worlds"
var world := 0 # focused / open world (0-based)
var scroll := 0.0
var zoom := 0.0 # 0 = card row, 1 = inside the world
var t := 0.0
var current := 0 # index of the next level to play
var n_worlds := 10
var _c = C2D.new()
var _hen
var _btn: Button
var _drag := false
var _drag_x := 0.0
var _drag_s := 0.0
var _drag_moved := 0.0
var _vel := 0.0
var _last_x := 0.0
var _tw: Tween
var _busy := false
var _tile_in := 0.0
var _unlock := {} # level index -> 0..1 padlock burst
var _star_pop := {} # level index -> 0..1
var _unlock_shake := {}
var _shake_w := 0.0
var _world_pop := 0.0
var Z := {}

func _init() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP

func _world_of(i: int) -> int:
	return int(levels[i].world) - 1 if i < levels.size() else n_worlds - 1

func _first_of(w: int) -> int:
	for i in levels.size():
		if int(levels[i].world) == w + 1:
			return i
	return 9999

func _levels_of(w: int) -> Array:
	var out = []
	for i in levels.size():
		if int(levels[i].world) == w + 1:
			out.append(i)
	return out

func _stars(i: int) -> int:
	var b: Dictionary = save.get("best", {})
	return int(b.get(str(int(levels[i].id)), 0))

func _world_open(w: int) -> bool:
	var f = _first_of(w)
	return f < playable and f <= current

func open() -> void:
	n_worlds = Art.WORLDS.size()
	current = clampi(int(save.get("level", 1)), 1, playable) - 1
	_layout()
	_hen = Hen.new()
	_hen.role = "front"
	_hen.pokeable = true
	add_child(_hen)
	_btn = UI.button(self, "", UI.GREEN, 32)
	_btn.pressed.connect(func(): _start(current))
	var br = create_tween().set_loops()
	br.tween_property(_btn, "scale", Vector2(1.03, 1.03), 0.7).set_trans(Tween.TRANS_SINE)
	br.tween_property(_btn, "scale", Vector2.ONE, 0.7).set_trans(Tween.TRANS_SINE)
	_place()
	if from_level >= 0:
		# came back from a win: open that world's levels and celebrate the unlock
		world = _world_of(from_level)
		scroll = world
		mode = "levels"
		zoom = 1.0
		_tile_in = 1.0
		_after_win(from_level)
	else:
		world = _world_of(current)
		var ua = OS.get_cmdline_user_args()
		if ua.has("--card"):
			world = int(ua[ua.find("--card") + 1])
		scroll = world
		_hen.set_mood("happy")
	get_viewport().size_changed.connect(func():
		_layout()
		_place())

func _layout() -> void:
	var sz = get_viewport_rect().size
	var top = UI.safe_top() + 16.0
	var bottom = sz.y - UI.safe_bottom()
	Z.sz = sz
	Z.header = Rect2(16, top, sz.x - 32, 78)
	Z.button = Rect2(sz.x / 2 - minf(520.0, sz.x - 64.0) / 2, bottom - 100 - 30, minf(520.0, sz.x - 64.0), 100)
	var hen_h = clampf(sz.y * 0.13, 120.0, 170.0)
	Z.hen_h = hen_h
	Z.hen = Vector2(sz.x * 0.5, Z.button.position.y - 14.0)
	var zone_top = Z.header.end.y + 26.0
	var zone_bot = Z.hen.y - hen_h * 1.02 - 46.0 # page dots live under the cards, above the hen
	var cw = minf(sz.x * 0.78, 500.0)
	var ch = minf(zone_bot - zone_top, cw * 1.3)
	cw = minf(cw, ch / 1.12)
	Z.card = Rect2(sz.x / 2 - cw / 2, zone_top + (zone_bot - zone_top - ch) / 2, cw, ch)
	Z.dots_y = Z.card.end.y + 26.0
	Z.spacing = cw + 34.0
	# level grid: rows of three, centred between the header and the hen
	var tile = minf(184.0, (sz.x - 48.0 - 2 * 26.0) / 3.0)
	Z.tile = tile
	var row_h = tile + 52.0
	var grid_h = row_h * 2.0
	Z.grid_top = Z.header.end.y + 40.0 + maxf(0.0, (Z.hen.y - hen_h * 1.02 - Z.header.end.y - 40.0 - grid_h) / 2.0)
	Z.back = Rect2(Z.header.position.x, Z.header.position.y + 2, 74, 74)

func _place() -> void:
	if _hen:
		_hen.H = Z.hen_h
		_hen.position = Z.hen
	if _btn:
		_btn.position = Z.button.position
		_btn.size = Z.button.size
		_btn.pivot_offset = _btn.size / 2
		_btn.text = "PLAY  LEVEL %d" % int(levels[current].id)

func _tile_rect(k: int, n: int) -> Rect2:
	var T: float = Z.tile
	var gap = 26.0
	var row = k / 3
	var in_row = mini(3, n - row * 3)
	var col = k % 3
	var w = in_row * T + (in_row - 1) * gap
	var x0 = Z.sz.x / 2 - w / 2
	return Rect2(x0 + col * (T + gap), Z.grid_top + row * (T + 52.0), T, T)

# ---------------------------------------------------------------- after a win
func _after_win(fl: int) -> void:
	_busy = true
	_hen.set_mood("happy")
	_star_pop[fl] = 0.0
	if current > fl and current < playable:
		_unlock[current] = 0.0
	var tw = create_tween()
	tw.tween_interval(0.45)
	tw.tween_callback(func():
		Sfx.play("star1", -4.0)
		Sfx.buzz(20, 0.4))
	tw.tween_method(func(v): _star_pop[fl] = v, 0.0, 1.0, 0.5).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if current > fl and current < playable:
		tw.tween_interval(0.25)
		tw.tween_callback(func():
			Sfx.play("click", -2.0, 0.7)
			Sfx.buzz(12, 0.3)
			_unlock_shake[current] = 1.0)
		tw.tween_interval(0.35)
		tw.tween_method(func(v): _unlock[current] = v, 0.0, 1.0, 0.6)
		tw.tween_callback(func():
			Sfx.play("fanfare", -6.0)
			Sfx.buzz(30, 0.6)
			_hen.set_mood("happy"))
		if _world_of(current) != world:
			# the next level is in a new world: fly out and swipe over to it
			tw.tween_interval(0.6)
			tw.tween_callback(func(): _back_to_worlds(_world_of(current)))
	tw.tween_callback(func(): _busy = false)

# ---------------------------------------------------------------- navigation
func _enter_world(w: int) -> void:
	if _busy:
		return
	if not _world_open(w):
		Sfx.play("click", -6.0, 0.6)
		Sfx.buzz(8, 0.2)
		_hen.set_mood("gasp")
		_shake_w = 1.0
		return
	_busy = true
	world = w
	Sfx.play("whoosh", -6.0, 1.2)
	Sfx.buzz(12, 0.3)
	var tw = create_tween()
	tw.tween_property(self, "scroll", float(w), 0.18).set_trans(Tween.TRANS_SINE)
	tw.tween_property(self, "zoom", 1.0, 0.42).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	tw.tween_callback(func():
		mode = "levels"
		_tile_in = 0.0)
	tw.tween_property(self, "_tile_in", 1.0, 0.5).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func(): _busy = false)

func _back_to_worlds(to := -1) -> void:
	_busy = true
	Sfx.play("whoosh", -8.0, 0.9)
	mode = "worlds"
	var tw = create_tween()
	tw.tween_property(self, "zoom", 0.0, 0.38).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	if to >= 0 and to != world:
		tw.tween_property(self, "scroll", float(to), 0.6).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
		tw.tween_callback(func():
			world = to
			_world_pop = 1.0
			Sfx.play("fanfare", -6.0)
			_hen.set_mood("happy"))
	tw.tween_callback(func(): _busy = false)

func _start(i: int) -> void:
	if _busy or i > current or i >= playable:
		return
	_busy = true
	Sfx.play("grab")
	Sfx.buzz(15, 0.4)
	_hen.set_mood("happy")
	play.emit(i)

func _hit_tile(p: Vector2) -> int:
	var ids = _levels_of(world)
	for k in ids.size():
		if _tile_rect(k, ids.size()).grow(8).has_point(p):
			return ids[k]
	return -1

func _gui_input(ev: InputEvent) -> void:
	if ev is InputEventScreenTouch:
		if ev.pressed:
			_drag = true
			_drag_x = ev.position.x
			_last_x = ev.position.x
			_drag_s = scroll
			_drag_moved = 0.0
			_vel = 0.0
			if _tw:
				_tw.kill()
		else:
			if not _drag:
				return
			_drag = false
			if _drag_moved < 18.0:
				_tap(ev.position)
			elif mode == "worlds" and not _busy:
				var target = clampi(int(roundf(scroll - clampf(_vel * 0.12, -0.6, 0.6))), 0, n_worlds - 1)
				_snap(target)
		accept_event()
	elif ev is InputEventScreenDrag and _drag:
		_drag_moved += absf(ev.relative.x) + absf(ev.relative.y)
		if mode == "worlds" and not _busy:
			var d = (ev.position.x - _drag_x) / Z.spacing
			var s = _drag_s - d
			if s < 0.0:
				s = s * 0.3
			elif s > n_worlds - 1:
				s = n_worlds - 1 + (s - n_worlds + 1) * 0.3
			scroll = s
			_vel = (ev.position.x - _last_x) / maxf(1.0, Z.spacing) * 60.0
			_last_x = ev.position.x
		accept_event()

func _snap(w: int) -> void:
	if _tw:
		_tw.kill()
	_tw = create_tween()
	_tw.tween_property(self, "scroll", float(w), 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if w != world:
		world = w
		Sfx.play("click", -10.0, 1.3)
		Sfx.buzz(6, 0.2)

func _tap(p: Vector2) -> void:
	if _busy:
		return
	if mode == "worlds":
		var r: Rect2 = Z.card
		var w = clampi(int(roundf(scroll)), 0, n_worlds - 1)
		if r.has_point(p):
			_enter_world(w)
		elif p.y > r.position.y and p.y < r.end.y:
			_snap(clampi(w + (1 if p.x > r.end.x else -1), 0, n_worlds - 1))
		return
	if Z.back.grow(10).has_point(p):
		_back_to_worlds()
		return
	var i = _hit_tile(p)
	if i < 0:
		return
	if i <= current and i < playable:
		_start(i)
	else:
		Sfx.play("click", -6.0, 0.6)
		Sfx.buzz(8, 0.2)
		_unlock_shake[i] = 1.0

func _process(dt: float) -> void:
	t += dt
	_shake_w = maxf(0.0, _shake_w - dt * 2.5)
	_world_pop = maxf(0.0, _world_pop - dt * 1.5)
	for k in _unlock_shake.keys():
		_unlock_shake[k] = maxf(0.0, _unlock_shake[k] - dt * 2.5)
	queue_redraw()

# ---------------------------------------------------------------- drawing
func _draw() -> void:
	var c = _c
	c.begin(self)
	var sz: Vector2 = Z.sz
	var full = Rect2(Vector2.ZERO, sz)
	var fw = clampi(int(roundf(scroll)), 0, n_worlds - 1)
	if zoom < 1.0:
		_backdrop(c, fw)
		_cards(c)
	if zoom > 0.0:
		# flying into the card: the card rect grows to the full screen
		var r: Rect2 = Z.card
		var k = zoom * zoom * (3.0 - 2.0 * zoom)
		var rr = Rect2(r.position.lerp(Vector2.ZERO, k), r.size.lerp(sz, k))
		c.save()
		if k < 0.999:
			c.begin_path()
			c.round_rect(rr.position.x, rr.position.y, rr.size.x, rr.size.y, 30.0 * (1.0 - k))
			c.clip_path()
		# the farm's level page shows the live parallax backdrop itself; other worlds paint their scene
		if not (world == 0 and k >= 0.999):
			Art.draw(c, world, rr, t, false)
		c.restore()
	if mode == "levels" and zoom >= 1.0:
		_levels(c)
	_header(c)
	if mode == "worlds" and zoom <= 0.0:
		_dots()

func _backdrop(c, w: int) -> void:
	var W = Art.WORLDS[w]
	c.fill_rect(0, 0, Z.sz.x, Z.sz.y, c.lin(0, 0, 0, Z.sz.y, [Color(W.sky[0]).darkened(0.3), Color(W.sky[1]).darkened(0.15)]))
	c.begin_path()
	c.oval(Z.sz.x / 2, Z.card.get_center().y, Z.card.size.x * 0.8, Z.card.size.y * 0.66)
	c.fill_path(Color(1, 1, 1, 0.1))

func _cards(c) -> void:
	var base: Rect2 = Z.card
	var order = []
	for i in n_worlds:
		var d = i - scroll
		if absf(d) < 2.2:
			order.append([absf(d), i])
	order.sort()
	order.reverse()
	for e in order:
		var i: int = e[1]
		var d = i - scroll
		var k = 1.0 - 0.16 * minf(1.0, absf(d))
		var x = Z.sz.x / 2 + d * Z.spacing * 0.86
		if i == world and zoom > 0.0:
			continue
		var pop = (1.0 + 0.06 * sin(_world_pop * PI)) if i == world else 1.0
		var shake = sin(t * 60.0) * 10.0 * _shake_w if i == int(roundf(scroll)) else 0.0
		c.save()
		c.translate(x + shake, base.get_center().y)
		c.scale(k * pop, k * pop)
		_card(c, i, Rect2(-base.size / 2, base.size))
		c.restore()

func _card(c, i: int, r: Rect2) -> void:
	var W = Art.WORLDS[i]
	var open = _world_open(i)
	var exists = _first_of(i) < playable
	c.begin_path()
	c.round_rect(r.position.x + 4, r.position.y + 14, r.size.x, r.size.y, 30)
	c.fill_path(Color(0, 0, 0, 0.22))
	c.begin_path()
	c.round_rect(r.position.x, r.position.y + 8, r.size.x, r.size.y, 30)
	c.fill_path(Color(W.tile).darkened(0.3))
	c.begin_path()
	c.round_rect(r.position.x - 4, r.position.y - 4, r.size.x + 8, r.size.y + 16, 34)
	c.fill_path(Color(W.tile).darkened(0.62))
	c.begin_path()
	c.round_rect(r.position.x, r.position.y + 8, r.size.x, r.size.y, 30)
	c.fill_path(Color(W.tile).darkened(0.3))
	c.begin_path()
	c.round_rect(r.position.x, r.position.y, r.size.x, r.size.y, 30)
	c.fill_path(Color("FFF6E4"))
	var art = Rect2(r.position + Vector2(10, 10), Vector2(r.size.x - 20, r.size.y * 0.7))
	c.save()
	c.begin_path()
	c.round_rect(art.position.x, art.position.y, art.size.x, art.size.y, 22)
	c.clip_path()
	Art.draw(c, i, art, t, true)
	if not open:
		c.fill_rect(art.position.x, art.position.y, art.size.x, art.size.y, Color(0.15, 0.12, 0.1, 0.45))
	c.restore()
	# world number ribbon on the art
	var rb = Rect2(art.position.x + 16, art.position.y + 16, 132, 40)
	c.begin_path()
	c.round_rect(rb.position.x, rb.position.y + 4, rb.size.x, rb.size.y, 14)
	c.fill_path(Color(W.tile).darkened(0.3))
	c.begin_path()
	c.round_rect(rb.position.x, rb.position.y, rb.size.x, rb.size.y, 14)
	c.fill_path(Color(W.tile))
	var T = c.T
	var k = c.sc()
	_text_at(T * (rb.get_center() + Vector2(0, 8)), "WORLD %d" % (i + 1), 22 * k, Color.WHITE)
	var py = art.end.y + (r.end.y - art.end.y) / 2.0
	var nfs = 36.0
	while nfs > 22.0 and UI.font(900).get_string_size(W.name, HORIZONTAL_ALIGNMENT_LEFT, -1, int(nfs)).x > r.size.x - 40:
		nfs -= 2.0
	_text_at(T * Vector2(0, py - 8), W.name, nfs * k, UI.INK)
	if open:
		var ids = _levels_of(i)
		var got = 0
		for j in ids:
			got += _stars(j)
		_star_count(T * Vector2(0, py + 34), got, ids.size() * 3, 24 * k)
	else:
		_text_at(T * Vector2(0, py + 34), ("Finish World %d" % i) if exists else "Coming soon", 22 * k, UI.MUTED)
	if not open:
		_padlock(c, art.get_center() + Vector2(0, -4), 1.25, 0.0)

func _padlock(c, p: Vector2, sc: float, burst: float) -> void:
	if burst >= 1.0:
		return
	UI.padlock(self, c.T * p, c.sc() * sc * (1.0 + burst * 0.6), burst)

func _levels(c) -> void:
	var ids = _levels_of(world)
	var W = Art.WORLDS[world]
	for k in ids.size():
		var i: int = ids[k]
		var r = _tile_rect(k, ids.size())
		var pop = clampf(_tile_in * 1.4 - k * 0.1, 0.0, 1.0)
		if pop <= 0.0:
			continue
		var unlock: float = _unlock.get(i, 1.0 if i <= current else 0.0)
		var locked = i >= playable or unlock < 0.5
		var boss = levels[i].has("boss")
		var cur = i == current and i < playable and unlock >= 1.0
		var col = Color("B9B1A8") if locked else (Color("D94A3A") if boss else Color(W.tile))
		var s = pop * (1.0 + (0.05 * sin(t * 4.0) if cur else 0.0))
		if unlock > 0.0 and unlock < 1.0:
			s *= 1.0 + 0.25 * sin(unlock * PI)
		var sh = sin(t * 50.0) * 8.0 * _unlock_shake.get(i, 0.0)
		c.save()
		c.translate(r.get_center().x + sh, r.get_center().y)
		c.scale(s, s)
		var R = Rect2(-r.size / 2, r.size)
		var T0: Transform2D = c.T
		var kk = c.sc()
		var SR = Rect2(T0 * R.position, R.size * kk)
		if cur:
			UI.rounded(self, SR.grow(13 * kk), Color(1, 1, 1, 0.45 + 0.2 * sin(t * 4.0)), 40 * kk)
		UI.slab(self, SR, col, 30 * kk, 10 * kk, 0.0, 4.0 * kk)
		if locked or (unlock > 0.0 and unlock < 1.0):
			_padlock(c, Vector2(0, -10), R.size.x / 100.0, maxf(0.0, (unlock - 0.5) * 2.0))
		if not locked:
			UI.text(self, T0 * Vector2(0, R.size.y * 0.06), str(int(levels[i].id)), int(R.size.x * 0.5 * kk), Color.WHITE, col.darkened(0.6), int(12 * kk))
			var st = _stars(i)
			var sp = _star_pop.get(i, 1.0)
			for j in 3:
				var p = Vector2((j - 1) * R.size.x * 0.27, R.size.y * 0.27 - (5.0 if j == 1 else 0.0))
				UI.star(self, T0 * p, R.size.x * (0.125 if j == 1 else 0.105) * kk, j < st, sp)
		if boss:
			c.save()
			c.translate(R.size.x * 0.36, -R.size.y * 0.48)
			c.rotate(0.3)
			c.begin_path()
			c.poly([-16, 8, -18, -10, -8, -2, 0, -16, 8, -2, 18, -10, 16, 8])
			c.solid(Color("FFD23F"), Color("7A4A0A"), 3)
			c.restore()
		c.restore()
		if cur and _tile_in >= 1.0 and not _busy:
			var a = r.get_center() + Vector2(0, -r.size.y / 2 - 28 - 8.0 * absf(sin(t * 4.0)))
			c.begin_path()
			c.poly([a.x - 16, a.y - 8, a.x + 16, a.y - 8, a.x, a.y + 12])
			c.solid(Color.WHITE, Color(W.tile).darkened(0.35), 4)

func _star(c, p: Vector2, r: float, on: bool, k: float) -> void:
	var pts = []
	for q in 10:
		var rr = r if q % 2 == 0 else r * 0.5
		var a = -PI / 2 + PI * q / 5.0
		pts.append(p.x + cos(a) * rr)
		pts.append(p.y + sin(a) * rr)
	c.begin_path()
	c.poly(pts)
	c.fill_path(Color(0, 0, 0, 0.25))
	if on and k > 0.0:
		c.save()
		c.translate(p.x, p.y)
		c.scale(k, k)
		c.translate(-p.x, -p.y)
		c.begin_path()
		c.poly(pts)
		c.solid(UI.GOLD, Color("A86A00"), 2.5)
		c.restore()

func _header(c) -> void:
	var h: Rect2 = Z.header
	var coins = int(save.get("coins", 0))
	var f = UI.display()
	var cw = f.get_string_size(str(coins), HORIZONTAL_ALIGNMENT_LEFT, -1, 30).x
	var pill = Rect2(h.end.x - cw - 84, h.position.y + 10, cw + 84, 58)
	UI.pill(self, pill)
	UI.icon(self, "coin", Vector2(pill.position.x + 32, pill.get_center().y), 36.0, UI.GOLD)
	draw_string(f, Vector2(pill.position.x + 58, pill.get_center().y + 11), str(coins), HORIZONTAL_ALIGNMENT_LEFT, -1, 30, UI.INK)
	if mode == "levels" and zoom >= 1.0:
		var b: Rect2 = Z.back
		UI.slab(self, Rect2(b.position, b.size - Vector2(0, 2)), UI.BLUE, 37.0, 6.0)
		var a = b.get_center() + Vector2(-2, -4)
		var arrow = PackedVector2Array([a + Vector2(8, -15), a + Vector2(-9, 0), a + Vector2(8, 15)])
		draw_polyline(arrow, Color("0B4F7A"), 15.0, true)
		for q in arrow:
			draw_circle(q, 7.5, Color("0B4F7A"))
		draw_polyline(arrow, Color.WHITE, 8.0, true)
		for q in arrow:
			draw_circle(q, 4.0, Color.WHITE)
		var W = Art.WORLDS[world]
		var x0 = b.end.x + 14
		var x1 = pill.position.x - 14
		var wp = Rect2(x0, h.position.y + 6, x1 - x0, 66)
		UI.pill(self, Rect2(wp.position + Vector2(0, 4), Vector2(wp.size.x, 58)))
		var ids = _levels_of(world)
		var got = 0
		for j in ids:
			got += _stars(j)
		var title = W.name
		var stxt = "%d/%d" % [got, ids.size() * 3]
		var sw = f.get_string_size(stxt, HORIZONTAL_ALIGNMENT_LEFT, -1, 24).x
		var fs = 30
		while fs > 16 and f.get_string_size(title, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x > wp.size.x - sw - 80:
			fs -= 2
		draw_string(f, Vector2(wp.position.x + 20, wp.get_center().y + fs * 0.36), title, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, UI.INK)
		draw_string(f, Vector2(wp.end.x - 18 - sw, wp.get_center().y + 9), stxt, HORIZONTAL_ALIGNMENT_LEFT, -1, 24, UI.MUTED)
		UI.icon(self, "star", Vector2(wp.end.x - 38 - sw, wp.get_center().y), 28.0, UI.GOLD)
	else:
		var label = "Choose a world"
		var fs = 32
		var maxw = pill.position.x - h.position.x - 14 - 48
		while fs > 18 and f.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x > maxw:
			fs -= 2
		var tw = f.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		var tp = Rect2(h.position.x, h.position.y + 6, tw + 48, 66)
		UI.pill(self, Rect2(tp.position + Vector2(0, 4), Vector2(tp.size.x, 58)))
		draw_string(f, Vector2(tp.position.x + 24, tp.get_center().y + fs * 0.36), label, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, UI.INK)

func _dots() -> void:
	var n = n_worlds
	var gap = 22.0
	var x0 = Z.sz.x / 2 - (n - 1) * gap / 2
	for i in n:
		var d = absf(i - scroll)
		var r = 6.0 + 4.0 * maxf(0.0, 1.0 - d)
		draw_circle(Vector2(x0 + i * gap, Z.dots_y), r, Color(1, 1, 1, 0.5 + 0.5 * maxf(0.0, 1.0 - d)))

func _star_count(p: Vector2, got: int, of: int, size: float) -> void:
	var f = UI.display()
	var s = "%d / %d" % [got, of]
	var fs = int(size)
	var w = f.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	var x0 = p.x - (w + size * 1.4) / 2
	UI.icon(self, "star", Vector2(x0 + size * 0.5, p.y - size * 0.34), size * 1.1, UI.GOLD)
	draw_string(f, Vector2(x0 + size * 1.4, p.y), s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, UI.MUTED)

func _text_at(p: Vector2, s: String, size: float, col: Color, shadow := Color(0, 0, 0, 0)) -> void:
	var f = UI.display()
	var fs = maxi(8, int(size))
	var w = f.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	if shadow.a > 0.0:
		draw_string(f, Vector2(p.x - w / 2.0, p.y + fs * 0.08), s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, shadow)
	draw_string(f, Vector2(p.x - w / 2.0, p.y), s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, col)
