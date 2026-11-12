# The weasel (hunter), ported from the web game's sim/thieves.js and sim/boss.js. It lives on the floor of the
# outermost channel (its run) and rides that ring. An egg in its run it stalks and snaps up; an egg one channel in it
# hunts through a gap: it lines up under the gap, crouches and wiggles (the telegraph, with a red target where it
# will land), then pounces up through the gap. If the gap has turned away it bonks its head and falls back dazed.
# With an egg in its jaws it trots to its den and stashes it. Caught in the inner channel with no gap in reach it is
# TRAPPED: it drops the egg and can be hit (an egg falling on it, a burning egg, an egg saved meanwhile). A hit frees
# one stashed egg; a level weasel runs home and hides for a while, the boss (level 5) loses a heart and, at zero,
# flees and frees every stashed egg. The boss also throws thorn balls and curse orbs at the eggs, in phases.
# State runs in physics time, angles are screen radians, lengths in metres; the node draws the flat weasel.
extends Node2D

const G = preload("res://scripts/g.gd")
const UI = preload("res://scripts/ui_kit.gd")
# rig (metres): mouth = where a held egg sits from the feet (forward, up); body centre; grab reach; narrowest gap
const MOUTH_X := 0.82
const MOUTH_Y := 0.31
const BODY_Y := 0.22
const REACH := 0.42
const GAP_MIN := 0.58
# timings (Medium)
const SPEED := 1.0
const STALK := 0.65
const CARRY := 1.05
const FLEE := 2.4
const WARN := 1.05
const GRAB := 0.42
const SNEAK := 0.8
const LEAP := 0.6
const LUNGE := 0.32
const HOP := 0.45
const BONK := 1.0
const HURT := 0.5
const STUNNED := 2.2
const STASH := 0.6
const LAUGH := 0.9
const IN_T := 0.8
const TRAP := 4.2
const NEXT := 2.4
const AWAY := 10.0
const TRAP_R := 1.8
const SNEAK_MAX := 2.5
const FAR := 1.7
const NEAR := 0.2
const THROW_WARN := 0.9
const THROW_FLY := 0.6

var V # the vault
var boss = false
var hp = 0
var hp_max = 0
var run = 1
var den_a = 0.0
var ph = "wait"
var t = 3.0
var a = 0.0
var r = 1.0
var face = 1
var ch = 1
var car_a = 0.0
var egg = null # in its jaws
var tgt = null # the egg it is after
var k = ""
var gi = -1
var next = 2.0
var sneak_t = 0.0
var esc = false
var hit_cd = 0.0
var saved_seen = 0
var stash = []
var alpha = 1.0
# flight
var a0 = 0.0
var r0 = 0.0
var a1 = 0.0
var r1 = 0.0
var ap = 0.0
var lu = 0.0
var ldur = 1.0
var lg = -1
var blocked = false
# boss attacks
var phases = []
var phase = 0
var atk_t = 3.0
var atk_k = 0
var throw_k = 0
var throws = ["thorn", "curse"]
var winding = 0.0 # > 0 while a throw winds up
var wind_spots = []
var anim = 0.0
var walk = 0.0
var flash = 0.0

func setup(vault, spec: Dictionary, is_boss: bool) -> void:
	V = vault
	boss = is_boss
	var n = V.rings.size()
	run = clampi(int(spec.get("ch", n - 1)), 1, n - 1)
	den_a = -deg_to_rad(float(spec.get("a", 90.0)))
	t = float(spec.get("delay", 3.0))
	if boss:
		hp = int(spec.get("hp", 3))
		hp_max = hp
	ch = run
	r = _floor(run)
	a = _den_pt().a
	car_a = V.rings[run].angle
	z_index = 5
	visible = false

func setup_boss_fight(F: Dictionary) -> void:
	phases = F.get("phases", [])
	throws = F.get("throws", ["thorn", "curse"])
	atk_t = float(F.get("delay", 3.0)) + 1.0

# ---------------------------------------------------------------- geometry
func _floor(c: int) -> float:
	return float(V.rings[c].r) - G.RING_TH / 2

func _den_pt() -> Dictionary:
	var ring = V.rings[run]
	var rr = float(ring.r) - G.RING_TH / 2 - 0.3
	var da = ring.angle + den_a
	return {"a": da, "p": Vector2.from_angle(da) * rr}

