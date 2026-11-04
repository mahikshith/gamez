# Mama Hen, the app mascot: a cut-out rig built from the SVG parts in assets/hen (designed in tools/hen/parts.mjs),
# rasterised once at start and posed every frame. Origin = between her feet. H = on-screen height in px.
#
# Behaviour is a small state machine of moods, each a pose function; switching mood blends over 0.18 s:
#   idle      breathes, blinks, looks around, and now and then fidgets (a hop, a wing stretch, a comb shake)
#   happy     soft bounce, happy eyes, wings a little open
#   worried   wings out and trembling, worried brows, small darting pupils, sweat drop
#   cheer     one-shot: crouch, big stretch jump with flapping wings, squash on landing
#   sad       slumped, eyes shut, brows up, tears, little sobs
#   wow       surprised: eyes wide, beak open, wings out
#   celebrate the win stage: a varied loop of jumps, a spin, a "ta-da" pose and a wing-clap; never the same order twice
# Secondary motion: the comb and tail lag behind the body on springs, feet tuck in the air, squash keeps volume.
extends Node2D

const DIR := "res://assets/hen/"
const CANVAS_H := 390.0 # comb top to feet in canvas units
const GROUND := Vector2(256, 470)
static var _tex := {}
static var _meta := {}

@export var H := 200.0
@export var face := 1
var mood := "idle"
var t := 0.0
var mt := 0.0
var _parts := {}
var _joints := {}
var _prev := {}
var _blend := 1.0
var _blink := 0.0
var _blink_next := 1.5
var _look := Vector2.ZERO
var _look_to := Vector2.ZERO
var _look_next := 1.0
var _fidget := ""
var _fidget_t := -1.0
var _fidget_next := 4.0
var _comb := Vector2.ZERO # x = angle, y = velocity
var _tail := Vector2.ZERO
var _last_lift := 0.0
var _last_vel := 0.0
var _tears := []
var _routine := []
var _step := 0
var _step_t := 0.0
var _rig: Node2D
var _face: Node2D

static func _load_parts() -> void:
	if not _meta.is_empty():
		return
	_meta = JSON.parse_string(FileAccess.get_file_as_string(DIR + "parts.json"))
	for id in _meta.order:
		var svg = FileAccess.get_file_as_string(DIR + id + ".svg")
		var img = Image.new()
		img.load_svg_from_string(svg, 1.0)
		img.generate_mipmaps()
		_tex[id] = ImageTexture.create_from_image(img)

func _ready() -> void:
	_load_parts()
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_rig = Node2D.new() # squash/stretch about the feet
	add_child(_rig)
	_face = Node2D.new() # eyes, beak, cheeks: shift together when she looks around
	var feet = Node2D.new()
	add_child(feet)
	move_child(feet, 0)
	for id in _meta.order:
		var m = _meta.parts[id]
		var pivot = Vector2(m.pivot[0], m.pivot[1])
		var j = Node2D.new()
		j.position = pivot - GROUND
		var s = Sprite2D.new()
		s.texture = _tex[id]
		s.centered = false
		s.offset = Vector2(m.x, m.y) - pivot
		j.add_child(s)
		_joints[id] = j
		_parts[id] = s
		if id.begins_with("foot"):
			feet.add_child(j)
		elif id in ["eye_l", "eye_r", "pupil_l", "pupil_r", "eyes_happy", "eyes_shut", "brows_worry", "brows_proud", "mouth", "beak_bot", "beak_top", "cheek_l", "cheek_r", "tear", "sweat"]:
			if _face.get_parent() == null:
				_rig.add_child(_face)
			_face.add_child(j)
		else:
			_rig.add_child(j)
	# wings in front of the face, tail behind the body
	_rig.move_child(_face, _rig.get_child_count() - 1)
	for w in ["wing_l", "wing_r"]:
		_rig.move_child(_joints[w], _rig.get_child_count() - 1)
	_joints.tail.get_parent().move_child(_joints.tail, 0)
	_parts.tear.visible = false
	_apply()

func set_mood(m: String) -> void:
	if m == mood and m != "cheer" and m != "wow":
		return
	_prev = _pose(mood)
	mood = m
	mt = 0.0
	_blend = 0.0
	if m == "celebrate":
		_new_routine()

# ---------------------------------------------------------------- celebrate routine
const MOVES := ["jump", "jump", "spin", "tada", "clap", "wiggle"]
func _new_routine() -> void:
	var pool = MOVES.duplicate()
	pool.shuffle()
	_routine = ["jump"] + pool.slice(0, 4) # always open with a big jump
	_step = 0
	_step_t = 0.0

