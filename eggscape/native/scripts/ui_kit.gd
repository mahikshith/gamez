# App UI kit: palette, fonts, buttons, labels, stat cards, safe-area helpers. One place for the app's look:
# flat bright colours on warm white, Nunito Black/ExtraBold, chunky 3D buttons (a darker lip that the button
# sinks into when pressed), cards with a coloured header band. No outlines anywhere.
extends RefCounted

const G = preload("res://scripts/g.gd")
const BRAND := Color("F5891F") # the hen's ginger
const BRAND_D := Color("D86F0C")
const GREEN := Color("4FC21A")
const GREEN_D := Color("3A9A0E")
const GOLD := Color("FFC21A")
const GOLD_D := Color("E59A00")
const BLUE := Color("1EA7F0")
const RED := Color("FF5148")
const PURPLE := Color("B07CF2")
const INK := Color("3B2A20")
const MUTED := Color("9A8B80")
const PAPER := Color("FFFBF4")
const LINE := Color("EDE4D8")

static var _fonts := {}

static func font(weight := 900) -> Font:
	if not _fonts.has(weight):
		_fonts[weight] = load("res://assets/fonts/nunito-latin-%d-normal.woff2" % weight)
	return _fonts[weight]

static func safe_top() -> float:
	if not OS.has_feature("mobile"):
		return 0.0
	var vp = Engine.get_main_loop().root
	var safe = DisplayServer.get_display_safe_area()
	var win = DisplayServer.window_get_size()
	if win.y <= 0:
		return 0.0
	return maxf(0.0, safe.position.y) * vp.get_visible_rect().size.y / win.y

static func safe_bottom() -> float:
	if not OS.has_feature("mobile"):
		return 0.0
	var vp = Engine.get_main_loop().root
	var safe = DisplayServer.get_display_safe_area()
	var win = DisplayServer.window_get_size()
	if win.y <= 0 or safe.size.y <= 0:
		return 0.0
	return maxf(0.0, win.y - safe.end.y) * vp.get_visible_rect().size.y / win.y

static func label(parent: Node, text: String, size: int, col: Color, weight := 900, align := HORIZONTAL_ALIGNMENT_CENTER) -> Label:
	var l = Label.new()
	l.text = text
	l.horizontal_alignment = align
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.add_theme_font_override("font", font(weight))
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.clip_text = false
	parent.add_child(l)
	return l

static func _box(col: Color, lip: Color, lip_px: int, radius := 20) -> StyleBoxFlat:
	var sb = StyleBoxFlat.new()
	sb.bg_color = col
	sb.set_corner_radius_all(radius)
	sb.border_color = lip
	sb.border_width_bottom = lip_px
	sb.anti_aliasing = true
	sb.content_margin_top = 4 + (6 - lip_px if lip_px < 6 else 0)
	return sb

static func button(parent: Node, text: String, col: Color, size := 30) -> Button:
	var b = Button.new()
	b.text = text
	b.add_theme_font_override("font", font(900))
	b.add_theme_font_size_override("font_size", size)
	var lip = col.darkened(0.22)
	b.add_theme_stylebox_override("normal", _box(col, lip, 7))
	b.add_theme_stylebox_override("hover", _box(col, lip, 7))
	b.add_theme_stylebox_override("pressed", _box(col.darkened(0.04), lip, 1))
	var f = StyleBoxEmpty.new()
	b.add_theme_stylebox_override("focus", f)
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
		b.add_theme_color_override(c, Color.WHITE)
	b.focus_mode = Control.FOCUS_NONE
	parent.add_child(b)
	return b

static func flat_button(parent: Node, text: String, col: Color, size := 22) -> Button:
	var b = Button.new()
	b.text = text
	b.flat = true
	b.add_theme_font_override("font", font(900))
	b.add_theme_font_size_override("font_size", size)
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
		b.add_theme_color_override(c, col)
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	b.focus_mode = Control.FOCUS_NONE
	parent.add_child(b)
	return b

static func rounded(ci: CanvasItem, r: Rect2, col: Color, radius := 16.0) -> void:
	var sb = StyleBoxFlat.new()
	sb.bg_color = col
	sb.set_corner_radius_all(int(radius))
	sb.anti_aliasing = true
	ci.draw_style_box(sb, r)

