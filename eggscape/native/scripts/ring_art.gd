# Draws one ring (child of its body, so it turns with it), flat style: a two-tone band (lit outer half, shaded inner
# half), rounded gap ends, a soft drop shadow, sponge pads as yellow foam with pores, thorns as two-tone red spikes
# (grey for blunt ones), and a warm glow while the player holds it. No outlines.
extends Node2D

const G = preload("res://scripts/g.gd")
const MAT := {"wood": [Color("D58A45"), Color("EDAE68"), Color("B06A2C")], "stone": [Color("A6A39C"), Color("CFCCC4"), Color("847F77")],
	"ice": [Color("9ED9F5"), Color("D9F3FF"), Color("6FB7DD")], "metal": [Color("97A3AE"), Color("CCD5DD"), Color("6F7B87")],
	"coral": [Color("F08E78"), Color("FFC1B0"), Color("C9614D")], "glass": [Color("B8E6E2"), Color("ECFFFD"), Color("86C3BE")]}
var ring: Dictionary
var held = false
var _glow = 0.0

const BRASS := Color("D9A03A")
const BRASS_DK := Color("A8731F")
const UI = preload("res://scripts/ui_kit.gd")
var _live = false

func _ready() -> void:
	for g in ring.gaps:
		if g.shut != null or g.curtain != null or g.x > 1:
			_live = true

func _process(dt: float) -> void:
	var g = move_toward(_glow, 1.0 if held else 0.0, dt * 6.0)
	if g != _glow or held or _live:
		_glow = g
		queue_redraw()

# brass teeth along one edge of the ring (toward the ring it drives), on the solid arcs only: a thin brass band with
# short square cogs, so a gear reads as a machine part and never as a row of thorns
func _teeth(edge: float, dir: float) -> void:
	for arc in ring.arcs:
		_seg(edge - (5.0 if dir < 0 else 0.0), edge + (5.0 if dir > 0 else 0.0), arc[0], arc[1], BRASS_DK, false)
		_seg(edge - (3.0 if dir < 0 else 0.0), edge + (3.0 if dir > 0 else 0.0), arc[0], arc[1], BRASS, false)
		var n = int((arc[1] - arc[0]) * edge / 26.0)
		for i in n:
			var q: float = arc[0] + (i + 0.5) * (arc[1] - arc[0]) / n
			var w = 5.0 / edge
			var h = 7.0 * dir
			draw_colored_polygon(PackedVector2Array([Vector2.from_angle(q - w) * edge, Vector2.from_angle(q - w * 0.8) * (edge + h),
				Vector2.from_angle(q + w * 0.8) * (edge + h), Vector2.from_angle(q + w) * edge]), BRASS)

func _seg(ri: float, ro: float, a0: float, a1: float, col: Color, caps := true) -> void:
	draw_colored_polygon(G.band(ri, ro, a0, a1), col)
	if caps:
		var r = (ri + ro) / 2.0
		var h = (ro - ri) / 2.0
		draw_circle(Vector2.from_angle(a0) * r, h, col)
		draw_circle(Vector2.from_angle(a1) * r, h, col)

