# The vault: rings (kinematic bodies turned by the player), eggs, thorns, sponge pads, flame orbs, nest and ground.
# Built from the shared level data (data/levels.json, exported from the web game). Angles in the data are degrees,
# y up, -90 = straight down; here screen y points down, so every angle flips sign.
# Rules follow the web game: approach speed >= CRACK_V cracks, >= SHATTER_V breaks, pads and the nest soften,
# three cracks break the egg, hook thorns and the ground break it, a flaming egg burns thorns away.
# World 1 mechanics (ported from sim.js): gear trains, timed gap doors, thorn curtains, x-gates, the crack ladder
# (a fall through 2+ rings cracks on landing), portals (teleport, suction, orb spawners), swaying power orbs
# (red flame, green flame mends, twin egg, curse), and the fuse (level time limit).
extends Node2D

const G = preload("res://scripts/g.gd")
const Egg = preload("res://scripts/egg.gd")
const FX = preload("res://scripts/fx.gd")
const UI = preload("res://scripts/ui_kit.gd")
const CRACK_V := 5.6
const SHATTER_V := 8.5
const PAD_SOFT := 0.5
const NEST_SOFT := 2.3
const EGG_EGG := 2.0
const CURTAIN_BURN := 1.0
const PULL_R := 1.2
const MAX_EGGS := 4
const MATERIALS := {"wood": [0.75, 0.08], "stone": [0.85, 0.04], "ice": [0.02, 0.05], "metal": [0.55, 0.12], "coral": [0.9, 0.08], "glass": [0.45, 0.12]}

signal saved_egg(egg)
signal broke_egg(egg, why)
signal cracked_egg(egg)
signal finished(won: bool)
signal grabbed
signal eggs_changed
signal gate_passed(egg, x)
signal thief_event(kind: String)
signal bumped(egg, power: float)

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
var time_limit = 0.0
var time_left = 0.0
var curse_t = 0.0
var _jit_t = 0.0
var turns = 0
var orbs = []
var portals = []
var trains = []
var _portal_art: Node2D
var thieves = []

