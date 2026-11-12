# Farm world backdrop in screen space, built in depth: a deep sky with a blooming sun and slow rays, two decks of
# painted clouds, hazy far hills, a middle hill with the barn, silo, trees and fence, a near hill with hay bales, and
# drifting pollen in front. Each layer shifts and scales by its depth as the level camera moves (`pan`, `zoom`),
# and the whole landscape rides on `horizon` (the screen y of the world's ground line) so it always meets the turf.
extends Node2D

const CLOUD1 = preload("res://assets/fx/cloud1.png")
const CLOUD2 = preload("res://assets/fx/cloud2.png")
const GLOW = preload("res://assets/fx/glow.png")

var t = 0.0
var sway = 0.0
var pan = Vector2.ZERO # camera offset from its rest framing, in screen px
var zoom = 1.0 # camera zoom relative to the rest framing
var horizon = -1.0 # screen y of the ground line; < 0 = default for menus
var clouds = []
var motes = []
var _hz = 0.0
var _add: CanvasItemMaterial

func _ready() -> void:
	_add = CanvasItemMaterial.new()
	_add.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	var rng = RandomNumberGenerator.new()
	rng.seed = 5
	for i in 7:
		clouds.append({"x": rng.randf() * 1000.0 - 140.0, "y": rng.randf_range(0.05, 0.4), "s": rng.randf_range(0.55, 1.15), "v": rng.randf_range(4, 10), "far": i % 2 == 0})
	for i in 14:
		motes.append({"x": rng.randf(), "y": rng.randf(), "s": rng.randf_range(0.5, 1.0), "p": rng.randf() * TAU})

func _process(dt: float) -> void:
	t += dt
	var sz = get_viewport_rect().size
	for c in clouds:
		c.x += c.v * dt * (0.5 if c.far else 1.0)
		if c.x > sz.x + 200.0:
			c.x = -260.0
	var want = horizon if horizon >= 0.0 else sz.y * 0.74
	_hz = want if _hz == 0.0 else lerpf(_hz, want, 1.0 - exp(-dt * 12.0))
	queue_redraw()

func _strip(top: PackedVector2Array, y_bot: float, c_top: Color, c_bot: Color, span := 260.0) -> void:
	var pts = PackedVector2Array()
	var cols = PackedColorArray()
	var idx = PackedInt32Array()
	var ymin = 1e9
	for p in top:
		ymin = minf(ymin, p.y)
	for i in top.size():
		pts.append(top[i])
		cols.append(c_top.lerp(c_bot, clampf((top[i].y - ymin) / span, 0.0, 1.0)))
		pts.append(Vector2(top[i].x, maxf(y_bot, top[i].y + 1.0)))
		cols.append(c_top.lerp(c_bot, clampf((y_bot - ymin) / span, 0.0, 1.0)))
		if i > 0:
			var k = i * 2
			idx.append_array([k - 2, k - 1, k, k - 1, k + 1, k])
	RenderingServer.canvas_item_add_triangle_array(get_canvas_item(), idx, pts, cols)

func _hill(W: float, y0: float, amp: float, freq: float, ph: float, ox: float) -> PackedVector2Array:
	var pts = PackedVector2Array()
	var n = 48
	for i in n + 1:
		var x = -60.0 + (W + 120.0) * i / n
		pts.append(Vector2(x, y0 - amp * (0.5 + 0.5 * sin((x - ox) * freq + ph)) - amp * 0.18 * sin((x - ox) * freq * 2.7 + ph * 1.7)))
	return pts

func _hill_y(W: float, y0: float, amp: float, freq: float, ph: float, ox: float, x: float) -> float:
	return y0 - amp * (0.5 + 0.5 * sin((x - ox) * freq + ph)) - amp * 0.18 * sin((x - ox) * freq * 2.7 + ph * 1.7)

