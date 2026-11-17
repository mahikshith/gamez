# One flat illustration per world (sky, two hill bands, the world's own props and a little egg vault in the middle),
# for the world cards and the level-select background. Drawn with the Canvas 2D painter into a rect; the caller clips.
# Same flat, outline-free look as the in-level backdrops; the vault emblem wears the house brown outline.
extends RefCounted

const LINE := Color("6b4a2a")

const WORLDS := [
	{name = "The Farm", tag = "Weasels in the henhouse", sky = ["7CCFFB", "DDF4FF"], hills = ["C3EBA0", "A3DC78", "86CC5B"], tile = "F5891F", ring = "C98A4B"},
	{name = "Wild Woods", tag = "Snakes in the brambles", sky = ["8FD3C2", "E4F5D6"], hills = ["7CC27A", "4F9E55", "3B8445"], tile = "3FA35A", ring = "8A6A3A"},
	{name = "Frozen Lake", tag = "Ice, gales and the Blizzard", sky = ["9ED6F5", "F0FAFF"], hills = ["E6F3FB", "CBE5F4", "B2D7EE"], tile = "3FA6E0", ring = "8FB8D6"},
	{name = "Crystal Caves", tag = "Grates, portals and the Golem", sky = ["3C2F6B", "7A5DB8"], hills = ["5C4A9A", "4A3B82", "3A2E6A"], tile = "8B5CF0", ring = "9A86C8"},
	{name = "Volcano", tag = "Lava and the salamander", sky = ["FF8C55", "FFD38A"], hills = ["9A4E3A", "7A3B2D", "5E2C22"], tile = "F0522B", ring = "6E4A3A"},
	{name = "Storm Peaks", tag = "Eagles over the clouds", sky = ["6C82A6", "C6D2E2"], hills = ["9AA7BC", "7C8AA2", "626F87"], tile = "5A7BC8", ring = "8C93A6"},
	{name = "Thieves' Vault", tag = "Rats, traps and the Rat King", sky = ["4E3F35", "8E735C"], hills = ["6B5848", "57483B", "45392F"], tile = "C9A227", ring = "A8875A"},
	{name = "Coral Reef", tag = "Eggs float up to the boat", sky = ["2FA9C4", "A8EEF0"], hills = ["F3DDA4", "E8C985", "D9B46A"], tile = "1EB5B0", ring = "E07A8A"},
	{name = "Gator Bayou", tag = "Gators, mosquitos, a turtle", sky = ["93B57A", "E2EAB6"], hills = ["6E9A5A", "557F48", "426A3A"], tile = "6E9A2E", ring = "7A6A42"},
	{name = "Shape Lab", tag = "Square, hex and spiral vaults", sky = ["243457", "5D6F9E"], hills = ["34466F", "2A3A5E", "202E4C"], tile = "2EC4B6", ring = "7FA0C8"},
]

static func col(h: String) -> Color:
	return Color(h)

# hills as a closed band from y0 down past the bottom of the rect
static func _hill(c, r: Rect2, y0: float, amp: float, freq: float, ph: float, color: Color) -> void:
	c.begin_path()
	var n = 28
	c.move_to(r.position.x - 4, r.end.y + 4)
	for i in n + 1:
		var x = r.position.x - 4.0 + (r.size.x + 8.0) * i / n
		var u = (x - r.position.x) / maxf(1.0, r.size.x)
		c.line_to(x, y0 - amp * (0.55 + 0.45 * sin(u * freq * TAU + ph)))
	c.line_to(r.end.x + 4, r.end.y + 4)
	c.close_path()
	c.fill_path(color)

static func draw(c, w: int, r: Rect2, t: float, vault := true) -> void:
	var W = WORLDS[clampi(w, 0, WORLDS.size() - 1)]
	var x0 = r.position.x
	var y0 = r.position.y
	var ww = r.size.x
	var hh = r.size.y
	var k = ww / 400.0 # props are authored for a 400 px wide card
	c.fill_rect(x0, y0, ww, hh, c.lin(0, y0, 0, y0 + hh * 0.8, [col(W.sky[0]), col(W.sky[1])]))
	match w:
		0: _farm(c, r, t, k)
		1: _woods(c, r, t, k)
		2: _frozen(c, r, t, k)
		3: _crystal(c, r, t, k)
		4: _volcano(c, r, t, k)
		5: _storm(c, r, t, k)
		6: _vaultw(c, r, t, k)
		7: _reef(c, r, t, k)
		8: _bayou(c, r, t, k)
		9: _lab(c, r, t, k)
	if vault:
		_emblem(c, Vector2(x0 + ww * 0.5, y0 + hh * 0.52), minf(ww, hh) * 0.2, col(W.ring), t)

