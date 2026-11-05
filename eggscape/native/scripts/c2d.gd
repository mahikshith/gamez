# A small HTML Canvas 2D style painter, so the game's own web art (src/render/*.js, all Canvas 2D code) ports to the app
# line for line and the app looks like the same game. Paths are tessellated in screen space as they are built; fill()
# triangulates each subpath (self-crossings are cleaned with Clipper), clip() is a polygon intersection, gradients are
# small cached gradient textures sampled through per-vertex UVs, strokes are polylines with round joins and caps.
# Use it inside a CanvasItem's _draw(): var c = C2D.new(); c.begin(self); c.move_to(...); ...
extends RefCounted

var ci: CanvasItem
var rid: RID
var T := Transform2D.IDENTITY
var alpha := 1.0
var fill = Color.BLACK # a Color, or a gradient from lin() / rad()
var stroke := Color.BLACK
var lw := 1.0
var round_cap := true
var clip = null # null, or an Array of outer polygons (screen space)
var _st := []
var _subs := [] # [PackedVector2Array, closed]
var _cur := PackedVector2Array()
var _start := Vector2.ZERO
var _pt := Vector2.ZERO
static var _tex := {}

func begin(item: CanvasItem) -> void:
	ci = item
	rid = item.get_canvas_item()
	T = Transform2D.IDENTITY
	alpha = 1.0
	clip = null
	_st.clear()
	begin_path()

# ---------------------------------------------------------------- state
func save() -> void:
	_st.append([T, alpha, fill, stroke, lw, clip, round_cap])

func restore() -> void:
	if _st.is_empty():
		return
	var s = _st.pop_back()
	T = s[0]
	alpha = s[1]
	fill = s[2]
	stroke = s[3]
	lw = s[4]
	clip = s[5]
	round_cap = s[6]

func translate(x: float, y: float) -> void:
	T = T * Transform2D(0.0, Vector2(x, y))

func rotate(a: float) -> void:
	T = T * Transform2D(a, Vector2.ZERO)

func scale(sx: float, sy: float) -> void:
	T = T * Transform2D(Vector2(sx, 0), Vector2(0, sy), Vector2.ZERO)

func sc() -> float:
	return sqrt(absf(T.determinant()))

# ---------------------------------------------------------------- paths
func begin_path() -> void:
	_subs = []
	_cur = PackedVector2Array()

func _flush(closed: bool) -> void:
	if _cur.size() > 0:
		_subs.append([_cur, closed])
	_cur = PackedVector2Array()

func move_to(x: float, y: float) -> void:
	_flush(false)
	var p = T * Vector2(x, y)
	_cur.append(p)
	_start = p
	_pt = p

func _lead() -> void:
	if _cur.is_empty():
		_cur.append(_pt)
		_start = _pt

func line_to(x: float, y: float) -> void:
	_lead()
	_pt = T * Vector2(x, y)
	_cur.append(_pt)

func _n(len_px: float) -> int:
	return clampi(int(len_px / 7.0), 3, 18)

func quad_to(cx: float, cy: float, x: float, y: float) -> void:
	_lead()
	var a: Vector2 = _pt
	var c: Vector2 = T * Vector2(cx, cy)
	var b: Vector2 = T * Vector2(x, y)
	var n: int = _n(a.distance_to(c) + c.distance_to(b))
	var k: int = _cur.size()
	_cur.resize(k + n)
	var inv: float = 1.0 / n
	for i in range(1, n + 1):
		var u: float = i * inv
		var v: float = 1.0 - u
		_cur[k + i - 1] = a * (v * v) + c * (2.0 * u * v) + b * (u * u)
	_pt = b

