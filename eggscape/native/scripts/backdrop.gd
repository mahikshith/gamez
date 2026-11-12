# Farm world backdrop in screen space: soft sky gradient, a sun with a halo, rounded drifting clouds, three flat
# hill layers with a slight parallax sway as the vault turns, one simple barn. Flat colours, no outlines.
extends Node2D

var t = 0.0
var sway = 0.0
var clouds = []

func _ready() -> void:
	for i in 4:
		clouds.append({"x": randf() * 800.0 - 60.0, "y": randf_range(0.08, 0.32), "s": randf_range(0.8, 1.3), "v": randf_range(5, 11)})

func _process(dt: float) -> void:
	t += dt
	var W = get_viewport_rect().size.x
	for c in clouds:
		c.x += c.v * dt
		if c.x > W + 140.0:
			c.x = -180.0
	queue_redraw()

func _hill(W: float, y0: float, amp: float, freq: float, ph: float, col: Color, H: float) -> void:
	var pts = PackedVector2Array()
	var n = 40
	for i in n + 1:
		var x = -40.0 + (W + 80.0) * i / n
		pts.append(Vector2(x, y0 - amp * (0.55 + 0.45 * sin(x * freq + ph))))
	pts.append(Vector2(W + 40.0, H + 10.0))
	pts.append(Vector2(-40.0, H + 10.0))
	draw_colored_polygon(pts, col)

func _cloud(p: Vector2, s: float) -> void:
	var col = Color(1, 1, 1, 0.95)
	var w = 150.0 * s
	var h = 34.0 * s
	var sb = StyleBoxFlat.new()
	sb.bg_color = col
	sb.set_corner_radius_all(int(h / 2))
	sb.anti_aliasing = true
	draw_style_box(sb, Rect2(p - Vector2(w / 2, 0), Vector2(w, h)))
	draw_circle(p + Vector2(-w * 0.18, 2), h * 0.95, col)
	draw_circle(p + Vector2(w * 0.12, -2), h * 1.25, col)

func _draw() -> void:
	var sz = get_viewport_rect().size
	var W = sz.x
	var H = sz.y
	draw_polygon(PackedVector2Array([Vector2(0, 0), Vector2(W, 0), Vector2(W, H * 0.7), Vector2(0, H * 0.7)]),
		PackedColorArray([Color("7CCFFB"), Color("7CCFFB"), Color("DDF4FF"), Color("DDF4FF")]))
	draw_rect(Rect2(0, H * 0.7, W, H * 0.3 + 2), Color("DDF4FF"))
	var sc = Vector2(W * 0.82, H * 0.1)
	draw_circle(sc, 92.0, Color(1, 1, 1, 0.18))
	draw_circle(sc, 66.0, Color(1, 0.98, 0.8, 0.35))
	draw_circle(sc, 46.0, Color("FFE36B"))
	for c in clouds:
		_cloud(Vector2(c.x, c.y * H), c.s)
	var o = sway * 14.0
	_hill(W, H * 0.62, 56.0, 0.007, 0.6 + o * 0.002, Color("C3EBA0"), H)
	var bx = W * 0.15 + o * 0.3
	var by = H * 0.585
	draw_colored_polygon(PackedVector2Array([Vector2(bx - 34, by), Vector2(bx - 34, by - 40), Vector2(bx, by - 64), Vector2(bx + 34, by - 40), Vector2(bx + 34, by)]), Color("F07B6E"))
	draw_colored_polygon(PackedVector2Array([Vector2(bx - 40, by - 38), Vector2(bx, by - 70), Vector2(bx + 40, by - 38), Vector2(bx + 34, by - 36), Vector2(bx, by - 62), Vector2(bx - 34, by - 36)]), Color("FFF6EC"))
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color("C95A4E")
	sb.corner_radius_top_left = 12
	sb.corner_radius_top_right = 12
	draw_style_box(sb, Rect2(bx - 11, by - 26, 22, 26))
	_hill(W, H * 0.68, 46.0, 0.01, 2.1 + o * 0.004, Color("A3DC78"), H)
	_hill(W, H * 0.76, 30.0, 0.014, 4.0 + o * 0.006, Color("86CC5B"), H)
