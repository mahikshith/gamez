# Mama hen's level-end routines: a port of the web game's src/render/cheer.js (choreographed win routines, each a pure
# function of time u since the card opened, so a tap that skips is just u = len). Plus a view track per routine: which
# moves read best side-on (hops, flips, the strut, the juggle) and which face the player (waves, pumps, the dance, hugs).
#   len    when it reaches its final hold pose (the hold keeps breathing and now and then a small beat)
#   stars  when each star lands (the win card pops its stars on these beats)
#   cues   [time, sfx]: sounds as u crosses them
#   fx     confetti bursts [at, n, from]
extends RefCounted

const A = preload("res://scripts/mama_art.gd")

const JUG_T0 := 0.5
const JUG_T := 0.26
const JUG_AIR := 0.56
const JUG_FIN := 0.42

const R := {
	"cheer": {len = 1.9, stars = [0.88, 1.12, 1.36], face = -1, hold = "wave", view = [[0.0, 1]],
		cues = [[0.44, "hop"], [0.8, "land"], [0.92, "cluck"], [1.6, "tada"]], fx = [[0.8, 14, "sides"]]},
	"pump": {len = 2.15, stars = [0.98, 1.26, 1.54], face = 1, hold = "pump", view = [[0.0, 1]],
		cues = [[0.42, "hop"], [0.84, "land"], [1.0, "flap"], [1.28, "flap"], [1.56, "flap"], [1.78, "hop"], [1.95, "cluck"], [2.06, "tada"]],
		fx = [[0.84, 22, "sides"], [2.05, 10, "feathers"]]},
	"dance": {len = 2.35, stars = [1.0, 1.3, 1.6], face = -1, hold = "sway", view = [[0.0, 1]],
		cues = [[0.42, "hop"], [0.7, "land"], [1.0, "cluck"], [1.3, "cluck"], [1.6, "cluck"], [1.86, "hop"], [2.18, "land"], [2.22, "tada"]],
		fx = [[0.7, 16, "sides"], [2.2, 18, "top"]]},
	"juggle": {len = 2.5, stars = [1.7, 1.96, 2.22], face = 1, hold = "balance", view = [[0.0, 0], [3.1, 1]],
		cues = [[0.5, "flap"], [0.76, "flap"], [1.02, "flap"], [1.28, "flap"], [1.54, "flap"], [1.8, "flap"], [1.7, "land"], [1.96, "land"], [2.22, "cluck"], [2.24, "confetti"], [2.4, "tada"]],
		fx = [[2.22, 26, "sides"]]},
	"backflip": {len = 2.45, stars = [1.38, 1.62, 1.86], face = -1, hold = "pump", view = [[0.0, 0], [2.9, 1]],
		cues = [[0.55, "hop"], [0.62, "flap"], [1.24, "land"], [1.26, "confetti"], [1.4, "cluck"], [1.64, "cluck"], [1.88, "cluck"], [2.08, "hop"], [2.32, "tada"]],
		fx = [[1.24, 44, "sides"], [1.24, 12, "feathers"], [2.3, 16, "top"]]},
	"chicks": {len = 2.5, stars = [1.12, 1.46, 1.8], face = -1, hold = "hug", view = [[0.0, 1]],
		cues = [[0.3, "cluck"], [0.86, "hop"], [1.2, "hop"], [1.54, "hop"], [1.12, "land"], [1.46, "land"], [1.8, "land"], [1.82, "confetti"], [2.3, "tada"]],
		fx = [[1.8, 36, "sides"]], heart = [2.2]},
	"strut": {len = 2.6, stars = [1.15, 1.45, 1.75], face = 1, hold = "proud", view = [[0.0, 0], [2.0, 1]],
		cues = [[0.62, "land"], [0.66, "tada"], [0.85, "cluck"], [1.15, "cluck"], [1.45, "cluck"], [1.75, "cluck"], [2.1, "cluck"], [2.15, "confetti"], [2.4, "tada"]],
		fx = [[2.15, 40, "sides"]], hat = "crown"},
	"encourage": {len = 1.5, stars = [], face = -1, hold = "cheerOn", view = [[0.0, 1]],
		cues = [[0.86, "hop"], [1.0, "cluck"]], fx = []},
}
const ROUTINES := ["cheer", "pump", "dance", "juggle", "backflip", "chicks", "strut"]

