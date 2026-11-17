# Draws one ring (child of its body, so it turns with it). Each solid arc is its own child drawn by the ring shader
# (shaders/ring.gdshader): a bevelled, lit wooden bar with a contact shadow. On top of the arcs this node paints the
# fixtures: sponge pads, thorns, brass gear teeth, sliding doors, thorn curtains and the x-gate badges.
extends Node2D

const G = preload("res://scripts/g.gd")
const UI = preload("res://scripts/ui_kit.gd")
const SHADER = preload("res://shaders/ring.gdshader")
# base, lit, dark, outline, grain
const MAT := {"wood": [Color("D98A45"), Color("FFC680"), Color("93501F"), Color("4E2C12"), 1.0],
	"stone": [Color("A9A59D"), Color("E4E0D6"), Color("6F6A62"), Color("3B3833"), 0.35],
	"ice": [Color("9ED9F5"), Color("E6F8FF"), Color("5AA3CD"), Color("2F6C93"), 0.0],
	"metal": [Color("97A3AE"), Color("E3EAF0"), Color("5F6B77"), Color("2D353D"), 0.0],
	"coral": [Color("F08E78"), Color("FFD0C2"), Color("B9523F"), Color("6E2A1E"), 0.3],
	"glass": [Color("B8E6E2"), Color("F4FFFE"), Color("76B3AE"), Color("3C7772"), 0.0]}
const VIS := 3.0 # the drawn bar is this much thicker than the collision band on each side
const BRASS := Color("E2A93C")
const BRASS_DK := Color("8C5A14")
const THORN_LINE := Color("6E1712")

var ring: Dictionary
var held = false
var _glow = 0.0
var _live = false
var _mats: Array = []

func _ready() -> void:
	for g in ring.gaps:
		if g.shut != null or g.curtain != null or g.x > 1:
			_live = true
	var r: float = ring.r * G.PPM
	var rb = G.RING_TH * G.PPM / 2.0 + VIS
	var col: Array = MAT.get(ring.mat, MAT.wood)
	for arc in ring.arcs:
		var ap: float = (arc[1] - arc[0]) / 2.0
		var n = Node2D.new()
		n.show_behind_parent = true
		n.rotation = (arc[0] + arc[1]) / 2.0
		var m = ShaderMaterial.new()
		m.shader = SHADER
		m.set_shader_parameter("ra", r)
		m.set_shader_parameter("rb", rb)
		m.set_shader_parameter("ap", minf(ap, PI))
		m.set_shader_parameter("c_base", col[0])
		m.set_shader_parameter("c_lit", col[1])
		m.set_shader_parameter("c_dark", col[2])
		m.set_shader_parameter("c_line", col[3])
		m.set_shader_parameter("grain", col[4])
		n.material = m
		_mats.append(m)
		var pad = 30.0
		var am = minf(PI, ap + (rb + pad) / r)
		# two halves, so a full ring never makes a self-touching polygon
		var polys = [G.band(r - rb - pad, r + rb + pad, -am, 0.0), G.band(r - rb - pad, r + rb + pad, 0.0, am)]
		n.draw.connect(func():
			for p in polys:
				n.draw_colored_polygon(p, Color.WHITE))
		add_child(n)

func _process(dt: float) -> void:
	var g = move_toward(_glow, 1.0 if held else 0.0, dt * 7.0)
	if g != _glow:
		_glow = g
		for m in _mats:
			m.set_shader_parameter("held", g)
	if _live:
		queue_redraw()

func _seg(ri: float, ro: float, a0: float, a1: float, col: Color, caps := true) -> void:
	draw_colored_polygon(G.band(ri, ro, a0, a1), col)
	if caps:
		var r = (ri + ro) / 2.0
		var h = (ro - ri) / 2.0
		draw_circle(Vector2.from_angle(a0) * r, h, col)
		draw_circle(Vector2.from_angle(a1) * r, h, col)

