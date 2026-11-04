# A power orb floating in a channel. An egg that touches it takes the power (fire_red: burns thorns for 6 s).
extends Area2D

const G = preload("res://scripts/g.gd")
signal taken(orb, egg)
var kind = "fire_red"
var t = 0.0
var used = false

func _ready() -> void:
	collision_layer = 0
	collision_mask = 2
	var cs = CollisionShape2D.new()
	var c = CircleShape2D.new()
	c.radius = 0.24 * G.PPM
	cs.shape = c
	add_child(cs)
	body_entered.connect(_on_body)

func _on_body(b: Node) -> void:
	if used or not b.has_method("crack"):
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

func _draw() -> void:
	var r = 0.2 * G.PPM * (1.0 + 0.06 * sin(t * 5.0))
	draw_circle(Vector2.ZERO, r * 1.6, Color(1.0, 0.5, 0.1, 0.18))
	draw_circle(Vector2.ZERO, r, Color("ff6a1f"))
	draw_circle(Vector2.ZERO, r, Color("8a2a08"), false, 3.0, true)
	# flame glyph
	var f = PackedVector2Array()
	for i in 24:
		var a = TAU * i / 24.0
		var rr = r * 0.62 * (1.0 + 0.35 * maxf(0.0, -sin(a)) + 0.06 * sin(a * 5.0 + t * 9.0))
		f.append(Vector2(cos(a) * rr * 0.75, sin(a) * rr + r * 0.12))
	draw_colored_polygon(f, Color("ffd34a"))
	draw_colored_polygon(G.ellipse(Vector2(0, r * 0.22), r * 0.22, r * 0.3, 12), Color("fff6c2"))
