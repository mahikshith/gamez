# The vault: rings (kinematic bodies turned by the player), eggs, thorns, sponge pads, flame orbs, nest and ground.
# Built from the shared level data (data/levels.json, exported from the web game). Angles in the data are degrees,
# y up, -90 = straight down; here screen y points down, so every angle flips sign.
# Rules follow the web game: approach speed >= CRACK_V cracks, >= SHATTER_V breaks, pads and the nest soften,
# three cracks break the egg, hook thorns and the ground break it, a flaming egg burns thorns away.
extends Node2D

const G = preload("res://scripts/g.gd")
const Egg = preload("res://scripts/egg.gd")
const CRACK_V := 5.6
const SHATTER_V := 8.5
const PAD_SOFT := 0.5
const NEST_SOFT := 2.3
const EGG_EGG := 2.0
const MATERIALS := {"wood": [0.75, 0.08], "stone": [0.85, 0.04], "ice": [0.02, 0.05], "metal": [0.55, 0.12], "coral": [0.9, 0.08], "glass": [0.45, 0.12]}

signal saved_egg(egg)
signal broke_egg(egg, why)
signal cracked_egg(egg)
signal finished(won: bool)
signal grabbed

var level: Dictionary
var rings = []
var eggs = []
var outer_r = 0.0
var ground_y = 0.0
var nest_x = 0.0
var nest_w = 2.6
var n_eggs = 0
var target = 1
var n_saved = 0
var n_broken = 0
var any_cracks = false
var done = false
var held = null
var _grab_a = 0.0
var _nest_area: Area2D
var _nest_pile = 0
var _fx: Node2D
var splats = []
var play_t = 0.0

func setup(lv: Dictionary) -> void:
	level = lv
	n_eggs = int(lv.get("eggs", 1))
	target = int(lv.get("target", n_eggs))
	_fx = Node2D.new()
	_fx.z_index = 5
	var r = float(lv.get("r0", 1.05))
	var spacing = float(lv.get("spacing", 1.0))
	var specs: Array = lv.rings
	for i in specs.size():
		if i > 0:
			r += float(specs[i].get("gapTo", spacing))
		rings.append(_make_ring(i, r, specs[i], str(specs[i].get("mat", lv.get("material", "wood")))))
	outer_r = r + G.RING_TH / 2
	var nest: Dictionary = lv.get("nest", {})
	nest_w = float(nest.get("w", 1.9))
	nest_x = float(nest.get("x", 0.0))
	ground_y = (outer_r + float(nest.get("drop", 0.6)) + 0.35)
	_make_ground()
	_make_nest()
	for o in lv.get("orbs", []):
		_make_orb(o)
	var spots = [[-0.24, -0.62], [0.24, -0.62], [0.0, -0.1], [-0.3, 0.3], [0.3, 0.3]]
	var k = float(rings[0].r) / 1.05
	for i in mini(n_eggs, spots.size()):
		_add_egg(Vector2(spots[i][0] * k, -spots[i][1] * k) * G.PPM)
	add_child(_fx)

