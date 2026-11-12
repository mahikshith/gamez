# Mama Hen, the mascot: the web game's animated hen (src/render/hen.js drawHenAnim: pose blending, reactions with
# variants, idle pecks and ruffles, springy comb and tail) ported with the same art, plus things the app adds:
#   - a FRONT view (she faces the player to cheer, wave, cry and be poked) and quick cartoon turns between the two views
#   - the web's level-end routines (scripts/cheer.gd) via play(name, power), with sound cues
#   - pokeable: on the title and map a tap on her gets a reaction
# Origin = between her feet; H = her box height in px. face: -1 looks left, 1 right (side view).
extends Node2D

const A = preload("res://scripts/mama_art.gd")
const Cheer = preload("res://scripts/cheer.gd")
const C2D = preload("res://scripts/c2d.gd")

signal cue(name)

@export var H := 140.0
@export var face := -1.0
var role := "level" # "level": side-on beside the nest, turns to you to cheer; "front": faces you, now and then looks away
var mood := "idle"
var danger := 0.0
var look = null # -1..1: shuffle toward that side (side view), null = stand
var shadow := 0.22
var pokeable := false
var calm := false
var force_variant := -1 # review strips: always this reaction variant

# routine playback
var routine := ""
var ru := 0.0
var pw := 1.0
var stage_top := -400.0 # local y of the stage's top edge (the falling crown starts there)

var _c = C2D.new()
var _P := {}
var _o := {}
var _t := 0.0
var _n := 0
var _st := {}
var _view := 0
var _view_from := 0
var _flip := -1.0
var _front_until := -1.0
var _side_until := -1.0
var _peek_next := 6.0
var _peck_at := -9.0
var _blink_seed := 0.0
var _frame := 0

func _ready() -> void:
	_blink_seed = randf() * 10.0
	_st = _fresh()
	_view = 1 if role == "front" else 0
	_view_from = _view
	z_index = max(z_index, 0)
	set_process_input(true)

func _fresh() -> Dictionary:
	return {c = 0.0, w = {worry = 0.0, cry = 0.0, dance = 0.0}, x = 0.0, sv = 0.0, phase = 0.0, mood = "idle", n = 0,
		cheerAt = -9.0, cheerK = 0, cheerV = -1, queued = false, startleAt = -9.0, startleK = 0, startleV = -1,
		phewAt = -9.0, phewK = 0, phewV = -1, worryT = 0.0, face = face, sec = null}

# ---------------------------------------------------------------- API
# Moods: idle, happy / cheer (a hop; retriggers), worried, gasp, phew, sad / cry, dance, wow (a happy hop facing you)
func set_mood(m: String) -> void:
	if _st.is_empty():
		_st = _fresh()
	match m:
		"cheer", "wow", "celebrate":
			m = "happy"
		"sad":
			m = "cry"
	if m != mood or m in ["happy", "gasp", "phew"]:
		_n += 1
	mood = m
	if m == "happy":
		_front_until = _st.c + 1.7
	elif m == "dance" or m == "cry":
		_front_until = _st.c + 99999.0
	elif m == "idle" and _front_until > _st.c + 50.0:
		_front_until = -1.0

func play(name: String, power := 1.0) -> void:
	routine = name if Cheer.R.has(name) else "cheer"
	ru = 0.0
	pw = power
	face = float(Cheer.R[routine].face)
	_view = Cheer.view_at(routine, 0.0)
	_view_from = _view
	_flip = -1.0

func skip_routine() -> void:
	if routine != "":
		ru = maxf(ru, Cheer.R[routine].len)

func routine_info() -> Dictionary:
	return Cheer.R.get(routine, {})

func poke() -> void:
	var r = randi() % 4
	if r == 3:
		set_mood("phew")
		_front_until = _st.c + 1.3
	else:
		set_mood("happy")
	Sfx.play("cluck", -2.0, randf_range(0.95, 1.12))

func _input(ev: InputEvent) -> void:
	if not pokeable or not is_visible_in_tree():
		return
	if ev is InputEventScreenTouch and ev.pressed:
		var p = get_global_transform_with_canvas().affine_inverse() * ev.position
		if absf(p.x) < H * 0.45 and p.y < 0.0 and p.y > -H * 1.05:
			poke()

func _turn(v: int) -> void:
	if v == _view and _flip < 0.0:
		return
	if _flip >= 0.0:
		if v == _view:
			return
	_view_from = _current_view()
	_view = v
	_flip = 0.0

func _current_view() -> int:
	if _flip >= 0.0 and _flip < 0.5:
		return _view_from
	return _view