static func ss(a: float, b: float, x: float) -> float:
	return A.ss(a, b, x)

static func env(u: float, a: float, b: float, c: float, d: float) -> float:
	return ss(a, b, u) * (1.0 - ss(c, d, u))

static func pick(stars: int, streak: int, boss: bool, first_world: bool, last: String) -> String:
	var pool
	if boss:
		pool = ["strut", "backflip"]
	elif first_world:
		pool = ["juggle", "dance"]
	elif stars >= 3:
		pool = ["chicks", "backflip"] if streak >= 2 else ["backflip", "chicks"]
	elif stars == 2:
		pool = ["dance", "pump"] if randf() < 0.5 else ["pump", "dance"]
	else:
		pool = ["cheer", "pump"] if randf() < 0.65 else ["pump", "cheer"]
	for r in pool:
		if r != last:
			return r
	return pool[0]

static func power(stars: int) -> float:
	return [0.45, 0.45, 0.75, 1.0][clampi(stars, 0, 3)]

static func view_at(name: String, u: float) -> int:
	var v = 1
	for k in R[name].view:
		if u >= k[0]:
			v = k[1]
	return v

static func jug_throws() -> Array:
	var out = []
	for j in 6:
		out.append(JUG_T0 + j * JUG_T)
	return out

static func jug_land() -> Array:
	var th = jug_throws()
	return [th[3] + JUG_FIN, th[4] + JUG_FIN, th[5] + JUG_FIN]

# ---------------------------------------------------------------- move helpers (edit P in place)
static func jump(P: Dictionary, u: float, t0: float, up: float, h: float, k := 1.0, ant := 0.16) -> float:
	var c = ss(t0 - ant, t0 - 0.03, u) * (1.0 - ss(t0 - 0.03, t0 + 0.03, u))
	P.sq -= 0.17 * k * c
	P.lift -= 6.0 * k * c
	P.hy += 3.0 * c
	P.tail += 0.25 * c
	P.wa -= 0.25 * c
	P.wf -= 0.2 * c
	var a = -1.0
	if u >= t0 and u < t0 + up:
		a = (u - t0) / up
		P.lift += h * 4.0 * a * (1.0 - a)
		P.sq += k * (0.17 * (1.0 - a) * (1.0 - a) - 0.03 * sin(a * PI) + 0.08 * a * a * a)
		P.fL += 5.0 * sin(a * PI)
		P.fR += 4.0 * sin(a * PI)
	var d = u - (t0 + up)
	if d >= 0.0 and d < 0.6:
		var e = exp(-d / 0.085)
		var w = cos(d * 17.0)
		P.sq -= 0.21 * k * e * w
		P.lift -= 6.0 * k * e * maxf(0.0, w)
		P.hy += 3.0 * e * maxf(0.0, w)
	return a

static func bounce(P: Dictionary, u: float, t: float, amp: float, dur := 0.22) -> void:
	if u >= t and u < t + dur:
		var a = (u - t) / dur
		P.lift += amp * sin(a * PI)
		P.sq += 0.05 * sin(a * PI) * (1.0 if a < 0.5 else 0.2)
	var d = u - t - dur
	if d >= 0.0 and d < 0.4:
		P.sq -= 0.09 * exp(-d / 0.06) * cos(d * 20.0) * clampf(amp / 5.0, 0.4, 1.2)

static func wings(P: Dictionary, wa: float, wf: float, sp: float, E: float) -> void:
	P.wa = lerpf(P.wa, wa, E)
	P.wf = lerpf(P.wf, wf, E)
	P.sp = lerpf(P.sp, sp, E)

static func wings_y(P: Dictionary, E: float) -> void:
	wings(P, 1.75, 1.3, 1.0, E)
	P.fw = maxf(P.fw, E)

static func wing_far(P: Dictionary, E: float) -> void:
	wings(P, 0.4, 1.3, 0.9, E)
	P.fw = maxf(P.fw, E)

static func happy(P: Dictionary, E := 1.0, open := 2.0) -> void:
	P.eHappy = lerpf(P.eHappy, 1.0, E)
	P.blush = lerpf(P.blush, 0.6, E)
	P.beak = lerpf(P.beak, open, E)