func _draw() -> void:
	var r: float = ring.r * G.PPM
	var th = G.RING_TH * G.PPM
	var ri = r - th / 2
	var ro = r + th / 2
	var col: Array = MAT.get(ring.mat, MAT.wood)
	var full = ring.arcs.size() == 1 and ring.arcs[0][1] - ring.arcs[0][0] >= TAU - 0.01
	if _glow > 0.0:
		for arc in ring.arcs:
			_seg(ri - 8, ro + 8, arc[0], arc[1], Color(1, 0.93, 0.55, 0.45 * _glow), not full)
	for arc in ring.arcs:
		var a0: float = arc[0]
		var a1: float = arc[1]
		# drop shadow (screen-down offset is approximated by a slightly bigger, darker band)
		_seg(ri - 1, ro + 3, a0, a1, Color(0.05, 0.1, 0.15, 0.18), not full)
		_seg(ri, ro, a0, a1, col[2], not full)
		_seg(ri + th * 0.22, ro, a0 + 0.004, a1 - 0.004, col[0], not full)
		_seg(r + th * 0.12, ro - th * 0.12, a0 + 0.01, a1 - 0.01, col[1], not full)
	if ring.gear_in != null:
		_teeth(ri, -1.0)
	if ring.gear_out != null:
		_teeth(ro, 1.0)
	for g in ring.gaps:
		var half: float = g.half
		if g.shut != null:
			# door frames, then two grey doors sliding in from the edges with a yellow leading stripe
			for b in [g.a - half, g.a + half]:
				draw_line(Vector2.from_angle(b) * (ri - 4), Vector2.from_angle(b) * (ro + 4), Color("4A4F57"), 4.0, true)
			var shut = half * (1.0 - g.o)
			if shut > 0.004:
				for e in [-1, 1]:
					var a0: float = g.a - half if e < 0 else g.a + half - shut
					var a1: float = g.a - half + shut if e < 0 else g.a + half
					_seg(ri + 1, ro - 1, a0, a1, Color("8A939E"), false)
					_seg(r, ro - 3, a0, a1, Color("AEB6BF"), false)
					var lead = a1 if e < 0 else a0
					draw_line(Vector2.from_angle(lead) * (ri + 1), Vector2.from_angle(lead) * (ro - 1), Color("FFCC33"), 4.0, true)
		if g.curtain != null and g.curtain.alive:
			# thorn curtain: a dark vine across the gap bristling with red thorns; it glows and shrivels while it burns
			var k: float = 1.0 - g.curtain.burn
			var vine = Color("3E6B2A").lerp(Color("FF7A1F"), g.curtain.burn) if g.curtain.burning else Color("3E6B2A")
			var pts = PackedVector2Array()
			for j in 13:
				var q: float = g.a - half + 2.0 * half * j / 12.0
				pts.append(Vector2.from_angle(q) * (r + sin(j * 1.7) * 3.0))
			draw_polyline(pts, vine, 5.0 * k + 1.0, true)
			for j in 6:
				var q: float = g.a - half + 2.0 * half * (j + 0.5) / 6.0
				var dirn = -1.0 if j % 2 == 0 else 1.0
				var base = Vector2.from_angle(q) * r
				var tip = Vector2.from_angle(q) * (r + dirn * 14.0 * k)
				var side = Vector2.from_angle(q + PI / 2) * 4.0
				draw_colored_polygon(PackedVector2Array([base - side, tip, base + side]), Color("D93A31") if not g.curtain.burning else Color("FFB13B"))
			if g.curtain.burning:
				for j in 4:
					var q: float = g.a - half + 2.0 * half * randf()
					draw_circle(Vector2.from_angle(q) * (r + randf_range(-8, 8)), randf_range(3, 7), Color(1.0, randf_range(0.5, 0.85), 0.2, 0.8))
		if g.x > 1:
			# x-gate badge just outside the gap, kept upright
			var c = Vector2.from_angle(g.a) * ((ri - 24.0) if ring.get("outer", false) else (ro + 22.0))
			draw_set_transform(c, -get_parent().rotation)
			UI.rounded(self, Rect2(-24, -15, 48, 30), Color("FFC21A"), 15)
			draw_string(UI.font(900), Vector2(-24, 9), "x%d" % g.x, HORIZONTAL_ALIGNMENT_CENTER, 48, 22, Color("3B2A20"))
			draw_set_transform(Vector2.ZERO, 0.0)
	for p in ring.pads:
		for arc in ring.arcs:
			var s0: float = maxf(p.a - p.half, arc[0])
			var s1: float = minf(p.a + p.half, arc[1])
			if s1 <= s0:
				continue
			var pr = ri - 2
			_seg(pr - 10, pr + 3, s0, s1, Color("E5B21E"))
			_seg(pr - 10, pr - 1, s0, s1, Color("FFD34D"))
			var q = s0 + 0.04
			var i = 0
			while q < s1 - 0.02:
				draw_circle(Vector2.from_angle(q) * (pr - 5.5 + (i % 2) * 2.5), 1.9, Color("EDB824"))
				q += 0.1 / ring.r
				i += 1
	for t in ring.thorns:
		if not t.alive:
			continue
		var a: float = t.a
		var b: float = t.base * G.PPM
		var tp: float = t.tip * G.PPM
		var hw: float = t.half * 1.2
		var tip = Vector2.from_angle(a) * tp
		var l = Vector2.from_angle(a - hw) * b
		var rr = Vector2.from_angle(a + hw) * b
		var mid = Vector2.from_angle(a) * b
		var hook: bool = t.kind != "blunt"
		draw_colored_polygon(PackedVector2Array([l, tip, mid]), Color("FF5B4F") if hook else Color("B9BEC4"))
		draw_colored_polygon(PackedVector2Array([mid, tip, rr]), Color("D93A31") if hook else Color("8E959C"))