func setup(lv: Dictionary) -> void:
	level = lv
	n_eggs = int(lv.get("eggs", 1))
	target = int(lv.get("target", n_eggs))
	_fx = Node2D.new()
	_fx.z_index = 7
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
	# gears: spec.gear links a ring to the ring with that index (the next one out); linked chains form one train
	for ring in rings:
		var gi = rings[ring.i].spec.get("gear", null)
		if gi != null and int(gi) < rings.size() and int(gi) != ring.i:
			ring.gear_out = rings[int(gi)]
			rings[int(gi)].gear_in = ring
	for ring in rings:
		if ring.train != null or (ring.gear_in == null and ring.gear_out == null):
			continue
		var a = ring
		while a.gear_in != null:
			a = a.gear_in
		var train = []
		var b = a
		while b != null:
			train.append(b)
			b = b.gear_out
		for q in train:
			q.train = train
		trains.append(train)
	rings[-1].outer = true
	# the back plate: a shader disc behind everything in the vault
	var plate = Node2D.new()
	plate.z_index = -1
	var pm = ShaderMaterial.new()
	pm.shader = preload("res://shaders/plate.gdshader")
	var PR = (outer_r + 0.24) * G.PPM
	pm.set_shader_parameter("R", PR)
	plate.material = pm
	plate.draw.connect(func(): plate.draw_rect(Rect2(-PR - 50, -PR - 50, PR * 2 + 100, PR * 2 + 100), Color.WHITE))
	add_child(plate)
	move_child(plate, 0)
	for ring in rings:
		ring.art.queue_redraw()
	_make_ground()
	_make_nest()
	time_limit = float(lv.get("time", 0))
	time_left = time_limit
	_portal_art = Node2D.new()
	_portal_art.z_index = 1
	_portal_art.draw.connect(_draw_portals)
	add_child(_portal_art)
	var pi = 0
	for pd in lv.get("portals", []):
		var every = float(pd.get("every", 8))
		portals.append({"a": Vector2(float(pd.a[0]), -float(pd.a[1])), "b": Vector2(float(pd.b[0]), -float(pd.b[1])), "r": 0.3,
			"emit": pd.get("emit", []), "every": every, "timer": every * (0.4 + 0.3 * pi), "k": 0, "pull": float(pd.get("pull", PULL_R)), "src": "p%d" % pi})
		pi += 1
	for o in lv.get("orbs", []):
		_add_orb(str(o.get("type", "fire_red")), int(o.get("ch", 1)), -deg_to_rad(float(o.get("a", 90.0))), "start")
	# the egg thieves: the weasel (level 4) and the weasel boss (level 5)
	var F: Dictionary = lv.get("bossFight", {})
	if F.get("kind", "") == "weasel" and F.has("den"):
		var w = preload("res://scripts/weasel.gd").new()
		w.setup(self, {"a": F.den.get("a", 90), "hp": F.den.get("hp", 3), "delay": F.get("delay", 3)}, true)
		w.setup_boss_fight(F)
		add_child(w)
		thieves.append(w)
	if lv.has("weasel"):
		var w2 = preload("res://scripts/weasel.gd").new()
		w2.setup(self, lv.weasel, false)
		add_child(w2)
		thieves.append(w2)
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
		"wmax": minf(2.2, 2.7 / r) * (0.7 if mat == "stone" else 1.0), "mat": mat, "gaps": [], "pads": [], "thorns": [], "arcs": [],
		"spec": spec, "gear_in": null, "gear_out": null, "train": null, "follower": false, "moving": false}
	for g in spec.get("gaps", []):
		var ln = float(g.get("len", 0.78))
		var gd = {"a": -deg_to_rad(float(g.a)), "half": ln / (2.0 * r), "len": ln, "x": int(g.get("x", 1)), "shut": g.get("shut", null),
			"o": 1.0, "closed": false, "doors": [], "curtain": null}
		if g.get("curtain", 0):
			gd.curtain = {"alive": true, "burning": false, "burn": 0.0, "cps": []}
		ring.gaps.append(gd)
	var ncur = int(spec.get("curtain", 0))
	for gd in ring.gaps:
		if ncur > 0 and gd.curtain == null:
			gd.curtain = {"alive": true, "burning": false, "burn": 0.0, "cps": []}
			ncur -= 1
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
	# fixtures across special gaps: sliding doors (on only while shut) and thorn curtains (until burnt)
	for g in ring.gaps:
		if g.shut != null:
			g.doors = _across(ring, g, "shut")
			for cp in g.doors:
				cp.disabled = true
		if g.curtain != null:
			g.curtain.cps = _across(ring, g, "curtain")
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

func _across(ring: Dictionary, g: Dictionary, kind: String) -> Array:
	var r: float = ring.r
	var ri = (r - G.RING_TH / 2) * G.PPM
	var ro = (r + G.RING_TH / 2) * G.PPM
	var n = maxi(2, int(ceil(g.len / 0.2)))
	var out = []
	for k in n:
		var b0: float = g.a - g.half + 2.0 * g.half * k / n
		var b1: float = g.a - g.half + 2.0 * g.half * (k + 1) / n
		var cp = CollisionPolygon2D.new()
		cp.polygon = PackedVector2Array([Vector2.from_angle(b0) * ri, Vector2.from_angle(b0) * ro, Vector2.from_angle(b1) * ro, Vector2.from_angle(b1) * ri])
		cp.set_meta("kind", kind)
		cp.set_meta("gap", g)
		ring.body.add_child(cp)
		out.append(cp)
	return out

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

# A floating orb in channel ch (inside ring ch): it sways through the low part of the channel, where eggs roll,
# and sinks there from wherever it starts (sim.js addOrb / moveOrb). Angles are screen radians.
func _add_orb(kind: String, ch: int, a: float, src: String, rad := -1.0):
	ch = clampi(ch, 0, rings.size() - 1)
	var orb = preload("res://scripts/orb.gd").new()
	orb.kind = kind
	orb.ch = ch
	orb.a = a
	orb.rad = rad if rad > 0.0 else _orb_floor(ch) - 0.25
	orb.ph = randf() * TAU
	orb.sway = randf_range(0.7, 1.3)
	orb.src = src
	orb.taken.connect(_on_orb)
	add_child(orb)
	orbs.append(orb)
	_move_orb(orb, 0.0)
	return orb

func _orb_floor(ch: int) -> float:
	return float(rings[ch].r) - G.RING_TH / 2 - 0.3

