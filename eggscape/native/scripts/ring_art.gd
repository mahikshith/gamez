# Draws one ring (child of its body, so it turns with it): wood band with grain and bevel, rounded gap ends,
# foam sponge pads, thorns (hook = red, blunt = grey), and a glow while the player holds it.
extends Node2D

const G = preload("res://scripts/g.gd")
const WOOD := {"wood": [Color("c98a4b"), Color("e8b274"), Color("8a5228")], "stone": [Color("9b9a95"), Color("c9c7c0"), Color("5f5d58")],
	"ice": [Color("a9def5"), Color("e6f8ff"), Color("5c9fc2")], "metal": [Color("8e9aa6"), Color("d0d8e0"), Color("4c5662")],
	"coral": [Color("ef8a72"), Color("ffc0ae"), Color("a5493a")], "glass": [Color("b6e3e0"), Color("eefffd"), Color("6aa7a3")]}
var ring: Dictionary
var held = false
var _glow = 0.0

func _process(dt: float) -> void:
	var g = move_toward(_glow, 1.0 if held else 0.0, dt * 6.0)
	if g != _glow or held:
		_glow = g
		queue_redraw()

func _draw() -> void:
	var r: float = ring.r * G.PPM
	var th = G.RING_TH * G.PPM
	var ri = r - th / 2
	var ro = r + th / 2
	var col: Array = WOOD.get(ring.mat, WOOD.wood)
	if _glow > 0.0:
		for arc in ring.arcs:
			draw_colored_polygon(G.band(ri - 7, ro + 7, arc[0], arc[1]), Color(1, 0.95, 0.6, 0.35 * _glow))
	for arc in ring.arcs:
		var a0: float = arc[0]
		var a1: float = arc[1]
		draw_colored_polygon(G.band(ri, ro, a0, a1), col[0])
		# bevel: light on the outer half, shadow line inside
		draw_colored_polygon(G.band(r + th * 0.08, ro - 2, a0 + 0.01, a1 - 0.01), col[1])
		draw_polyline(G.arc(ri + 3, a0 + 0.01, a1 - 0.01), col[2].lightened(0.1), 2.0, true)
		# wood grain dashes
		var step = 0.55 / ring.r
		var k = a0 + step * 0.5
		while k < a1 - step * 0.3:
			var rr = r - th * 0.15 + sin(k * 7.0) * 3.0
			draw_line(Vector2.from_angle(k) * rr, Vector2.from_angle(k + step * 0.35) * rr, col[2].lightened(0.25), 2.0, true)
			k += step
		# outline with rounded ends at the gaps
		draw_polyline(G.closed(G.band(ri, ro, a0, a1)), col[2], 3.0, true)
		if a1 - a0 < TAU - 0.01:
			for e in [a0, a1]:
				var c = Vector2.from_angle(e) * r
				draw_circle(c, th / 2, col[0])
				draw_arc(c, th / 2, e + (PI / 2 if e == a1 else -PI / 2) - PI / 2, e + (PI / 2 if e == a1 else -PI / 2) + PI / 2, 10, col[2], 3.0, true)
	# sponge pads: soft yellow foam with pores, sitting on the inner face of the ring
	for p in ring.pads:
		for arc in ring.arcs:
			var s0: float = maxf(p.a - p.half, arc[0])
			var s1: float = minf(p.a + p.half, arc[1])
			if s1 <= s0:
				continue
			var pr = ri - 1
			var pts = G.band(pr - 9, pr + 4, s0, s1)
			G.shape(self, pts, Color("ffd85a"), Color("c99a1a"), 2.5)
			var q = s0 + 0.05
			var i = 0
			while q < s1 - 0.03:
				draw_circle(Vector2.from_angle(q) * (pr - 3.5 + (i % 2) * 3.0), 1.8, Color("e0b02a"))
				q += 0.11 / ring.r
				i += 1
	for t in ring.thorns:
		if not t.alive:
			continue
		var a: float = t.a
		var b: float = t.base * G.PPM
		var tp: float = t.tip * G.PPM
		var hw: float = t.half * 1.15
		var pts = PackedVector2Array([Vector2.from_angle(a - hw) * b, Vector2.from_angle(a) * tp, Vector2.from_angle(a + hw) * b])
		var hook: bool = t.kind != "blunt"
		G.shape(self, pts, Color("e23b2e") if hook else Color("9aa0a6"), Color("7a1810") if hook else Color("4a4f55"), 2.5)
		draw_line(Vector2.from_angle(a - hw * 0.3) * (b + (tp - b) * 0.15), Vector2.from_angle(a) * (b + (tp - b) * 0.75), Color(1, 1, 1, 0.45), 2.0, true)