static func cluck(P: Dictionary, u: float, t: float, amt := 4.5) -> void:
	P.beak = maxf(P.beak, amt * env(u, t - 0.03, t, t + 0.06, t + 0.16))

static func breathe(P: Dictionary, u: float) -> void:
	P.sq += sin(u * 3.1) * 0.016
	P.hy += sin(u * 3.1 + 0.6) * 0.8
	P.tail += sin(u * 3.7) * 0.06
	P.comb += sin(u * 3.1 - 0.5) * 0.05
	P.hr += sin(u * 1.3) * 0.03

# ---------------------------------------------------------------- the routines
static func _pose(name: String, u: float, pw: float) -> Dictionary:
	var P = A.pose({blush = 0.5})
	match name:
		"cheer":
			happy(P, ss(0, 0.3, u), 1.5)
			var a = jump(P, u, 0.44, 0.36, 12)
			if a >= 0.0:
				wings(P, 1.5 + sin(u * 36.0) * 0.45, 1.4 + sin(u * 36.0 + 0.5) * 0.45, 0.9, sin(a * PI))
			var pump = env(u, 0.84, 0.92, 1.2, 1.36)
			wings(P, 1.75, 0.5, 0.85, pump)
			P.hr -= 0.15 * pump
			P.hx += 2.0 * pump
			cluck(P, u, 0.92)
			bounce(P, u, 1.14, 3)
			var wave = ss(1.4, 1.6, u)
			wings(P, 1.55 + sin(u * 11.0) * 0.3 * wave, 0.3, 0.75, wave)
			P.hr -= 0.1 * wave
			P.wink = ss(1.45, 1.6, u)
			happy(P, wave, 2.5)
		"pump":
			happy(P, ss(0, 0.3, u), 1.5)
			var a = jump(P, u, 0.42, 0.42, 14.0 + 6.0 * pw)
			var Y = ss(0.42, 0.55, u)
			wings_y(P, Y)
			P.hr -= 0.15 * Y
			happy(P, Y, 3.5)
			if a >= 0.0:
				P.fL += 3.0
				P.fR += 3.0
			for b in [0.98, 1.26, 1.54]:
				var dn = env(u, b - 0.1, b - 0.04, b + 0.01, b + 0.12)
				P.wa -= 1.05 * dn
				P.wf -= 0.75 * dn
				P.sp -= 0.3 * dn
				bounce(P, u, b - 0.02, 3.5)
				cluck(P, u, b + 0.02, 5)
			jump(P, u, 1.78, 0.28, 8, 0.8, 0.12)
			var fin = ss(1.8, 2.0, u)
			P.lean -= 0.09 * fin
			P.hr -= 0.15 * fin
			cluck(P, u, 1.97, 5.5)
			P.tsp += 0.6 * fin
			var L = env(u, 1.98, 2.05, 2.12, 2.3)
			P.wa -= 0.8 * L
			P.hx += 3.0 * L
			P.hy -= 2.0 * L
		"dance":
			happy(P, ss(0, 0.3, u), 2)
			jump(P, u, 0.42, 0.28, 8)
			var D = env(u, 0.66, 0.8, 1.78, 1.9)
			var ph = (u - 0.7) / 0.3
			var s = sin(ph * PI)
			P.dx += 11.0 * s * D
			P.sway += 0.12 * s * D
			P.hx += 3.0 * s * D
			P.hr += -0.12 * s * D
			P.fL += maxf(0.0, s) * 7.0 * D
			P.fR += maxf(0.0, -s) * 7.0 * D
			P.sL += maxf(0.0, s) * 6.0 * D
			P.sR += maxf(0.0, -s) * 6.0 * D
			wings(P, 1.25 + 0.5 * s, 1.85 - 0.6 * s, 0.9, D)
			P.lift += absf(cos(ph * PI)) * 3.0 * D
			P.tail += sin(u * 14.0) * 0.25 * D
			P.comb -= 0.2 * s * D
			for b in [1.0, 1.3, 1.6]:
				cluck(P, u, b, 3.5)
			var ta = jump(P, u, 1.88, 0.3, 10.0 + 4.0 * pw, 0.9, 0.1)
			P.twirl += TAU * clampf((u - 1.92) / 0.22, 0.0, 1.0)
			if ta >= 0.0:
				wings(P, 1.8, 1.7, 1, sin(ta * PI))
			var fin = ss(2.14, 2.3, u)
			wings_y(P, fin)
			P.fR += 6.0 * fin
			P.sR += 7.0 * fin
			P.wink = fin
			P.hr -= 0.1 * fin
			happy(P, fin, 3)
		"juggle":
			var th = jug_throws()
			var ld = jug_land()
			happy(P, ss(0, 0.3, u), 1.5)
			var J = env(u, 0.35, 0.5, ld[2] - 0.1, ld[2] + 0.05)
			var toss = 0.0
			for t in th:
				toss = maxf(toss, env(u, t - 0.06, t - 0.01, t + 0.03, t + 0.12))
			wings(P, 0.95 + 1.1 * toss, 0.7, 0.6, J)
			P.eHappy = lerpf(P.eHappy, 0.0, J)
			P.pdy -= 1.6 * J
			P.pdx += 0.8 * J
			P.hr -= 0.3 * J + 0.08 * toss
			P.hx -= 2.0 * J
			bounce(P, u, ld[0] - 0.05, 2.5)
			bounce(P, u, ld[1] - 0.05, 2.5)
			var hit = u - ld[2]
			if hit >= 0.0:
				P.sq -= 0.12 * exp(-hit / 0.08) * cos(hit * 16.0)
				P.hy += 3.0 * exp(-hit / 0.1)
			var fin = ss(ld[2], ld[2] + 0.22, u)
			wings_y(P, fin)
			happy(P, fin, 3)
			P.hr = lerpf(P.hr, -0.05, fin)
			P.wink = fin
		"backflip":
			happy(P, ss(0, 0.25, u), 1.5)
			var c = env(u, 0.22, 0.48, 0.52, 0.58)
			P.hr -= 0.25 * c
			P.pdy -= 1.5 * c
			P.eHappy = lerpf(P.eHappy, 0.0, c)
			P.tsp += 0.6 * c
			var a = jump(P, u, 0.56, 0.68, 30.0 + 10.0 * pw, 1.3, 0.3)
			if a >= 0.0:
				P.spin = -TAU * ss(0.06, 0.84, a)
				var E = sin(a * PI)
				wings(P, 1.9, 1.8, 1, E)
				P.fL += 6.0 * E
				P.fR += 6.0 * E
				P.eSqueeze = ss(0.1, 0.25, a) * (1.0 - ss(0.7, 0.85, a))
				P.beak = 4.0 * E
			var st = [1.38, 1.62, 1.86]
			for i in 3:
				var b = st[i]
				bounce(P, u, b - 0.06, 4.0 + i)
				var w = env(u, b - 0.06, b + 0.02, b + 0.14, b + 0.24)
				if i == 0:
					wings(P, 1.75, 0.5, 0.8, w)
				elif i == 1:
					wing_far(P, w)
				cluck(P, u, b + 0.02, 4.5)
			wings_y(P, ss(1.84, 1.96, u))
			happy(P, ss(1.2, 1.35, u), 3)
			jump(P, u, 2.08, 0.24, 7, 0.8, 0.08)
			var fin = ss(2.26, 2.4, u)
			P.lean -= 0.08 * fin
			P.hr -= 0.15 * fin
			P.fR += 5.0 * fin
			P.sR += 6.0 * fin
			P.beak = maxf(P.beak, 4.0 * fin)
			P.tsp += 0.7 * fin
		"chicks":
			happy(P, ss(0, 0.3, u), 1.5)
			var look = env(u, 0.15, 0.25, 0.75, 0.85)
			P.eHappy = lerpf(P.eHappy, 0.0, look)
			P.pdx += 1.6 * signf(sin(u * 7.0)) * look
			cluck(P, u, 0.3)
			wings(P, 1.25, 1.15, 0.7, ss(0.4, 0.7, u))
			for b in [0.86, 1.2, 1.54]:
				var a = jump(P, u, b, 0.26, 10.0 + 3.0 * pw, 0.9, 0.1)
				if a >= 0.0:
					wings_y(P, sin(a * PI))
			var hug = ss(1.95, 2.25, u)
			wings(P, 0.95, 0.9, 0.8, hug)
			P.hy += 3.0 * hug
			P.hr += 0.12 * hug
			happy(P, ss(0.8, 0.9, u), 2.5)
		"strut":
			happy(P, ss(0, 0.3, u), 1)
			var up = env(u, 0.1, 0.25, 0.58, 0.66)
			P.eHappy = lerpf(P.eHappy, 0.0, up)
			P.pdy -= 1.8 * up
			P.hr -= 0.25 * up
			P.beak = maxf(P.beak, 2.5 * up)
			var hit = u - 0.62
			if hit >= 0.0:
				P.sq -= 0.13 * exp(-hit / 0.08) * cos(hit * 15.0)
				P.hy += 3.0 * exp(-hit / 0.1)
				P.eSqueeze = env(u, 0.62, 0.66, 0.72, 0.8)
			var S = env(u, 0.78, 0.9, 1.88, 2.0)
			var ph = (u - 0.85) / 0.3
			P.dx += lerpf(lerpf(-16, 16, ss(0.85, 1.9, u)), 0, ss(1.98, 2.2, u))
			var st = sin(ph * PI)
			P.fL += maxf(0.0, st) * 8.0 * S
			P.fR += maxf(0.0, -st) * 8.0 * S
			P.sL += st * 7.0 * S
			P.sR -= st * 7.0 * S
			P.hx += 4.0 * absf(cos(ph * PI)) * S - 2.0 * S
			P.lean -= 0.1 * S
			P.puff += 0.05 * S
			P.hr -= 0.22 * S
			P.tsp += 1.0 * S
			P.tail += 0.15 * S
			P.lift += absf(st) * 2.0 * S
			for b in [0.85, 1.15, 1.45, 1.75]:
				cluck(P, u, b, 3)
			wings(P, 0.6, 0.5, 0.4, S)
			var fin = ss(1.95, 2.15, u)
			P.puff += 0.07 * fin
			P.lean -= 0.12 * fin
			P.hr -= 0.3 * fin
			happy(P, fin, 1)
			wings(P, 1.75, 0.45, 0.9, fin)
			bounce(P, u, 2.0, 4)
			cluck(P, u, 2.12, 5)
		"encourage":
			P.blush = 0.35
			var sad = env(u, 0, 0.12, 0.42, 0.55)
			P.hy += 4.0 * sad
			P.hr += 0.16 * sad
			P.pdy += 1.6 * sad
			P.brow = 0.9 * sad
			P.browY = 1.0 * sad
			P.wa -= 0.2 * sad
			P.wf -= 0.1 * sad
			P.tail -= 0.3 * sad
			P.sq -= 0.03 * sad + 0.04 * env(u, 0.26, 0.3, 0.32, 0.4)
			var sh = env(u, 0.45, 0.5, 0.68, 0.76)
			P.dx += sin(u * 62.0) * 2.2 * sh
			P.hr += sin(u * 62.0 + 1.0) * 0.12 * sh
			P.tufts = 0.9 * sh
			P.eSqueeze = sh
			P.puff += 0.04 * sh
			var a = jump(P, u, 0.86, 0.3, 10, 0.9, 0.1)
			var go = ss(0.8, 0.95, u)
			wings(P, 1.7, 0.5, 0.9, go)
			happy(P, go, 4)
			P.grit = go
			P.hr -= 0.12 * go
			if a >= 0.0:
				P.fR += 3.0
			var fin = ss(1.15, 1.45, u)
			P.beak = lerpf(P.beak, 2.5, fin)
			P.lean += 0.06 * fin
			P.wa = lerpf(P.wa, 1.55, fin)
	return P