func _move_orb(orb, dt: float) -> void:
	var floor_r = _orb_floor(orb.ch)
	var lo = float(rings[orb.ch - 1].r) + G.RING_TH / 2 + 0.22 if orb.ch > 0 else 0.0
	var A = minf(1.0, 1.5 / maxf(floor_r, 0.6))
	var want = PI / 2 + A * sin(play_t * 0.3 * orb.sway + orb.ph)
	var sp = (1.1 if absf(G.wrapa(want - orb.a)) > A + 0.25 else 0.4) * dt / maxf(orb.rad, 0.3)
	orb.a += clampf(G.wrapa(want - orb.a), -sp, sp)
	orb.rad += clampf(maxf(lo, floor_r - 0.04 + 0.05 * sin(play_t * 2.1 + orb.ph)) - orb.rad, -0.3 * dt, 0.3 * dt)
	orb.position = Vector2.from_angle(orb.a) * orb.rad * G.PPM

func _ch_at(d: float) -> int:
	var c = 0
	for ring in rings:
		if d > ring.r:
			c += 1
	return c

func _add_egg(p: Vector2, cracks := 0):
	var e = Egg.new()
	e.position = p
	e.hit.connect(_on_hit)
	e.bump.connect(_on_bump)
	e.ch = _ch_at(p.length() / G.PPM)
	add_child(e)
	eggs.append(e)
	for k in cracks:
		e.crack()
	return e

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
		ring.omega = clampf((ring.target - ring.angle) * 14.0, -lim, lim)
		ring.follower = false
	# gear trains: the ring being driven turns the rest, alternating direction ring by ring, at the slowest ring's speed
	for T in trains:
		var drive = T[0]
		for q in T:
			if absf(q.target - q.angle) > absf(drive.target - drive.angle):
				drive = q
		var lim = 99.0
		for q in T:
			lim = minf(lim, q.wmax)
		drive.omega = clampf(drive.omega, -lim, lim)
		for q in T:
			if q == drive:
				continue
			q.omega = (-1.0 if absi(q.i - drive.i) % 2 == 1 else 1.0) * drive.omega
			q.target = q.angle + q.omega * dt
			q.follower = true
	for ring in rings:
		var before: float = ring.angle
		ring.angle += ring.omega * dt
		ring.body.rotation = ring.angle
		var moving = not ring.follower and absf(ring.omega) > 0.25
		if moving and not ring.moving:
			turns += 1
		ring.moving = moving
		for g in ring.gaps:
			if g.shut != null:
				var per = float(g.shut.get("period", 4.0))
				var ph = fposmod(play_t + float(g.shut.get("phase", 0.0)), per) / per
				var want = 1.0 if ph < float(g.shut.get("open", 0.5)) else 0.0
				g.o = move_toward(g.o, want, dt * 2.5)
				var closed = g.o <= 0.5
				if closed != g.closed:
					g.closed = closed
					for cp in g.doors:
						cp.set_deferred("disabled", not closed)
					if closed:
						Sfx.play("click", -16.0, 0.5)
			var C = g.curtain
			if C != null and C.alive and C.burning:
				C.burn += dt / CURTAIN_BURN
				if C.burn >= 1.0:
					C.alive = false
					for cp in C.cps:
						cp.set_deferred("disabled", true)
					Sfx.play("burn", -4.0)
					var bp = ring.body.to_global(Vector2.from_angle(g.a) * ring.r * G.PPM)
					_puff(bp, Color(0.3, 0.25, 0.2), 12)
					FX.sparks(_fx, bp, 14, Color(1.0, 0.7, 0.3), 300.0)
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
	_bump_cd -= dt
	# the fuse (the curse orb makes it run double)
	if curse_t > 0.0:
		curse_t -= dt
		_jit_t -= dt
		if _jit_t <= 0.0:
			_jit_t = 0.18
			for e in eggs:
				if e.alive and not e.saved:
					e.apply_central_impulse(Vector2(randf_range(-0.4, 0.4), -randf() * 0.4) * G.PPM)
	if time_limit > 0.0:
		time_left -= dt * (2.0 if curse_t > 0.0 else 1.0)
		if time_left <= 0.0:
			time_left = 0.0
			for e in eggs.duplicate():
				if e.alive and not e.saved:
					_break(e, "fuse")
			if done:
				return
	for w in thieves:
		w.step(dt)
	if done:
		return
	for o in orbs.duplicate():
		if is_instance_valid(o) and not o.used:
			if not o.flying:
				_move_orb(o, dt)
		else:
			orbs.erase(o)
	_portal_step(dt)
	var inside = _nest_area.get_overlapping_bodies()
	for e in eggs:
		if not e.alive or e.saved or e.thf != 0:
			continue
		# channel tracking for the crack ladder and x-gates
		var ch = _ch_at(e.position.length() / G.PPM)
		if ch > e.ch:
			_pass_ring(e, rings[ch - 1])
		elif ch < e.ch:
			e.freefall = 0
		e.ch = ch
		if e in inside and e.linear_velocity.length() < 1.5 * G.PPM:
			e.nest_t += dt
			if e.nest_t > 0.3:
				_save(e)
		else:
			e.nest_t = 0.0
		if e.global_position.y - global_position.y > (ground_y + 2.0) * G.PPM or absf(e.position.x) > 30.0 * G.PPM:
			_break(e, "lost")

