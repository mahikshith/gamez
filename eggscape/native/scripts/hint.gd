# First-level tutorial: a hand that drags along a ring until the player grabs one.
extends Node2D

var radius = 200.0
var t = 0.0
var alpha = 1.0
var leaving = false

func dismiss() -> void:
	if leaving:
		return
	leaving = true
	var tw = create_tween()
	tw.tween_property(self, "alpha", 0.0, 0.25)
	tw.tween_callback(queue_free)

func _process(dt: float) -> void:
	t += dt
	queue_redraw()

func _draw() -> void:
	var u = fmod(t, 1.8) / 1.8
	var a = lerpf(-0.2, 1.1, smoothstep(0.1, 0.8, u))
	var p = Vector2.from_angle(a) * radius
	var fade = alpha * (1.0 - smoothstep(0.85, 1.0, u)) * smoothstep(0.0, 0.1, u)
	# trail
	var pts = PackedVector2Array()
	for i in 20:
		pts.append(Vector2.from_angle(lerpf(-0.2, a, i / 19.0)) * radius)
	if pts.size() > 1:
		draw_polyline(pts, Color(1, 1, 1, 0.45 * fade), 10.0, true)
	var press = 1.0 - 0.15 * smoothstep(0.05, 0.12, u)
	draw_circle(p, 30.0 * press, Color(1, 1, 1, 0.3 * fade))
	draw_circle(p, 20.0 * press, Color(1, 1, 1, 0.95 * fade))
	draw_circle(p, 20.0 * press, Color(0.42, 0.29, 0.16, fade), false, 3.0, true)