func _pt(f: float, h: float) -> Vector2:
	var rr = r - h
	return Vector2.from_angle(a + face * f / maxf(0.5, rr)) * rr

func mouth() -> Vector2:
	return _pt(MOUTH_X, MOUTH_Y)

func body_pt() -> Vector2:
	return _pt(0.0, BODY_Y)

func live() -> bool:
	return not ph in ["wait", "gone", "hide", "flee", "defeated"]

func _go_ph(p: String, tt := 0.0) -> void:
	ph = p
	t = tt

func _epos(e) -> Vector2:
	return e.position / G.PPM

func _can(e) -> bool:
	return is_instance_valid(e) and e.alive and not e.saved and e.thf == 0 and e.fire <= 0.0

func _eggs_at(c: int) -> Array:
	var out = []
	for e in V.eggs:
		if _can(e) and V._ch_at(_epos(e).length()) == c:
			out.append(e)
	return out

func _gaps(ri: int, mn: float) -> Array:
	var ring = V.rings[ri]
	var out = []
	for j in ring.gaps.size():
		var g = ring.gaps[j]
		if g.shut != null and g.o < 0.5:
			continue
		if g.curtain != null and g.curtain.alive:
			continue
		if g.len < mn:
			continue
		out.append({"a": G.wrapa(ring.angle + g.a), "len": g.len, "gi": j})
	return out

func _aligned(ri: int, j: int, wa: float) -> bool:
	var ring = V.rings[ri]
	if j < 0 or j >= ring.gaps.size():
		return false
	var g = ring.gaps[j]
	if (g.shut != null and g.o < 0.5) or (g.curtain != null and g.curtain.alive):
		return false
	return absf(G.wrapa(ring.angle + g.a - wa)) * float(ring.r) < g.len / 2.0 - 0.06

func _walk(d: float) -> void:
	a = G.wrapa(a + face * d / maxf(0.5, r))
	walk += d * 9.0

# walk toward world angle ga at speed v; returns the arc distance left
func _toward(ga: float, v: float, dt: float) -> float:
	var da = G.wrapa(ga - a)
	var dist = absf(da) * r
	if dist < 0.02:
		return 0.0
	var want = 1 if da > 0 else -1
	if want != face:
		face = want
		return dist
	_walk(minf(dist, v * dt))
	return maxf(0.0, dist - v * dt)

# ---------------------------------------------------------------- egg holding
func _pin(e, p: Vector2, ang: float) -> void:
	e.position = p * G.PPM
	e.rotation = ang
	e.linear_velocity = Vector2.ZERO
	e.angular_velocity = 0.0
	e.ch = V._ch_at(p.length())
	e.freefall = 0
	e.drop = 0

func _take(e) -> void:
	e.thf = 1
	e.freeze_mode = RigidBody2D.FREEZE_MODE_KINEMATIC
	e.set_deferred("freeze", true)
	e.collision_layer = 0
	e.collision_mask = 0
	egg = e
	tgt = null
	_go_ph("grab", GRAB)
	Sfx.play("grab", 0.0, 0.7)
	Sfx.buzz(30, 0.6)
	V.thief_grab(e)

func _free(e, why: String) -> void:
	if e == null or not is_instance_valid(e) or not e.alive:
		return
	e.thf = 0
	var p = _epos(e)
	var d = maxf(0.001, p.length())
	var c = V._ch_at(d)
	if c >= 1 and c < V.rings.size():
		var R = float(V.rings[c].r) - G.RING_TH / 2 - 0.3
		if d > R:
			e.position = p / d * R * G.PPM
	e.set_deferred("freeze", false)
	e.collision_layer = 2
	e.collision_mask = 1 | 2 | 8 | 16
	e.safe_t = maxf(e.safe_t, 0.8)
	e.ch = V._ch_at(_epos(e).length())
	e.freefall = 0
	e.drop = 0

func _let_go(why: String):
	if egg == null:
		return null
	var e = egg
	egg = null
	if not is_instance_valid(e) or not e.alive:
		return null
	_free(e, why)
	return e

func _holds() -> void:
	if egg != null and (not is_instance_valid(egg) or not egg.alive):
		egg = null
	if egg != null:
		_pin(egg, mouth(), a + (0.0 if face > 0 else PI))
	stash = stash.filter(func(q): return is_instance_valid(q) and q.alive and not q.saved)
	var d = _den_pt()
	var rr = float(V.rings[run].r) - G.RING_TH / 2 - 0.3
	for i in stash.size():
		var qa = d.a + (i - (stash.size() - 1) / 2.0) * 0.36 / rr
		_pin(stash[i], Vector2.from_angle(qa) * rr, qa - PI / 2)