# brass teeth along one edge of the ring (toward the ring it drives): a brass rail with square cogs, each lit on
# its top-left, so a gear reads as a machine part and never as a row of thorns
func _teeth(edge: float, dir: float) -> void:
	for arc in ring.arcs:
		_seg(edge - (6.0 if dir < 0 else 0.0), edge + (6.0 if dir > 0 else 0.0), arc[0], arc[1], BRASS_DK, false)
		_seg(edge - (4.0 if dir < 0 else 0.0), edge + (4.0 if dir > 0 else 0.0), arc[0], arc[1], BRASS, false)
		var n = int((arc[1] - arc[0]) * edge / 26.0)
		for i in n:
			var q: float = arc[0] + (i + 0.5) * (arc[1] - arc[0]) / n
			var w = 5.5 / edge
			var h = 9.0 * dir
			draw_colored_polygon(PackedVector2Array([Vector2.from_angle(q - w * 1.25) * edge, Vector2.from_angle(q - w) * (edge + h + dir * 1.5),
				Vector2.from_angle(q + w) * (edge + h + dir * 1.5), Vector2.from_angle(q + w * 1.25) * edge]), BRASS_DK)
			draw_colored_polygon(PackedVector2Array([Vector2.from_angle(q - w) * edge, Vector2.from_angle(q - w * 0.8) * (edge + h),
				Vector2.from_angle(q + w * 0.8) * (edge + h), Vector2.from_angle(q + w) * edge]), BRASS)
			draw_circle(Vector2.from_angle(q) * (edge + h * 0.5), 1.6, Color("FFE9A8"))

func _thorn(t: Dictionary) -> void:
	var a: float = t.a
	var b: float = t.base * G.PPM
	var tp: float = t.tip * G.PPM
	var hw: float = t.half * 1.25
	var out = signf(tp - b)
	var hook: bool = t.kind != "blunt"
	# a fang that leans a little (hooks) or a squat steel stud (blunt); outline, body, lit facet, glint
	var lean = 0.05 if hook else 0.0
	var tip = Vector2.from_angle(a + lean) * (tp + out * 3.0)
	var l = Vector2.from_angle(a - hw) * (b - out * 2.0)
	var rr = Vector2.from_angle(a + hw) * (b - out * 2.0)
	var mid = Vector2.from_angle(a) * (b - out * 2.0)
	var belly = Vector2.from_angle(a - hw * 0.72) * lerpf(b, tp, 0.45)
	var back = Vector2.from_angle(a + hw * 0.62) * lerpf(b, tp, 0.5)
	var outline = PackedVector2Array([l, belly, tip, back, rr])
	var line = THORN_LINE if hook else Color("3F454B")
	draw_colored_polygon(outline, Color("E8362C") if hook else Color("98A0A8"))
	draw_colored_polygon(PackedVector2Array([mid, back.lerp(mid, 0.25), tip, back, rr]), Color("B3211B") if hook else Color("6F777F"))
	draw_colored_polygon(PackedVector2Array([l.lerp(mid, 0.3), belly.lerp(mid, 0.25), tip.lerp(mid, 0.3)]), Color("FF8A78") if hook else Color("D5DBE0"))
	draw_polyline(G.closed(outline), line, 2.6, true)
	draw_circle(tip.lerp(mid, 0.2), 1.3, Color(1, 1, 1, 0.85))

