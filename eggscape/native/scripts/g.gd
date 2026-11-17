# Shared geometry and palette for drawing. Physics units: 1 m = PPM px, screen y points down.
extends RefCounted

const PPM := 100.0
const RING_TH := 0.16
const EGG_H := 0.56
const EGG_W := 0.42
const LINE := Color("6b4a2a")

static func ellipse(c: Vector2, rx: float, ry: float, n := 32, rot := 0.0) -> PackedVector2Array:
	var pts = PackedVector2Array()
	for i in n:
		var t = TAU * i / n
		pts.append(c + Vector2(cos(t) * rx, sin(t) * ry).rotated(rot))
	return pts

# Egg outline: narrow top (screen y up = negative), wide bottom. s scales it, in px.
static func egg(n := 24, s := PPM) -> PackedVector2Array:
	var pts = PackedVector2Array()
	for i in n:
		var t = TAU * i / n
		var sn = sin(t)
		pts.append(Vector2((EGG_W / 2) * cos(t) * (1.0 - 0.13 * sn), -(EGG_H / 2) * sn) * s)
	return pts

# Band between radii ri..ro over angles a0..a1 (screen radians).
static func band(ri: float, ro: float, a0: float, a1: float, step := 0.06) -> PackedVector2Array:
	var n = maxi(2, int(ceil(absf(a1 - a0) / step)))
	var pts = PackedVector2Array()
	for k in n + 1:
		var a = a0 + (a1 - a0) * k / n
		pts.append(Vector2(cos(a), sin(a)) * ro)
	for k in n + 1:
		var a = a1 + (a0 - a1) * k / n
		pts.append(Vector2(cos(a), sin(a)) * ri)
	return pts

static func arc(r: float, a0: float, a1: float, step := 0.05) -> PackedVector2Array:
	var n = maxi(2, int(ceil(absf(a1 - a0) / step)))
	var pts = PackedVector2Array()
	for k in n + 1:
		var a = a0 + (a1 - a0) * k / n
		pts.append(Vector2(cos(a), sin(a)) * r)
	return pts

static func star(c: Vector2, ro: float, ri: float, rot := 0.0) -> PackedVector2Array:
	var pts = PackedVector2Array()
	for i in 10:
		var r = ro if i % 2 == 0 else ri
		var a = -PI / 2 + PI * i / 5 + rot
		pts.append(c + Vector2(cos(a), sin(a)) * r)
	return pts

static func closed(pts: PackedVector2Array) -> PackedVector2Array:
	var out = pts.duplicate()
	out.append(pts[0])
	return out

# Fill + anti-aliased outline in one call.
static func shape(ci: CanvasItem, pts: PackedVector2Array, fill: Color, line := LINE, w := 3.0) -> void:
	ci.draw_colored_polygon(pts, fill)
	if w > 0.0:
		ci.draw_polyline(closed(pts), line, w, true)

static func wrapa(a: float) -> float:
	return wrapf(a, -PI, PI)
