# The hatched chick (port of the web game's src/render/characters.js drawChick): fluffy yellow ball with a shell cap.
# Drawn 1.5x the egg size s; flap 0..1 flutters, peck 0..1 bows it to peck the floor.
extends RefCounted

const A = preload("res://scripts/mama_art.gd")
const BUMPS := 16

static func draw(c, cx: float, cy: float, s: float, t := 0.0, flap := 0.0, peck := 0.0) -> void:
	if not (s > 0.0):
		return
	c.save()
	c.translate(cx, cy - s * 0.04)
	s *= 1.5
	c.scale(s / 100.0, s / 100.0)
	var o = A.outline_w(s, 2.8)
	flap = clampf(flap, 0.0, 1.0)
	peck = clampf(peck, 0.0, 1.0)
	var bob = 0.0 if peck > 0.0 else sin(t * (3.0 + flap * 9.0)) * (1.0 + flap * 1.5)
	var dip = pow(0.5 + 0.5 * sin(t * 13.0), 3) * peck if peck > 0.0 else 0.0
	c.translate(0, bob)
	for ps in [0, 1]:
		c.begin_path()
		for sx in [-1.0, 1.0]:
			var sw = sin(t * 10.0 + sx) * flap * 2.0
			c.move_to(sx * 8.0, 38)
			c.line_to(sx * 8.0 + sw, 46)
			c.move_to(sx * 8.0 + sw - 4.0, 48)
			c.line_to(sx * 8.0 + sw, 46)
			c.line_to(sx * 8.0 + sw + 4.0, 48)
		c.stroke_path(Color("ffa62b") if ps else Color("8a4a0a"), 3.0 if ps else 3.0 + o * 1.3)
	if dip > 0.0:
		c.translate(0, 40)
		c.rotate(sin(t * 13.0 + 1.0) * 0.04 + dip * 0.1)
		c.scale(1.0 + dip * 0.07, 1.0 - dip * 0.15)
		c.translate(0, -40.0 + dip * 6.0)
	c.begin_path()
	for i in BUMPS + 1:
		var a = float(i) / BUMPS * TAU - PI / 2
		var x = cos(a) * 33.0
		var y = 8.0 + sin(a) * 35.0
		if i == 0:
			c.move_to(x, y)
		else:
			var am = a - PI / BUMPS
			c.quad_to(cos(am) * 37.5, 8.0 + sin(am) * 39.5, x, y)
	c.close_path()
	c.solid(c.rad(-8, -4, 4, 42, [Color("fff7a8"), Color("ffd93a"), Color("f2a91c")]), Color("a8661a"), o)
	var wa = sin(t * (9.0 + 34.0 * flap)) * (0.25 + 0.6 * flap) - 0.45 * flap
	for sx in [-1.0, 1.0]:
		c.save()
		c.translate(sx * (29.0 + flap * 4.0), 12)
		c.scale(1.15 * sx, 1.15)
		c.rotate(-0.5 + wa)
		c.begin_path()
		c.move_to(-2, -5)
		c.quad_to(16, -9, 20, 1)
		c.quad_to(15, 2, 16, 6)
		c.quad_to(10, 5, 9, 9)
		c.quad_to(2, 9, -2, 5)
		c.close_path()
		c.solid(Color("ffcf33"), Color("a8661a"), o)
		c.restore()
	var fy = 6.0
	c.begin_path()
	c.oval(-20, fy + 9.0, 5.5, 3.5)
	c.oval(20, fy + 9.0, 5.5, 3.5)
	c.fill_path(Color(1, 120 / 255.0, 110 / 255.0, 0.45))
	for sx in [-1.0, 1.0]:
		c.begin_path()
		c.oval(sx * 11.5, fy, 5.8, 7.2 * (0.6 if dip > 0.5 else 1.0))
		c.fill_path(A.EYE)
		c.dot(sx * 11.5 - 1.9, fy - 2.6, 2.3, Color.WHITE)
		c.dot(sx * 11.5 + 1.8, fy + 2.8, 1.0, Color.WHITE)
	c.begin_path()
	for sx in [-1.0, 1.0]:
		c.move_to(sx * 6.0, fy - 11.0)
		c.line_to(sx * 16.0, fy - 8.0)
	c.stroke_path(Color("a8661a"), maxf(2.4, o * 0.9))
	var bo = 2.5 + flap * 2.0 + (dip * 4.0 if peck > 0.0 else sin(t * 7.0) * 0.6)
	c.begin_path()
	c.move_to(-4.5, fy + 9.0)
	c.line_to(4.5, fy + 9.0)
	c.line_to(0, fy + 10.0 + bo)
	c.close_path()
	c.solid(Color("f08a1a"), Color("8a4a0a"), o * 0.8)
	c.begin_path()
	c.move_to(-5.5, fy + 9.0)
	c.quad_to(0, fy + 2.0, 5.5, fy + 9.0)
	c.line_to(0, fy + 11.0)
	c.close_path()
	c.solid(Color("ffb22e"), Color("8a4a0a"), o * 0.8)
	c.begin_path()
	c.move_to(-11, -24)
	c.quad_to(-16, -31, -11, -34)
	c.stroke_path(Color("d99a1a"), maxf(2.4, o * 0.9))
	c.save()
	c.translate(3, -27)
	c.rotate(0.22 + sin(t * (2.0 + flap * 10.0)) * (0.04 + flap * 0.06))
	c.begin_path()
	c.move_to(-24, 4)
	c.bez_to(-24, -14, -12, -23, 0, -23)
	c.bez_to(12, -23, 24, -14, 24, 4)
	for z in [[18, -1], [13, 6], [7, 0], [1, 7], [-5, 0], [-11, 6], [-17, -1]]:
		c.line_to(z[0], z[1])
	c.close_path()
	c.solid(c.lin(-10, -22, 10, 6, [Color("fffdf6"), Color("e7d6b6")]), A.LINE, o)
	c.begin_path()
	c.oval(-9, -12, 3.5, 5, 0.5)
	c.fill_path(Color(1, 1, 1, 0.9))
	c.restore()
	if flap > 0.4:
		for sx in [-1.0, 1.0]:
			var k = A.fract(t * 3.0 + (0.5 if sx > 0 else 0.0))
			c.dot(sx * (40.0 + k * 8.0), 4.0 - k * 14.0, 3.5 * (1.0 - k), Color(1, 1, 1, (flap - 0.4) * 0.9))
	c.restore()