# ---------------------------------------------------------------- build
func _make_ring(i: int, r: float, spec: Dictionary, mat: String) -> Dictionary:
	var body = AnimatableBody2D.new()
	body.sync_to_physics = true
	body.collision_layer = 1
	body.collision_mask = 0
	var m = PhysicsMaterial.new()
	var mm: Array = MATERIALS.get(mat, MATERIALS.wood)
	m.friction = mm[0]
	m.bounce = mm[1]
	body.physics_material_override = m
	body.rotation = -deg_to_rad(float(spec.get("angle", 0.0)))
	add_child(body)
	var ring = {"i": i, "r": r, "body": body, "angle": body.rotation, "target": body.rotation, "omega": 0.0,
		"wmax": minf(2.2, 2.7 / r) * (0.7 if mat == "stone" else 1.0), "mat": mat, "gaps": [], "pads": [], "thorns": [], "arcs": []}
	for g in spec.get("gaps", []):
		var ln = float(g.get("len", 0.78))
		ring.gaps.append({"a": -deg_to_rad(float(g.a)), "half": ln / (2.0 * r), "x": int(g.get("x", 1))})
	for p in spec.get("pads", []):
		ring.pads.append({"a": -deg_to_rad(float(p.a)), "half": float(p.len) / (2.0 * r)})
	# solid arcs between gaps
	var gs: Array = ring.gaps.duplicate()
	gs.sort_custom(func(a, b): return a.a < b.a)
	var arcs = []
	if gs.is_empty():
		arcs.append([0.0, TAU])
	else:
		for j in gs.size():
			var a0: float = gs[j].a + gs[j].half
			var nxt: Dictionary = gs[(j + 1) % gs.size()]
			var a1: float = nxt.a - nxt.half
			if j == gs.size() - 1:
				a1 += TAU
			if a1 > a0:
				arcs.append([a0, a1])
	ring.arcs = arcs
	var ri = (r - G.RING_TH / 2) * G.PPM
	var ro = (r + G.RING_TH / 2) * G.PPM
	for arc in arcs:
		var n = maxi(1, int(ceil((arc[1] - arc[0]) * r / 0.2)))
		for k in n:
			var b0: float = arc[0] + (arc[1] - arc[0]) * k / n
			var b1: float = arc[0] + (arc[1] - arc[0]) * (k + 1) / n
			var cp = CollisionPolygon2D.new()
			cp.polygon = PackedVector2Array([Vector2.from_angle(b0) * ri, Vector2.from_angle(b0) * ro, Vector2.from_angle(b1) * ro, Vector2.from_angle(b1) * ri])
			var mid = (b0 + b1) / 2
			var pad = false
			for p in ring.pads:
				if absf(G.wrapa(mid - p.a)) < p.half:
					pad = true
			cp.set_meta("kind", "pad" if pad else "seg")
			body.add_child(cp)
	for th in spec.get("thorns", []):
		var cnt = int(th.get("n", 1))
		for k in cnt:
			var a = -deg_to_rad(float(th.a) + (k - (cnt - 1) / 2.0) * float(th.get("spread", 11.0)))
			_add_thorn(ring, a, str(th.get("side", "in")), float(th.get("h", 0.24)), str(th.get("kind", "hook")))
	var art = preload("res://scripts/ring_art.gd").new()
	art.ring = ring
	body.add_child(art)
	ring.art = art
	return ring

func _add_thorn(ring: Dictionary, a: float, side: String, h: float, kind: String) -> void:
	var r: float = ring.r
	var half = 0.13 / r
	var base = r - G.RING_TH / 2 + 0.03 if side == "in" else r + G.RING_TH / 2 - 0.03
	var tip = base - h if side == "in" else base + h
	var cp = CollisionPolygon2D.new()
	cp.polygon = PackedVector2Array([Vector2.from_angle(a - half) * base * G.PPM, Vector2.from_angle(a + half) * base * G.PPM, Vector2.from_angle(a) * tip * G.PPM])
	cp.set_meta("kind", "thorn")
	var th = {"a": a, "base": base, "tip": tip, "half": half, "kind": kind, "alive": true, "burn": 0.0, "cp": cp}
	cp.set_meta("thorn", th)
	ring.body.add_child(cp)
	ring.thorns.append(th)

func _make_ground() -> void:
	var gb = StaticBody2D.new()
	gb.collision_layer = 16
	var cs = CollisionShape2D.new()
	var rect = RectangleShape2D.new()
	rect.size = Vector2(120.0, 1.0) * G.PPM
	cs.shape = rect
	cs.position = Vector2(0, ground_y * G.PPM + rect.size.y / 2)
	cs.set_meta("kind", "ground")
	gb.add_child(cs)
	add_child(gb)