# ---------------------------------------------------------------- per frame
func _process(dt: float) -> void:
	dt = minf(dt, 0.1)
	_t += dt
	if _flip >= 0.0:
		_flip += dt / 0.24
		if _flip >= 1.0:
			_flip = -1.0
	if routine != "":
		var u0 = ru
		ru += dt
		for k in Cheer.R[routine].cues:
			if k[0] > u0 and k[0] <= ru:
				cue.emit(k[1])
		_turn(Cheer.view_at(routine, ru))
		_routine_pose()
	else:
		_anim(dt)
	# The vector art is rebuilt at most 30 times a second (the canvas keeps the last drawing in between). On a slow
	# phone the rate drops so the hens never take more than about a quarter of the CPU: the measured cost of a
	# draw sets the gap between draws (30 Hz down to 15 Hz). Turns redraw every frame while drawing is cheap.
	_frame += 1
	_since += dt
	var gap = clampf(_cost_ms / 250.0, 1.0 / 31.0, 1.0 / 15.0)
	if _since >= gap or (_flip >= 0.0 and _cost_ms < 6.0):
		_since = 0.0
		queue_redraw()

func _routine_pose() -> void:
	var u = ru
	var P = Cheer.pose_at(routine, u, pw)
	var P1 = Cheer.pose_at(routine, u - 0.04, pw)
	var P2 = Cheer.pose_at(routine, u - 0.09, pw)
	_secondary_static(P, (P1.lift - P2.lift) / 0.05, ((P1.dx - P2.dx) / 0.05) * face)
	var ev = _idle_events(u + 0.7 + _blink_seed)
	var blink = 0.0 if (P.eHappy > 0.6 or P.eSqueeze > 0.5) else ev.blink
	var burst = null
	for f in Cheer.R[routine].fx:
		if f[2] == "feathers" and u >= f[0] and u - f[0] < 1.0:
			burst = {u = (u - f[0]) * 1.1, k = roundf(f[0] * 10.0)}
	var hat = null
	if Cheer.R[routine].get("hat", "") == "crown":
		hat = Cheer.crown_hat(u)
	elif routine == "juggle":
		hat = Cheer.egg_hat(u)
	_flip_pose(P)
	_P = P
	_o = {face = face, blink = blink, tt = u, burst = burst, hat = hat, enter = u + 0.02}

func _flip_pose(P: Dictionary) -> void:
	if _flip >= 0.0:
		P.lift += 4.0 * sin(_flip * PI)
		P.sq -= 0.04 * sin(_flip * PI)

# ---------------------------------------------------------------- the web state machine (drawHenAnim)
const SEC := {c = [-0.0055, -0.005], t = [0.006, 0.004], w = [-0.0045, 0.0]}
static func _sec_target(k: String, vy: float, vx: float) -> float:
	return clampf(SEC[k][0] * vy + SEC[k][1] * vx, -0.4, 0.4)

static func _apply_sec(P: Dictionary, c: float, t: float, w: float) -> void:
	P.comb += c
	P.tail += t
	P.wa += w * clampf(P.wa, 0.0, 1.0)
	P.wf += w * clampf(P.wf, 0.0, 1.0)

static func _secondary_static(P: Dictionary, vy: float, vx: float) -> void:
	_apply_sec(P, _sec_target("c", vy, vx), _sec_target("t", vy, vx), _sec_target("w", vy, vx))

static func _slot(tt: float, period: float, seed: float, dur: float, prob: float) -> Dictionary:
	var k = floorf(tt / period)
	if A.hsh(k * 1.7 + seed) > prob:
		return {u = -1.0, k = k}
	var start = A.hsh(k * 3.1 + seed + 9.0) * (period - dur - 0.3) + 0.15
	var u = (tt - k * period - start) / dur
	return {u = u if u >= 0.0 and u <= 1.0 else -1.0, k = k}

static func _idle_events(tt: float) -> Dictionary:
	var b = _slot(tt, 3.3, 1, 0.17, 0.92)
	var p = _slot(tt, 5.4, 2, 1.15, 0.8)
	var r = _slot(tt, 8.7, 3, 0.75, 0.8)
	var blink = 0.0 if b.u < 0.0 else sin(b.u * PI)
	if A.hsh(b.k * 7.7 + 2.0) > 0.62:
		var b2 = _slot(tt - 0.26, 3.3, 1, 0.17, 0.92)
		if b2.u >= 0.0:
			blink = maxf(blink, sin(b2.u * PI))
	var d = _slot(tt, 2.3, 6, 0.75, 0.7)
	var de = 0.0 if d.u < 0.0 else A.ss(0, 0.08, d.u) * (1.0 - A.ss(0.86, 1, d.u))
	return {blink = blink, peck = p.u, ruffle = r.u, dx = de * (A.hsh(d.k * 4.1) * 2.0 - 1.0) * 1.6, dy = de * (A.hsh(d.k * 2.3 + 1.0) - 0.6) * 1.4}