func _draw() -> void:
	var r: float = ring.r * G.PPM
	var th = G.RING_TH * G.PPM
	var ri = r - th / 2
	var ro = r + th / 2
	if ring.gear_in != null:
		_teeth(ri - VIS + 1.0, -1.0)
	if ring.gear_out != null:
		_teeth(ro + VIS - 1.0, 1.0)
	for g in ring.gaps:
		var half: float = g.half
		if g.shut != null:
			# steel door frames, then two riveted doors sliding in from the edges with a hazard-yellow leading edge
			for b in [g.a - half, g.a + half]:
				draw_line(Vector2.from_angle(b) * (ri - 7), Vector2.from_angle(b) * (ro + 7), Color("2D353D"), 7.0, true)
				draw_line(Vector2.from_angle(b) * (ri - 5), Vector2.from_angle(b) * (ro + 5), Color("8A939E"), 3.0, true)
			var shut = half * (1.0 - g.o)
			if shut > 0.004:
				for e in [-1, 1]:
					var a0: float = g.a - half if e < 0 else g.a + half - shut
					var a1: float = g.a - half + shut if e < 0 else g.a + half
					_seg(ri - 2, ro + 2, a0, a1, Color("2D353D"), false)
					_seg(ri, ro, a0, a1, Color("7E8893"), false)
					_seg(r, ro - 2, a0, a1, Color("B7C0C9"), false)
					var lead = a1 if e < 0 else a0
					draw_line(Vector2.from_angle(lead) * (ri - 1), Vector2.from_angle(lead) * (ro + 1), Color("FFCC33"), 5.0, true)
		if g.curtain != null and g.curtain.alive:
			# thorn curtain: a dark vine across the gap bristling with red thorns; it glows and shrivels while it burns
			var k: float = 1.0 - g.curtain.burn
			var vine = Color("2F5A20").lerp(Color("FF7A1F"), g.curtain.burn) if g.curtain.burning else Color("2F5A20")
			var pts = PackedVector2Array()
			for j in 13:
				var q: float = g.a - half + 2.0 * half * j / 12.0
				pts.append(Vector2.from_angle(q) * (r + sin(j * 1.7) * 3.0))
			draw_polyline(pts, Color("1B3312"), 8.0 * k + 2.0, true)
			draw_polyline(pts, vine, 5.0 * k + 1.0, true)
			for j in 6:
				var q: float = g.a - half + 2.0 * half * (j + 0.5) / 6.0
				var dirn = -1.0 if j % 2 == 0 else 1.0
				var base = Vector2.from_angle(q) * r
				var tip = Vector2.from_angle(q) * (r + dirn * 15.0 * k)
				var side = Vector2.from_angle(q + PI / 2) * 4.5
				var tri = PackedVector2Array([base - side, tip, base + side])
				draw_colored_polygon(tri, Color("E8362C") if not g.curtain.burning else Color(1.0, 0.8, 0.3))
				draw_polyline(G.closed(tri), THORN_LINE if not g.curtain.burning else Color("C2410C"), 2.0, true)
			if g.curtain.burning:
				for j in 4:
					var q: float = g.a - half + 2.0 * half * randf()
					draw_circle(Vector2.from_angle(q) * (r + randf_range(-8, 8)), randf_range(3, 7), Color(1.0, randf_range(0.5, 0.85), 0.2, 0.8))
		if g.x > 1:
			# x-gate badge just outside the gap, kept upright: a gold token with a stroked number
			var c = Vector2.from_angle(g.a) * ((ri - 30.0) if ring.get("outer", false) else (ro + 28.0))
			draw_set_transform(c, -get_parent().rotation)
			var bob = 1.0 + 0.04 * sin(Time.get_ticks_msec() / 300.0 + g.a)
			draw_set_transform(c, -get_parent().rotation, Vector2(bob, bob))
			UI.rounded(self, Rect2(-29, -17, 58, 40), Color(0.1, 0.07, 0.03, 0.35), 20)
			UI.rounded(self, Rect2(-29, -20, 58, 40), Color("7A4A0A"), 20)
			UI.rounded(self, Rect2(-26, -17, 52, 34), Color("FFC21A"), 17)
			UI.rounded(self, Rect2(-22, -15, 44, 13), Color("FFE680"), 8)
			UI.text(self, Vector2(0, 8), "x%d" % g.x, 26, Color("5A3606"))
			draw_set_transform(Vector2.ZERO, 0.0)
	for p in ring.pads:
		for arc in ring.arcs:
			var s0: float = maxf(p.a - p.half, arc[0])
			var s1: float = minf(p.a + p.half, arc[1])
			if s1 <= s0:
				continue
			# sponge: a fat honey-yellow cushion on the inside of the bar, outlined, lit on top, pocked with pores
			var pr = ri - 1
			_seg(pr - 15, pr + 2, s0, s1, Color("8A5A0C"))
			_seg(pr - 13, pr, s0, s1, Color("F2B01E"))
			_seg(pr - 13, pr - 5, s0, s1, Color("FFD34D"))
			_seg(pr - 12, pr - 9.5, s0 + 0.01, s1 - 0.01, Color("FFF0A6"))
			var q = s0 + 0.03
			var i = 0
			while q < s1 - 0.02:
				draw_circle(Vector2.from_angle(q) * (pr - 6.0 + (i % 2) * 3.0), 1.9, Color("D99A12"))
				q += 0.1 / ring.r
				i += 1
	for t in ring.thorns:
		if t.alive:
			_thorn(t)
