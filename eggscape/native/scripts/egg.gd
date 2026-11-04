# An egg: rigid body with an egg-shaped hull. Measures the approach speed of every new contact and reports it to
# the vault, which applies the crack rules. Draws itself: shell shading, cracks, a face that reacts to falling.
extends RigidBody2D

const G = preload("res://scripts/g.gd")
signal hit(egg, kind: String, speed: float, node: Node)

var cracks = 0
var crack_lines = []
var crack_cd = 0.0
var fire = 0.0
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
	_keys = now
	_pv = state.linear_velocity

func _physics_process(dt: float) -> void:
	crack_cd = maxf(0.0, crack_cd - dt)
	safe_t = maxf(0.0, safe_t - dt)
	if fire > 0.0:
		fire = maxf(0.0, fire - dt)
	_flame.emitting = fire > 0.0 and alive

func _process(dt: float) -> void:
	t += dt
	var sp = linear_velocity.length() / G.PPM
	fear = move_toward(fear, 1.0 if (sp > 3.2 and linear_velocity.y > 0.0) else 0.0, dt * 4.0)
	queue_redraw()

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

func _draw() -> void:
	var s = G.PPM
	# body (the hull rotates with the body; the face below counter-rotates to stay upright-ish)
	var base = Color("FFF8EC") if fire <= 0.0 else Color("FFE2BC")
	# soft contact shadow so the egg sits on the vault, not on top of the screen
	var sh_pts = PackedVector2Array()
	for p in _hull:
		sh_pts.append(p * 1.04 + Vector2(0, 3).rotated(-rotation))
	draw_colored_polygon(sh_pts, Color(0.05, 0.1, 0.15, 0.22))
	draw_colored_polygon(_hull, base)
	# shade crescent on the lower right: hull minus itself shifted up-left
	var off = PackedVector2Array()
	for p in _hull:
		off.append(p * 0.97 + Vector2(-5, -6))
	for poly in Geometry2D.clip_polygons(_hull, off):
		draw_colored_polygon(poly, Color("F2D6AA"))
	draw_colored_polygon(G.ellipse(Vector2(-7, -12), 4.5, 7.5, 14, -0.3), Color(1, 1, 1, 0.9))
	for c in crack_lines:
		draw_polyline(c, Color("8A5A2E"), 2.2, true)
	# face: counter-rotate so the eyes stay level
	draw_set_transform(Vector2.ZERO, -rotation * 0.8, Vector2.ONE)
	var look = linear_velocity.normalized() * 1.5 if linear_velocity.length() > 30.0 else Vector2.ZERO
	var er = lerpf(2.6, 4.0, fear)
	for side in [-1, 1]:
		var e = Vector2(side * 6.0, 2.0)
		if fear > 0.5:
			draw_circle(e, er + 1.2, Color.WHITE)
			draw_circle(e + look, er * 0.6, Color("3A2618"))
		else:
			var blink = fmod(t, 3.7) < 0.12
			if blink:
				draw_line(e + Vector2(-2.5, 0), e + Vector2(2.5, 0), Color("3A2618"), 2.0, true)
			else:
				draw_circle(e + look, er, Color("3A2618"))
				draw_circle(e + look + Vector2(-0.8, -1.0), 0.9, Color.WHITE)
	if fear > 0.5:
		draw_circle(Vector2(0, 10), 2.6, Color("3A2618"))
	else:
		draw_arc(Vector2(0, 7), 3.0, 0.3, PI - 0.3, 8, Color("3A2618"), 1.6, true)
	draw_circle(Vector2(-10, 8), 2.5, Color(1, 0.5, 0.5, 0.45))
	draw_circle(Vector2(10, 8), 2.5, Color(1, 0.5, 0.5, 0.45))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
