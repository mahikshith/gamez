# Farm world backdrop, drawn in screen space behind the vault: sky gradient, sun with soft rays, drifting clouds,
# three hill layers that sway slightly with the vault's turn (parallax), a red barn and a fence.
extends Node2D

var t = 0.0
var sway = 0.0
var clouds = []

func _ready() -> void:
	for i in 5:
		clouds.append({"x": randf() * 900.0 - 90.0, "y": randf_range(90, 420), "s": randf_range(0.7, 1.4), "v": randf_range(6, 14)})

func _process(dt: float) -> void:
	t += dt
	var W = get_viewport_rect().size.x
	for c in clouds:
		c.x += c.v * dt
		if c.x > W + 120.0:
			c.x = -160.0
	queue_redraw()

func _hill(W: float, y0: float, amp: float, freq: float, ph: float, col: Color, H: float) -> void:
	var pts = PackedVector2Array()
	var n = 48
	for i in n + 1:
		var x = -40.0 + (W + 80.0) * i / n
		pts.append(Vector2(x, y0 - amp * (0.6 + 0.4 * sin(x * freq + ph))))
	pts.append(Vector2(W + 40.0, H + 10.0))
	pts.append(Vector2(-40.0, H + 10.0))
	draw_colored_polygon(pts, col)

func _draw() -> void:
	var sz = get_viewport_rect().size
	var W = sz.x
	var H = sz.y
	draw_polygon(PackedVector2Array([Vector2(0, 0), Vector2(W, 0), Vector2(W, H * 0.62), Vector2(0, H * 0.62)]),
		PackedColorArray([Color("5ec2f2"), Color("5ec2f2"), Color("cdeffa"), Color("cdeffa")]))
	draw_rect(Rect2(0, H * 0.62, W, H), Color("cdeffa"))
	# sun with slowly turning rays
	var sc = Vector2(W * 0.8, H * 0.13)
	for i in 12:
		var a = t * 0.08 + TAU * i / 12.0
		draw_colored_polygon(PackedVector2Array([sc, sc + Vector2.from_angle(a - 0.09) * 210.0, sc + Vector2.from_angle(a + 0.09) * 210.0]), Color(1, 0.97, 0.75, 0.16))
	draw_circle(sc, 70.0, Color(1, 0.96, 0.7, 0.35))
	draw_circle(sc, 52.0, Color("fff3a6"))
	draw_circle(sc, 44.0, Color("ffe066"))
	for c in clouds:
		var p = Vector2(c.x, c.y)
		var s: float = c.s
		for b in [[-38, 6, 26], [-10, -10, 34], [24, -2, 30], [48, 8, 22], [6, 12, 30]]:
			draw_circle(p + Vector2(b[0], b[1]) * s, b[2] * s, Color(1, 1, 1, 0.92))
		draw_rect(Rect2(p + Vector2(-50, 10) * s, Vector2(110, 22) * s), Color(1, 1, 1, 0.92))
	var o = sway * 18.0
	_hill(W, H * 0.6, 60.0, 0.008, 0.5 + o * 0.002, Color("9fd38a"), H)
	# barn on the far hill
	var bx = W * 0.16 + o * 0.4
	var by = H * 0.555
	draw_colored_polygon(PackedVector2Array([Vector2(bx - 44, by), Vector2(bx - 44, by - 52), Vector2(bx, by - 84), Vector2(bx + 44, by - 52), Vector2(bx + 44, by)]), Color("c8433a"))
	draw_colored_polygon(PackedVector2Array([Vector2(bx - 52, by - 50), Vector2(bx, by - 92), Vector2(bx + 52, by - 50), Vector2(bx + 44, by - 46), Vector2(bx, by - 82), Vector2(bx - 44, by - 46)]), Color("f4efe6"))
	draw_rect(Rect2(bx - 15, by - 34, 30, 34), Color("8e2a23"))
	draw_line(Vector2(bx - 15, by - 34), Vector2(bx + 15, by), Color("f4efe6"), 3.0, true)
	draw_line(Vector2(bx + 15, by - 34), Vector2(bx - 15, by), Color("f4efe6"), 3.0, true)
	_hill(W, H * 0.66, 50.0, 0.011, 2.0 + o * 0.004, Color("7cc26a"), H)
	_hill(W, H * 0.74, 34.0, 0.015, 4.0 + o * 0.007, Color("63ad55"), H)
	# fence
	var fy = H * 0.73
	for i in int(W / 46.0) + 2:
		var x = fmod(i * 46.0 + o * 0.9, W + 46.0) - 10.0
		draw_rect(Rect2(x, fy - 34, 9, 40), Color("e9d3a8"))
		draw_rect(Rect2(x, fy - 34, 9, 40), Color("9c7a4a"), false, 2.0)
	draw_rect(Rect2(-10, fy - 26, W + 20, 6), Color("e9d3a8"))
	draw_rect(Rect2(-10, fy - 12, W + 20, 6), Color("e9d3a8"))
