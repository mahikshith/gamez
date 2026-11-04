# World-space ground and the straw nest, flat style. Two instances: back (ground + nest bowl behind the eggs) and
# front (the nest's woven front rim over the eggs' lower half).
extends Node2D

const G = preload("res://scripts/g.gd")
var vault
var front = false

func _draw() -> void:
	var gy: float = vault.ground_y * G.PPM
	var nx: float = vault.nest_x * G.PPM
	var w: float = vault.nest_w / 2 * G.PPM
	var ny = gy - 2.0
	if not front:
		draw_rect(Rect2(-4000, gy, 8000, 3000), Color("6DBE45"))
		draw_rect(Rect2(-4000, gy - 6, 8000, 12), Color("86CC5B"))
		for i in 90:
			var x = -1800.0 + i * 40.0 + sin(i * 3.1) * 10.0
			var c = Vector2(x, gy - 2)
			draw_colored_polygon(PackedVector2Array([c + Vector2(-5, 0), c + Vector2(0, -12 - (i % 3) * 4), c + Vector2(5, 0)]), Color("5AAE38"))
		# nest bowl interior
		draw_colored_polygon(G.ellipse(Vector2(nx, ny - 22), w + 8, 24, 40), Color("A8692C"))
		draw_colored_polygon(G.ellipse(Vector2(nx, ny - 20), w - 6, 14, 40), Color("7C4A1C"))
	else:
		var rim = PackedVector2Array()
		for i in 33:
			var a = lerpf(0.0, PI, i / 32.0)
			rim.append(Vector2(nx + cos(a) * (w + 12), ny - 18 + sin(a) * 26))
		for i in range(32, -1, -1):
			var a = lerpf(0.0, PI, i / 32.0)
			rim.append(Vector2(nx + cos(a) * (w - 2), ny - 22 + sin(a) * 8))
		draw_colored_polygon(rim, Color("E0A24E"))
		# woven bands
		for k in 3:
			var band = PackedVector2Array()
			for i in 25:
				var a = lerpf(0.15, PI - 0.15, i / 24.0)
				band.append(Vector2(nx + cos(a) * (w + 6 - k * 2), ny - 16 + k * 7 + sin(a) * (20 - k * 5)))
			draw_polyline(band, Color("C7863A"), 4.0, true)
		for i in 11:
			var x = nx - w + (2 * w) * (i + 0.5) / 11.0
			draw_line(Vector2(x, ny - 20), Vector2(x + 12 * sin(i * 2.3), ny - 32), Color("F5C772"), 3.5, true)
