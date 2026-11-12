# World-space ground stage and the straw nest. Two instances: back (soil cross-section, turf cap, tufts and flowers,
# contact shadows, the nest's dark inside) and front (the woven basket rim over the eggs' lower half).
extends Node2D

const G = preload("res://scripts/g.gd")
var vault
var front = false
var hen_x = 0.0
var t = 0.0
var glow = 0.0 # the nest lights up for a moment when an egg comes home

func _process(dt: float) -> void:
	t += dt
	if glow > 0.0:
		glow = maxf(0.0, glow - dt * 1.6)
		queue_redraw()

func _h(i: int) -> float:
	return fposmod(sin(i * 127.1 + 311.7) * 43758.5453, 1.0)

func _grad_rect(x0: float, x1: float, y0: float, y1: float, c0: Color, c1: Color) -> void:
	draw_polygon(PackedVector2Array([Vector2(x0, y0), Vector2(x1, y0), Vector2(x1, y1), Vector2(x0, y1)]), PackedColorArray([c0, c0, c1, c1]))

func _draw() -> void:
	var gy: float = vault.ground_y * G.PPM
	var nx: float = vault.nest_x * G.PPM
	var w: float = vault.nest_w / 2 * G.PPM
	var ny = gy - 2.0
	if not front:
		# soil: warm at the top, deep and dark below, with strata, pebbles and little roots
		_grad_rect(-4000, 4000, gy, gy + 260, Color("9A6434"), Color("5C3719"))
		_grad_rect(-4000, 4000, gy + 260, gy + 3000, Color("5C3719"), Color("2E1A0C"))
		for k in 2:
			var pts = PackedVector2Array()
			for i in 121:
				var x = -3000.0 + i * 50.0
				pts.append(Vector2(x, gy + 92 + k * 86 + sin(x * 0.011 + k * 2.0) * 9.0))
			draw_polyline(pts, Color(0.25, 0.13, 0.05, 0.35), 5.0, true)
			var hi = PackedVector2Array()
			for p in pts:
				hi.append(p + Vector2(0, 5))
			draw_polyline(hi, Color(1, 0.85, 0.6, 0.08), 3.0, true)
		for i in 70:
			var p = Vector2(-2100.0 + i * 60.0 + _h(i) * 40.0, gy + 48 + _h(i + 99) * 190.0)
			var s = 5.0 + _h(i + 7) * 9.0
			draw_colored_polygon(G.ellipse(p + Vector2(1.5, 2), s * 1.25, s * 0.85, 12, _h(i) * 2.0), Color(0.2, 0.1, 0.04, 0.5))
			draw_colored_polygon(G.ellipse(p, s * 1.2, s * 0.8, 12, _h(i) * 2.0), Color("B88A5C") if i % 3 else Color("9C9388"))
			draw_colored_polygon(G.ellipse(p + Vector2(-s * 0.25, -s * 0.22), s * 0.5, s * 0.25, 8, _h(i) * 2.0), Color(1, 1, 1, 0.3))
		# turf: a thick cap with a scalloped overhang, lit along the top
		var cap = PackedVector2Array([Vector2(-4000, gy - 8), Vector2(4000, gy - 8)])
		var n = 320
		for i in n + 1:
			var x = 4000.0 - 8000.0 * i / n
			var sc = absf(sin(x * 0.045 + sin(x * 0.013) * 1.3))
			cap.append(Vector2(x, gy + 20.0 + sc * 15.0))
		var dark = PackedVector2Array()
		for p in cap:
			dark.append(p + Vector2(0, 6.0 if p.y > gy else 0.0))
		draw_colored_polygon(dark, Color("2F7A1E"))
		draw_colored_polygon(cap, Color("63BE38"))
		_grad_rect(-4000, 4000, gy - 8, gy + 12, Color("A6E864"), Color("63BE38"))
		draw_rect(Rect2(-4000, gy - 8, 8000, 3.5), Color("D4F99A"))
		# shadows of what stands on the turf: the vault above, the nest, the hen
		draw_colored_polygon(G.ellipse(Vector2(0, gy + 3), vault.outer_r * G.PPM * 0.92, 14.0, 40), Color(0.05, 0.2, 0.03, 0.2))
		draw_colored_polygon(G.ellipse(Vector2(nx, gy + 4), w + 34, 13.0, 32), Color(0.03, 0.14, 0.02, 0.38))
		draw_colored_polygon(G.ellipse(Vector2(hen_x, gy + 3), 62.0, 11.0, 24), Color(0.03, 0.14, 0.02, 0.3))
		# tufts and flowers along the top (none in front of the nest)
		for i in 120:
			var x = -2400.0 + i * 40.0 + _h(i) * 22.0
			if absf(x - nx) < w + 30.0:
				continue
			var c = Vector2(x, gy - 6)
			var hh = 12.0 + _h(i + 3) * 12.0
			for b in 3:
				var lean = (b - 1) * 6.0 + sin(t * 1.3 + i) * 1.5
				draw_colored_polygon(PackedVector2Array([c + Vector2((b - 1) * 4.0 - 3.5, 2), c + Vector2((b - 1) * 4.0 + lean, -hh * (1.0 if b == 1 else 0.7)), c + Vector2((b - 1) * 4.0 + 3.5, 2)]),
					Color("4FA82A") if b != 1 else Color("86D94C"))
			if i % 5 == 2 and absf(x - nx) > w + 90.0:
				var fc = c + Vector2(10, -hh - 4)
				draw_line(c + Vector2(10, 0), fc, Color("3F8F22"), 2.5, true)
				var pc = Color("FFFFFF") if i % 2 == 0 else Color("FFD64A")
				for q in 5:
					draw_circle(fc + Vector2.from_angle(TAU * q / 5.0) * 4.5, 3.4, pc)
				draw_circle(fc, 3.0, Color("FF9F1A") if i % 2 == 0 else Color("B5651D"))
		# nest inside: dark woven hollow behind the eggs
		draw_colored_polygon(G.ellipse(Vector2(nx, ny - 30), w + 13, 27, 40), Color("6B4A2A"))
		draw_colored_polygon(G.ellipse(Vector2(nx, ny - 30), w + 9, 23, 40), Color("8E5A26"))
		draw_colored_polygon(G.ellipse(Vector2(nx, ny - 26), w - 2, 17, 40), Color("5E3814"))
		if glow > 0.0:
			draw_colored_polygon(G.ellipse(Vector2(nx, ny - 28), w + 4, 20, 40), Color(1.0, 0.9, 0.5, 0.6 * glow))
	else:
		# basket front: a deep bowl of woven straw, outlined, lit rim, shaded belly, straws poking out
		var top = PackedVector2Array()
		var bot = PackedVector2Array()
		for i in 33:
			var u = i / 32.0
			var x = lerpf(-1.0, 1.0, u)
			top.append(Vector2(nx + x * (w + 15), ny - 16 - 20.0 * x * x))
			bot.append(Vector2(nx + x * (w + 15) * (1.0 - 0.1 * (1.0 - x * x)), ny + 9.0 - 30.0 * pow(absf(x), 3.0)))
		var rim = top.duplicate()
		for i in range(32, -1, -1):
			rim.append(bot[i])
		var ol = PackedVector2Array()
		var cen = Vector2(nx, ny - 8)
		for p in rim:
			ol.append(p + (p - cen).normalized() * 3.5)
		draw_colored_polygon(ol, Color("6B4A2A"))
		draw_colored_polygon(rim, Color("DDA04C"))
		# belly shade
		var belly = PackedVector2Array()
		for i in 33:
			belly.append(top[i].lerp(bot[i], 0.55))
		for i in range(32, -1, -1):
			belly.append(bot[i])
		draw_colored_polygon(belly, Color("B9772E"))
		# weave: slanted strokes in two directions
		for i in 15:
			var u = (i + 0.5) / 15.0
			var k = int(u * 32.0)
			var a = top[k].lerp(bot[k], 0.12)
			var b = top[mini(32, k + 2)].lerp(bot[mini(32, k + 2)], 0.9)
			draw_line(a, b, Color("8A5320"), 3.0, true)
			var a2 = top[mini(32, k + 2)].lerp(bot[mini(32, k + 2)], 0.12)
			var b2 = top[k].lerp(bot[k], 0.9)
			draw_line(a2, b2, Color(1.0, 0.85, 0.5, 0.45), 2.2, true)
		# rolled rim
		var roll = PackedVector2Array()
		for p in top:
			roll.append(p + Vector2(0, 3))
		draw_polyline(roll, Color("6B4A2A"), 13.0, true)
		draw_polyline(roll, Color("F3C06A"), 8.0, true)
		var shine = PackedVector2Array()
		for i in range(3, 20):
			shine.append(top[i] + Vector2(0, 1))
		draw_polyline(shine, Color("FFE9AE"), 2.5, true)
		for i in 9:
			var k = 2 + i * 3 + (i % 2)
			var p = top[mini(32, k)] + Vector2(0, 2)
			var d = Vector2(sin(i * 2.3) * 9.0, -9.0 - (i % 3) * 3.0)
			draw_line(p, p + d, Color("6B4A2A"), 5.0, true)
			draw_line(p, p + d, Color("F7D283"), 2.4, true)