func _tree(p: Vector2, s: float, c0: Color, c1: Color, c2: Color) -> void:
	draw_colored_polygon(PackedVector2Array([p + Vector2(-5, 0) * s, p + Vector2(-3.5, -30) * s, p + Vector2(3.5, -30) * s, p + Vector2(5, 0) * s]), Color("7A4A22"))
	var blobs = [[0, -52, 30], [-22, -40, 22], [22, -42, 23], [-8, -70, 22], [14, -66, 20]]
	for b in blobs:
		draw_circle(p + Vector2(b[0] + 3, b[1] + 4) * s, b[2] * s, c2)
	for b in blobs:
		draw_circle(p + Vector2(b[0], b[1]) * s, b[2] * s * 0.94, c0)
	for b in blobs:
		draw_circle(p + Vector2(b[0] - 5, b[1] - 6) * s, b[2] * s * 0.55, c1)

func _barn(b: Vector2, s: float) -> void:
	# silo behind
	draw_rect(Rect2(b + Vector2(44, -92) * s, Vector2(30, 92) * s), Color("C9D3DA"))
	draw_rect(Rect2(b + Vector2(62, -92) * s, Vector2(12, 92) * s), Color("9DA9B3"))
	draw_colored_polygon(PackedVector2Array([b + Vector2(42, -92) * s, b + Vector2(59, -112) * s, b + Vector2(76, -92) * s]), Color("E4574B"))
	for k in 3:
		draw_line(b + Vector2(44, -70 + k * 24) * s, b + Vector2(74, -70 + k * 24) * s, Color("8794A0"), 2.0 * s)
	# barn body: lit front, roof with a pale trim, loft window, big doors with a cross brace
	var body = PackedVector2Array([b + Vector2(-46, 0) * s, b + Vector2(-46, -50) * s, b + Vector2(-30, -74) * s, b + Vector2(0, -88) * s, b + Vector2(30, -74) * s, b + Vector2(46, -50) * s, b + Vector2(46, 0) * s])
	draw_colored_polygon(body, Color("E4574B"))
	draw_colored_polygon(PackedVector2Array([b + Vector2(18, 0) * s, b + Vector2(18, -80) * s, b + Vector2(30, -74) * s, b + Vector2(46, -50) * s, b + Vector2(46, 0) * s]), Color("C4423A"))
	var roof = PackedVector2Array([b + Vector2(-52, -48) * s, b + Vector2(-33, -78) * s, b + Vector2(0, -94) * s, b + Vector2(33, -78) * s, b + Vector2(52, -48) * s])
	draw_polyline(roof, Color("8C2C26"), 9.0 * s, true)
	draw_polyline(roof, Color("FFF3E0"), 5.0 * s, true)
	draw_rect(Rect2(b + Vector2(-17, -40) * s, Vector2(34, 40) * s), Color("FFF3E0"))
	draw_rect(Rect2(b + Vector2(-13, -36) * s, Vector2(26, 36) * s), Color("9C3029"))
	draw_line(b + Vector2(-13, -36) * s, b + Vector2(13, 0) * s, Color("FFF3E0"), 3.0 * s, true)
	draw_line(b + Vector2(13, -36) * s, b + Vector2(-13, 0) * s, Color("FFF3E0"), 3.0 * s, true)
	draw_circle(b + Vector2(0, -62) * s, 9.0 * s, Color("FFF3E0"))
	draw_circle(b + Vector2(0, -62) * s, 6.0 * s, Color("5A2420"))

func _bale(p: Vector2, s: float) -> void:
	draw_colored_polygon(_ell(p + Vector2(0, 2) * s, 34 * s, 6 * s), Color(0.1, 0.3, 0.05, 0.3))
	draw_circle(p + Vector2(0, -22) * s, 25 * s, Color("A8741E"))
	draw_circle(p + Vector2(0, -22) * s, 22 * s, Color("F0C24A"))
	draw_arc(p + Vector2(0, -22) * s, 15 * s, 0.4, 4.6, 20, Color("C8962A"), 3.0 * s, true)
	draw_arc(p + Vector2(0, -22) * s, 8 * s, 1.0, 6.0, 16, Color("C8962A"), 3.0 * s, true)
	draw_arc(p + Vector2(0, -22) * s, 19 * s, 3.6, 4.9, 10, Color("FFE9A0"), 3.0 * s, true)