static func _hold(name: String, P: Dictionary, v: float) -> void:
	breathe(P, v)
	var k = floorf(v / 2.6)
	var w = v - k * 2.6
	match R[name].hold:
		"wave":
			P.wa += sin(v * 9.0) * 0.25 * (0.6 + 0.4 * sin(v * 0.7))
		"pump":
			bounce(P, w, 1.6, 3)
			P.wa -= 0.9 * env(w, 1.5, 1.56, 1.62, 1.76)
			P.wf -= 0.6 * env(w, 1.5, 1.56, 1.62, 1.76)
		"sway":
			P.sway += sin(v * 3.0) * 0.07
			P.dx += sin(v * 3.0) * 2.0
		"balance":
			P.hr += sin(v * 2.3) * 0.05
			P.dx += sin(v * 2.3 + 1.0) * 1.2
		"hug":
			P.hy += sin(v * 3.4) * 0.8
		"proud":
			P.hy += sin(v * 2.2) * 0.8
		"cheerOn":
			bounce(P, w, 1.4, 3.5)
			P.wa += 0.15 * env(w, 1.36, 1.44, 1.56, 1.7)
			P.hy += maxf(0.0, sin(v * 4.0)) * 1.2

static func pose_at(name: String, u: float, pw: float) -> Dictionary:
	var L: float = R[name].len
	if u >= L:
		var P = _pose(name, L, pw)
		_hold(name, P, u - L)
		return P
	var P2 = _pose(name, maxf(0.0, u), pw)
	breathe(P2, u)
	return P2

