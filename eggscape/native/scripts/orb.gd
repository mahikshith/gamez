# A power orb floating in a channel (the vault moves it: see vault._move_orb). An egg that touches it takes the power:
# fire_red burns thorns and curtains for 6 s, fire_green mends every crack, twin adds an egg, curse makes the fuse run
# double for 6 s, thorn (a boss throw) cracks the egg. Flat art, one look per kind, gently pulsing.
extends Area2D

const G = preload("res://scripts/g.gd")
signal taken(orb, egg)
var kind = "fire_red"
var t = 0.0
var used = false
# motion state, owned by the vault
var ch = 1
var a = 0.0
var rad = 1.0
var ph = 0.0
var sway = 1.0
var src = "start"
var flying = false

func _ready() -> void:
	collision_layer = 0
	collision_mask = 2
	var cs = CollisionShape2D.new()
	var c = CircleShape2D.new()
	c.radius = 0.24 * G.PPM
	cs.shape = c
	add_child(cs)
	body_entered.connect(_on_body)
	z_index = 2

func _on_body(b: Node) -> void:
	if used or not b.has_method("crack") or not b.alive or b.saved:
		return
	used = true
	taken.emit(self, b)
	var tw = create_tween()
	tw.tween_property(self, "scale", Vector2(1.8, 1.8), 0.18)
	tw.parallel().tween_property(self, "modulate:a", 0.0, 0.18)
	tw.tween_callback(queue_free)

func _process(dt: float) -> void:
	t += dt
	queue_redraw()

func _flame(r: float, outer: Color, mid: Color, core: Color, hot: Color) -> void:
	draw_circle(Vector2.ZERO, r, outer)
	draw_circle(Vector2(0, r * 0.12), r * 0.86, mid)
	var f = PackedVector2Array()
	for i in 28:
		var q = TAU * i / 28.0
		var up = maxf(0.0, -sin(q))
		var rr = r * 0.55 * (1.0 + 0.55 * up * up + 0.05 * sin(q * 5.0 + t * 10.0))
		f.append(Vector2(cos(q) * rr * (0.8 - 0.35 * up), sin(q) * rr + r * 0.15))
	draw_colored_polygon(f, core)
	draw_colored_polygon(G.ellipse(Vector2(0, r * 0.28), r * 0.2, r * 0.27, 14), hot)

func _draw() -> void:
	var r = 0.2 * G.PPM * (1.0 + 0.05 * sin(t * 5.0))
	var halo: Color = {"fire_red": Color(1.0, 0.55, 0.15), "fire_green": Color(0.35, 0.85, 0.35), "twin": Color(1.0, 0.55, 0.7),
		"curse": Color(0.6, 0.35, 0.95), "thorn": Color(0.85, 0.25, 0.2)}.get(kind, Color.WHITE)
	draw_circle(Vector2.ZERO, r * 1.7, Color(halo, 0.16))
	draw_circle(Vector2.ZERO, r * 1.3, Color(halo, 0.22))
	match kind:
		"fire_green":
			_flame(r, Color("2FA84A"), Color("47C25E"), Color("B6F27A"), Color("F0FFD8"))
		"twin":
			draw_circle(Vector2.ZERO, r, Color("FF7FA8"))
			draw_circle(Vector2(0, r * 0.12), r * 0.86, Color("FF9DBC"))
			for sx in [-1, 1]:
				var c = Vector2(sx * r * 0.32, r * 0.08 + sx * r * 0.06)
				draw_colored_polygon(_egg_at(c, r * 1.45), Color("FFF8EC"))
			draw_circle(Vector2(r * 0.5, -r * 0.55), r * 0.14, Color.WHITE)
		"curse":
			draw_circle(Vector2.ZERO, r, Color("5B2A9E"))
			draw_circle(Vector2(0, r * 0.12), r * 0.86, Color("7A3FC7"))
			var pts = PackedVector2Array()
			for j in 24:
				var u = j / 23.0
				pts.append(Vector2.from_angle(t * 4.0 + u * 5.5) * r * (0.7 - 0.6 * u))
			draw_polyline(pts, Color("E2C8FF"), 3.0, true)
			draw_circle(Vector2.ZERO, r * 0.12, Color("FFE36B"))
		"thorn":
			draw_circle(Vector2.ZERO, r, Color("8A4B2A"))
			for k in 8:
				var q = TAU * k / 8.0 + t
				draw_colored_polygon(PackedVector2Array([Vector2.from_angle(q - 0.25) * r * 0.8, Vector2.from_angle(q) * r * 1.35, Vector2.from_angle(q + 0.25) * r * 0.8]), Color("FF5B4F"))
			draw_circle(Vector2.ZERO, r * 0.7, Color("A9643C"))
		_:
			_flame(r, Color("FF7A1F"), Color("FF9A2E"), Color("FFD23F"), Color("FFF6C8"))

func _egg_at(c: Vector2, s: float) -> PackedVector2Array:
	var out = PackedVector2Array()
	for p in G.egg(16, s):
		out.append(c + p)
	return out