static func _idle(tt: float) -> Dictionary:
	var br = sin(tt * 2.4)
	return A.pose({sq = br * 0.018, hx = sin(tt * 1.1) * 0.9, hy = sin(tt * 2.4 + 0.6) * 0.8, hr = sin(tt * 0.9) * 0.03,
		comb = sin(tt * 2.4 - 0.5) * 0.04, wa = br * 0.03, tail = sin(tt * 3.0) * 0.04})

static func _worry(tt: float) -> Dictionary:
	var k = int(floorf(tt * 2.6))
	var f = A.ss(0, 0.35, A.fract(tt * 2.6))
	var sx = [-1.0, 0.8, -0.4, 1.0, -0.9, 0.3]
	var sy = [0.0, -1.0, 0.4, -0.6, 0.2, -1.0]
	var a = k % 6
	var b = (k + 1) % 6
	var dx = lerpf(sx[a], sx[b], f)
	var dy = lerpf(sy[a], sy[b], f)
	return A.pose({sq = 0.03, lift = absf(sin(tt * 15.0)) * 0.9, dx = sin(tt * 43.0) * 0.7, hx = -2.0 + dx * 2.5, hy = -4.0 + dy * 1.5, hr = -0.08 + dx * 0.1,
		comb = -0.12 + sin(tt * 20.0) * 0.05, wa = 1.05 + sin(tt * 17.0) * 0.12, wf = 1.15 + sin(tt * 17.0 + 1.0) * 0.12, sp = 0.55, puff = 1.06, tufts = 1.0,
		tail = 0.12, tsp = 0.6, eWide = 1.0, brow = 1.0, pdx = dx * 1.4, pdy = dy * 1.0, beak = 2.6, sweat = 1.0, blush = 0.25})

static func _cry(tt: float) -> Dictionary:
	var heave = maxf(0.0, sin(tt * 8.0))
	var wipe = A.ss(0.55, 0.7, A.fract(tt / 2.4)) * (1.0 - A.ss(0.86, 1, A.fract(tt / 2.4)))
	return A.pose({sq = -0.045 + heave * 0.03, dx = sin(tt * 31.0) * 0.25, hx = 1.0, hy = 5.0 - heave * 1.4, hr = 0.16 + sin(tt * 4.0) * 0.05, comb = 0.3,
		wa = lerpf(-0.18, 2.68, wipe) + sin(tt * 16.0) * 0.07 * wipe, wf = -0.1, sp = 0.15 * wipe, tail = -0.35, tsp = -0.3, eSqueeze = 1.0, brow = 1.0, browY = 1.5,
		beak = 4.5 + sin(tt * 9.0) * 1.4, tear = 1.0, blush = 0.45})

static func _dance(tt: float) -> Dictionary:
	var ph = tt * 2.2
	var f = A.fract(ph)
	var air = sin((f / 0.7) * PI) if f < 0.7 else 0.0
	var land = maxf(0.0, 1.0 - (f - 0.7) / 0.14) if f >= 0.7 else 0.0
	var s = sin(ph * PI)
	var sw = sin(ph * TAU) * 0.45
	return A.pose({lift = air * 12.0, sq = 0.06 * air - 0.1 * land, sway = s * 0.1, dx = s * 3.0, hx = s * 2.0, hy = -2.0, hr = -0.1 - s * 0.1, comb = -s * 0.2,
		wa = 1.5 + sw, wf = 1.45 - sw, sp = 0.85, tail = sin(tt * 7.0) * 0.2, tsp = 0.5, fL = maxf(0.0, s) * 6.0, fR = maxf(0.0, -s) * 6.0,
		sL = maxf(0.0, s) * 5.0, sR = maxf(0.0, -s) * 5.0, eHappy = 1.0, beak = 4.5, blush = 0.5})

static func _blend_into(out: Dictionary, p: Dictionary, w: float) -> void:
	if w <= 0.0005:
		return
	for k in A.KEYS:
		out[k] += p[k] * w

static func _cheer_common(P: Dictionary, E: float) -> void:
	P.eHappy = lerpf(P.eHappy, 1.0, E)
	P.eWide = lerpf(P.eWide, 0.0, E)
	P.brow = lerpf(P.brow, 0.0, E)
	P.sweat = lerpf(P.sweat, 0.0, E)
	P.blush = lerpf(P.blush, 0.55, E)
	P.lean *= 1.0 - E