# ---------------------------------------------------------------- props (hen frame units: feet at y 48)
static func egg(c, x: float, y: float, s: float, rot := 0.0) -> void:
	if s <= 0.01:
		return
	c.save()
	c.translate(x, y)
	c.rotate(rot)
	var w = s * 0.76
	var path = func(cc):
		for i in 25:
			var t = float(i) / 24.0 * TAU
			var sy = sin(t)
			var px = (w / 2.0) * cos(t) * (1.0 + 0.13 * sy)
			var py = (s / 2.0) * sy
			if i == 0:
				cc.move_to(px, py)
			else:
				cc.line_to(px, py)
		cc.close_path()
	c.begin_path()
	path.call(c)
	c.fill_path(Color("f6e6c4"))
	c.save()
	c.clip_path()
	c.begin_path()
	c.oval(w * 0.16, s * 0.12, w * 0.5, s * 0.5)
	c.fill_path(Color("e2c595"))
	c.begin_path()
	c.oval(-w * 0.04, -s * 0.06, w * 0.46, s * 0.47)
	c.fill_path(Color("f6e6c4"))
	c.restore()
	c.begin_path()
	path.call(c)
	c.stroke_path(A.LINE, 2.4)
	c.begin_path()
	c.oval(-w * 0.18, -s * 0.22, w * 0.1, s * 0.08, -0.5)
	c.fill_path(Color(1, 1, 1, 0.7))
	c.restore()

