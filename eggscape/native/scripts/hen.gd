# Mama Hen, the mascot. A cut-out rig (tail, far wing, legs, body, near wing, head) drawn from vector parts and
# posed every frame. Moods: idle, worried, cheer (one-shot hop), cry, dance (win loop), celebrate (big win stage).
# Every mood is a pose function; switching mood cross-fades the poses over 0.22 s so nothing pops.
# Origin = between the feet; height H px. Faces +x; set face = -1 to face left.
extends Node2D

const G = preload("res://scripts/g.gd")
const LINE := Color("6b4a2a")
const BODY := Color("fff6e6")
const SHADE := Color("efd3a8")
const WING := Color("f8e7c9")
const RED := Color("e8382b")
const RED_D := Color("a51c13")
const BEAK := Color("ffb93a")
const LEG := Color("f59a23")
const EYE := Color("2a1d14")
const BLUSH := Color(1.0, 0.45, 0.45, 0.45)

@export var H := 140.0
@export var face := 1
var mood = "idle"
var t = 0.0
var _prev = {}
var _prev_mood = "idle"
var _blend = 1.0
var _mood_t = 0.0
var _blink_next = 2.0
var _blink = 0.0
var _peck_next = 4.0
var _peck = -1.0
var tears = []
var notes = []

func set_mood(m: String) -> void:
	if m == mood and m != "cheer":
		return
	_prev = _pose(mood, t, _mood_t)
	_prev_mood = mood
	mood = m
	_mood_t = 0.0
	_blend = 0.0

func _process(dt: float) -> void:
	t += dt
	_mood_t += dt
	_blend = minf(1.0, _blend + dt / 0.22)
	_blink_next -= dt
	if _blink_next <= 0.0:
		_blink = 0.14
		_blink_next = randf_range(2.0, 4.5)
	_blink = maxf(0.0, _blink - dt)
	if mood == "idle":
		_peck_next -= dt
		if _peck_next <= 0.0:
			_peck = 0.0
			_peck_next = randf_range(4.0, 8.0)
	if _peck >= 0.0:
		_peck += dt
		if _peck > 0.7:
			_peck = -1.0
	if mood == "cheer" and _mood_t > 1.1:
		set_mood("idle")
	if mood == "cry" and randf() < dt * 5.0:
		tears.append({"p": Vector2(28 + randf_range(-3, 3), -78), "v": Vector2(randf_range(10, 40), -30), "life": 0.8})
	if (mood == "dance" or mood == "celebrate") and randf() < dt * 1.6:
		notes.append({"p": Vector2(randf_range(-30, 40), -110), "life": 1.4, "s": randf_range(0.8, 1.2)})
	for d in tears:
		d.v = d.v + Vector2(0, 300.0 * dt)
		d.p += d.v * dt
		d.life -= dt
	tears = tears.filter(func(d): return d.life > 0.0)
	for n in notes:
		n.p += Vector2(sin(n.life * 6.0) * 20.0, -50.0) * dt
		n.life -= dt
	notes = notes.filter(func(n): return n.life > 0.0)
	queue_redraw()

# A pose: lift (px up), sq (squash +wide), lean (rad), wn/wf (near/far wing raise, rad), hx/hy (head offset),
# hr (head tilt), tail (rad), eyes (0 open, 1 happy arcs, 2 closed sad, 3 wide), beak (0..1 open), legk (leg kick).
func _pose(m: String, tt: float, mt: float) -> Dictionary:
	var p = {"lift": 0.0, "sq": sin(tt * 2.4) * 0.025, "lean": 0.0, "wn": 0.0, "wf": 0.0, "hx": 0.0, "hy": sin(tt * 2.4 + 0.6) * 1.2,
		"hr": 0.0, "tail": sin(tt * 1.7) * 0.05, "eyes": 0.0, "beak": 0.0, "legk": 0.0, "sweat": 0.0}
	match m:
		"idle":
			if _peck >= 0.0:
				var k = sin(clampf(_peck / 0.7, 0.0, 1.0) * PI)
				p.lean = 0.35 * k
				p.hx = 10.0 * k
				p.hy += 18.0 * k
				p.hr = 0.5 * k
		"worried":
			var sh = sin(tt * 22.0)
			p.wn = 0.7 + 0.25 * sh
			p.wf = 0.6 - 0.25 * sh
			p.sq = -0.04 + 0.02 * sh
			p.hx = -4.0
			p.hy = -4.0 + sin(tt * 9.0) * 2.0
			p.eyes = 3.0
			p.beak = 0.5
			p.sweat = 1.0
			p.tail = 0.25
		"cheer":
			var k = mt
			if k < 0.15:
				p.sq = 0.16 * k / 0.15
			elif k < 0.75:
				var u = (k - 0.15) / 0.6
				p.lift = 60.0 * sin(u * PI)
				p.sq = -0.12 * sin(u * PI) + 0.16 * maxf(0.0, 1.0 - u * 4.0)
				p.wn = 1.2 + 0.9 * sin(tt * 30.0)
				p.wf = 1.2 - 0.9 * sin(tt * 30.0)
				p.legk = 1.0
			else:
				var u = (k - 0.75) / 0.35
				p.sq = 0.14 * (1.0 - u)
			p.eyes = 1.0
			p.beak = 0.8
			p.tail = 0.3
		"cry":
			p.lean = 0.25
			p.sq = 0.05 + 0.03 * sin(tt * 16.0)
			p.hy = 8.0 + 2.0 * sin(tt * 16.0)
			p.hr = 0.25
			p.wn = 0.15
			p.eyes = 2.0
			p.beak = 0.3
			p.tail = -0.2
		"dance", "celebrate":
			var big = 1.6 if m == "celebrate" else 1.0
			var beat = fmod(tt * 2.0, 1.0)
			var hop = absf(sin(beat * PI))
			p.lift = 26.0 * hop * big
			p.sq = -0.08 * hop + 0.1 * maxf(0.0, 1.0 - hop * 5.0)
			var side = 1.0 if fmod(tt, 1.0) < 0.5 else -1.0
			p.lean = 0.12 * side
			p.wn = 1.1 + 0.9 * (1.0 if side > 0 else 0.0) * big * 0.6 + 0.3 * sin(tt * 14.0)
			p.wf = 1.1 + 0.9 * (1.0 if side < 0 else 0.0) * big * 0.6 - 0.3 * sin(tt * 14.0)
			p.hr = -0.15 * side
			p.eyes = 1.0
			p.beak = 0.7
			p.legk = hop
			p.tail = 0.3 * side
	return p