static func _env(u: float, a: float, b: float, c: float, d: float) -> float:
	return A.ss(a, b, u) * (1.0 - A.ss(c, d, u))

const REACT_LEN := {happy = [1.3, 1.25, 1.2], gasp = [0.5, 0.85, 0.75], phew = [1.0, 1.0, 0.95]}

# one-shot reaction layers (hen.js REACT): returns {burst, heart}
static func _react(kind: String, v: int, P: Dictionary, u: float) -> Dictionary:
	var out = {burst = -1.0, heart = -1.0}
	var ss = func(a, b, x): return A.ss(a, b, x)
	if kind == "happy":
		if v == 0:
			var E = ss.call(0, 0.08, u) * (1.0 - ss.call(0.85, 1.25, u))
			var lift = 0.0
			var sq = 0.0
			if u < 0.09:
				sq = -0.1 * (u / 0.09)
			elif u < 0.5:
				var a = (u - 0.09) / 0.41
				lift = 15.0 * sin(a * PI)
				sq = lerpf(-0.1, 0.09, ss.call(0, 0.25, a)) * (1.0 - ss.call(0.7, 1, a)) + 0.04 * sin(a * PI) * (0.0 if a > 0.5 else 1.0)
			if u >= 0.5:
				sq -= 0.17 * exp(-(u - 0.5) / 0.07)
			if u >= 0.62 and u < 0.92:
				lift += 6.0 * sin((u - 0.62) / 0.3 * PI)
			if u >= 0.92:
				sq -= 0.08 * exp(-(u - 0.92) / 0.07)
			P.lift += lift
			P.sq += sq
			var fl = sin(u * 34.0) * 0.5
			P.wa = lerpf(P.wa, 1.45 + fl, E)
			P.wf = lerpf(P.wf, 1.35 + fl, E)
			P.sp = lerpf(P.sp, 1.0, E)
			_cheer_common(P, E)
			P.beak = lerpf(P.beak, 4.5, E)
			P.hy += -2.0 * E
			P.hr = lerpf(P.hr, -0.15, E)
			P.tail = lerpf(P.tail, 0.15 + sin(u * 26.0) * 0.18, E)
			P.tsp = lerpf(P.tsp, 0.8, E)
			P.sway += sin(u * 9.0) * 0.05 * E
			P.fL = lerpf(P.fL, lift * 0.25, E)
			P.fR = lerpf(P.fR, lift * 0.2, E)
			out.burst = u - 0.09 if u >= 0.09 else -1.0
		elif v == 1:
			var E = ss.call(0, 0.06, u) * (1.0 - ss.call(0.9, 1.25, u))
			var a = clampf((u - 0.1) / 0.46, 0.0, 1.0)
			var air = sin(a * PI) if (u > 0.1 and u < 0.56) else 0.0
			P.lift += 13.0 * air
			P.sq += (-0.1 * ss.call(0, 0.1, u) if u < 0.1 else 0.0) + 0.08 * air * (1.0 if a < 0.5 else 0.3) - (0.16 * exp(-(u - 0.56) / 0.07) if u >= 0.56 else 0.0)
			P.twirl += TAU * clampf((u - 0.14) / 0.32, 0.0, 1.0)
			var fl = _env(u, 0.62, 0.7, 0.85, 1.05)
			P.wa = lerpf(P.wa, 1.6 - 0.1 * fl, E)
			P.wf = lerpf(P.wf, 1.5 + 0.8 * fl, E)
			P.sp = lerpf(P.sp, 1.0, E)
			_cheer_common(P, E)
			P.beak = lerpf(P.beak, 3.5 + 1.5 * fl, E)
			P.hr = lerpf(P.hr, -0.12 - 0.12 * fl, E)
			P.tail = lerpf(P.tail, 0.2, E)
			P.tsp = lerpf(P.tsp, 0.9, E)
			P.fL = lerpf(P.fL, 4.0 * air, E)
			P.fR = lerpf(P.fR, 3.0 * air, E)
			out.burst = (u - 0.5) * 1.3 if u >= 0.5 else -1.0
		else:
			var E = ss.call(0, 0.06, u) * (1.0 - ss.call(0.85, 1.2, u))
			var p1 = _env(u, 0.04, 0.13, 0.3, 0.42)
			var p2 = _env(u, 0.42, 0.51, 0.7, 0.86)
			var p = maxf(p1, p2)
			P.wa = lerpf(P.wa, 0.3 + 1.35 * p, E)
			P.wf = lerpf(P.wf, 0.4 + 1.85 * p, E)
			P.sp = lerpf(P.sp, 0.5 + 0.5 * p, E)
			P.lift += 3.0 * p
			P.sq += 0.06 * p - 0.05 * _env(u, 0.3, 0.36, 0.38, 0.46) - 0.05 * _env(u, 0.7, 0.76, 0.78, 0.9)
			P.hx += 3.0 * p * E
			P.hy -= 2.0 * p * E
			P.hr = lerpf(P.hr, -0.2 * p, E)
			_cheer_common(P, E)
			P.beak = lerpf(P.beak, 4.8 * p, E)
			P.tail = lerpf(P.tail, sin(u * 30.0) * 0.22, E)
			P.tsp = lerpf(P.tsp, 0.6, E)
			P.fR += 3.0 * p2
	elif kind == "gasp":
		if v == 0:
			var a = minf(1.0, u / 0.2)
			var air = sin(a * PI) if u < 0.2 else 0.0
			P.lift += 4.5 * air
			P.sq += 0.08 * air - (0.08 * exp(-maxf(0.0, u - 0.2) / 0.07) if u >= 0.2 else 0.0)
			P.puff += 0.05 * exp(-u / 0.18)
			P.tufts = maxf(P.tufts, 1.0 - ss.call(0.2, 0.5, u))
		elif v == 1:
			var E = _env(u, 0, 0.07, 0.55, 0.85)
			P.wa = lerpf(P.wa, 2.5, E)
			P.wf = lerpf(P.wf, 2.35, E)
			P.sp = lerpf(P.sp, 0.3, E)
			P.lean -= 0.14 * E
			P.hy -= 2.0 * E
			P.hx -= 2.0 * E
			P.lift += 2.5 * sin(clampf(u / 0.18, 0.0, 1.0) * PI)
			P.eWide = maxf(P.eWide, E)
			P.beak = lerpf(P.beak, 3.6, E)
			P.puff += 0.03 * E
			P.tufts = maxf(P.tufts, 0.8 * E)
		else:
			var d = _env(u, 0, 0.06, 0.2, 0.42)
			var sh = _env(u, 0.22, 0.3, 0.55, 0.72)
			P.sq -= 0.11 * d
			P.lift -= 4.0 * d
			P.hx -= 4.0 * d
			P.hy += 4.0 * d
			P.puff += 0.04 * d
			P.wa = lerpf(P.wa, 0.9, d)
			P.wf = lerpf(P.wf, 0.9, d)
			P.hr += sin((u - 0.22) * 42.0) * 0.2 * sh
			P.comb += sin((u - 0.22) * 42.0 - 0.8) * 0.22 * sh
			P.eSqueeze = maxf(P.eSqueeze, d)
			P.tufts = maxf(P.tufts, maxf(d, sh) * 0.9)
	else:
		if v == 0:
			var E = _env(u, 0, 0.12, 0.72, 1)
			var sw = _env(u, 0.16, 0.24, 0.5, 0.6)
			P.wa = lerpf(P.wa, 2.45 + sin(u * 11.0) * 0.22 * sw, E)
			P.sp = lerpf(P.sp, 0.2, E)
			P.sweat = maxf(P.sweat, _env(u, 0, 0.08, 0.4, 0.6))
			P.eHappy = lerpf(P.eHappy, 0.85, ss.call(0.35, 0.5, u) * E)
			P.beak = lerpf(P.beak, 2.0, _env(u, 0.45, 0.55, 0.75, 0.9))
			P.sq -= 0.04 * _env(u, 0.5, 0.6, 0.8, 1)
			P.hy += 2.0 * E
		elif v == 1:
			var inh = _env(u, 0, 0.12, 0.16, 0.26)
			var o2 = _env(u, 0.2, 0.32, 0.6, 0.78)
			var sh = _env(u, 0.66, 0.72, 0.88, 1)
			P.sq += 0.05 * inh - 0.07 * o2
			P.puff += 0.04 * inh
			P.hy += -2.0 * inh + 4.0 * o2
			P.lean += 0.06 * o2
			P.wa = lerpf(P.wa, -0.2, o2)
			P.wf = lerpf(P.wf, -0.1, o2)
			P.eHappy = lerpf(P.eHappy, 0.9, o2)
			P.beak = lerpf(P.beak, 1.8, o2)
			P.dx += sin(u * 60.0) * 0.9 * sh
			P.tufts = maxf(P.tufts, 0.5 * sh)
			P.tail += sin(u * 50.0) * 0.2 * sh
		else:
			var E = _env(u, 0, 0.1, 0.65, 0.95)
			var a = clampf((u - 0.3) / 0.28, 0.0, 1.0)
			var air = sin(a * PI) if (u > 0.3 and u < 0.58) else 0.0
			P.wa = lerpf(P.wa, 0.8 + sin(u * 16.0) * 0.1, E)
			P.wf = lerpf(P.wf, 0.3, E)
			P.lift += 6.0 * air
			P.sq += 0.05 * air - (0.1 * exp(-(u - 0.58) / 0.07) if u > 0.58 else 0.0)
			_cheer_common(P, E)
			P.blush = lerpf(P.blush, 0.85, E)
			P.beak = lerpf(P.beak, 2.0, E)
			P.hr = lerpf(P.hr, 0.1, E)
			out.heart = u
	return out