static func _sun(c, p: Vector2, rr: float, color := Color("FFE36B")) -> void:
	c.dot(p.x, p.y, rr * 1.9, Color(1, 1, 1, 0.18))
	c.dot(p.x, p.y, rr * 1.4, Color(1, 0.98, 0.8, 0.35))
	c.dot(p.x, p.y, rr, color)

static func _cloud(c, p: Vector2, s: float, color := Color(1, 1, 1, 0.95)) -> void:
	c.begin_path()
	c.round_rect(p.x - 70 * s, p.y, 140 * s, 30 * s, 15 * s)
	c.circle(p.x - 26 * s, p.y + 4 * s, 26 * s)
	c.circle(p.x + 18 * s, p.y, 34 * s)
	c.fill_path(color)

static func _hills3(c, r: Rect2, w: int, ph := 0.0) -> void:
	var W = WORLDS[w]
	var hh = r.size.y
	_hill(c, r, r.position.y + hh * 0.66, hh * 0.08, 1.2, 0.6 + ph, col(W.hills[0]))
	_hill(c, r, r.position.y + hh * 0.76, hh * 0.06, 1.7, 2.1 + ph, col(W.hills[1]))
	_hill(c, r, r.position.y + hh * 0.86, hh * 0.045, 2.3, 4.0 + ph, col(W.hills[2]))

static func _farm(c, r: Rect2, t: float, k: float) -> void:
	_sun(c, r.position + Vector2(r.size.x * 0.82, r.size.y * 0.13), 30 * k)
	_cloud(c, r.position + Vector2(fposmod(r.size.x * 0.25 + t * 8.0, r.size.x + 200) - 60, r.size.y * 0.14), 0.7 * k)
	_hills3(c, r, 0)
	var b = r.position + Vector2(r.size.x * 0.13, r.size.y * 0.71)
	c.begin_path()
	c.poly([b.x - 30 * k, b.y, b.x - 30 * k, b.y - 36 * k, b.x, b.y - 58 * k, b.x + 30 * k, b.y - 36 * k, b.x + 30 * k, b.y])
	c.fill_path(Color("F07B6E"))
	c.begin_path()
	c.poly([b.x - 36 * k, b.y - 34 * k, b.x, b.y - 64 * k, b.x + 36 * k, b.y - 34 * k, b.x + 30 * k, b.y - 32 * k, b.x, b.y - 56 * k, b.x - 30 * k, b.y - 32 * k])
	c.fill_path(Color("FFF6EC"))
	c.fill_rect(b.x - 10 * k, b.y - 24 * k, 20 * k, 24 * k, Color("C95A4E"))
	for i in 5:
		var fx = r.position.x + r.size.x * (0.62 + i * 0.075)
		var fy = r.position.y + r.size.y * 0.8
		c.fill_rect(fx, fy - 22 * k, 6 * k, 24 * k, Color("FFF6EC"))
	c.fill_rect(r.position.x + r.size.x * 0.6, r.position.y + r.size.y * 0.8 - 16 * k, r.size.x * 0.36, 5 * k, Color("FFF6EC"))

static func _pine(c, x: float, y: float, s: float, a: Color, b: Color) -> void:
	c.fill_rect(x - 4 * s, y - 10 * s, 8 * s, 14 * s, Color("7A5434"))
	for i in 3:
		var w2 = (30 - i * 7) * s
		var yy = y - 8 * s - i * 18 * s
		c.begin_path()
		c.poly([x - w2, yy, x, yy - 30 * s, x + w2, yy])
		c.fill_path(a if i % 2 == 0 else b)

static func _woods(c, r: Rect2, t: float, k: float) -> void:
	_sun(c, r.position + Vector2(r.size.x * 0.2, r.size.y * 0.12), 26 * k, Color("FFF0A0"))
	_hills3(c, r, 1)
	for p in [[0.08, 0.72, 1.1], [0.2, 0.78, 1.3], [0.85, 0.7, 1.2], [0.94, 0.8, 1.0], [0.72, 0.82, 0.9]]:
		_pine(c, r.position.x + r.size.x * p[0], r.position.y + r.size.y * p[1], p[2] * k, Color("2F7A44"), Color("3E9150"))
	# a vine hanging from the top with leaves
	c.begin_path()
	c.move_to(r.position.x + r.size.x * 0.66, r.position.y)
	c.quad_to(r.position.x + r.size.x * 0.7, r.position.y + r.size.y * 0.12, r.position.x + r.size.x * 0.64, r.position.y + r.size.y * 0.22)
	c.stroke_path(Color("3B8445"), 5 * k)
	for i in 3:
		c.begin_path()
		c.oval(r.position.x + r.size.x * (0.67 - i * 0.012), r.position.y + r.size.y * (0.06 + i * 0.06), 8 * k, 4 * k, 0.6)
		c.fill_path(Color("5FAE5A"))

