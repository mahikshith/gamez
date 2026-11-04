# World-space ground strip and the straw nest. Two instances: back (behind eggs) and front (the nest's front rim).
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
		draw_rect(Rect2(-4000, gy, 8000, 2000), Color("6fb44f"))
		draw_rect(Rect2(-4000, gy + 26, 8000, 2000), Color("5a9a40"))
		draw_line(Vector2(-4000, gy), Vector2(4000, gy), Color("3f7a2c"), 4.0)
		for i in 160:
			var x = -2000.0 + i * 25.0 + sin(i * 3.1) * 8.0
			draw_line(Vector2(x, gy + 2), Vector2(x - 4, gy - 10 - (i % 3) * 3), Color("4e8f36"), 3.0, true)
		# nest back: dark straw bowl interior
		draw_colored_polygon(G.ellipse(Vector2(nx, ny - 22), w + 6, 22, 32), Color("8a5a24"))
		draw_colored_polygon(G.ellipse(Vector2(nx, ny - 20), w - 6, 14, 32), Color("5e3a14"))
	else:
		# nest front rim: woven straw over the eggs' lower half
		var rim = PackedVector2Array()
		for i in 25:
			var a = lerpf(0.0, PI, i / 24.0)
			rim.append(Vector2(nx + cos(a) * (w + 10), ny - 18 + sin(a) * 24))
		for i in range(24, -1, -1):
			var a = lerpf(0.0, PI, i / 24.0)
			rim.append(Vector2(nx + cos(a) * (w - 2), ny - 22 + sin(a) * 8))
		G.shape(self, rim, Color("d9a24c"), Color("7a4a16"), 3.0)
		for i in 14:
			var x = nx - w + (2 * w) * (i + 0.5) / 14.0
			draw_line(Vector2(x - 8, ny - 14 + sin(i) * 3), Vector2(x + 10, ny - 2 + cos(i) * 3), Color("b07a2e"), 2.5, true)
		for i in 9:
			var x = nx - w + (2 * w) * (i + 0.5) / 9.0
			draw_line(Vector2(x, ny - 22), Vector2(x + 14 * sin(i * 2.3), ny - 34), Color("e8c06a"), 2.5, true)