# ---------------------------------------------------------------- thief callbacks (weasel.gd)
func thief_in(_w) -> void:
	thief_event.emit("in")

func thief_grab(e) -> void:
	_popup("Grabbed!", e.global_position + Vector2(0, -50), Color("FF5148"))
	thief_event.emit("grab")

func thief_bonk(w) -> void:
	_popup("Bonk!", w.global_position + Vector2(0, -60), Color.WHITE)
	FX.sparks(_fx, w.global_position, 12)
	thief_event.emit("bonk")

func thief_trapped(w) -> void:
	_popup("Trapped! Drop an egg on it", w.global_position + Vector2(0, -70), Color("FFC21A"))
	thief_event.emit("trapped")

func thief_hit(w, _why: String) -> void:
	_popup("Bonk!" if not w.boss else ("Ouch! %d left" % w.hp if w.hp > 0 else "Beaten!"), w.global_position + Vector2(0, -70), Color.WHITE)
	FX.sparks(_fx, w.global_position, 18, Color(1.0, 0.92, 0.6), 340.0)
	thief_event.emit("hit" if not (w.boss and w.hp <= 0) else "beaten")

func thief_stash(w) -> void:
	_popup("Stolen!", w.global_position + Vector2(0, -60), Color("FF5148"))
	thief_event.emit("stash")

func boss_phase(w, _phase: int) -> void:
	_popup("It's angry!", w.global_position + Vector2(0, -90), Color("FF5148"))
	thief_event.emit("phase")

func boss_throw(w, spot: Dictionary) -> void:
	# the orb flies from its mouth to the egg it aimed at, then floats there
	var mine = orbs.filter(func(o): return is_instance_valid(o) and not o.used and o.src == "boss")
	if mine.size() >= 4:
		mine[0].used = true
		mine[0].queue_free()
	var o = _add_orb(spot.type, mini(spot.ch, rings.size() - 1), spot.p.angle(), "boss", spot.p.length())
	var dest = o.position
	o.position = w.mouth() * G.PPM
	o.monitoring = false
	o.flying = true
	var tw = create_tween()
	tw.tween_method(func(u):
		o.position = (w.mouth() * G.PPM).lerp(dest, u) + Vector2(0, -sin(u * PI) * 120.0), 0.0, 1.0, 0.6)
	tw.tween_callback(func():
		if is_instance_valid(o):
			o.monitoring = true
			o.flying = false)
	Sfx.play("whoosh", -2.0, 1.4)

func _process(_dt: float) -> void:
	if not portals.is_empty():
		_portal_art.queue_redraw()

func _pass_ring(e, ring: Dictionary) -> void:
	var local = G.wrapa(e.position.angle() - ring.angle)
	var best = 9e9
	var gate = null
	for g in ring.gaps:
		var d = absf(G.wrapa(local - g.a))
		if d < best:
			best = d
			gate = g
	if gate != null and gate.x > 1 and best < gate.half + 0.25:
		var key = "%d:%d" % [ring.i, ring.gaps.find(gate)]
		if not e.gates.has(key):
			e.gates[key] = true
			e.mult = mini(30, e.mult * int(gate.x))
			gate_passed.emit(e, int(gate.x))
			Sfx.play("coin", -2.0, 1.0 + 0.1 * gate.x)
			_popup("x%d" % e.mult, e.global_position + Vector2(0, -40), Color("FFC21A"))
	e.freefall += 1
	e.drop = e.freefall