static func _frozen(c, r: Rect2, t: float, k: float) -> void:
	_sun(c, r.position + Vector2(r.size.x * 0.8, r.size.y * 0.14), 24 * k, Color("FFF6D0"))
	_hills3(c, r, 2)
	# icicles along the top
	for i in 9:
		var x = r.position.x + r.size.x * (0.04 + i * 0.12)
		var l = (18 + 14 * absf(sin(i * 2.3))) * k
		c.begin_path()
		c.poly([x - 7 * k, r.position.y, x + 7 * k, r.position.y, x, r.position.y + l])
		c.fill_path(Color(0.86, 0.95, 1.0, 0.95))
	for i in 7:
		var fx = r.position.x + fposmod(r.size.x * (0.1 + i * 0.14) + sin(t + i) * 10.0, r.size.x)
		var fy = r.position.y + fposmod(r.size.y * (0.1 + i * 0.09) + t * 18.0, r.size.y * 0.7)
		c.dot(fx, fy, 3.2 * k, Color(1, 1, 1, 0.9))

static func _crystal(c, r: Rect2, t: float, k: float) -> void:
	_hills3(c, r, 3)
	for p in [[0.1, 0.78, 1.3, -0.2], [0.18, 0.8, 0.8, 0.25], [0.86, 0.76, 1.4, 0.15], [0.93, 0.82, 0.9, -0.3], [0.75, 0.86, 0.7, 0.1]]:
		var x = r.position.x + r.size.x * p[0]
		var y = r.position.y + r.size.y * p[1]
		var s = p[2] * k
		c.save()
		c.translate(x, y)
		c.rotate(p[3])
		c.begin_path()
		c.poly([-10 * s, 0, -10 * s, -40 * s, 0, -56 * s, 10 * s, -40 * s, 10 * s, 0])
		c.fill_path(Color("B98CFF"))
		c.begin_path()
		c.poly([0, 0, 0, -56 * s, 10 * s, -40 * s, 10 * s, 0])
		c.fill_path(Color("8E62E6"))
		c.restore()
	for i in 6:
		var a = 0.5 + 0.5 * sin(t * 2.0 + i * 1.7)
		c.dot(r.position.x + r.size.x * (0.1 + i * 0.16), r.position.y + r.size.y * (0.12 + (i % 3) * 0.08), 2.5 * k, Color(1, 0.95, 1, 0.4 + 0.5 * a))

static func _volcano(c, r: Rect2, t: float, k: float) -> void:
	var cx = r.position.x + r.size.x * 0.2
	var by = r.position.y + r.size.y * 0.72
	for i in 3:
		var u = fposmod(t * 0.25 + i / 3.0, 1.0)
		c.dot(cx + sin(u * 4.0 + i) * 10 * k, by - 120 * k - u * 60 * k, (14 + u * 18) * k, Color(0.45, 0.35, 0.33, 0.5 * (1.0 - u)))
	c.begin_path()
	c.poly([cx - 90 * k, by, cx - 22 * k, by - 110 * k, cx + 22 * k, by - 110 * k, cx + 90 * k, by])
	c.fill_path(Color("7A3B2D"))
	c.begin_path()
	c.poly([cx - 22 * k, by - 110 * k, cx + 22 * k, by - 110 * k, cx + 14 * k, by - 84 * k, cx + 4 * k, by - 96 * k, cx - 8 * k, by - 80 * k, cx - 16 * k, by - 95 * k])
	c.fill_path(Color("FF6A2A"))
	_hills3(c, r, 4)
	c.begin_path()
	c.move_to(r.position.x - 4, r.position.y + r.size.y * 0.93)
	c.quad_to(r.position.x + r.size.x * 0.5, r.position.y + r.size.y * 0.88, r.end.x + 4, r.position.y + r.size.y * 0.94)
	c.line_to(r.end.x + 4, r.position.y + r.size.y * 0.94 + 7 * k)
	c.quad_to(r.position.x + r.size.x * 0.5, r.position.y + r.size.y * 0.88 + 7 * k, r.position.x - 4, r.position.y + r.size.y * 0.93 + 7 * k)
	c.close_path()
	c.fill_path(Color("FF7A2A"))