func _move_len(m: String) -> float:
	return {"jump": 0.75, "spin": 0.8, "tada": 0.9, "clap": 0.9, "wiggle": 0.8}.get(m, 0.8)

# ---------------------------------------------------------------- per frame
func _process(dt: float) -> void:
	t += dt
	mt += dt
	_blend = minf(1.0, _blend + dt / 0.18)
	_blink_next -= dt
	if _blink_next <= 0.0:
		_blink = 0.13
		_blink_next = randf_range(2.2, 4.8)
	_blink = maxf(0.0, _blink - dt)
	_look_next -= dt
	if _look_next <= 0.0:
		_look_to = Vector2(randf_range(-1, 1), randf_range(-0.6, 0.6)) if randf() < 0.75 else Vector2.ZERO
		_look_next = randf_range(0.9, 2.6)
	_look = _look.lerp(_look_to, 1.0 - exp(-dt * 14.0))
	if mood == "idle":
		_fidget_next -= dt
		if _fidget_next <= 0.0 and _fidget_t < 0.0:
			_fidget = ["hop", "stretch", "shake"][randi() % 3]
			_fidget_t = 0.0
			_fidget_next = randf_range(4.0, 7.5)
	if _fidget_t >= 0.0:
		_fidget_t += dt
		if _fidget_t > 0.9:
			_fidget_t = -1.0
	if mood == "cheer" and mt > 1.2:
		set_mood("happy")
	if mood == "wow" and mt > 1.0:
		set_mood("idle")
	if mood == "celebrate":
		_step_t += dt
		if _step_t > _move_len(_routine[_step]):
			_step_t = 0.0
			_step += 1
			if _step >= _routine.size():
				_new_routine()
				_routine[0] = ["clap", "wiggle", "tada"][randi() % 3]
	if mood == "sad" and randf() < dt * 3.5:
		_tears.append({"side": randi() % 2, "y": 0.0, "v": 40.0, "life": 0.9})
	for d in _tears:
		d.v += 500.0 * dt
		d.y += d.v * dt
		d.life -= dt
	_tears = _tears.filter(func(d): return d.life > 0.0)
	_apply(dt)

# pose keys: lift, sx, sy, lean, wl, wr (wing deg), fl, fr (foot deg), tail, eyes ("open"/"happy"/"shut"),
# brows ("" / "worry" / "proud"), mouth (0..1), pupil (scale), eye (scale), sweat (0/1), turn (-1..1 body flip)
func _pose(m: String) -> Dictionary:
	var p = {"lift": 0.0, "sx": 1.0, "sy": 1.0, "lean": 0.0, "wl": 0.0, "wr": 0.0, "fl": 0.0, "fr": 0.0, "tail": 0.0,
		"eyes": "open", "brows": "", "mouth": 0.0, "pupil": 1.0, "eye": 1.0, "sweat": 0.0, "turn": 1.0}
	var br = sin(t * 2.6)
	p.sy = 1.0 + 0.018 * br
	p.sx = 1.0 - 0.012 * br
	p.wl = 4.0 * br
	p.wr = -4.0 * br
	match m:
		"idle":
			if _fidget_t >= 0.0:
				var u = _fidget_t / 0.9
				match _fidget:
					"hop":
						_jump(p, u, 34.0)
					"stretch":
						var k = sin(u * PI)
						p.wl = 95.0 * k
						p.wr = -95.0 * k
						p.sy += 0.08 * k
						p.sx -= 0.05 * k
						p.eyes = "happy" if k > 0.4 else "open"
					"shake":
						var k = sin(u * PI)
						p.lean = 8.0 * sin(u * 40.0) * k
						p.eyes = "shut" if k > 0.3 else "open"
		"happy":
			var b = absf(sin(t * 4.0))
			p.lift = 8.0 * b
			p.sy += 0.03 * b
			p.wl = 30.0 + 10.0 * sin(t * 8.0)
			p.wr = -30.0 - 10.0 * sin(t * 8.0)
			p.eyes = "happy"
			p.mouth = 0.5
		"worried":
			var sh = sin(t * 30.0)
			p.wl = 62.0 + 10.0 * sh
			p.wr = -62.0 - 10.0 * sh
			p.sx = 0.97 + 0.01 * sh
			p.sy = 1.04
			p.brows = "worry"
			p.pupil = 0.68
			p.eye = 1.06
			p.sweat = 1.0
			p.lean = 2.0 * sh
		"cheer":
			_jump(p, mt / 1.2, 90.0)
			p.eyes = "happy"
			p.mouth = 1.0
		"sad":
			var sob = maxf(0.0, sin(t * 7.0))
			p.sy = 0.93 + 0.02 * sob
			p.sx = 1.06 - 0.015 * sob
			p.lean = -4.0
			p.wl = -12.0
			p.wr = 12.0
			p.tail = -12.0
			p.eyes = "shut"
			p.brows = "worry"
			p.mouth = 0.25 * sob
		"wow":
			var k = minf(1.0, mt / 0.15)
			p.eye = 1.0 + 0.12 * k
			p.pupil = 0.85
			p.mouth = 1.0 * k
			p.wl = 100.0 * k
			p.wr = -100.0 * k
			p.sy = 1.0 + 0.07 * k
			p.sx = 1.0 - 0.05 * k
		"celebrate":
			_celebrate(p)
	return p