func _make_nest() -> void:
	var nb = StaticBody2D.new()
	nb.collision_layer = 8
	var m = PhysicsMaterial.new()
	m.friction = 0.9
	m.bounce = 0.0
	nb.physics_material_override = m
	nb.position = Vector2(nest_x, ground_y - 0.02) * G.PPM
	var w = nest_w / 2
	var polys = [
		[Vector2(-w, 0.12), Vector2(-w + 0.18, 0), Vector2(w - 0.18, 0), Vector2(w, 0.12), Vector2(w - 0.2, 0.16), Vector2(-w + 0.2, 0.16)],
		[Vector2(-w - 0.08, 0.5), Vector2(-w, 0.08), Vector2(-w + 0.14, 0.12), Vector2(-w + 0.04, 0.5)],
		[Vector2(w + 0.08, 0.5), Vector2(w - 0.04, 0.5), Vector2(w - 0.14, 0.12), Vector2(w, 0.08)],
	]
	for poly in polys:
		var cp = CollisionPolygon2D.new()
		var pts = PackedVector2Array()
		for p in poly:
			pts.append(Vector2(p.x, -p.y) * G.PPM)
		cp.polygon = pts
		cp.set_meta("kind", "nest")
		nb.add_child(cp)
	add_child(nb)
	_nest_area = Area2D.new()
	_nest_area.collision_layer = 0
	_nest_area.collision_mask = 2
	_nest_area.position = nb.position
	var cs = CollisionShape2D.new()
	var rect = RectangleShape2D.new()
	rect.size = Vector2((w - 0.12) * 2, 0.5) * G.PPM
	cs.shape = rect
	cs.position = Vector2(0, -0.38 * G.PPM)
	_nest_area.add_child(cs)
	add_child(_nest_area)

func _make_orb(o: Dictionary) -> void:
	var ch = int(o.get("ch", 1))
	var rad = 0.0
	if ch > 0 and ch < rings.size():
		rad = (rings[ch - 1].r + rings[ch].r) / 2.0
	elif ch >= rings.size():
		rad = rings[-1].r + 0.5
	var a = -deg_to_rad(float(o.get("a", 0.0)))
	var orb = preload("res://scripts/orb.gd").new()
	orb.kind = str(o.get("type", "fire_red"))
	orb.position = Vector2.from_angle(a) * rad * G.PPM
	orb.taken.connect(_on_orb)
	add_child(orb)

func _add_egg(p: Vector2) -> void:
	var e = Egg.new()
	e.position = p
	e.hit.connect(_on_hit)
	add_child(e)
	eggs.append(e)

# ---------------------------------------------------------------- input: drag a ring like a dial
func pointer(ev: InputEvent, world_pos: Vector2) -> void:
	if done:
		return
	var lp = world_pos - global_position
	var d = lp.length() / G.PPM
	var pressed: bool = (ev is InputEventScreenTouch and ev.pressed) or (ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT)
	var released: bool = (ev is InputEventScreenTouch and not ev.pressed) or (ev is InputEventMouseButton and not ev.pressed)
	if pressed and held == null:
		if d > outer_r + 0.9:
			return
		var best = null
		var bd = 9e9
		for ring in rings:
			var dd = absf(d - ring.r)
			if dd < bd:
				bd = dd
				best = ring
		if best != null:
			held = best
			held.art.held = true
			_grab_a = lp.angle()
			Sfx.play("grab", -6.0)
			Sfx.buzz(8, 0.3)
			grabbed.emit()
	elif released and held != null:
		held.art.held = false
		held = null
	elif held != null and (ev is InputEventScreenDrag or ev is InputEventMouseMotion):
		if lp.length() < 12.0:
			return
		var a = lp.angle()
		var da = G.wrapa(a - _grab_a)
		_grab_a = a
		held.target += da

