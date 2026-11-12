# The level camera. A rest framing (set by main._fit) plus layered moves, all springs or eases so nothing snaps:
#   intro    opens close on Mama Hen and the nest, then cranes up and pulls back to the play framing
#   follow   drifts toward the eggs that are moving and leans in a touch while they fall (damped)
#   push     pushes in on the nest when an egg has left the vault and is on its way down, and for the win
#   punch    a zoom spring: in on a save, out on a break
#   shake    trauma based: offset and roll scale with trauma squared and die away
#   tilt     a small roll kick on a break; the fail outro eases out and leans
# `reduce` (the reduced-motion setting) keeps only the rest framing and a gentle win push.
extends Camera2D

const G = preload("res://scripts/g.gd")
var base_pos := Vector2.ZERO
var base_zoom := 1.0
var reduce := false
var trauma := 0.0
var intro := 1.0 # 0..1 over INTRO seconds
var intro_from := Vector2.ZERO
var intro_zoom := 1.45
var out_kind := ""
var out := 0.0
var _p := 0.0
var _pv := 0.0
var _tilt := 0.0
var _tv := 0.0
var _lean := Vector2.ZERO
var _lean_z := 0.0
var _push := 0.0
var _push_at := Vector2.ZERO
var _t := 0.0
const INTRO := 2.5
const HOLD := 0.3 # share of the intro spent on the hen before the crane starts

func reset(vault) -> void:
	intro = 1.0 if reduce else 0.0
	trauma = 0.0
	out_kind = ""
	out = 0.0
	_p = 0.0
	_pv = 0.0
	_tilt = 0.0
	_tv = 0.0
	_lean = Vector2.ZERO
	_lean_z = 0.0
	_push = 0.0
	rotation = 0.0
	offset = Vector2.ZERO
	if vault:
		intro_from = Vector2((vault.nest_x + vault.nest_w / 4 + 0.4) * G.PPM, (vault.ground_y - 1.9) * G.PPM)

func punch(k: float) -> void:
	if not reduce:
		_pv += k * 22.0

func kick(rad: float) -> void:
	if not reduce:
		_tv += rad * 30.0

func shake(amount: float) -> void:
	if not reduce:
		trauma = minf(1.0, trauma + amount)

func _n(seed: float) -> float:
	return sin(_t * 37.0 + seed) * 0.6 + sin(_t * 61.0 + seed * 2.3) * 0.4

func tick(dt: float, vault) -> void:
	if vault == null or not is_instance_valid(vault):
		rotation = 0.0
		offset = Vector2.ZERO
		return
	_t += dt
	intro = minf(1.0, intro + dt / INTRO)
	var u = clampf((intro - HOLD) / (1.0 - HOLD), 0.0, 1.0)
	var ki = u * u * u * (u * (u * 6.0 - 15.0) + 10.0)
	# follow the eggs that are moving, weighted by speed; lean in while something falls
	var want = Vector2.ZERO
	var want_z = 0.0
	var wsum = 0.0
	var acc = Vector2.ZERO
	var push_to = 0.0
	var nest = Vector2(vault.nest_x * G.PPM, (vault.ground_y - 0.45) * G.PPM)
	var live = 0
	for e in vault.eggs:
		if not is_instance_valid(e) or not e.alive or e.saved:
			continue
		live += 1
		var sp = e.linear_velocity.length() / G.PPM
		var w = clampf((sp - 0.5) / 3.5, 0.0, 1.0)
		acc += e.position * w
		wsum += w
		# out of the vault and on its way down: frame the drop and the nest
		if e.position.length() > (vault.outer_r + 0.12) * G.PPM and e.position.y > 0.0:
			push_to = 1.0
			_push_at = (e.position + nest) / 2.0
	if wsum > 0.0:
		want = (acc / wsum - base_pos) * 0.17 * minf(1.0, wsum)
		want = want.limit_length(110.0)
		want_z = 0.04 * minf(1.0, wsum)
	if reduce:
		want = Vector2.ZERO
		want_z = 0.0
		push_to = 0.0
	var a = 1.0 - exp(-dt * 3.2)
	_lean = _lean.lerp(want, a)
	_lean_z = lerpf(_lean_z, want_z, a)
	_push = lerpf(_push, push_to, 1.0 - exp(-dt * (5.0 if push_to > _push else 2.2)))
	if dt > 0.0:
		_pv += (-170.0 * _p - 15.0 * _pv) * dt
		_p += _pv * dt
		_tv += (-120.0 * _tilt - 9.0 * _tv) * dt
		_tilt += _tv * dt
	trauma = maxf(0.0, trauma - dt * 1.5)
	var zo = 0.0
	var po = Vector2.ZERO
	var roll = 0.0
	if out_kind != "":
		out = minf(1.0, out + dt / 1.0)
		var ko = out * out * (3.0 - 2.0 * out)
		if out_kind == "win":
			zo = (0.16 if reduce else 0.42) * ko
			po = (intro_from + Vector2(0, 30) - base_pos) * (0.4 if reduce else 0.78) * ko
			_push = lerpf(_push, 0.0, ko)
		elif not reduce:
			zo = -0.07 * ko
			roll = 0.03 * ko
	var pos = intro_from.lerp(base_pos, ki) + (_lean + po) * ki
	pos = pos.lerp(_push_at, _push * 0.38)
	var z = base_zoom * lerpf(intro_zoom, 1.0, ki) * (1.0 + _lean_z + _p + zo + _push * 0.2)
	zoom = Vector2(z, z)
	position = pos
	var s = trauma * trauma
	offset = Vector2(_n(1.0), _n(7.0)) * s * 20.0 / z
	rotation = _tilt + roll + (1.0 - ki) * -0.025 * u + _n(13.0) * s * 0.025