# ---------------------------------------------------------------- step (called by the vault every physics frame)
func step(dt: float) -> void:
	anim += dt
	flash = maxf(0.0, flash - dt)
	if ph == "gone":
		return
	# the target is saved and only stashed eggs are left: the weasel keeps them and the level ends
	var left = []
	for e in V.eggs:
		if e.alive and not e.saved:
			left.append(e)
	if V.n_saved >= V.target and not left.is_empty() and left.all(func(q): return q.thf == 2):
		for q in stash.duplicate():
			V._break(q, "thief")
		stash.clear()
		return
	if hit_cd > 0.0:
		hit_cd -= dt
	# its run ring carries it round while it stands in the run
	var ra: float = V.rings[run].angle
	if ph != "leap" and ch == run and ph != "flee" and live():
		a = G.wrapa(a + G.wrapa(ra - car_a))
	car_a = ra
	_holds()
	if ph == "wait":
		t -= dt
		if t <= 0.0:
			_at_den()
			_go_ph("in", IN_T)
			visible = true
			modulate.a = 0.0
			create_tween().tween_property(self, "modulate:a", 1.0, 0.4)
			Sfx.play("whoosh", -4.0, 0.8)
			V.thief_in(self)
		_place()
		return
	if ph == "hide":
		_at_den()
		t -= dt
		if t <= 0.0:
			_go_ph("in", 0.7)
			create_tween().tween_property(self, "modulate:a", 1.0, 0.4)
		_place()
		return
	# an egg saved: a trapped weasel takes the hit; a crouching one flinches; the boss loses its wind-up
	if V.n_saved > saved_seen:
		saved_seen = V.n_saved
		if ph == "trapped":
			_hurt("save", null)
		elif ph == "crouch":
			next = 1.4
			tgt = null
			_go_ph("prowl")
		if winding > 0.0:
			winding = 0.0
			atk_t = 1.6
	if next > 0.0:
		next -= dt
	match ph:
		"in":
			t -= dt
			if t <= 0.0:
				_go_ph("prowl")
		"prowl", "stalk", "idle":
			_prowl(dt)
		"toss":
			t -= dt
			if t <= 0.0:
				_go_ph("prowl")
		"crouch":
			_crouch(dt)
		"leap":
			_leap(dt)
		"grab":
			t -= dt
			if t <= 0.0:
				sneak_t = 0.0
				_go_ph("inner" if ch < run else "carry")
		"carry":
			_carry(dt)
		"inner":
			_inner(dt)
		"trapped":
			_trap_hits()
			if ph == "trapped":
				t -= dt
				if t <= 0.0:
					sneak_t = 0.0
					esc = true
					_go_ph("inner")
		"hurt":
			t -= dt
			if t <= 0.0:
				if boss and hp <= 0:
					_go_ph("defeated", 1.6)
				else:
					_go_ph("stunned", STUNNED)
		"stunned", "bonk":
			t -= dt
			if t <= 0.0:
				next = maxf(next, 1.2)
				sneak_t = 0.0
				esc = true
				if not boss and k == "hit":
					k = ""
					tgt = null
					_go_ph("home", 6.0)
				else:
					_go_ph("inner" if ch < run else "prowl")
		"home":
			_home(dt)
		"stash":
			t -= dt
			if t <= 0.0:
				_stash()
				_go_ph("laugh", LAUGH)
		"laugh", "drop":
			t -= dt
			if t <= 0.0:
				next = maxf(next, NEXT)
				_go_ph("prowl")
		"defeated":
			t -= dt
			if t <= 0.0:
				_go_ph("flee", 1.2)
		"flee":
			_walk(FLEE * dt)
			t -= dt
			modulate.a = clampf(t / 0.6, 0.0, 1.0)
			if t <= 0.0:
				ph = "gone"
				visible = false
	if boss and live():
		_boss_attacks(dt)
	_place()

func _at_den() -> void:
	a = _den_pt().a
	r = _floor(run)
	ch = run
	car_a = V.rings[run].angle