# crack ladder: a fall through n rings at once cracks on landing (1 ring is always safe, 2 = 1 crack, 3 = 2, 4+ = broken)
func _land_fall(e) -> void:
	var d = e.drop - 1
	e.drop = 0
	e.freefall = 0
	if d <= 0:
		return
	if e.cracks + d >= 3:
		_break(e, "fall")
	else:
		for k in d:
			_crack(e)

func _portal_step(dt: float) -> void:
	for pt in portals:
		# suction toward the mouth, with a swirl, inside the same channel
		if pt.pull > 0.0:
			var ca = _ch_at(pt.a.length())
			for e in eggs:
				if not e.alive or e.saved or e.portal_cd > 0.0:
					continue
				var p = e.position / G.PPM
				var dv = pt.a - p
				var d = dv.length()
				if d > pt.pull or d < 0.001 or _ch_at(p.length()) != ca:
					continue
				var k = 1.0 - d / pt.pull
				var f = 3.0 + 16.0 * k * k
				e.apply_central_force(Vector2(dv.x - dv.y * 0.25, dv.y + dv.x * 0.25) / d * f * G.PPM)
		if pt.a.distance_to(pt.b) > 0.05:
			for e in eggs:
				if e.alive and not e.saved and e.portal_cd <= 0.0 and (e.position / G.PPM).distance_to(pt.a) < pt.r:
					e.portal_cd = 0.9
					var from = e.global_position
					PhysicsServer2D.body_set_state(e.get_rid(), PhysicsServer2D.BODY_STATE_TRANSFORM, Transform2D(e.rotation, pt.b * G.PPM + global_position))
					e.position = pt.b * G.PPM
					Sfx.play("whoosh", -2.0, 1.3)
					_puff(from, Color(0.69, 0.49, 0.95), 10)
					_puff(e.global_position, Color(0.69, 0.49, 0.95), 10)
		# orb spawner
		if pt.emit.size() > 0:
			pt.timer -= dt
			if pt.timer <= 0.0:
				pt.timer = pt.every
				var mine = 0
				for o in orbs:
					if is_instance_valid(o) and not o.used and o.src == pt.src:
						mine += 1
				var ch = _ch_at(pt.b.length())
				if mine < 2 and ch < rings.size():
					var kind = str(pt.emit[pt.k % pt.emit.size()])
					pt.k += 1
					var o = _add_orb(kind, ch, pt.b.angle(), pt.src, pt.b.length())
					o.scale = Vector2.ZERO
					create_tween().tween_property(o, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
					Sfx.play("whoosh", -6.0, 1.6)

func _draw_portals() -> void:
	var ci = _portal_art
	for pt in portals:
		var ends = [pt.a] if pt.a.distance_to(pt.b) <= 0.05 else [pt.a, pt.b]
		for i in ends.size():
			var c: Vector2 = ends[i] * G.PPM
			var R = 26.0 if i == 0 else 20.0
			var spin = play_t * (3.0 if i == 0 else -3.0)
			ci.draw_circle(c, R + 8.0, Color(0.69, 0.49, 0.95, 0.18))
			ci.draw_circle(c, R, Color("7B4FD6"))
			for k in 3:
				var pts = PackedVector2Array()
				for j in 14:
					var u = j / 13.0
					pts.append(c + Vector2.from_angle(spin + k * TAU / 3.0 + u * 2.4) * R * (0.95 - 0.8 * u))
				ci.draw_polyline(pts, Color("D9C2FF"), 3.0, true)
			ci.draw_circle(c, R * 0.22, Color("F3EAFF"))

func _popup(text: String, at: Vector2, col: Color) -> void:
	var l = UI.title(_fx, text, 40, col, Color("3B2A20"), 10)
	l.z_index = 20
	l.size = Vector2(320, 56)
	l.pivot_offset = l.size / 2
	l.global_position = at - l.size / 2
	l.scale = Vector2(0.3, 0.3)
	l.rotation = randf_range(-0.12, 0.12)
	var tw = l.create_tween()
	tw.tween_property(l, "scale", Vector2.ONE, 0.26).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(l, "position:y", l.position.y - 56, 0.95).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "modulate:a", 0.0, 0.25)
	tw.tween_callback(l.queue_free)