# anticipation (crouch), stretch on take-off, wings flap in the air, tuck feet, squash on landing, settle
func _jump(p: Dictionary, u: float, height: float) -> void:
	u = clampf(u, 0.0, 1.0)
	if u < 0.18:
		var k = u / 0.18
		p.sy = 1.0 - 0.16 * k
		p.sx = 1.0 + 0.12 * k
		p.wl = -10.0 * k
		p.wr = 10.0 * k
	elif u < 0.75:
		var k = (u - 0.18) / 0.57
		var arc = sin(k * PI)
		p.lift = height * arc
		var st = maxf(0.0, 1.0 - k * 2.2)
		p.sy = 1.0 + 0.14 * st
		p.sx = 1.0 - 0.1 * st
		var flap = sin(t * 34.0)
		p.wl = 105.0 + 30.0 * flap
		p.wr = -105.0 - 30.0 * flap
		p.fl = 30.0 * arc
		p.fr = -30.0 * arc
		p.tail = 18.0 * arc
	else:
		var k = (u - 0.75) / 0.25
		var sq = sin(k * PI) * (1.0 - k * 0.5)
		p.sy = 1.0 - 0.14 * sq
		p.sx = 1.0 + 0.1 * sq
		p.wl = 40.0 * (1.0 - k)
		p.wr = -40.0 * (1.0 - k)

func _celebrate(p: Dictionary) -> void:
	var m = _routine[_step] if _routine.size() > 0 else "jump"
	var u = _step_t / _move_len(m)
	p.eyes = "happy"
	p.mouth = 0.8
	match m:
		"jump":
			_jump(p, u, 110.0)
			# wide-eyed, beak-open "woo!" in the air, happy squint on the ground
			if u > 0.2 and u < 0.78:
				p.eyes = "open"
				p.eye = 1.1
				p.pupil = 1.15
				p.mouth = 1.0
		"spin":
			# a hop with a full turn: flip through the side view
			_jump(p, u, 70.0)
			var k = clampf((u - 0.2) / 0.55, 0.0, 1.0)
			p.turn = cos(k * TAU)
		"tada":
			var k = minf(1.0, u / 0.2)
			var hold = sin(u * PI)
			p.wl = 150.0 * k
			p.wr = -150.0 * k
			p.sy = 1.0 + 0.1 * hold
			p.sx = 1.0 - 0.07 * hold
			p.lift = 10.0 * hold
			p.eyes = "open" if u > 0.3 and u < 0.85 else "happy"
			p.pupil = 1.1
			p.mouth = 1.0
			p.brows = "proud"
		"clap":
			var c = absf(sin(u * PI * 4.0))
			p.wl = 70.0 + 50.0 * c
			p.wr = -70.0 - 50.0 * c
			p.lift = 12.0 * c
			p.sy = 1.0 + 0.04 * c
		"wiggle":
			var w = sin(u * TAU * 2.0)
			p.lean = 10.0 * w
			p.lift = 6.0 * absf(w)
			p.wl = 60.0 + 30.0 * w
			p.wr = -60.0 + 30.0 * w
			p.tail = 20.0 * w

func _mix() -> Dictionary:
	var p = _pose(mood)
	if _blend >= 1.0 or _prev.is_empty():
		return p
	var k = smoothstep(0.0, 1.0, _blend)
	for key in p:
		if p[key] is float:
			p[key] = lerpf(_prev[key], p[key], k)
		elif k < 0.5:
			p[key] = _prev[key]
	return p

