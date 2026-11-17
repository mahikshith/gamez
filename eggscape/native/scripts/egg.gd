# An egg: rigid body with an egg-shaped hull. Measures the approach speed of every new contact and reports it to
# the vault, which applies the crack rules. Draws itself: shell shading, cracks, a face that reacts to falling.
extends RigidBody2D

const G = preload("res://scripts/g.gd")
signal hit(egg, kind: String, speed: float, node: Node)
# cosmetic twin of `hit`: every new contact with where it happened, for dust, sound and the squash
signal bump(egg, kind: String, speed: float, at: Vector2, normal: Vector2)

var cracks = 0
var crack_lines = []
var crack_cd = 0.0
var fire = 0.0
var fire_kind = ""
var glow = 0.0
var curse = 0.0
var ch = 0
var freefall = 0
var drop = 0
var mult = 1
var gates = {}
var portal_cd = 0.0
var thf = 0 # 1 = in a weasel's jaws, 2 = stashed in its den
var alive = true
var saved = false
var nest_t = 0.0
var fear = 0.0
var safe_t = 1.2
var _pv = Vector2.ZERO
var _keys = {}
var _hull: PackedVector2Array
var _flame: CPUParticles2D
var t = randf() * 10.0
var sq = 0.0 # squash spring along sq_dir (world): < 0 squashed, > 0 stretched
var sq_v = 0.0
var sq_dir = Vector2.UP
var joy = 0.0
var _stretch = 0.0
var _blink = randf() * 3.0
var _chips = []

func _init() -> void:
	mass = 1.0
	gravity_scale = 1.0
	continuous_cd = RigidBody2D.CCD_MODE_CAST_SHAPE
	contact_monitor = true
	max_contacts_reported = 8
	angular_damp = 0.35
	linear_damp = 0.02
	can_sleep = false
	var m = PhysicsMaterial.new()
	m.friction = 0.5
	m.bounce = 0.12
	physics_material_override = m
	collision_layer = 2
	collision_mask = 1 | 2 | 8 | 16
	var cp = CollisionPolygon2D.new()
	cp.polygon = G.egg(12)
	add_child(cp)
	_hull = G.egg(28)

func _ready() -> void:
	_flame = CPUParticles2D.new()
	_flame.emitting = false
	_flame.amount = 26
	_flame.lifetime = 0.5
	_flame.local_coords = false
	_flame.emission_shape = CPUParticles2D.EMISSION_SHAPE_SPHERE
	_flame.emission_sphere_radius = 14.0
	_flame.direction = Vector2(0, -1)
	_flame.spread = 25.0
	_flame.gravity = Vector2(0, -260)
	_flame.initial_velocity_min = 20.0
	_flame.initial_velocity_max = 60.0
	_flame.scale_amount_min = 6.0
	_flame.scale_amount_max = 11.0
	var ramp = Gradient.new()
	ramp.set_color(0, Color(1.0, 0.95, 0.5, 1.0))
	ramp.set_color(1, Color(0.9, 0.15, 0.05, 0.0))
	ramp.add_point(0.4, Color(1.0, 0.55, 0.1, 0.9))
	_flame.color_ramp = ramp
	var curve = Curve.new()
	curve.add_point(Vector2(0, 1))
	curve.add_point(Vector2(1, 0.2))
	_flame.scale_amount_curve = curve
	add_child(_flame)

func _integrate_forces(state: PhysicsDirectBodyState2D) -> void:
	var now = {}
	for i in state.get_contact_count():
		var obj = state.get_contact_collider_object(i)
		if obj == null:
			continue
		var shape_i = state.get_contact_collider_shape(i)
		var key = "%d:%d" % [obj.get_instance_id(), shape_i]
		now[key] = true
		if _keys.has(key):
			continue
		var node: Node = obj
		var kind = "seg"
		if obj is CollisionObject2D:
			var owner_id: int = obj.shape_find_owner(shape_i)
			var o: Object = obj.shape_owner_get_owner(owner_id)
			if o is Node:
				node = o
				kind = o.get_meta("kind", "seg")
		if obj is RigidBody2D and obj.has_method("crack"):
			kind = "egg"
		var n = state.get_contact_local_normal(i)
		var rel = _pv - state.get_contact_collider_velocity_at_position(i)
		var v = absf(rel.dot(n)) / G.PPM
		hit.emit(self, kind, v, node)
		if v > 0.7:
			sq_dir = n
			sq_v -= minf(v, 7.0) * 1.5
		bump.emit(self, kind, v, state.get_contact_collider_position(i), n)
	_keys = now
	_pv = state.linear_velocity