# every new contact of an egg, for feel only (no rules here): dust scaled by the landing speed, a knock pitched by
# it, a haptic tick, and a nudge for the camera on the hard ones
var _bump_cd = 0.0
func _on_bump(e, kind: String, v: float, at: Vector2, normal: Vector2) -> void:
	if not e.alive or e.saved or done or v < 1.1 or kind in ["thorn", "curtain", "ground"]:
		return
	var k = clampf((v - 1.1) / 5.0, 0.0, 1.0)
	if kind == "pad":
		FX.dust(_fx, at, normal, k * 0.8, Color("FFE08A"))
		Sfx.play("pop", -16.0 + 10.0 * k, lerpf(0.7, 0.5, k))
	elif kind == "nest":
		FX.dust(_fx, at, normal, k, Color("F1D18A"))
		Sfx.play("land", -12.0 + 8.0 * k, lerpf(1.5, 1.0, k))
	elif kind == "egg":
		Sfx.play("click", -16.0 + 8.0 * k, lerpf(1.5, 1.0, k))
	else:
		FX.dust(_fx, at, normal, k)
		Sfx.play("knock", -15.0 + 13.0 * k, lerpf(1.35, 0.8, k) * randf_range(0.96, 1.04))
	if _bump_cd <= 0.0:
		_bump_cd = 0.05
		Sfx.buzz(int(6 + 22 * k), 0.15 + 0.5 * k)
	if k > 0.25:
		bumped.emit(e, k)

func _on_hit(e, kind: String, v: float, node: Node) -> void:
	if not e.alive or e.saved or done:
		return
	if kind == "curtain":
		var C = node.get_meta("gap").curtain
		if C == null or not C.alive:
			return
		if e.fire > 0.0 and e.fire_kind == "fire_red":
			if not C.burning:
				C.burning = true
				Sfx.play("burn", -2.0)
			return
		if C.burning or e.safe_t > 0.0:
			return
		_break(e, "curtain")
		return
	# the crack ladder judges a landing after a fall through 2+ rings (and that landing is not also a hard hit)
	if e.drop >= 2 and v > 1.2 and kind != "thorn":
		if kind == "pad":
			e.drop = 0
			e.freefall = 0
			return
		if kind != "ground":
			_land_fall(e)
			return
	if kind in ["seg", "pad", "shut"]:
		e.freefall = 0
		e.drop = 0
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
			if e.safe_t > 0.0:
				return
			if th.kind == "blunt":
				# blunt spikes crack (never the breaking crack) and shove the egg off
				if e.cracks < 2 and e.crack_cd <= 0.0:
					_crack(e)
				var tip = th.cp.get_parent().to_global(Vector2.from_angle(th.a) * th.tip * G.PPM)
				e.apply_central_impulse((e.global_position - tip).normalized() * 1.6 * G.PPM)
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
	if kind == "shut":
		vv = v
	if vv >= SHATTER_V:
		_break(e, "shatter")
	elif vv >= CRACK_V and e.crack_cd <= 0.0:
		_crack(e)

func _crack(e) -> void:
	e.crack()
	any_cracks = true
	Sfx.play("crack", -2.0, randf_range(0.9, 1.1))
	Sfx.buzz(30, 0.6)
	FX.shell(_fx, e.global_position, 5, 240.0)
	FX.dust(_fx, e.global_position, Vector2.UP, 0.5, Color.WHITE)
	cracked_egg.emit(e)
	if e.cracks >= 3:
		_break(e, "cracks")

func _burn_thorn(th: Dictionary) -> void:
	th.alive = false
	th.cp.set_deferred("disabled", true)
	Sfx.play("burn", -4.0)
	for ring in rings:
		ring.art.queue_redraw()
	FX.sparks(_fx, th.cp.global_position + Vector2.from_angle(th.a + th.cp.get_parent().rotation) * (th.base + th.tip) / 2.0 * G.PPM, 8, Color(1.0, 0.7, 0.3), 220.0)
	_puff(th.cp.global_position + Vector2.from_angle(th.a + th.cp.get_parent().rotation) * (th.base + th.tip) / 2.0 * G.PPM, Color(0.3, 0.25, 0.2), 14)