static func juggling_eggs(c, u: float, P: Dictionary, face: float) -> void:
	var fs = 1.0 if face >= 0.0 else -1.0
	if u < 0.32:
		return
	var th = jug_throws()
	var ld = jug_land()
	var appear = ss(0.32, 0.46, u)
	var hand = Vector2(30, 4)
	for i in 3:
		var t1 = th[i]
		var t2 = th[i + 3]
		var t3 = ld[i]
		var x = 0.0
		var y = 0.0
		var rot = 0.0
		if u < t1:
			x = 30.0 + i * 4.0
			y = 8.0 - 5.0 * i
		elif u < t1 + JUG_AIR:
			var a = (u - t1) / JUG_AIR
			x = lerpf(hand.x, 46, a)
			y = hand.y - 78.0 * 4.0 * a * (1.0 - a)
			rot = a * 3.0
		elif u < t2:
			var a = clampf((u - t1 - JUG_AIR) / (t2 - t1 - JUG_AIR), 0.0, 1.0)
			x = lerpf(46, hand.x, a)
			y = hand.y + 6.0 * sin(a * PI)
		elif u < t3:
			var a = (u - t2) / JUG_FIN
			var e = Vector2(22.0 + P.hx, -25.0 + P.hy - 13.0 - 9.0) if i == 2 else [Vector2(40, 39), Vector2(54, 39)][i]
			x = lerpf(hand.x, e.x, a)
			y = lerpf(hand.y, e.y, a) - 62.0 * 4.0 * a * (1.0 - a)
			rot = a * TAU
		elif i < 2:
			var d = u - t3
			x = [40.0, 54.0][i]
			y = 39.0 - 4.0 * exp(-d / 0.06) * absf(sin(d * 18.0))
		else:
			continue
		egg(c, fs * x, y, 19.0 * appear, rot * fs)