func _physics_process(dt: float) -> void:
	crack_cd = maxf(0.0, crack_cd - dt)
	safe_t = maxf(0.0, safe_t - dt)
	portal_cd = maxf(0.0, portal_cd - dt)
	glow = maxf(0.0, glow - dt)
	curse = maxf(0.0, curse - dt)
	if fire > 0.0:
		fire = maxf(0.0, fire - dt)
	_flame.emitting = fire > 0.0 and alive

func _process(dt: float) -> void:
	t += dt
	var sp = linear_velocity.length() / G.PPM
	fear = move_toward(fear, 1.0 if (sp > 3.2 and linear_velocity.y > 0.0 and not saved) else 0.0, dt * 4.0)
	joy = move_toward(joy, 1.0 if saved else 0.0, dt * 5.0)
	# squash spring, and a stretch along the fall while it drops
	sq_v += (-260.0 * sq - 17.0 * sq_v) * dt
	sq = clampf(sq + sq_v * dt, -0.24, 0.2)
	_stretch = lerpf(_stretch, clampf((sp - 2.0) / 5.0, 0.0, 1.0) * 0.13 if not saved else 0.0, 1.0 - exp(-dt * 10.0))
	queue_redraw()

# a little hop of joy (the nest calls it when the egg is home)
func cheer() -> void:
	sq_dir = Vector2.UP
	sq_v = 3.2

func mend() -> void:
	cracks = 0
	crack_lines.clear()
	_chips.clear()

func crack() -> void:
	cracks += 1
	crack_cd = 0.3
	var start = Vector2(randf_range(-10, 10), randf_range(-14, 8))
	var pts = PackedVector2Array([start])
	var dir = Vector2.from_angle(randf() * TAU)
	for k in 4:
		start += dir.rotated(randf_range(-0.9, 0.9)) * randf_range(5, 9)
		pts.append(start)
	crack_lines.append(pts)
	# branch: a short spur off the middle so it reads as a fracture, not a scratch
	var mid = pts[2]
	crack_lines.append(PackedVector2Array([mid, mid + dir.rotated(1.3) * randf_range(5, 8), mid + dir.rotated(1.0) * randf_range(9, 13)]))
	if cracks >= 2:
		_chips.append(Vector2.from_angle(randf() * TAU))