func _ell(c: Vector2, rx: float, ry: float) -> PackedVector2Array:
	var pts = PackedVector2Array()
	for i in 24:
		pts.append(c + Vector2(cos(TAU * i / 24.0) * rx, sin(TAU * i / 24.0) * ry))
	return pts

func _draw() -> void:
	var sz = get_viewport_rect().size
	var W = sz.x
	var H = sz.y
	var hz = _hz
	# sky: deep blue overhead, pale and warm toward the horizon
	var ys = [0.0, hz * 0.45, hz * 0.85, H]
	var cs = [Color("2E8FE6"), Color("6FC4F7"), Color("CFEFFC"), Color("EAF8E6")]
	for i in 3:
		draw_polygon(PackedVector2Array([Vector2(0, ys[i]), Vector2(W, ys[i]), Vector2(W, ys[i + 1]), Vector2(0, ys[i + 1])]), PackedColorArray([cs[i], cs[i], cs[i + 1], cs[i + 1]]))
	# sun: slow rays, a hot core that the glow pass blooms
	var sc = Vector2(W * 0.8, hz * 0.17) - pan * 0.03
	for i in 10:
		var a = t * 0.05 + TAU * i / 10.0
		var wdt = 0.07 + 0.03 * sin(i * 1.7)
		draw_polygon(PackedVector2Array([sc, sc + Vector2.from_angle(a - wdt) * 620.0, sc + Vector2.from_angle(a + wdt) * 620.0]),
			PackedColorArray([Color(1, 0.97, 0.8, 0.22), Color(1, 0.97, 0.8, 0.0), Color(1, 0.97, 0.8, 0.0)]))
	var gs = 520.0 + 16.0 * sin(t * 0.8)
	draw_texture_rect(GLOW, Rect2(sc - Vector2(gs, gs) / 2.0, Vector2(gs, gs)), false, Color(1.0, 0.95, 0.72, 0.85))
	draw_circle(sc, 56.0, Color(1.0, 0.93, 0.6, 0.55))
	draw_circle(sc, 46.0, Color(1.0, 0.9, 0.5))
	draw_circle(sc + Vector2(-8, -8), 30.0, Color(1.0, 0.97, 0.75))
	# clouds, two decks
	for pass_far in [true, false]:
		for c in clouds:
			if c.far != pass_far:
				continue
			var tex = CLOUD2 if c.far else CLOUD1
			var s = c.s * (0.8 if c.far else 1.0)
			var d = 0.04 if c.far else 0.09
			var p = Vector2(c.x, c.y * hz) - pan * d
			draw_texture_rect(tex, Rect2(p, tex.get_size() * s), false, Color(1, 1, 1, 0.8 if c.far else 0.97))
	# far hills in haze
	var o = sway * 10.0
	var k1 = 1.0 + (zoom - 1.0) * 0.12
	var far = _hill(W, hz - 96.0 * k1 - pan.y * 0.12, 70.0, 0.006, 0.4, -pan.x * 0.12 + o * 0.2)
	_strip(far, H, Color("9ED7C4"), Color("C9EDD0"), 150.0)
	for i in 9:
		var x = fposmod(i * 97.0 - pan.x * 0.12 + o * 0.2, W + 120.0) - 60.0
		var y = _hill_y(W, hz - 96.0 * k1 - pan.y * 0.12, 70.0, 0.006, 0.4, -pan.x * 0.12 + o * 0.2, x)
		_tree(Vector2(x, y + 6), 0.36 + 0.1 * (i % 3), Color("7DC3A6"), Color("92D2B6"), Color("68AE93"))
	draw_polygon(PackedVector2Array([Vector2(0, hz - 110), Vector2(W, hz - 110), Vector2(W, hz - 20), Vector2(0, hz - 20)]),
		PackedColorArray([Color(1, 1, 1, 0), Color(1, 1, 1, 0), Color(0.93, 0.98, 0.95, 0.55), Color(0.93, 0.98, 0.95, 0.55)]))
	# middle hill: barn, silo, trees, fence
	var k2 = 1.0 + (zoom - 1.0) * 0.3
	var mo = -pan.x * 0.3 + o * 0.5
	var my = hz - 44.0 * k2 - pan.y * 0.3
	var mid = _hill(W, my, 62.0, 0.0085, 2.2, mo)
	_strip(mid, H, Color("A9E36F"), Color("6FC04A"), 170.0)
	var rimhi = PackedVector2Array()
	for p in mid:
		rimhi.append(p + Vector2(0, 2))
	draw_polyline(rimhi, Color(0.86, 1.0, 0.62, 0.9), 3.0, true)
	var bx = W * 0.2 + mo
	_barn(Vector2(bx, _hill_y(W, my, 62.0, 0.0085, 2.2, mo, bx) + 8), 1.0 * k2)
	for i in 4:
		var x = [W * 0.44, W * 0.58, W * 0.9, W * 0.02][i] + mo
		_tree(Vector2(x, _hill_y(W, my, 62.0, 0.0085, 2.2, mo, x) + 8), [0.8, 0.6, 0.95, 0.7][i] * k2, Color("58B23A"), Color("86D452"), Color("3F9330"))
	for i in 9:
		var x = W * 0.62 + i * 24.0 + mo
		var y = _hill_y(W, my, 62.0, 0.0085, 2.2, mo, x) + 6
		draw_line(Vector2(x, y), Vector2(x, y - 22), Color("B9C6C0"), 6.0)
		draw_line(Vector2(x, y), Vector2(x, y - 22), Color("FFFFFF"), 4.0)
		if i < 8:
			var y2 = _hill_y(W, my, 62.0, 0.0085, 2.2, mo, x + 24.0) + 6
			draw_line(Vector2(x, y - 16), Vector2(x + 24, y2 - 16), Color("FFFFFF"), 4.0, true)
			draw_line(Vector2(x, y - 7), Vector2(x + 24, y2 - 7), Color("E8EFEA"), 4.0, true)
	draw_polygon(PackedVector2Array([Vector2(0, hz - 60), Vector2(W, hz - 60), Vector2(W, hz + 10), Vector2(0, hz + 10)]),
		PackedColorArray([Color(1, 1, 1, 0), Color(1, 1, 1, 0), Color(0.9, 1.0, 0.8, 0.3), Color(0.9, 1.0, 0.8, 0.3)]))
	# near hill: richer green, hay bales
	var k3 = 1.0 + (zoom - 1.0) * 0.55
	var no = -pan.x * 0.55 + o
	var nyy = hz + 6.0 - pan.y * 0.55
	var near = _hill(W, nyy, 40.0 * k3, 0.012, 4.1, no)
	_strip(near, H, Color("8ED957"), Color("4FA832"), 200.0)
	var rim2 = PackedVector2Array()
	for p in near:
		rim2.append(p + Vector2(0, 2))
	draw_polyline(rim2, Color(0.8, 1.0, 0.55, 0.9), 3.0, true)
	for i in 2:
		var x = [W * 0.08, W * 0.93][i] + no
		_bale(Vector2(x, _hill_y(W, nyy, 40.0 * k3, 0.012, 4.1, no, x) + 10), [1.0, 0.8][i] * k3)
	# pollen drifting in the light
	for m in motes:
		var p = Vector2(fposmod(m.x * W + t * 9.0 * m.s + sin(t * 0.7 + m.p) * 20.0 - pan.x * 0.8, W), fposmod(m.y * H - t * 6.0 * m.s - pan.y * 0.8, H))
		var a = 0.25 + 0.2 * sin(t * 1.3 + m.p)
		draw_circle(p, 7.0 * m.s, Color(1, 1, 0.85, a * 0.25))
		draw_circle(p, 2.6 * m.s, Color(1, 1, 0.9, a + 0.2))