static func _next_variant(prev: int, n: int) -> int:
	if prev < 0:
		return int(floorf(A.hsh(n * 3.7 + 1.0) * 3.0))
	return (prev + 1 + (1 if A.hsh(n * 1.3 + 5.0) > 0.5 else 0)) % 3

func _anim(dt: float) -> void:
	var st = _st
	st.c += dt
	var tt: float = st.c
	var again = _n != st.n or mood != st.mood
	var tw = {worry = 0.0, cry = 0.0, dance = 0.0}
	if mood == "gasp":
		tw.worry = 1.0
	elif mood == "worried":
		tw.worry = 0.75
	elif mood == "cry":
		tw.cry = 1.0
	elif mood == "dance":
		tw.dance = 1.0
	if danger > 0.15:
		tw.worry = maxf(tw.worry, minf(0.6, (danger - 0.15) * 1.3))
	if again:
		if mood == "happy":
			var u = st.c - st.cheerAt
			var ln = REACT_LEN.happy[maxi(0, st.cheerV)]
			if u > ln * 0.7 or st.cheerAt < -1.0:
				_fire_cheer(false)
			else:
				st.queued = true
		if mood == "gasp" and st.worryT < 0.3:
			st.startleAt = st.c
			st.startleK += 1
			st.startleV = _next_variant(st.startleV, st.startleK + _n)
		elif mood == "worried" and st.worryT < 0.3:
			st.startleAt = st.c
			st.startleK += 1
			st.startleV = 0
		if mood == "phew":
			st.phewAt = st.c
			st.phewK += 1
			st.phewV = _next_variant(st.phewV, st.phewK + _n)
		st.mood = mood
		st.n = _n
	if st.queued and st.c - st.cheerAt > REACT_LEN.happy[maxi(0, st.cheerV)] * 0.7:
		_fire_cheer(true)
	var ease = func(cur: float, want: float, tin: float, tout: float) -> float:
		return cur + (want - cur) * (1.0 - exp(-dt / (tin if want > cur else tout)))
	st.w.worry = ease.call(st.w.worry, tw.worry, 0.07, 0.4)
	st.w.cry = ease.call(st.w.cry, tw.cry, 0.3, 0.55)
	st.w.dance = ease.call(st.w.dance, tw.dance, 0.22, 0.3)
	st.worryT = st.w.worry
	var wsum = st.w.worry + st.w.cry + st.w.dance
	var nrm = 1.0 / wsum if wsum > 1.0 else 1.0
	var wW = st.w.worry * nrm
	var wC = st.w.cry * nrm
	var wD = st.w.dance * nrm
	var wI = maxf(0.0, 1.0 - wW - wC - wD)
	var P = {}
	for k in A.KEYS:
		P[k] = 0.0
	_blend_into(P, _idle(tt), wI)
	_blend_into(P, _worry(tt), wW)
	_blend_into(P, _cry(tt), wC)
	_blend_into(P, _dance(tt), wD)

	# which way she faces: front to cheer at you / cry / dance; the title-screen hen faces you and now and then looks away
	var want_front = st.c < _front_until
	if role == "front":
		want_front = st.c >= _side_until
		if mood == "idle" and wW < 0.2 and st.c > _peek_next and _flip < 0.0:
			_peek_next = st.c + randf_range(7.0, 11.0)
			_side_until = st.c + 2.3
			_peck_at = st.c + 0.55
			face = -1.0 if randf() < 0.5 else 1.0
	elif mood == "happy" or wD > 0.5:
		want_front = want_front or wD > 0.5
	_turn(1 if want_front else 0)
	var front = _current_view() == 1

	# walk (side view only)
	var walk_amt = 0.0
	var fd = 1.0 if face >= 0.0 else -1.0
	if look != null and not front:
		var still = clampf(1.0 - wW - wC - wD, 0.0, 1.0)
		var want = clampf(look, -1.0, 1.0) * 22.0
		if still < 0.5:
			want = st.x
		var v = clampf((want - st.x) * 5.0, -26.0, 26.0) * still
		st.sv += (v - st.sv) * (1.0 - exp(-dt * 9.0))
		st.x = clampf(st.x + st.sv * dt, -22.0, 22.0)
		st.phase += absf(st.sv) * dt * 0.42
		walk_amt = clampf(absf(st.sv) / 26.0 * 1.6, 0.0, 1.0)
	else:
		st.sv = 0.0
	var face_t = signf(st.sv) if absf(st.sv) > 3.0 else fd
	st.face = st.face + (face_t - st.face) * (1.0 - exp(-dt / 0.045))
	if walk_amt > 0.001:
		var sp = sin(st.phase)
		var cp = cos(st.phase)
		P.fL += walk_amt * 5.0 * maxf(0.0, sp)
		P.fR += walk_amt * 5.0 * maxf(0.0, -sp)
		P.sL += walk_amt * 6.0 * cp
		P.sR -= walk_amt * 6.0 * cp
		P.lift += walk_amt * 0.9 * absf(sp)
		P.lean += 0.07 * walk_amt
		P.hx += 3.0 * walk_amt + sin(st.phase * 2.0 + 1.0) * 2.2 * walk_amt
		P.hy += sin(st.phase * 2.0 + 1.0) * 0.8 * walk_amt
		P.sq += cos(st.phase * 2.0) * 0.012 * walk_amt
		P.sway += sp * 0.03 * walk_amt
		P.tail += -0.1 * walk_amt

	# idle one-shots: pecks (side view), ruffles, eye darts; front view gets a curious head tilt instead of a peck
	var beak_peck = 0.0
	var ev = _idle_events(tt + _blink_seed)
	if wI > 0.001:
		var pu = ev.peck
		if st.c - _peck_at >= 0.0 and st.c - _peck_at < 1.15:
			pu = (st.c - _peck_at) / 1.15
		if pu >= 0.0 and not front:
			var base = sin(pu * PI)
			var tap = maxf(0.0, sin(pu * TAU * 2.2 - 0.6))
			var dip = base * (0.72 + 0.28 * tap) * wI
			P.lean += 0.3 * dip
			P.hy += 7.0 * dip
			P.hx += 5.0 * dip
			P.hr += 0.55 * dip
			P.sq -= 0.04 * dip
			P.comb += 0.12 * dip
			P.tail -= 0.25 * dip
			beak_peck = tap * base * 2.4 * wI
			P.pdy += 1.0 * dip
		elif pu >= 0.0 and front:
			var e = sin(pu * PI) * wI
			P.hr += 0.35 * e * (1.0 if A.hsh(floorf(tt / 5.4)) > 0.5 else -1.0)
			P.pdx += 1.2 * e
			P.beak += 1.2 * _env(pu, 0.4, 0.5, 0.6, 0.7)
		if ev.ruffle >= 0.0:
			var u = ev.ruffle
			var e = sin(u * PI)
			var sh = sin(u * 62.0) * e
			P.wa += (0.55 + sh * 0.15) * e * wI
			P.wf += (0.5 - sh * 0.15) * e * wI
			P.sp += 0.35 * e * wI
			P.dx += sh * 0.9 * wI
			P.sq += 0.03 * e * wI
			P.tufts += 0.55 * e * wI
			P.tail += sh * 0.15 * wI
			P.tsp += 0.4 * e * wI
		if look == null:
			P.pdx += ev.dx * wI
			P.pdy += ev.dy * wI
	var blink = ev.blink if wC < 0.5 else 0.0

	# one-shot reactions
	var burst = -1.0
	var heart = -1.0
	var cu = st.c - st.cheerAt
	var v1 = maxi(0, st.cheerV)
	if cu >= 0.0 and cu < REACT_LEN.happy[v1] + 0.3:
		var x = _react("happy", v1, P, cu)
		if x.burst >= 0.0:
			burst = x.burst
	var su = st.c - st.startleAt
	var v2 = maxi(0, st.startleV)
	if su >= 0.0 and su < REACT_LEN.gasp[v2]:
		_react("gasp", v2, P, su)
	var pu2 = st.c - st.phewAt
	var v3 = maxi(0, st.phewV)
	if pu2 >= 0.0 and pu2 < REACT_LEN.phew[v3]:
		var x = _react("phew", v3, P, pu2)
		if x.heart >= 0.0:
			heart = x.heart

	# overlapping action: damped springs on comb, tail and wing tips
	if st.sec == null:
		st.sec = {pl = P.lift, px = st.x + P.dx, c = 0.0, cv = 0.0, t = 0.0, tv = 0.0, w = 0.0, wv = 0.0}
	var S = st.sec
	if dt > 0.0:
		var vy = (P.lift - S.pl) / dt
		var vx = ((st.x + P.dx - S.px) / dt) * (1.0 if st.face >= 0.0 else -1.0)
		var steps = int(ceilf(dt * 120.0))
		var hdt = dt / steps
		for i in steps:
			for k in ["c", "t", "w"]:
				var kv = k + "v"
				S[kv] += (220.0 * (_sec_target(k, vy, vx) - S[k]) - 13.0 * S[kv]) * hdt
				S[k] += S[kv] * hdt
	S.pl = P.lift
	S.px = st.x + P.dx
	_apply_sec(P, S.c, S.t, S.w)
	if look != null:
		P.pdx += float(look) * 0.8 * (1.0 if st.face >= 0.0 else -1.0)
	P.beak += beak_peck
	_flip_pose(P)
	_P = P
	_o = {face = st.face, x = st.x, blink = blink, tt = tt, burst = {u = burst, k = st.cheerK} if burst >= 0.0 else null,
		loose = st.w.worry if (st.w.worry > 0.3 and P.tufts > 0.3) else 0.0, notes = wD, heart = heart}