# ---------------------------------------------------------------- step
func _physics_process(dt: float) -> void:
	for ring in rings:
		var lim: float = ring.wmax
		ring.target = ring.angle + clampf(ring.target - ring.angle, -0.7, 0.7)
		var w = clampf((ring.target - ring.angle) * 14.0, -lim, lim)
		var before: float = ring.angle
		ring.angle += w * dt
		ring.body.rotation = ring.angle
		# a tick every ~10 degrees turned, like a dial
		if int(floor(before / 0.17)) != int(floor(ring.angle / 0.17)):
			Sfx.play("click", -14.0, randf_range(0.9, 1.1))
			Sfx.buzz(4, 0.15)
		for th in ring.thorns:
			if th.burn > 0.0:
				th.burn -= dt
	if done:
		return
	play_t += dt
	var inside = _nest_area.get_overlapping_bodies()
	for e in eggs:
		if not e.alive or e.saved:
			continue
		if e in inside and e.linear_velocity.length() < 1.5 * G.PPM:
			e.nest_t += dt
			if e.nest_t > 0.3:
				_save(e)
		else:
			e.nest_t = 0.0
		if e.global_position.y - global_position.y > (ground_y + 2.0) * G.PPM or absf(e.position.x) > 30.0 * G.PPM:
			_break(e, "lost")

func _on_hit(e, kind: String, v: float, node: Node) -> void:
	if not e.alive or e.saved or done:
		return
	match kind:
		"ground":
			_break(e, "ground")
			return
		"thorn":
			var th: Dictionary = node.get_meta("thorn")
			if not th.alive:
				return
			if e.fire > 0.0:
				_burn_thorn(th)
				return
			if th.kind == "blunt":
				if e.crack_cd <= 0.0:
					_crack(e)
				return
			_break(e, "thorn")
			return
	if e.safe_t > 0.0:
		return
	var vv = v
	if kind == "pad":
		vv *= PAD_SOFT
	elif kind == "nest":
		vv /= NEST_SOFT
	elif kind == "egg":
		vv /= EGG_EGG
	if vv >= SHATTER_V:
		_break(e, "shatter")
	elif vv >= CRACK_V and e.crack_cd <= 0.0:
		_crack(e)
	elif v > 1.2:
		Sfx.play("click", -18.0 + minf(v, 6.0), 0.6)

func _crack(e) -> void:
	e.crack()
	any_cracks = true
	Sfx.play("crack", -2.0, randf_range(0.9, 1.1))
	Sfx.buzz(30, 0.6)
	cracked_egg.emit(e)
	if e.cracks >= 3:
		_break(e, "cracks")

func _burn_thorn(th: Dictionary) -> void:
	th.alive = false
	th.cp.set_deferred("disabled", true)
	Sfx.play("burn", -4.0)
	_puff(th.cp.global_position + Vector2.from_angle(th.a + th.cp.get_parent().rotation) * (th.base + th.tip) / 2.0 * G.PPM, Color(0.3, 0.25, 0.2), 14)

func _on_orb(orb, e) -> void:
	if orb.kind.begins_with("fire"):
		e.fire = 6.0
	Sfx.play("save", -4.0, 0.7)
	Sfx.buzz(20, 0.4)

