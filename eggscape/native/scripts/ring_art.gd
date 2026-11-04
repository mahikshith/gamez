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

func _process(dt: float) -> void:
	var g = move_toward(_glow, 1.0 if held else 0.0, dt * 6.0)
	if g != _glow or held:
		_glow = g
		queue_redraw()

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