static func _storm(c, r: Rect2, t: float, k: float) -> void:
	for p in [[0.18, 0.62, 1.2], [0.5, 0.58, 1.5], [0.85, 0.64, 1.1]]:
		var x = r.position.x + r.size.x * p[0]
		var y = r.position.y + r.size.y * p[1]
		var s = p[2] * k
		c.begin_path()
		c.poly([x - 80 * s, y + 40 * s, x, y - 70 * s, x + 80 * s, y + 40 * s])
		c.fill_path(Color("8592A8"))
		c.begin_path()
		c.poly([x - 26 * s, y - 34 * s, x, y - 70 * s, x + 26 * s, y - 34 * s, x + 12 * s, y - 28 * s, x, y - 38 * s, x - 12 * s, y - 28 * s])
		c.fill_path(Color("F2F5FA"))
	_hills3(c, r, 5)
	var cl = r.position + Vector2(r.size.x * 0.72, r.size.y * 0.1)
	_cloud(c, cl, 0.8 * k, Color("5E6B82"))
	var fl = 1.0 if fposmod(t, 2.4) < 0.12 else 0.0
	c.begin_path()
	c.poly([cl.x, cl.y + 26 * k, cl.x - 12 * k, cl.y + 56 * k, cl.x - 2 * k, cl.y + 56 * k, cl.x - 10 * k, cl.y + 86 * k, cl.x + 14 * k, cl.y + 46 * k, cl.x + 4 * k, cl.y + 46 * k, cl.x + 12 * k, cl.y + 26 * k])
	c.fill_path(Color(1, 0.89, 0.42, 0.7 + 0.3 * fl))

static func _vaultw(c, r: Rect2, t: float, k: float) -> void:
	# stone bricks
	var bh = 26 * k
	var rows = int(r.size.y / bh) + 1
	for j in rows:
		var off = (0.0 if j % 2 == 0 else 30 * k)
		var x = r.position.x - off
		while x < r.end.x:
			c.begin_path()
			c.round_rect(x + 2 * k, r.position.y + j * bh + 2 * k, 56 * k, bh - 4 * k, 5 * k)
			c.fill_path(Color(1, 1, 1, 0.05 + 0.04 * ((j * 7 + int(x)) % 3)))
			x += 60 * k
	_hills3(c, r, 6)
	for i in 6:
		var x = r.position.x + r.size.x * (0.08 + (i % 3) * 0.05) + (r.size.x * 0.72 if i >= 3 else 0.0)
		var y = r.position.y + r.size.y * (0.86 - (i % 3) * 0.03)
		c.dot(x, y, 9 * k, Color("C9A227"))
		c.dot(x - 2 * k, y - 2 * k, 6 * k, Color("FFD95A"))

static func _reef(c, r: Rect2, t: float, k: float) -> void:
	for i in 4:
		var x = r.position.x + r.size.x * (0.1 + i * 0.27)
		c.begin_path()
		c.poly([x - 20 * k, r.position.y, x + 20 * k, r.position.y, x + 60 * k, r.position.y + r.size.y * 0.6, x + 20 * k, r.position.y + r.size.y * 0.6])
		c.fill_path(Color(1, 1, 1, 0.07))
	_hills3(c, r, 7)
	for p in [[0.12, 0.84, 1.2, "FF7A8A"], [0.22, 0.88, 0.8, "FFB347"], [0.84, 0.82, 1.3, "B07CF2"], [0.92, 0.88, 0.9, "FF7A8A"]]:
		var x = r.position.x + r.size.x * p[0]
		var y = r.position.y + r.size.y * p[1]
		var s = p[2] * k
		c.begin_path()
		c.move_to(x, y)
		c.line_to(x, y - 40 * s)
		c.move_to(x, y - 18 * s)
		c.line_to(x - 16 * s, y - 34 * s)
		c.move_to(x, y - 24 * s)
		c.line_to(x + 15 * s, y - 44 * s)
		c.stroke_path(Color(p[3]), 7 * s)
	for i in 6:
		var u = fposmod(t * 0.3 + i / 6.0, 1.0)
		c.begin_path()
		c.circle(r.position.x + r.size.x * (0.15 + i * 0.14) + sin(t * 2.0 + i) * 6.0, r.position.y + r.size.y * (0.85 - u * 0.8), (3 + i % 3) * k)
		c.stroke_path(Color(1, 1, 1, 0.7 * (1.0 - u)), 2 * k)

