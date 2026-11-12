# Particle effects with baked textures (assets/fx, see tools/make-fx.py): GPU particles, one-shot bursts that free
# themselves. Everything the vault, the hen and the end screens throw into the air comes from here.
extends RefCounted

const DUST = preload("res://assets/fx/dust.png")
const SPARK = preload("res://assets/fx/spark.png")
const GLOW = preload("res://assets/fx/glow.png")
const FEATHER = preload("res://assets/fx/feather.png")
const CHIPS = preload("res://assets/fx/chips.png")
const CONFETTI = preload("res://assets/fx/confetti.png")

static var _frames := {}

static func _sheet(n: int, additive := false) -> CanvasItemMaterial:
	var key = n * 2 + (1 if additive else 0)
	if not _frames.has(key):
		var m = CanvasItemMaterial.new()
		if n > 1:
			m.particles_animation = true
			m.particles_anim_h_frames = n
			m.particles_anim_v_frames = 1
			m.particles_anim_loop = false
		if additive:
			m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
		_frames[key] = m
	return _frames[key]

static func _fade(c0: Color, c1: Color, hold := 0.6) -> GradientTexture1D:
	var g = Gradient.new()
	g.offsets = PackedFloat32Array([0.0, hold, 1.0])
	g.colors = PackedColorArray([c0, c0.lerp(c1, 0.3), c1])
	var t = GradientTexture1D.new()
	t.gradient = g
	t.width = 32
	return t

static func _curve(a: float, b: float, c := -1.0) -> CurveTexture:
	var cv = Curve.new()
	cv.add_point(Vector2(0, a))
	if c >= 0.0:
		cv.add_point(Vector2(0.3, c))
	cv.add_point(Vector2(1, b))
	var t = CurveTexture.new()
	t.curve = cv
	t.width = 32
	return t

# o: tex, n, life, dir (Vector2), spread (deg), v0, v1, grav (Vector2), size0, size1 (px), damp, spin (deg/s),
#    c0, c1 (colour over life), scale (CurveTexture), frames, additive, radius (emission), colors (Gradient: random tint)
static func burst(parent: Node, at: Vector2, o: Dictionary) -> GPUParticles2D:
	var ps = GPUParticles2D.new()
	var tex: Texture2D = o.get("tex", DUST)
	ps.texture = tex
	ps.one_shot = true
	ps.explosiveness = o.get("explosive", 0.94)
	ps.amount = maxi(1, int(o.get("n", 8)))
	ps.lifetime = o.get("life", 0.6)
	ps.local_coords = false
	var frames = int(o.get("frames", 1))
	if frames > 1 or o.get("additive", false):
		ps.material = _sheet(frames, o.get("additive", false))
	var m = ParticleProcessMaterial.new()
	var d: Vector2 = o.get("dir", Vector2.UP)
	m.direction = Vector3(d.x, d.y, 0)
	m.spread = o.get("spread", 180.0)
	m.initial_velocity_min = o.get("v0", 40.0)
	m.initial_velocity_max = o.get("v1", 120.0)
	var g: Vector2 = o.get("grav", Vector2.ZERO)
	m.gravity = Vector3(g.x, g.y, 0)
	var px = float(tex.get_height())
	m.scale_min = o.get("size0", 16.0) / px
	m.scale_max = o.get("size1", 28.0) / px
	m.damping_min = o.get("damp", 0.0)
	m.damping_max = o.get("damp", 0.0) * 1.4
	var spin = o.get("spin", 0.0)
	m.angular_velocity_min = -spin
	m.angular_velocity_max = spin
	m.angle_min = 0.0
	m.angle_max = 360.0 if o.get("rand_angle", true) else 0.0
	if o.has("radius"):
		m.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
		m.emission_sphere_radius = o.radius
	m.color_ramp = _fade(o.get("c0", Color.WHITE), o.get("c1", Color(1, 1, 1, 0)), o.get("hold", 0.6))
	if o.has("colors"):
		var gt = GradientTexture1D.new()
		gt.gradient = o.colors
		gt.width = 16
		m.color_initial_ramp = gt
	if o.has("scale"):
		m.scale_curve = o.scale
	if frames > 1:
		m.anim_offset_min = 0.0
		m.anim_offset_max = 1.0
	ps.process_material = m
	parent.add_child(ps)
	ps.global_position = at
	ps.emitting = true
	ps.finished.connect(ps.queue_free)
	return ps