# prowling: hunt the run's eggs, else line up under a gap below an egg one channel in
func _prowl(dt: float) -> void:
	var R = _floor(run)
	var r_in = _floor(run - 1)
	r = R
	ch = run
	var plan = null
	if next <= 0.0 and winding <= 0.0:
		for e in _eggs_at(run):
			var ea = _epos(e).angle()
			var d = absf(G.wrapa(ea - a)) * R
			if plan == null or d < plan.d:
				plan = {"kind": "snap", "e": e, "d": d, "ea": ea}
		if plan == null:
			for e in _eggs_at(run - 1):
				var ea = _epos(e).angle()
				for g in _gaps(run - 1, GAP_MIN):
					var along = absf(G.wrapa(ea - g.a)) * r_in
					if along < NEAR or along > FAR:
						continue
					var d = absf(G.wrapa(g.a - a)) * R
					if plan == null or d < plan.d:
						plan = {"kind": "pounce", "e": e, "d": d, "ea": ea, "g": g}
	if plan == null:
		# nothing to hunt: patrol the bottom of the run, sniffing
		tgt = null
		var home = PI / 2 + 0.7 * sin(V.play_t * 0.17 + 2.1)
		var lft = _toward(home, SPEED * 0.6, dt)
		ph = "idle" if lft < 0.05 else "prowl"
		return
	tgt = plan.e
	if plan.kind == "snap":
		var fc = 1 if G.wrapa(plan.ea - a) >= 0 else -1
		var stand = plan.ea - fc * MOUTH_X / R
		var lft = absf(G.wrapa(stand - a)) * R
		ph = "stalk" if lft < 1.5 else "prowl"
		if lft < 0.1:
			face = fc
			_crouch_start("snap", -1, 0.75)
			return
		_toward(stand, STALK if ph == "stalk" else SPEED, dt)
		return
	var g = plan.g
	var fc2 = 1 if G.wrapa(plan.ea - g.a) >= 0 else -1
	var lft2 = absf(G.wrapa(g.a - a)) * R
	ph = "stalk" if lft2 < 1.5 else "prowl"
	if lft2 < 0.1:
		face = fc2
		_crouch_start("pounce", g.gi, 1.0)
		return
	_toward(g.a, STALK if ph == "stalk" else SPEED, dt)

func _crouch_start(kk: String, g_i: int, f: float) -> void:
	k = kk
	gi = g_i
	_go_ph("crouch", WARN * f)
	Sfx.play("click", -4.0, 0.5)

func landing() -> Dictionary:
	var inner = k == "pounce"
	var rr = _floor(run - 1 if inner else run)
	var la = a + face * 0.3 / rr
	if tgt != null and is_instance_valid(tgt):
		la = _epos(tgt).angle() - face * MOUTH_X * 0.85 / rr
	return {"a": la, "r": rr, "p": Vector2.from_angle(la) * rr}

func _crouch(dt: float) -> void:
	var want = run - 1 if k == "pounce" else run
	if tgt == null or not _can(tgt) or V._ch_at(_epos(tgt).length()) != want:
		next = 0.8
		tgt = null
		_go_ph("prowl")
		return
	t -= dt
	if t > 0.0:
		return
	var L = landing()
	if k == "pounce":
		_fly(L.a, L.r, minf(_floor(run), L.r) - 0.36, LEAP, run - 1)
	else:
		_fly(L.a, L.r, L.r - 0.1, LUNGE, -1)
	Sfx.play("whoosh", -2.0, 1.2)

func _fly(fa1: float, fr1: float, fap: float, dur: float, g_lg: int) -> void:
	a0 = a
	r0 = r
	a1 = a + G.wrapa(fa1 - a)
	r1 = fr1
	ap = fap
	lu = 0.0
	ldur = dur
	lg = g_lg
	blocked = false
	_go_ph("leap", dur)

func _fly_at(u: float) -> Dictionary:
	if lg >= 0:
		if u < 0.5:
			var v = u / 0.5
			return {"a": a0, "r": r0 + (ap - r0) * (1.0 - (1.0 - v) * (1.0 - v))}
		var v2 = (u - 0.5) / 0.5
		return {"a": a0 + (a1 - a0) * smoothstep(0.0, 1.0, v2), "r": ap + (r1 - ap) * v2 * v2}
	var kk = clampf((u - 0.22) / 0.78, 0.0, 1.0) if blocked else u
	var up = sin(PI * u)
	return {"a": a0 + (a1 - a0) * smoothstep(0.0, 1.0, kk), "r": (r0 + (r1 - r0) * u) - (minf(r0, r1) - ap) * up}