static func _bayou(c, r: Rect2, t: float, k: float) -> void:
	_sun(c, r.position + Vector2(r.size.x * 0.78, r.size.y * 0.15), 24 * k, Color("FFF0A0"))
	_hills3(c, r, 8)
	c.fill_rect(r.position.x, r.position.y + r.size.y * 0.9, r.size.x, r.size.y * 0.1, Color("4F7A55"))
	for i in 3:
		c.begin_path()
		c.oval(r.position.x + r.size.x * (0.65 + i * 0.1), r.position.y + r.size.y * (0.93 + (i % 2) * 0.02), 16 * k, 6 * k)
		c.fill_path(Color("7DBA5A"))
	for i in 7:
		var x = r.position.x + r.size.x * (0.04 + i * 0.035)
		c.begin_path()
		c.move_to(x, r.position.y + r.size.y * 0.92)
		c.quad_to(x + 4 * k, r.position.y + r.size.y * 0.82, x + sin(t + i) * 4 * k, r.position.y + r.size.y * (0.74 - (i % 3) * 0.03))
		c.stroke_path(Color("6E8A3A"), 4 * k)

static func _lab(c, r: Rect2, t: float, k: float) -> void:
	var g = 40 * k
	var gx = r.position.x
	while gx < r.end.x:
		c.fill_rect(gx, r.position.y, 1.5 * k, r.size.y, Color(1, 1, 1, 0.08))
		gx += g
	var gy = r.position.y
	while gy < r.end.y:
		c.fill_rect(r.position.x, gy, r.size.x, 1.5 * k, Color(1, 1, 1, 0.08))
		gy += g
	_hills3(c, r, 9)
	var p = r.position + Vector2(r.size.x * 0.15, r.size.y * 0.2)
	c.save()
	c.translate(p.x, p.y)
	c.rotate(t * 0.5)
	c.begin_path()
	c.round_rect(-18 * k, -18 * k, 36 * k, 36 * k, 6 * k)
	c.stroke_path(Color("2EC4B6"), 5 * k)
	c.restore()
	var q = r.position + Vector2(r.size.x * 0.85, r.size.y * 0.24)
	c.save()
	c.translate(q.x, q.y)
	c.rotate(-t * 0.4)
	c.begin_path()
	var pts = []
	for i in 6:
		pts.append(cos(i * TAU / 6.0) * 22 * k)
		pts.append(sin(i * TAU / 6.0) * 22 * k)
	c.poly(pts)
	c.stroke_path(Color("FFC21A"), 5 * k)
	c.restore()

# the little egg vault: three rings with gaps that turn slowly, an egg in the middle
static func _emblem(c, p: Vector2, R: float, ring: Color, t: float) -> void:
	c.dot(p.x, p.y + R * 1.08, R * 0.9, Color(0, 0, 0, 0.0))
	c.begin_path()
	c.oval(p.x, p.y + R * 1.22, R * 0.95, R * 0.14)
	c.fill_path(Color(0, 0, 0, 0.16))
	for i in 3:
		var rr = R * (1.0 - i * 0.28)
		var a0 = t * (0.4 - i * 0.25) + i * 2.1
		c.begin_path()
		c.ellipse(p.x, p.y, rr, rr, 0.0, a0 + 0.5, a0 + TAU - 0.5)
		c.stroke_path(LINE, R * 0.16)
		c.begin_path()
		c.ellipse(p.x, p.y, rr, rr, 0.0, a0 + 0.5, a0 + TAU - 0.5)
		c.stroke_path(ring, R * 0.1)
	var e = R * 0.42
	c.save()
	c.translate(p.x, p.y + sin(t * 2.0) * R * 0.03)
	c.begin_path()
	for i in 25:
		var a = float(i) / 24.0 * TAU
		var sy = sin(a)
		var px = e * 0.38 * cos(a) * (1.0 + 0.13 * sy)
		var py = e * 0.5 * sy
		if i == 0:
			c.move_to(px, py)
		else:
			c.line_to(px, py)
	c.close_path()
	c.solid(Color("FFF3DC"), LINE, R * 0.05)
	c.dot(-e * 0.1, -e * 0.15, e * 0.07, Color.WHITE)
	c.restore()