func _cur() -> Dictionary:
	var p = _pose(mood, t, _mood_t)
	if _blend >= 1.0 or _prev.is_empty():
		return p
	var k = smoothstep(0.0, 1.0, _blend)
	for key in p:
		p[key] = lerpf(_prev[key], p[key], k) if key != "eyes" else (p[key] if k > 0.5 else _prev[key])
	return p

func _draw() -> void:
	var p = _cur()
	var s = H / 140.0
	draw_set_transform(Vector2.ZERO, 0.0, Vector2(s * face, s))
	# ground shadow stays on the ground while she hops
	var sh = 1.0 - clampf(p.lift / 120.0, 0.0, 0.6)
	draw_colored_polygon(G.ellipse(Vector2(0, 2), 44 * sh, 7 * sh, 24), Color(0.15, 0.07, 0.0, 0.25))
	var lift: float = p.lift
	var sq: float = p.sq
	# legs (behind the body), with a kick when hopping
	for i in 2:
		var hip = Vector2(-8 + i * 16, -24 - lift)
		var kick: float = p.legk * (8.0 if i == 0 else -6.0)
		var foot = Vector2(-10 + i * 18 + kick, -lift * 0.15 if lift > 0 else 0.0)
		if lift > 0:
			foot.y = -lift + 4.0
		draw_line(hip, foot, LINE, 9.0, true)
		draw_line(hip, foot, LEG, 5.0, true)
		for toe in [-0.5, 0.0, 0.5]:
			var tp: Vector2 = foot + Vector2(11, 0).rotated(toe)
			draw_line(foot, tp, LINE, 6.0, true)
			draw_line(foot, tp, LEG, 3.2, true)
	# body transform: squash around the feet, lean about the hips
	var bt = Transform2D(p.lean, Vector2(1.0 + sq, 1.0 - sq), 0.0, Vector2(0, -lift))
	draw_set_transform_matrix(Transform2D(0.0, Vector2(s * face, s), 0.0, Vector2.ZERO) * bt)
	# tail fan: three long rounded feathers fanning up and back
	for i in 3:
		var a: float = -2.25 - 0.36 * (i - 1) + p.tail
		var base = Vector2(-30, -66)
		var c = base + Vector2.from_angle(a) * 22.0
		G.shape(self, G.ellipse(c, 24.0 - absf(i - 1) * 3.0, 9.5, 20, a), WING.darkened(0.06 * absf(i - 1)), LINE, 3.0)
	# far wing (peeks out when raised)
	_wing(Vector2(2, -66), p.wf, true)
	# body
	var body = G.ellipse(Vector2(-2, -58), 42, 34, 40)
	draw_colored_polygon(body, BODY)
	# hard cel shadow: the body minus itself shifted up-back
	for poly in Geometry2D.clip_polygons(body, G.ellipse(Vector2(-8, -66), 40, 32, 40)):
		draw_colored_polygon(poly, SHADE)
	# feather scallops on the chest
	for row in 2:
		for j in 3:
			var c = Vector2(14 + j * 7 - row * 4, -54 + row * 10 + j * 2)
			draw_arc(c, 6.0, 0.2, PI - 0.2, 8, SHADE.darkened(0.15), 2.0, true)
	draw_polyline(G.closed(body), LINE, 4.0, true)
	# head
	var hc = Vector2(26 + p.hx, -94 + p.hy)
	draw_set_transform_matrix(Transform2D(0.0, Vector2(s * face, s), 0.0, Vector2.ZERO) * bt * Transform2D(p.hr, hc))
	# neck fill joins head and body
	draw_colored_polygon(PackedVector2Array([Vector2(-14, 4), Vector2(12, 6), Vector2(4, 34), Vector2(-24, 30)]), BODY)
	# comb
	for i in 3:
		var cc = Vector2(-8 + i * 8, -21 + absf(i - 1) * 4)
		G.shape(self, G.ellipse(cc, 6.5, 7.5, 16), RED, RED_D, 2.5)
	var head = G.ellipse(Vector2.ZERO, 22, 21, 32)
	draw_colored_polygon(head, BODY)
	draw_polyline(G.closed(head), LINE, 4.0, true)
	# wattle
	G.shape(self, G.ellipse(Vector2(14, 16), 5, 8, 14), RED, RED_D, 2.5)
	# beak (upper + lower, opens)
	var bo: float = p.beak * 6.0
	G.shape(self, PackedVector2Array([Vector2(16, -6), Vector2(33, 1 - bo * 0.2), Vector2(16, 3)]), BEAK, Color("b5650a"), 2.5)
	G.shape(self, PackedVector2Array([Vector2(16, 3), Vector2(29, 4 + bo), Vector2(15, 7 + bo * 0.5)]), BEAK.darkened(0.12), Color("b5650a"), 2.5)
	# eyes and blush
	draw_colored_polygon(G.ellipse(Vector2(4, 9), 6, 4, 14), BLUSH)
	var eye = Vector2(8, -4)
	match int(p.eyes):
		1:
			draw_arc(eye + Vector2(0, 2), 5.0, PI + 0.3, TAU - 0.3, 10, EYE, 3.0, true)
		2:
			draw_arc(eye + Vector2(0, -3), 5.0, 0.3, PI - 0.3, 10, EYE, 3.0, true)
		_:
			var r = 4.6 if int(p.eyes) == 0 else 6.0
			if _blink > 0.0:
				draw_line(eye + Vector2(-5, 0), eye + Vector2(5, 0), EYE, 3.0, true)
			else:
				draw_colored_polygon(G.ellipse(eye, r * 0.85, r, 16), EYE)
				draw_circle(eye + Vector2(-1.5, -2.0), r * 0.35, Color.WHITE)
	if p.sweat > 0.0:
		var d = Vector2(-20, -16 + fmod(t * 30.0, 14.0))
		G.shape(self, PackedVector2Array([d + Vector2(0, -7), d + Vector2(4, 1), d + Vector2(0, 4), d + Vector2(-4, 1)]), Color("8fd3ff"), Color("3d8fd1"), 1.5)
	# near wing
	draw_set_transform_matrix(Transform2D(0.0, Vector2(s * face, s), 0.0, Vector2.ZERO) * bt)
	_wing(Vector2(-6, -64), p.wn, false)
	# tears and notes (no squash)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2(s * face, s))
	for d in tears:
		G.shape(self, G.ellipse(d.p, 3, 4.5, 10), Color("8fd3ff"), Color("3d8fd1"), 1.2)
	for n in notes:
		var a = clampf(n.life / 0.4, 0.0, 1.0)
		var c = Color(0.42, 0.29, 0.16, a)
		draw_circle(n.p, 4.5 * n.s, c)
		draw_line(n.p + Vector2(4, 0) * n.s, n.p + Vector2(4, -16) * n.s, c, 2.5, true)
		draw_line(n.p + Vector2(4, -16) * n.s, n.p + Vector2(10, -12) * n.s, c, 2.5, true)

# Wing: teardrop pivoting at the shoulder; raise > 0 lifts it up and back. far = darker, drawn behind the body.
func _wing(shoulder: Vector2, raise: float, far: bool) -> void:
	var a = -0.3 + raise
	var pts = PackedVector2Array()
	var L = 46.0
	for i in 17:
		var u = i / 16.0
		var w = sin(u * PI) * 15.0 * (1.0 - u * 0.35)
		pts.append(shoulder + Vector2(-u * L, -w).rotated(a))
	for i in range(16, -1, -1):
		var u = i / 16.0
		var w = sin(u * PI) * 9.0 * (1.0 - u * 0.4)
		pts.append(shoulder + Vector2(-u * L, w).rotated(a))
	var fill = WING.darkened(0.12) if far else WING
	G.shape(self, pts, fill, LINE, 3.5)
	if not far:
		for i in 3:
			var u = 0.45 + i * 0.16
			var c = shoulder + Vector2(-u * L, 2).rotated(a)
			draw_arc(c, 6.0, a + 0.3, a + PI - 0.3, 8, SHADE.darkened(0.2), 2.0, true)