static func egg_hat(u: float):
	var t = jug_land()[2]
	if u < t:
		return null
	return func(c, P, o):
		var d = u - t
		var sq = 1.0 - 0.15 * exp(-d / 0.08) * cos(d * 16.0)
		c.save()
		c.translate(1, -20)
		c.scale(1.0 / sq, sq)
		egg(c, 0, -9, 19, sin(u * 2.3) * 0.08)
		c.restore()

static func crown(c, o: float, glint: float) -> void:
	c.begin_path()
	c.move_to(-11, 0)
	c.line_to(-13, -13)
	c.line_to(-6, -7)
	c.line_to(0, -16)
	c.line_to(6, -7)
	c.line_to(13, -13)
	c.line_to(11, 0)
	c.close_path()
	c.fill_path(Color("ffd23f"))
	c.save()
	c.clip_path()
	c.fill_rect(-16, -4, 32, 6, Color("e59a12"))
	c.restore()
	c.stroke_path(Color("7a4a0a"), o)
	for g in [[-13, -13, Color("f0402f")], [0, -16, Color("5a8dee")], [13, -13, Color("f0402f")]]:
		c.begin_path()
		c.circle(g[0], g[1], 2.4)
		c.solid(g[2], Color("7a4a0a"), o * 0.6)
	if glint > 0.0:
		c.save()
		c.alpha *= glint
		c.translate(-5, -6)
		c.rotate(0.6)
		c.fill_rect(-0.8, -3.5, 1.6, 7, Color("fff6c8"))
		c.fill_rect(-3.5, -0.8, 7, 1.6, Color("fff6c8"))
		c.restore()

static func crown_hat(u: float):
	if u < 0.62:
		return null
	return func(c, P, o):
		var d = u - 0.62
		var b = exp(-d / 0.12) * absf(sin(d * 14.0)) * 5.0
		var gl = env(A.fract((u - 1.0) / 1.6) * 1.6, 0, 0.1, 0.2, 0.35) if u > 1.0 else 0.0
		c.save()
		c.translate(-1, -13.0 - b)
		c.rotate(-0.12 + sin(d * 10.0) * 0.12 * exp(-d / 0.2))
		crown(c, o if o else 2.8, gl)
		c.restore()

static func falling_crown(c, u: float, P: Dictionary, face: float, top: float) -> void:
	if u < 0.08 or u >= 0.62:
		return
	var a = (u - 0.08) / 0.54
	var fs = 1.0 if face >= 0.0 else -1.0
	var hx = P.dx + fs * (21.0 + P.hx)
	var hy = -25.0 + P.hy - P.lift - 13.0
	c.save()
	c.translate(lerpf(hx - 14.0 * fs, hx, a), lerpf(minf(hy - 20.0, top + 10.0), hy, a * a))
	c.rotate((1.0 - a) * 2.4 * fs)
	crown(c, 2.8, 0)
	c.restore()

const CHICKS := [[-1, -40, 0.0], [1, 40, 0.06], [1, 64, 0.12]]

static func chicks(c, u: float, pw: float, front: bool) -> void:
	if not front:
		return
	const Chick = preload("res://scripts/chick_art.gd")
	for i in 3:
		var ch = CHICKS[i]
		var t = u - ch[2]
		var run = ss(0.15, 0.75, t)
		var hug = ss(1.95, 2.25, t)
		var x = lerpf(lerpf(ch[0] * 150.0, ch[1], run), ch[0] * (26.0 + i * 12.0), hug)
		var y = 0.0
		var flap = 0.0
		if run > 0.0 and run < 1.0:
			y -= absf(sin(t * 22.0)) * 5.0
		for b in [0.86, 1.2, 1.54]:
			if t > b and t < b + 0.26:
				var a = (t - b) / 0.26
				y -= (13.0 + 3.0 * pw) * 4.0 * a * (1.0 - a)
				flap = sin(a * PI)
		if t > 2.3:
			y -= maxf(0.0, sin((t - 2.3) * 6.0 + i)) * 2.2
		c.save()
		c.translate(x, 0)
		c.scale(-1.0 if ch[0] > 0 else 1.0, 1.0)
		Chick.draw(c, 0, 48.0 - 0.68 * 24.0 + y, 24, u * 1.3 + i, flap, 0)
		c.restore()