func bez_to(c1x: float, c1y: float, c2x: float, c2y: float, x: float, y: float) -> void:
	_lead()
	var a: Vector2 = _pt
	var c1: Vector2 = T * Vector2(c1x, c1y)
	var c2: Vector2 = T * Vector2(c2x, c2y)
	var b: Vector2 = T * Vector2(x, y)
	var n: int = _n(a.distance_to(c1) + c1.distance_to(c2) + c2.distance_to(b))
	var k: int = _cur.size()
	_cur.resize(k + n)
	var inv: float = 1.0 / n
	for i in range(1, n + 1):
		var u: float = i * inv
		var v: float = 1.0 - u
		_cur[k + i - 1] = a * (v * v * v) + c1 * (3.0 * u * v * v) + c2 * (3.0 * u * u * v) + b * (u * u * u)
	_pt = b

func close_path() -> void:
	_flush(true)
	_pt = _start

# arc / ellipse: like canvas, joined to the current subpath with a line when one is open
func arc(x: float, y: float, r: float, a0: float, a1: float, ccw := false) -> void:
	ellipse(x, y, r, r, 0.0, a0, a1, ccw)

func ellipse(x: float, y: float, rx: float, ry: float, rot: float, a0: float, a1: float, ccw := false) -> void:
	var d = a1 - a0
	if not ccw:
		d = TAU if d >= TAU else fposmod(d, TAU)
	else:
		d = -TAU if d <= -TAU else -fposmod(-d, TAU)
	var n: int = clampi(int(absf(d) * maxf(rx, ry) * sc() / 8.0), 6, 40)
	# one transform maps the unit circle straight to screen space: T * translate(x,y) * rotate(rot) * scale(rx,ry)
	var M: Transform2D = T * Transform2D(rot, Vector2(rx, ry), 0.0, Vector2(x, y))
	var was_empty: bool = _cur.is_empty()
	var k: int = _cur.size()
	_cur.resize(k + n + 1)
	var step: float = d / n
	for i in n + 1:
		_cur[k + i] = M * Vector2.from_angle(a0 + step * i)
	if was_empty:
		_start = _cur[k]
	_pt = _cur[k + n]

func rect(x: float, y: float, w: float, h: float) -> void:
	move_to(x, y)
	line_to(x + w, y)
	line_to(x + w, y + h)
	line_to(x, y + h)
	close_path()

func round_rect(x: float, y: float, w: float, h: float, r: float) -> void:
	r = minf(r, minf(w, h) / 2.0)
	_flush(false)
	ellipse(x + w - r, y + r, r, r, 0.0, -PI / 2, 0.0)
	ellipse(x + w - r, y + h - r, r, r, 0.0, 0.0, PI / 2)
	ellipse(x + r, y + h - r, r, r, 0.0, PI / 2, PI)
	ellipse(x + r, y + r, r, r, 0.0, PI, PI * 1.5)
	close_path()

func poly(pts: Array) -> void: # [x0, y0, x1, y1, ...] as a closed subpath
	move_to(pts[0], pts[1])
	for i in range(2, pts.size(), 2):
		line_to(pts[i], pts[i + 1])
	close_path()

func circle(x: float, y: float, r: float) -> void: # a closed circle as its own subpath
	_flush(false)
	ellipse(x, y, r, r, 0.0, 0.0, TAU)
	close_path()

func oval(x: float, y: float, rx: float, ry: float, rot := 0.0) -> void:
	_flush(false)
	ellipse(x, y, rx, ry, rot, 0.0, TAU)
	close_path()

func _paths() -> Array:
	var out = _subs.duplicate()
	if _cur.size() > 0:
		out.append([_cur, false])
	return out

# ---------------------------------------------------------------- polygons
static func _outer(polys: Array) -> Array:
	var out = []
	for p in polys:
		if p.size() >= 3 and not Geometry2D.is_polygon_clockwise(p):
			out.append(p)
	return out

static func _clean(pts: PackedVector2Array) -> Array:
	if pts.size() < 3:
		return []
	return [pts]

