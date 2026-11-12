# Top bar, mobile style: a round pause/restart button on the left, a chunky progress bar in the middle that fills
# as eggs reach the nest (a flag marks the target), and the egg count on the right. White track on the sky.
# Sits below the phone's status bar / notch (safe area).
extends Control

const G = preload("res://scripts/g.gd")
const UI = preload("res://scripts/ui_kit.gd")
signal restart

var title = ""
var n_eggs = 3
var target = 2
var saved = 0
var broken = 0
var shown = 0.0
var pop = 0.0
var shake = 0.0
var time_limit = 0.0
var time_left = 0.0
var cursed = false

func _init() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_PASS

func _top() -> float:
	return UI.safe_top() + 22.0

func _process(dt: float) -> void:
	shown = move_toward(shown, float(saved), dt * 3.0)
	pop = maxf(0.0, pop - dt * 3.0)
	shake = maxf(0.0, shake - dt * 3.0)
	queue_redraw()

func _btn_rect() -> Rect2:
	return Rect2(20, _top(), 64, 64)

func _gui_input(ev: InputEvent) -> void:
	if ev is InputEventScreenTouch and ev.pressed and _btn_rect().grow(10).has_point(ev.position):
		Sfx.play("grab")
		Sfx.buzz(10, 0.3)
		restart.emit()
		accept_event()

func _has_point(p: Vector2) -> bool:
	return _btn_rect().grow(10).has_point(p)

func _draw() -> void:
	var W = get_viewport_rect().size.x
	var y = _top()
	# restart button: white circle with a soft lip
	var r = _btn_rect()
	var c = r.get_center()
	draw_circle(c + Vector2(0, 4), 32, Color(0.1, 0.25, 0.35, 0.18))
	draw_circle(c, 32, Color.WHITE)
	draw_arc(c, 13, -PI * 0.1, PI * 1.5, 24, UI.MUTED, 6.0, true)
	var tip = c + Vector2.from_angle(-PI * 0.1) * 13
	draw_colored_polygon(PackedVector2Array([tip + Vector2(-9, -7), tip + Vector2(9, -5), tip + Vector2(1, 9)]), UI.MUTED)
	# progress bar
	var bx = 104.0
	var bw = W - bx - 118.0
	var bar = Rect2(bx, y + 18, bw, 28)
	var sx = sin(shake * 40.0) * 6.0 * shake
	bar.position.x += sx
	UI.rounded(self, bar.grow(4), Color(1, 1, 1, 0.92), 18)
	UI.rounded(self, bar, Color("E9E2D8"), 14)
	var k = clampf(shown / float(n_eggs), 0.0, 1.0)
	if k > 0.01:
		var fill = Rect2(bar.position, Vector2(maxf(28.0, bar.size.x * k), bar.size.y))
		UI.rounded(self, fill, UI.BRAND, 14)
		UI.rounded(self, Rect2(fill.position + Vector2(10, 6), Vector2(maxf(0.0, fill.size.x - 20), 6)), Color(1, 1, 1, 0.35), 3)
	# target flag
	var fx = bar.position.x + bar.size.x * float(target) / n_eggs
	if target < n_eggs:
		draw_line(Vector2(fx, bar.position.y - 6), Vector2(fx, bar.end.y + 4), UI.INK.lerp(Color.WHITE, 0.3), 3.0, true)
		draw_colored_polygon(PackedVector2Array([Vector2(fx, bar.position.y - 6), Vector2(fx + 16, bar.position.y), Vector2(fx, bar.position.y + 6)]), UI.GREEN if saved >= target else UI.RED)
	# egg count
	var ex = W - 98.0
	var pc = Vector2(ex + 18, y + 31)
	UI.rounded(self, Rect2(ex - 8, y + 6, 92, 52), Color(1, 1, 1, 0.92), 26)
	UI.icon(self, "egg", pc, 34.0 * (1.0 + pop * 0.3), UI.BRAND)
	var f = UI.font(900)
	draw_string(f, Vector2(ex + 40, y + 44), "%d/%d" % [saved, n_eggs], HORIZONTAL_ALIGNMENT_LEFT, -1, 30, UI.INK)
	# the fuse: a clock pill under the bar, red and pulsing in the last 15 s, purple while a curse doubles it
	if time_limit > 0.0:
		var secs = int(ceil(time_left))
		var low = time_left <= 15.0
		var tc = UI.RED if low else (UI.PURPLE if cursed else UI.INK)
		var pk = 1.0 + (0.08 * absf(sin(Time.get_ticks_msec() / 160.0)) if low else 0.0)
		var tw = 128.0 * pk
		var tr = Rect2(W / 2 - tw / 2, y + 62, tw, 44 * pk)
		UI.rounded(self, tr, Color(1, 1, 1, 0.92), 22)
		UI.icon(self, "clock", tr.position + Vector2(28, tr.size.y / 2), 26.0, tc)
		draw_string(f, Vector2(tr.position.x + 46, tr.position.y + tr.size.y / 2 + 10), "%d:%02d" % [secs / 60, secs % 60], HORIZONTAL_ALIGNMENT_LEFT, -1, int(28 * pk), tc)