func _leap(dt: float) -> void:
	lu = minf(1.0, lu + dt / ldur)
	var q = _fly_at(lu)
	# crossing the ring between the channels: the gap must still be lined up, or it bonks and falls back
	if lg >= 0 and not blocked and lu <= 0.5:
		var ring = V.rings[run - 1]
		if q.r < float(ring.r) + G.RING_TH / 2 + 0.18 and q.r > float(ring.r) - G.RING_TH / 2 - 0.24 and not _aligned(run - 1, gi, q.a):
			blocked = true
			a0 = a
			r0 = r
			a1 = a
			r1 = _floor(run)
			ap = r
			lu = 0.0
			ldur = 0.32
			lg = -1
			Sfx.play("crack", -6.0, 0.5)
			Sfx.buzz(25, 0.5)
			V.thief_bonk(self)
			return
	a = G.wrapa(q.a)
	r = q.r
	if lu < 1.0:
		return
	a = G.wrapa(a1)
	r = r1
	ch = clampi(V._ch_at(r + 0.05), 1, run)
	if blocked:
		ch = run
		next = NEXT
		_go_ph("bonk", BONK)
		return
	if k == "hop":
		ch = run
		_go_ph("carry" if egg != null else "prowl")
		return
	var m = _pt(MOUTH_X, MOUTH_Y)
	if tgt != null and _can(tgt) and _epos(tgt).distance_to(m) < REACH + 0.2:
		_take(tgt)
		return
	next = NEXT * 0.6
	tgt = null
	if ch < run:
		sneak_t = 0.0
		_go_ph("inner")
	else:
		_go_ph("prowl")

# inside the inner channel: back to the nearest gap out (or trapped when there is none in reach)
func _inner(dt: float) -> void:
	var ri = run - 1
	r = _floor(ri)
	ch = ri
	var best = null
	for g in _gaps(ri, GAP_MIN):
		var d = absf(G.wrapa(g.a - a)) * r
		if best == null or d < best.d:
			best = g.duplicate()
			best.d = d
	sneak_t += dt
	if best == null or (not esc and (best.d > TRAP_R + 0.4 or sneak_t > SNEAK_MAX)):
		_trap()
		return
	if best.d < best.len / 2.0 - 0.1:
		esc = false
		gi = best.gi
		_fly(best.a, _floor(run), r - 0.12, HOP, -1)
		k = "hop"
		return
	_toward(best.a, SNEAK * (1.3 if esc else 1.0), dt)

func _trap() -> void:
	_let_go("trap")
	esc = false
	_go_ph("trapped", TRAP)
	Sfx.play("fail", -8.0, 1.6)
	V.thief_trapped(self)

# hits on a trapped weasel: an egg falling on it, a burning egg touching it
func _trap_hits() -> void:
	if hit_cd > 0.0:
		return
	var c = body_pt()
	var R = 0.9 * 0.75
	for e in V.eggs:
		if not e.alive or e.saved or e.thf != 0:
			continue
		var p = _epos(e)
		var v = e.linear_velocity / G.PPM
		var d = p.distance_to(c)
		if e.fire > 0.0 and d < R + 0.15:
			_hurt("fire", p)
			return
		if d < R and v.dot(c - p) / maxf(d, 0.001) > 1.6:
			_hurt("drop", p)
			return

func _hurt(why: String, p) -> void:
	if hit_cd > 0.0 or (boss and hp <= 0):
		return
	if boss:
		hp -= 1
	hit_cd = 1.2
	flash = 0.5
	_let_go("hit")
	if not stash.is_empty():
		var q = stash.pop_front()
		_free(q, "den")
	_go_ph("hurt", HURT)
	k = "hit"
	winding = 0.0
	Sfx.play("crack", 0.0, 0.6)
	Sfx.buzz(50, 0.8)
	V.thief_hit(self, why)
	if boss and hp <= 0:
		for q in stash:
			_free(q, "den")
		stash.clear()

func _carry(dt: float) -> void:
	r = _floor(run)
	ch = run
	if egg == null:
		_go_ph("prowl")
		return
	var d = _den_pt()
	var da = G.wrapa(d.a - a)
	if absf(da) * r < MOUTH_X + 0.05 and signi(int(signf(da))) == face:
		_go_ph("stash", STASH)
		return
	var stand = d.a - face * MOUTH_X / r
	_toward(stand if absf(da) * r < 1.0 else d.a, CARRY, dt)