static func _repair(pts: PackedVector2Array) -> Array: # self-crossing outlines: split into simple pieces
	var out = []
	for p in Geometry2D.merge_polygons(pts, PackedVector2Array()):
		if p.size() >= 3:
			out.append(p)
	return out

func _clipped(polys: Array) -> Array:
	if clip == null:
		return polys
	var out = []
	for p in polys:
		for c in clip:
			out.append_array(_outer(Geometry2D.intersect_polygons(p, c)))
	return out

func _shape() -> Array:
	var polys = []
	for s in _paths():
		polys.append_array(_clean(s[0]))
	return _clipped(polys)

func fill_path(style = null) -> void:
	var st = fill if style == null else style
	for p in _shape():
		_poly(p, st)

func _poly(p: PackedVector2Array, st, again := true) -> void:
	var idx = Geometry2D.triangulate_polygon(p)
	if idx.is_empty():
		if again:
			for q in _repair(p):
				_poly(q, st, false)
		return
	if st is Color:
		var col: Color = st
		col.a *= alpha
		if col.a <= 0.002:
			return
		RenderingServer.canvas_item_add_triangle_array(rid, idx, p, PackedColorArray([col]))
		return
	# gradient: a texture through per-vertex UVs
	var uv = PackedVector2Array()
	uv.resize(p.size())
	var tex: Texture2D
	if st.k == 0:
		var a = T * st.a
		var b = T * st.b
		var d = b - a
		var l2 = maxf(d.length_squared(), 0.0001)
		for i in p.size():
			uv[i] = Vector2(clampf((p[i] - a).dot(d) / l2, 0.0, 1.0), 0.5)
		tex = _grad_tex(st, 0.0)
	else:
		var c = T * st.c
		var r1 = maxf(st.r1 * sc(), 0.001)
		for i in p.size():
			uv[i] = Vector2(0.5, 0.5) + (p[i] - c) / (2.0 * r1)
		tex = _grad_tex(st, clampf(st.r0 / maxf(st.r1, 0.001), 0.0, 0.95))
	RenderingServer.canvas_item_add_triangle_array(rid, idx, p, PackedColorArray([Color(1, 1, 1, alpha)]), uv, PackedInt32Array(), PackedFloat32Array(), tex.get_rid())

func lin(x0: float, y0: float, x1: float, y1: float, stops: Array) -> Dictionary:
	return {k = 0, a = Vector2(x0, y0), b = Vector2(x1, y1), s = stops}

func rad(x: float, y: float, r0: float, r1: float, stops: Array) -> Dictionary:
	return {k = 1, c = Vector2(x, y), r0 = r0, r1 = r1, s = stops}

static func _grad_tex(st: Dictionary, r0: float) -> Texture2D:
	var key = str(st.k) + "|" + str(snappedf(r0, 0.01)) + "|"
	for c in st.s:
		key += (c as Color).to_html() + ","
	if _tex.has(key):
		return _tex[key]
	var g = Gradient.new()
	var n = st.s.size()
	var offs = PackedFloat32Array()
	var cols = PackedColorArray()
	for i in n:
		var u = float(i) / maxf(1.0, n - 1)
		offs.append(r0 + u * (1.0 - r0) if st.k == 1 else u)
		cols.append(st.s[i])
	g.offsets = offs
	g.colors = cols
	var t
	if st.k == 0:
		t = GradientTexture1D.new()
		t.width = 128
		t.gradient = g
	else:
		t = GradientTexture2D.new()
		t.width = 96
		t.height = 96
		t.fill = GradientTexture2D.FILL_RADIAL
		t.fill_from = Vector2(0.5, 0.5)
		t.fill_to = Vector2(1.0, 0.5)
		t.gradient = g
	_tex[key] = t
	return t