func _save(e) -> void:
	e.saved = true
	n_saved += 1
	e.set_deferred("freeze", true)
	e.collision_layer = 0
	e.collision_mask = 0
	var slot = _nest_pile
	_nest_pile += 1
	var dest = Vector2(nest_x * G.PPM + (slot - 1) * 34.0 * (0.9 if slot < 3 else 0.5), (ground_y - 0.2) * G.PPM - (12.0 if slot >= 3 else 0.0))
	var tw = create_tween()
	tw.tween_property(e, "position", dest, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(e, "rotation", 0.0, 0.35)
	_sparkle(dest + global_position)
	Sfx.play("save", 0.0)
	Sfx.buzz(25, 0.5)
	saved_egg.emit(e)
	_check_end()

func _break(e, why: String) -> void:
	if not e.alive:
		return
	e.alive = false
	n_broken += 1
	var p: Vector2 = e.global_position
	_shards(p, why == "ground")
	if why == "ground":
		splats.append({"x": e.position.x, "s": randf_range(0.9, 1.2)})
		queue_redraw()
	Sfx.play("splat" if why == "ground" else "crack", 0.0, 0.8)
	Sfx.buzz(60, 0.9)
	eggs.erase(e)
	broke_egg.emit(e, why)
	e.queue_free()
	_check_end()

func _check_end() -> void:
	if done:
		return
	var left = n_eggs - n_saved - n_broken
	if n_saved + left < target:
		done = true
		finished.emit(false)
	elif left == 0:
		done = true
		finished.emit(true)

func stars() -> int:
	if n_saved < target:
		return 0
	if n_saved < n_eggs:
		return 1
	return 2 if any_cracks else 3

func falling_fast() -> bool:
	for e in eggs:
		if e.alive and not e.saved and e.linear_velocity.y > 3.5 * G.PPM:
			return true
	return false

# ---------------------------------------------------------------- effects
func _burst(p: Vector2, n: int, cols: Array, vel: Vector2, grav: float, size: Vector2, life := 0.8) -> void:
	var ps = CPUParticles2D.new()
	ps.one_shot = true
	ps.explosiveness = 0.95
	ps.amount = n
	ps.lifetime = life
	ps.global_position = p
	ps.direction = Vector2(0, -1)
	ps.spread = 180.0
	ps.initial_velocity_min = vel.x
	ps.initial_velocity_max = vel.y
	ps.gravity = Vector2(0, grav)
	ps.scale_amount_min = size.x
	ps.scale_amount_max = size.y
	ps.angular_velocity_min = -400
	ps.angular_velocity_max = 400
	var gr = Gradient.new()
	gr.set_color(0, cols[0])
	gr.set_color(1, cols[cols.size() - 1])
	ps.color_initial_ramp = gr
	var fade = Gradient.new()
	fade.set_color(0, Color.WHITE)
	fade.set_color(1, Color(1, 1, 1, 0))
	fade.add_point(0.7, Color.WHITE)
	ps.color_ramp = fade
	_fx.add_child(ps)
	ps.global_position = p
	ps.emitting = true
	ps.finished.connect(ps.queue_free)

func _shards(p: Vector2, ground: bool) -> void:
	_burst(p, 18, [Color("fffaf0"), Color("efd3a8")], Vector2(120, 380), 1400.0, Vector2(5, 9), 0.9)
	_burst(p, 14, [Color("ffd23a"), Color("ff9f1a")], Vector2(60, 240 if ground else 160), 1200.0, Vector2(4, 8), 0.7)

func _sparkle(p: Vector2) -> void:
	_burst(p, 22, [Color("fff59a"), Color("ffffff")], Vector2(100, 260), 200.0, Vector2(3, 7), 0.7)

func _puff(p: Vector2, c: Color, n: int) -> void:
	_burst(p, n, [c, c.lightened(0.3)], Vector2(30, 90), -120.0, Vector2(5, 10), 0.8)

func _draw() -> void:
	# vault back-plate: a deep translucent disc (radial gradient, darker at the rim) so cream eggs and wood rings
	# both read clearly against it, plus a thin light rim
	var R = (outer_r + 0.22) * G.PPM
	# triangle fan sent as a raw triangle list (a polygon through the centre would fail to triangulate)
	var fan = PackedVector2Array([Vector2.ZERO])
	var cols = PackedColorArray([Color(0.16, 0.46, 0.62, 0.22)])
	var idx = PackedInt32Array()
	for k in 64:
		fan.append(Vector2.from_angle(TAU * k / 64.0) * R)
		cols.append(Color(0.10, 0.33, 0.50, 0.36))
		idx.append_array([0, 1 + k, 1 + (k + 1) % 64])
	RenderingServer.canvas_item_add_triangle_array(get_canvas_item(), idx, fan, cols)
	draw_arc(Vector2.ZERO, R, 0, TAU, 96, Color(1, 1, 1, 0.35), 4.0, true)
	# yolk splats on the ground
	for s in splats:
		var c = Vector2(s.x, ground_y * G.PPM - 2.0)
		draw_colored_polygon(G.ellipse(c, 30.0 * s.s, 6.0 * s.s, 20), Color("ffc93a"))
		draw_colored_polygon(G.ellipse(c + Vector2(4, -1), 12.0 * s.s, 4.0 * s.s, 16), Color("ff9f1a"))