func _fire_cheer(skip: bool) -> void:
	var st = _st
	st.cheerAt = st.c - (0.085 if skip else 0.0)
	st.cheerK += 1
	st.cheerV = 0 if (skip and st.cheerV == 0) else _next_variant(st.cheerV, st.cheerK + _n)
	if force_variant >= 0:
		st.cheerV = force_variant
	# the twirl reads badly from the front: in the front view use the hop or the wing pumps
	st.queued = false

# ---------------------------------------------------------------- draw
static var _prof_us := 0
static var _prof_n := 0
static var _cost_ms := 4.0 # running average cost of one hen draw, shared by every hen (they share the CPU)
var _since := 0.0

func _draw() -> void:
	if _P.is_empty():
		return
	var t0 = Time.get_ticks_usec()
	_draw_hen()
	_cost_ms = lerpf(_cost_ms, (Time.get_ticks_usec() - t0) / 1000.0, 0.1)
	if OS.has_environment("HEN_PROF"):
		_prof_us += Time.get_ticks_usec() - t0
		_prof_n += 1
		if _prof_n % 120 == 0:
			print("hen draw avg us: ", _prof_us / _prof_n, "  draws/s target ", roundi(1.0 / clampf(_cost_ms / 250.0, 1.0 / 31.0, 1.0 / 15.0)))