func _on_orb(orb, e) -> void:
	if not e.alive or e.saved:
		return
	orbs.erase(orb)
	match orb.kind:
		"fire_red":
			e.fire = 6.0
			e.fire_kind = "fire_red"
			Sfx.play("burn", -6.0, 1.4)
		"fire_green":
			# heals every crack
			e.glow = 1.5
			if e.cracks > 0:
				e.mend()
				_popup("Mended!", e.global_position + Vector2(0, -40), Color("6BE06B"))
			Sfx.play("save", -2.0, 1.3)
		"twin":
			var alive = 0
			for q in eggs:
				if q.alive and not q.saved:
					alive += 1
			if alive < MAX_EGGS:
				var p = e.position
				var tw = _add_egg(p - p.normalized() * 0.32 * G.PPM + Vector2(0, -0.1 * G.PPM), 1)
				tw.linear_velocity = e.linear_velocity
				tw.safe_t = 0.6
				n_eggs += 1
				eggs_changed.emit()
				_popup("+1 egg", e.global_position + Vector2(0, -40), Color.WHITE)
				Sfx.play("save", -2.0, 1.5)
			else:
				_popup("Full!", e.global_position + Vector2(0, -40), Color.WHITE)
		"curse":
			curse_t = 6.0
			for q in eggs:
				if q.alive and not q.saved:
					q.curse = 6.0
			_popup("Fuse x2!", e.global_position + Vector2(0, -40), Color("C59BFF"))
			Sfx.play("fail", -6.0, 1.4)
		"thorn":
			_crack(e)
	Sfx.buzz(20, 0.4)

func _save(e) -> void:
	e.saved = true
	n_saved += 1
	e.set_deferred("freeze", true)
	e.collision_layer = 0
	e.collision_mask = 0
	var slot = _nest_pile
	_nest_pile += 1
	var dest = Vector2(nest_x * G.PPM + (slot - 1) * 34.0 * (0.9 if slot < 3 else 0.5), (ground_y - 0.3) * G.PPM - (12.0 if slot >= 3 else 0.0))
	var tw = create_tween()
	tw.tween_property(e, "position", dest, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(e, "rotation", 0.0, 0.35)
	tw.tween_callback(e.cheer)
	_sparkle(dest + global_position)
	Sfx.play("save", 0.0, 1.0 + 0.12 * slot)
	Sfx.buzz(25, 0.5)
	saved_egg.emit(e)
	_check_end()

func _break(e, why: String) -> void:
	if OS.get_cmdline_user_args().has("--bot"):
		print("break %s t=%.1f pos=%s drop=%d" % [why, play_t, str(e.position / G.PPM), e.drop])
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
func _shards(p: Vector2, ground: bool) -> void:
	FX.shell(_fx, p, 14, 420.0)
	FX.yolk(_fx, p, 12, 300.0 if ground else 200.0)
	FX.dust(_fx, p, Vector2.UP, 0.9, Color.WHITE)

func _sparkle(p: Vector2) -> void:
	FX.sparks(_fx, p, 16, Color(1.0, 0.95, 0.7), 300.0, 26.0)
	FX.dust(_fx, p + Vector2(0, 10), Vector2.UP, 0.5, Color("F1D18A"))

func _puff(p: Vector2, c: Color, n: int) -> void:
	FX.smoke(_fx, p, n, c)

func _draw() -> void:
	# yolk splats on the ground: a glossy yolk on a spread of white
	for sp in splats:
		var c = Vector2(sp.x, ground_y * G.PPM - 1.0)
		draw_colored_polygon(G.ellipse(c + Vector2(0, 2), 46.0 * sp.s, 9.0 * sp.s, 24), Color(0.25, 0.15, 0.05, 0.25))
		draw_colored_polygon(G.ellipse(c, 44.0 * sp.s, 8.0 * sp.s, 24), Color("FFFDF4"))
		draw_colored_polygon(G.ellipse(c + Vector2(3, -2), 17.0 * sp.s, 6.5 * sp.s, 18), Color("E08A00"))
		draw_colored_polygon(G.ellipse(c + Vector2(3, -3), 15.0 * sp.s, 5.5 * sp.s, 18), Color("FFC21A"))
		draw_colored_polygon(G.ellipse(c + Vector2(-2, -5), 5.0 * sp.s, 1.6 * sp.s, 10), Color(1, 1, 1, 0.8))