func _stash() -> void:
	var e = egg
	egg = null
	if e == null or not is_instance_valid(e) or not e.alive:
		return
	e.thf = 2
	stash.append(e)
	Sfx.play("fail", -10.0, 1.2)
	V.thief_stash(self)

func _home(dt: float) -> void:
	if ch != run:
		_inner(dt)
		if ph == "trapped":
			t = 0.6
			esc = true
		if ph != "home" and ph != "leap":
			_go_ph("home", 6.0)
		return
	var d = _den_pt()
	r = _floor(ch)
	var lft = _toward(d.a, SPEED * 1.4, dt)
	t -= dt
	if lft < 0.05 or t <= 0.0:
		_go_ph("hide", AWAY)
		k = ""
		create_tween().tween_property(self, "modulate:a", 0.0, 0.3)

# ---------------------------------------------------------------- boss: phases of thrown orbs
func _boss_attacks(dt: float) -> void:
	if phase + 1 < phases.size():
		var at: Dictionary = phases[phase + 1].get("at", {})
		if V.n_saved >= int(at.get("saved", 99)) or V.play_t >= float(at.get("t", 1e9)):
			phase += 1
			atk_t = minf(atk_t, 2.2)
			V.boss_phase(self, phase)
	var P: Dictionary = phases[phase] if phase < phases.size() else {}
	var attacks: Array = P.get("attacks", [])
	if winding > 0.0:
		winding -= dt
		if winding <= 0.0:
			for s in wind_spots:
				V.boss_throw(self, s)
			wind_spots = []
		return
	if attacks.is_empty() or not ph in ["prowl", "stalk", "idle"]:
		return
	atk_t -= dt
	if atk_t > 0.0:
		return
	atk_t = float(P.get("every", 6.0))
	var name = str(attacks[atk_k % attacks.size()])
	atk_k += 1
	var two = name == "throw2"
	var targets = []
	for e in V.eggs:
		if e.alive and not e.saved and e.thf == 0:
			targets.append(e)
	if targets.is_empty():
		return
	# leading eggs first: the ones furthest out (closest to the nest)
	targets.sort_custom(func(p, q): return p.position.length() > q.position.length())
	wind_spots = []
	for e in targets.slice(0, 2 if two else 1):
		var p = _epos(e)
		wind_spots.append({"p": p, "ch": V._ch_at(p.length()), "type": str(throws[throw_k % throws.size()])})
		throw_k += 1
	winding = THROW_WARN
	Sfx.play("whoosh", -6.0, 0.6)

# ---------------------------------------------------------------- drawing
func _place() -> void:
	var lift = 0.0
	position = Vector2.from_angle(a) * r * G.PPM
	rotation = a - PI / 2
	scale = Vector2(-face, 1)
	queue_redraw()