# ---------------------------------------------------------------- the game's effects
static func dust(parent: Node, at: Vector2, normal: Vector2, power: float, tint := Color("EADBC3")) -> void:
	# a puff that hugs the surface and spreads away from the hit; bigger and faster the harder the landing
	var k = clampf(power, 0.0, 1.0)
	burst(parent, at, {"tex": DUST, "n": int(3 + 9 * k), "life": 0.35 + 0.35 * k, "dir": normal, "spread": 70.0, "v0": 20.0 + 60.0 * k,
		"v1": 60.0 + 190.0 * k, "damp": 160.0, "size0": 14.0 + 12.0 * k, "size1": 22.0 + 30.0 * k, "spin": 60.0,
		"c0": Color(tint, 0.55 + 0.25 * k), "c1": Color(tint, 0.0), "hold": 0.25, "scale": _curve(0.5, 1.5, 1.0)})

static func sparks(parent: Node, at: Vector2, n: int, col := Color(1.0, 0.92, 0.6), speed := 260.0, size := 20.0) -> void:
	burst(parent, at, {"tex": SPARK, "n": n, "life": 0.5, "spread": 180.0, "v0": speed * 0.35, "v1": speed, "damp": speed * 1.6,
		"size0": size * 0.6, "size1": size * 1.3, "spin": 200.0, "c0": col, "c1": Color(col, 0.0), "hold": 0.4, "additive": true,
		"scale": _curve(1.0, 0.0, 1.2)})

static func shell(parent: Node, at: Vector2, n: int, speed := 320.0) -> void:
	burst(parent, at, {"tex": CHIPS, "frames": 4, "n": n, "life": 0.9, "dir": Vector2.UP, "spread": 150.0, "v0": speed * 0.35, "v1": speed,
		"grav": Vector2(0, 1300), "size0": 14.0, "size1": 26.0, "spin": 520.0, "c0": Color.WHITE, "c1": Color(1, 1, 1, 0), "hold": 0.8})

static func yolk(parent: Node, at: Vector2, n: int, up := 220.0) -> void:
	var cols = Gradient.new()
	cols.colors = PackedColorArray([Color("FFD23A"), Color("FF9F1A")])
	burst(parent, at, {"tex": GLOW, "n": n, "life": 0.7, "dir": Vector2.UP, "spread": 75.0, "v0": up * 0.3, "v1": up, "grav": Vector2(0, 1200),
		"size0": 12.0, "size1": 22.0, "c0": Color(1, 1, 1, 1), "c1": Color(1, 1, 1, 0), "hold": 0.8, "colors": cols, "scale": _curve(1.0, 0.5)})

static func feathers(parent: Node, at: Vector2, n: int, dir := Vector2.UP, speed := 320.0) -> void:
	burst(parent, at, {"tex": FEATHER, "n": n, "life": 1.5, "dir": dir, "spread": 60.0, "v0": speed * 0.4, "v1": speed, "damp": speed * 1.1,
		"grav": Vector2(0, 150), "size0": 26.0, "size1": 42.0, "spin": 150.0, "c0": Color.WHITE, "c1": Color(1, 1, 1, 0), "hold": 0.75, "explosive": 0.9})

static func smoke(parent: Node, at: Vector2, n: int, col := Color(0.3, 0.25, 0.2)) -> void:
	burst(parent, at, {"tex": DUST, "n": n, "life": 0.9, "dir": Vector2.UP, "spread": 60.0, "v0": 30.0, "v1": 100.0, "grav": Vector2(0, -160),
		"size0": 22.0, "size1": 44.0, "spin": 50.0, "c0": Color(col, 0.75), "c1": Color(col, 0.0), "hold": 0.3, "scale": _curve(0.6, 1.6)})

static func confetti(parent: Node, at: Vector2, dir: Vector2, n: int, speed := 1100.0, spread := 30.0) -> GPUParticles2D:
	var cols = Gradient.new()
	cols.offsets = PackedFloat32Array([0.0, 0.2, 0.4, 0.6, 0.8, 1.0])
	cols.colors = PackedColorArray([Color("FF5148"), Color("FFC21A"), Color("4FC21A"), Color("1EA7F0"), Color("B07CF2"), Color("FF8A1F")])
	cols.interpolation_mode = Gradient.GRADIENT_INTERPOLATE_CONSTANT
	return burst(parent, at, {"tex": CONFETTI, "frames": 4, "n": n, "life": 2.8, "dir": dir, "spread": spread, "v0": speed * 0.55, "v1": speed,
		"grav": Vector2(0, 900), "damp": 220.0, "size0": 18.0, "size1": 30.0, "spin": 420.0, "c0": Color.WHITE, "c1": Color(1, 1, 1, 0),
		"hold": 0.85, "colors": cols, "explosive": 0.88})

# a soft additive light pool (child sprite): fire, orbs, the nest's welcome glow
static func light(parent: Node, col: Color, size: float) -> Sprite2D:
	var s = Sprite2D.new()
	s.texture = GLOW
	s.modulate = col
	s.scale = Vector2.ONE * size / 128.0
	s.material = _sheet(1, true)
	parent.add_child(s)
	return s