func _apply(dt := 0.016) -> void:
	if _rig == null:
		return
	var p = _mix()
	var s = H / CANVAS_H
	scale = Vector2(s * face, s)
	# body flip for the spin (cheap 2.5D turn)
	var turn: float = p.turn
	position.y = position.y # root stays where the parent put it
	_rig.position = Vector2(0, -p.lift)
	_rig.rotation_degrees = p.lean
	_rig.scale = Vector2(p.sx * (turn if absf(turn) > 0.08 else 0.08 * signf(turn + 0.0001)), p.sy)
	for f in ["foot_l", "foot_r"]:
		_joints[f].get_parent().position = Vector2(0, -p.lift * 0.92)
	_joints.foot_l.rotation_degrees = p.fl
	_joints.foot_r.rotation_degrees = p.fr
	_joints.wing_l.rotation_degrees = p.wl
	_joints.wing_r.rotation_degrees = p.wr
	# springs: comb and tail lag behind vertical motion
	var vel = (p.lift - _last_lift) / maxf(dt, 0.001)
	var acc = (vel - _last_vel) / maxf(dt, 0.001)
	_last_lift = p.lift
	_last_vel = vel
	_comb.y += (-_comb.x * 220.0 - _comb.y * 12.0 + clampf(acc, -6000.0, 6000.0) * 0.004) * dt
	_comb.x += _comb.y * dt
	_joints.comb.rotation_degrees = clampf(_comb.x, -25.0, 25.0) + p.lean * 0.4
	_tail.y += (-_tail.x * 160.0 - _tail.y * 9.0 + clampf(acc, -6000.0, 6000.0) * 0.003) * dt
	_tail.x += _tail.y * dt
	_joints.tail.rotation_degrees = p.tail + clampf(_tail.x, -20.0, 20.0)
	# face
	var happy = p.eyes == "happy"
	var shut = p.eyes == "shut"
	var open = not happy and not shut
	var bl = 0.1 if _blink > 0.0 and open else 1.0
	for e in ["eye_l", "eye_r"]:
		_parts[e].visible = open
		_joints[e].scale = Vector2(p.eye, p.eye * bl)
	for e in ["pupil_l", "pupil_r"]:
		_parts[e].visible = open and bl > 0.5
		_joints[e].scale = Vector2.ONE * p.pupil
		_joints[e].position = _base(e) + _look * Vector2(14, 10)
	_parts.eyes_happy.visible = happy
	_parts.eyes_shut.visible = shut
	_parts.brows_worry.visible = p.brows == "worry"
	_parts.brows_proud.visible = p.brows == "proud"
	var mo: float = p.mouth
	_parts.mouth.visible = mo > 0.05
	_parts.beak_bot.visible = mo > 0.05
	_joints.mouth.scale = Vector2(1.0, 0.4 + 0.9 * mo)
	_joints.beak_bot.position = _base("beak_bot") + Vector2(0, 16.0 * mo)
	_parts.sweat.visible = p.sweat > 0.5
	_joints.sweat.position = _base("sweat") + Vector2(0, fmod(t * 40.0, 24.0))
	_face.position = _look * Vector2(5, 3)
	queue_redraw()

func _base(id: String) -> Vector2:
	var m = _meta.parts[id]
	return Vector2(m.pivot[0], m.pivot[1]) - GROUND

func _draw() -> void:
	# ground shadow shrinks as she leaves the ground
	var lift = _rig.position.y if _rig else 0.0
	var k = 1.0 - clampf(-lift / 160.0, 0.0, 0.55)
	var pts = PackedVector2Array()
	for i in 32:
		var a = TAU * i / 32.0
		pts.append(Vector2(cos(a) * 118.0 * k, 4.0 + sin(a) * 15.0 * k))
	draw_colored_polygon(pts, Color(0.24, 0.12, 0.0, 0.16))
	# tears fall from the shut eyes
	for d in _tears:
		var x = -86.0 if d.side == 0 else 104.0
		var c = Vector2(x, -228.0 + d.y) + _rig.position
		var a = clampf(d.life / 0.3, 0.0, 1.0)
		var tp = PackedVector2Array([c + Vector2(0, -14), c + Vector2(9, 2), c + Vector2(0, 10), c + Vector2(-9, 2)])
		draw_colored_polygon(tp, Color(0.5, 0.82, 1.0, a))