func _draw() -> void:
	if ph in ["wait", "gone"]:
		return
	var crouch = ph == "crouch"
	var leap = ph == "leap"
	var dazed = ph in ["bonk", "stunned", "hurt"]
	var trapped = ph == "trapped"
	var moving = ph in ["prowl", "stalk", "carry", "home", "inner", "flee"]
	var fur = Color("C98345")
	var fur_d = Color("A9682F")
	var belly = Color("F6E3C4")
	if flash > 0.0 and fmod(flash, 0.12) < 0.06:
		fur = Color.WHITE
	# landing target while it crouches (drawn in vault space)
	if crouch:
		var L = landing()
		var lp = to_local(V.to_global(L.p * G.PPM))
		var pulse = 0.5 + 0.5 * sin(anim * 14.0)
		draw_arc(lp, 26.0 + 6.0 * pulse, 0, TAU, 32, Color(1, 0.3, 0.25, 0.85), 4.0, true)
		draw_circle(lp, 8.0, Color(1, 0.3, 0.25, 0.6))
	var dy = 6.0 if crouch else 0.0
	var wig = sin(anim * 30.0) * 4.0 if crouch else 0.0
	var sx = 1.2 if leap else 1.0
	draw_set_transform(Vector2(0, dy), 0.0, Vector2(sx, 1.0 / sx if leap else 1.0))
	# shadow
	if not leap:
		draw_colored_polygon(G.ellipse(Vector2(0, 2 - dy), 44, 6, 18), Color(0.05, 0.1, 0.15, 0.2))
	# tail: bushy, swishing
	var tsw = sin(anim * (12.0 if crouch else 3.0)) * (0.5 if crouch else 0.25)
	var tb = Vector2(-34 + wig * 0.5, -22)
	var tail = PackedVector2Array()
	for j in 9:
		var u = j / 8.0
		tail.append(tb + Vector2(-u * 34.0, -sin(u * 2.4 + tsw) * 22.0 - u * 8.0))
	draw_polyline(tail, fur_d, 15.0, true)
	draw_circle(tail[tail.size() - 1], 9.0, Color("5B3A22"))
	# legs
	for i in 4:
		var lx = [-26.0, -14.0, 14.0, 26.0][i]
		var sw = sin(walk + i * PI / 2) * (7.0 if moving else 0.0)
		if leap:
			sw = (12.0 if i >= 2 else -12.0)
		if trapped:
			sw = sin(anim * 26.0 + i) * 9.0
		draw_line(Vector2(lx, -14), Vector2(lx + sw, -2 + dy * -0.4), fur_d, 9.0, true)
	# body: a long rounded capsule with a cream belly
	var body = PackedVector2Array()
	for j in 24:
		var q = TAU * j / 24.0
		body.append(Vector2(cos(q) * 36.0 + wig * (1.0 if cos(q) < 0 else 0.0), -24.0 + sin(q) * 14.0))
	draw_colored_polygon(body, fur)
	draw_colored_polygon(G.ellipse(Vector2(4, -17), 26, 7, 18), belly)
	# head
	var hc = Vector2(38, -36)
	if dazed:
		hc += Vector2(0, 4)
	draw_circle(hc + Vector2(-8, -14), 7.0, fur_d)
	draw_circle(hc + Vector2(-8, -14), 3.5, Color("F2A7A0"))
	draw_circle(hc, 17.0, fur)
	draw_colored_polygon(G.ellipse(hc + Vector2(14, 4), 13, 8, 16), fur)
	draw_colored_polygon(G.ellipse(hc + Vector2(6, 8), 12, 6, 16), belly)
	draw_circle(hc + Vector2(26, 2), 4.5, Color("3B2418"))
	# eye
	var ec = hc + Vector2(6, -5)
	if dazed or ph == "defeated":
		draw_line(ec + Vector2(-4, -4), ec + Vector2(4, 4), Color("2A1A10"), 2.5, true)
		draw_line(ec + Vector2(-4, 4), ec + Vector2(4, -4), Color("2A1A10"), 2.5, true)
	elif crouch:
		draw_line(ec + Vector2(-5, 0), ec + Vector2(5, -2), Color("2A1A10"), 3.0, true)
	else:
		draw_circle(ec, 5.5, Color.WHITE)
		draw_circle(ec + Vector2(1.5, 0), 3.4, Color("2A1A10"))
		draw_circle(ec + Vector2(2.3, -1.2), 1.1, Color.WHITE)
	if ph == "laugh":
		draw_arc(hc + Vector2(16, 8), 6.0, 0.2, PI - 0.2, 10, Color("2A1A10"), 2.5, true)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	# dizzy stars
	if dazed:
		for j in 3:
			var q = anim * 5.0 + j * TAU / 3.0
			var sp = hc + Vector2(cos(q) * 20.0, -30 + sin(q) * 6.0)
			draw_colored_polygon(G.star(sp, 7.0, 3.5), UI.GOLD)
	if trapped:
		draw_line(hc + Vector2(-4, -58), hc + Vector2(-4, -38), UI.RED, 6.0, true)
		draw_circle(hc + Vector2(-4, -30), 3.5, UI.RED)
	# boss hearts and wind-up
	if boss and hp_max > 0 and live():
		for j in hp_max:
			var hp_c = Vector2((j - (hp_max - 1) / 2.0) * 24.0, -86)
			var col = UI.RED if j < hp else Color(1, 1, 1, 0.55)
			draw_circle(hp_c + Vector2(-4.5, 0), 6.0, col)
			draw_circle(hp_c + Vector2(4.5, 0), 6.0, col)
			draw_colored_polygon(PackedVector2Array([hp_c + Vector2(-10.5, 1.5), hp_c + Vector2(10.5, 1.5), hp_c + Vector2(0, 13)]), col)
		if winding > 0.0:
			var kk = 1.0 - winding / THROW_WARN
			draw_circle(hc + Vector2(-10, -40 - 10 * kk), 12.0 + 4 * kk, Color(1, 0.4, 0.3, 0.8))