func _draw_hen() -> void:
	var c = _c
	c.begin(self)
	var cy = -0.48 * H
	var S = H / 100.0
	var view = _current_view()
	var sq = maxf(0.12, absf(cos(_flip * PI))) if _flip >= 0.0 else 1.0
	var o = _o.duplicate()
	o.shadow = 0.0
	if routine != "":
		c.save()
		c.translate(0, cy)
		c.scale(S, S)
		if routine == "chicks":
			Cheer.chicks(c, ru, pw, false)
		c.restore()
	# soft contact shadow on the floor (shrinks as she hops)
	if shadow > 0.0:
		c.begin_path()
		c.oval(_P.dx * S + float(_o.get("x", 0.0)) * S, 0, H * 0.34 / (1.0 + maxf(0.0, _P.lift) / 30.0), H * 0.055)
		c.fill_path(Color(0, 0, 0, shadow))
	if view == 1:
		o.squeeze = sq
		A.draw_front(c, _P, 0, cy, H, o)
	else:
		var f = float(o.get("face", -1.0))
		o.face = (1.0 if f >= 0.0 else -1.0) * maxf(0.1, absf(f)) * sq
		A.draw_side(c, _P, 0, cy, H, o)
	if routine != "":
		c.save()
		c.translate(0, cy)
		c.scale(S, S)
		if routine == "chicks":
			Cheer.chicks(c, ru, pw, true)
		if routine == "juggle":
			Cheer.juggling_eggs(c, ru, _P, face)
		if routine == "strut":
			Cheer.falling_crown(c, ru, _P, face, (stage_top - cy) / S)
		var hearts = Cheer.R[routine].get("heart", [])
		for t in hearts:
			var v = A.fract((ru - t) / 2.6) * 2.6
			if ru >= t and v < 1.0:
				A.heart(c, 4.0 * sin(v * 5.0), -62.0 - v * 22.0, 8, 2.8, 1.0 - A.ss(0.6, 1, v))
		c.restore()