func _draw() -> void:
	# everything is drawn in a frame that squashes / stretches along a world direction while the hull turns with the body
	var s = sq
	var dirn: Vector2 = sq_dir
	var vel = linear_velocity
	if _stretch > absf(s) and vel.length() > 1.0:
		s = _stretch
		dirn = vel.normalized()
	var ax = dirn.rotated(-rotation)
	var k1 = 1.0 + s
	var k2 = 1.0 / sqrt(maxf(0.5, k1))
	var px = Vector2(-ax.y, ax.x)
	var m = Transform2D(Vector2(ax.x * ax.x * k1 + px.x * px.x * k2, ax.y * ax.x * k1 + px.y * px.x * k2),
		Vector2(ax.x * ax.y * k1 + px.x * px.y * k2, ax.y * ax.y * k1 + px.y * px.y * k2), ax * (minf(s, 0.0) * 24.0))
	var up = Vector2.UP.rotated(-rotation)
	var lt = Vector2(-0.55, -0.83).rotated(-rotation) # toward the light, in body space
	# contact shadow (not squashed), then auras
	draw_colored_polygon(G.ellipse(-up * 7.0 + lt * -5.0, 24.0, 27.0, 20), Color(0.02, 0.05, 0.1, 0.22))
	if glow > 0.0:
		draw_circle(Vector2.ZERO, 40.0, Color(0.42, 0.88, 0.42, 0.35 * minf(1.0, glow)))
	if curse > 0.0:
		draw_circle(Vector2.ZERO, 38.0, Color(0.6, 0.35, 0.95, 0.22 + 0.1 * sin(t * 12.0)))
	if fire > 0.0:
		draw_circle(Vector2.ZERO, 36.0 + 2.0 * sin(t * 17.0), Color(1.0, 0.6, 0.15, 0.35))
	draw_set_transform_matrix(m)
	# outline
	var ol = PackedVector2Array()
	for p in _hull:
		ol.append(p + p.normalized() * 2.6)
	draw_colored_polygon(ol, Color("6B4A2A") if fire <= 0.0 else Color("9A3A0A"))
	# shell: a fan from the lit spot out to the rim, the rim darker away from the light
	var lit = Color("FFFEF8") if fire <= 0.0 else Color("FFF1C9")
	var mid = Color("FFF1DA") if fire <= 0.0 else Color("FFC98A")
	var dark = Color("E2B981") if fire <= 0.0 else Color("F08A3C")
	var c0 = lt * 8.0
	var pts = PackedVector2Array([c0])
	var cols = PackedColorArray([lit])
	var idx = PackedInt32Array()
	var n = _hull.size()
	for i in n:
		var p = _hull[i]
		pts.append(p)
		var away = clampf(0.5 - 0.5 * p.normalized().dot(lt), 0.0, 1.0)
		cols.append(mid.lerp(dark, smoothstep(0.35, 1.0, away)))
		idx.append_array([0, 1 + i, 1 + (i + 1) % n])
	RenderingServer.canvas_item_add_triangle_array(get_canvas_item(), idx, pts, cols, PackedVector2Array(), PackedInt32Array(), PackedFloat32Array(), RID(), -1)
	# specular + soft bounce on the shaded side
	draw_colored_polygon(G.ellipse(lt * 14.0, 4.2, 7.0, 14, lt.angle() + PI / 2), Color(1, 1, 1, 0.95))
	draw_circle(lt * 7.0 + Vector2(-lt.y, lt.x) * -7.0, 1.8, Color(1, 1, 1, 0.8))
	for c in crack_lines:
		draw_polyline(c, Color("5A371A"), 2.6, true)
		var hl = PackedVector2Array()
		for p in c:
			hl.append(p + Vector2(1.2, 1.2))
		draw_polyline(hl, Color(1, 1, 1, 0.55), 1.0, true)
	for ch in _chips:
		# a chipped notch on the rim: a dark wedge with a pale lip
		var a = ch.angle()
		var e0 = _hull[int(fposmod(a, TAU) / TAU * n) % n]
		draw_colored_polygon(PackedVector2Array([e0 * 1.04, e0 * 0.7 + Vector2(-e0.y, e0.x).normalized() * 5.0, e0 * 0.74 - Vector2(-e0.y, e0.x).normalized() * 4.0]), Color("5A371A"))
	# face: stays nearly upright in the world while the shell rolls
	var fm = m * Transform2D(-rotation * 0.85, Vector2.ZERO)
	draw_set_transform_matrix(fm)
	var ink = Color("3A2618")
	var look = vel.normalized() * 1.6 if vel.length() > 30.0 else Vector2.ZERO
	_blink -= get_process_delta_time()
	if _blink < -0.12:
		_blink = randf_range(2.0, 4.5)
	for side in [-1, 1]:
		var e = Vector2(side * 7.0, 1.0)
		if joy > 0.5:
			draw_arc(e + Vector2(0, 1.5), 3.6, PI + 0.35, TAU - 0.35, 8, ink, 2.2, true)
		elif fear > 0.5:
			draw_circle(e, 5.4, ink)
			draw_circle(e, 4.4, Color.WHITE)
			draw_circle(e + look, 2.3, ink)
		elif _blink < 0.0:
			draw_line(e + Vector2(-3.0, 0), e + Vector2(3.0, 0), ink, 2.2, true)
		else:
			draw_circle(e + look, 3.4, ink)
			draw_circle(e + look + Vector2(-1.0, -1.2), 1.25, Color.WHITE)
	if joy > 0.5:
		draw_colored_polygon(PackedVector2Array([Vector2(-4, 7), Vector2(4, 7), Vector2(2.4, 11.5), Vector2(-2.4, 11.5)]), ink)
	elif fear > 0.5:
		draw_colored_polygon(G.ellipse(Vector2(0, 11), 3.0, 3.8, 12), ink)
	else:
		draw_arc(Vector2(0, 7), 3.4, 0.35, PI - 0.35, 8, ink, 1.9, true)
	draw_circle(Vector2(-12.5, 8), 3.0, Color(1, 0.45, 0.45, 0.5))
	draw_circle(Vector2(12.5, 8), 3.0, Color(1, 0.45, 0.45, 0.5))
	draw_set_transform_matrix(Transform2D.IDENTITY)