# ---------------------------------------------------------------- icons (drawn, centred on c, size s)
static func icon(ci: CanvasItem, kind: String, c: Vector2, s: float, col: Color) -> void:
	match kind:
		"egg":
			var pts = G.egg(24, s * 1.6)
			for i in pts.size():
				pts[i] += c
			ci.draw_colored_polygon(pts, Color("FFF3DC"))
			var sh = G.egg(24, s * 1.6)
			for i in sh.size():
				sh[i] = sh[i] * 0.86 + c + Vector2(-s * 0.06, -s * 0.08)
			for poly in Geometry2D.clip_polygons(pts, sh):
				ci.draw_colored_polygon(poly, Color("F2D7AE"))
			ci.draw_colored_polygon(G.ellipse(c + Vector2(-s * 0.13, -s * 0.18), s * 0.07, s * 0.12, 12, -0.3), Color.WHITE)
		"coin":
			ci.draw_circle(c + Vector2(0, s * 0.06), s * 0.46, GOLD_D)
			ci.draw_circle(c, s * 0.46, GOLD)
			ci.draw_circle(c, s * 0.32, Color("FFD95A"))
			ci.draw_colored_polygon(G.star(c, s * 0.2, s * 0.09), GOLD_D)
		"clock":
			ci.draw_circle(c, s * 0.46, col)
			ci.draw_circle(c, s * 0.34, Color.WHITE)
			ci.draw_line(c, c + Vector2(0, -s * 0.24), col, s * 0.09, true)
			ci.draw_line(c, c + Vector2(s * 0.17, 0), col, s * 0.09, true)
		"star":
			ci.draw_colored_polygon(G.star(c + Vector2(0, s * 0.05), s * 0.5, s * 0.25), GOLD_D)
			ci.draw_colored_polygon(G.star(c, s * 0.5, s * 0.25), GOLD)
		"crack":
			icon(ci, "egg", c, s, col)
			ci.draw_polyline(PackedVector2Array([c + Vector2(-s * 0.2, -s * 0.05), c + Vector2(-s * 0.05, s * 0.08), c + Vector2(0.0, -s * 0.06), c + Vector2(s * 0.18, s * 0.1)]), INK, s * 0.07, true)

# A Duolingo-style stat card: coloured frame, white label in the header band, icon + value inside.
class StatCard extends Control:
	const K = preload("res://scripts/ui_kit.gd")
	var label_text = ""
	var value_to = 0
	var value = 0.0
	var fmt = "%d"
	var color = Color.ORANGE
	var icon = "egg"
	var pop = 0.0

	func count_up() -> void:
		var tw = create_tween()
		var step = func(v):
			var old = int(value)
			value = v
			if int(v) != old and int(v) % 2 == 0:
				Sfx.play("coin", -14.0, 1.0 + v * 0.01)
		tw.tween_method(step, 0.0, float(value_to), 0.5)
		tw.tween_property(self, "pop", 1.0, 0.0)
		tw.tween_property(self, "pop", 0.0, 0.25)

	func finish() -> void:
		value = float(value_to)

	func _process(_dt: float) -> void:
		queue_redraw()

	func _draw() -> void:
		var r = Rect2(Vector2.ZERO, size)
		K.rounded(self, r, color, 18)
		K.rounded(self, Rect2(4, 36, size.x - 8, size.y - 40), Color.WHITE, 14)
		var f = K.font(900)
		var t = label_text
		var tw = f.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, 17).x
		draw_string(f, Vector2((size.x - tw) / 2.0, 25), t, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color.WHITE)
		var txt = fmt % int(round(value)) if fmt.count("%") == 1 else fmt
		var fs = 34
		var vw = f.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		var is_ = 34.0
		var total = is_ + 8.0 + vw
		var x0 = (size.x - total) / 2.0
		var cy = 36 + (size.y - 40) / 2.0
		var sc = 1.0 + pop * 0.15
		K.icon(self, icon, Vector2(x0 + is_ / 2.0, cy), is_ * sc, color)
		draw_string(f, Vector2(x0 + is_ + 8.0, cy + fs * 0.36), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, color.darkened(0.08))