# ---------------------------------------------------------------- strokes
func stroke_path(col = null, width := -1.0) -> void:
	var c: Color = stroke if col == null else col
	c.a *= alpha
	if c.a <= 0.002:
		return
	var w = (lw if width < 0.0 else width) * sc()
	var solid = c.a > 0.98
	for s in _paths():
		var pts: PackedVector2Array = s[0]
		if pts.size() < 2:
			continue
		if s[1]:
			pts = pts.duplicate()
			pts.append(pts[0])
		var pieces = [pts]
		if clip != null:
			pieces = []
			for cp in clip:
				pieces.append_array(Geometry2D.intersect_polyline_with_polygon(pts, cp))
		for q in pieces:
			_line(q, c, w, solid, s[1] and clip == null)

const _CAP_N := 10
static var _unit := PackedVector2Array()
var _cap_v := PackedVector2Array()
var _cap_i := PackedInt32Array()

static var _fan := PackedInt32Array()

func _cap(p: Vector2, r: float) -> void:
	if _unit.is_empty():
		_unit.append(Vector2.ZERO)
		for k in _CAP_N:
			_unit.append(Vector2.from_angle(TAU * k / _CAP_N))
			_fan.append_array([0, 1 + k, 1 + (k + 1) % _CAP_N])
	var b: int = _cap_v.size()
	_cap_v.append_array(Transform2D(0.0, Vector2(r, r), 0.0, p) * _unit)
	var f: PackedInt32Array = _fan.duplicate()
	for k in f.size():
		f[k] += b
	_cap_i.append_array(f)

func _line(q: PackedVector2Array, c: Color, w: float, solid: bool, closed: bool) -> void:
	if q.size() < 2:
		return
	ci.draw_polyline(q, c, w)
	if not solid or w < 2.0:
		return
	var r = w * 0.5
	# round joins where the line turns sharply (a polyline's own joins thin out there), round caps on open ends.
	# Tessellated curves turn gently at every point, so only short polylines (drawn corners) need the joins.
	# All the little discs go out in one triangle batch.
	_cap_v.clear()
	_cap_i.clear()
	for i in range(1, q.size() - 1 if q.size() < 10 else 1):
		var d0 = q[i] - q[i - 1]
		var d1 = q[i + 1] - q[i]
		if d0.length_squared() > 0.0001 and d1.length_squared() > 0.0001 and absf(d0.angle_to(d1)) > 0.45:
			_cap(q[i], r)
	if closed:
		_cap(q[0], r)
	elif round_cap:
		_cap(q[0], r)
		_cap(q[q.size() - 1], r)
	if _cap_i.size() > 0:
		RenderingServer.canvas_item_add_triangle_array(rid, _cap_i, _cap_v, PackedColorArray([c]))

# ---------------------------------------------------------------- clip, rects, dots
func clip_path() -> void:
	var polys = []
	for s in _paths():
		polys.append_array(_clean(s[0]))
	# union the subpaths (a body + neck + head silhouette is one clip region)
	var acc = []
	for p in polys:
		var m = p
		var keep = []
		for q in acc:
			var r = Geometry2D.merge_polygons(q, m)
			var o = _outer(r)
			if o.size() == 1:
				m = o[0]
			else:
				keep.append(q)
		keep.append(m)
		acc = keep
	if clip != null:
		var out = []
		for p in acc:
			for c in clip:
				out.append_array(_outer(Geometry2D.intersect_polygons(p, c)))
		acc = out
	clip = acc

func fill_rect(x: float, y: float, w: float, h: float, style = null) -> void:
	var p = PackedVector2Array([T * Vector2(x, y), T * Vector2(x + w, y), T * Vector2(x + w, y + h), T * Vector2(x, y + h)])
	if Geometry2D.is_polygon_clockwise(p):
		p.reverse()
	for q in _clipped([p]):
		_poly(q, fill if style == null else style)

func dot(x: float, y: float, r: float, col = null) -> void:
	begin_path()
	circle(x, y, r)
	fill_path(col)

# fill then outline the current path (the web art's "solid")
func solid(fill_style, line: Color, width: float) -> void:
	fill_path(fill_style)
	stroke_path(line, width)
