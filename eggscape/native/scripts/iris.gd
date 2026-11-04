# Circular iris wipe between screens (closes on the centre, swaps, opens), the usual mobile-game scene change.
extends Control

var k = 0.0 # 0 open, 1 closed

func _init() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE

func close() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	var tw = create_tween()
	tw.tween_property(self, "k", 1.0, 0.32).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	await tw.finished

func open() -> void:
	var tw = create_tween()
	tw.tween_property(self, "k", 0.0, 0.38).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	await tw.finished
	mouse_filter = Control.MOUSE_FILTER_IGNORE

func _process(_dt: float) -> void:
	queue_redraw()

func _draw() -> void:
	if k <= 0.001:
		return
	var sz = get_viewport_rect().size
	var c = sz / 2
	var R = sz.length() * 0.55 * (1.0 - k)
	# fill everything outside the circle with a thick ring polygon
	var outer = PackedVector2Array([Vector2(-10, -10), Vector2(sz.x + 10, -10), Vector2(sz.x + 10, sz.y + 10), Vector2(-10, sz.y + 10), Vector2(-10, -10)])
	var col = Color("2b170a")
	if R <= 1.0:
		draw_rect(Rect2(Vector2(-10, -10), sz + Vector2(20, 20)), col)
		return
	var n = 48
	var ring = PackedVector2Array()
	for i in n + 1:
		ring.append(c + Vector2.from_angle(TAU * i / n) * R)
	# draw as quads between circle and screen corners: thick arc stroke is simpler and exact enough
	draw_arc(c, R + sz.length() * 0.5, 0, TAU, 64, col, sz.length(), false)
	draw_arc(c, R + 4.0, 0, TAU, 64, Color("ffcf5a"), 8.0, true)
