# App UI kit: palette, fonts, buttons, panels, stroked text, icons, stat cards, safe-area helpers. One place for the
# app's look: chunky layered pieces with a dark outline, a lip they sink into when pressed, a gloss on the top half,
# and bold stroked lettering (Lilita One for display, Nunito Black for reading text).
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
const MUTED := Color("8C7B6F")
const PAPER := Color("FFFBF4")
const LINE := Color("EDE4D8")

const WOOD := Color("C8843C")
const WOOD_D := Color("7A4A1E")
const OUTLINE := Color("4A2C12")
const CREAM := Color("FFF6E4")
const NAVY := Color("17324D")

static var _fonts := {}
static var _display: Font

# the display face (Lilita One): titles, buttons, numerals
static func display() -> Font:
	if _display == null:
		_display = load("res://assets/fonts/lilita-one-latin-400-normal.woff2")
	return _display

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
	# the safe area is in screen coordinates; the game window can start below a cutout, so measure from the window
	var y0 = safe.position.y - DisplayServer.window_get_position().y
	return clampf(y0, 0.0, win.y * 0.15) * vp.get_visible_rect().size.y / win.y

static func safe_bottom() -> float:
	if not OS.has_feature("mobile"):
		return 0.0
	var vp = Engine.get_main_loop().root
	var safe = DisplayServer.get_display_safe_area()
	var win = DisplayServer.window_get_size()
	if win.y <= 0 or safe.size.y <= 0:
		return 0.0
	var y1 = safe.end.y - DisplayServer.window_get_position().y
	return clampf(win.y - y1, 0.0, win.y * 0.15) * vp.get_visible_rect().size.y / win.y

static func label(parent: Node, text: String, size: int, col: Color, weight := 900, align := HORIZONTAL_ALIGNMENT_CENTER) -> Label:
	var l = Label.new()
	l.text = text
	l.horizontal_alignment = align
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.add_theme_font_override("font", display() if weight >= 1000 else font(weight))
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.clip_text = false
	parent.add_child(l)
	return l

# display label with a dark stroke and a hard drop shadow (titles)
static func title(parent: Node, text: String, size: int, col: Color, stroke: Color, px := 12) -> Label:
	var l = label(parent, text, size, col, 1000)
	l.add_theme_color_override("font_outline_color", stroke)
	l.add_theme_constant_override("outline_size", px)
	l.add_theme_color_override("font_shadow_color", stroke.darkened(0.25))
	l.add_theme_constant_override("shadow_offset_x", 0)
	l.add_theme_constant_override("shadow_offset_y", maxi(3, size / 12))
	l.add_theme_constant_override("shadow_outline_size", px)
	return l

static func rounded(ci: CanvasItem, r: Rect2, col: Color, radius := 16.0) -> void:
	var sb = StyleBoxFlat.new()
	sb.bg_color = col
	sb.set_corner_radius_all(int(minf(radius, minf(r.size.x, r.size.y) / 2.0)))
	sb.corner_detail = 10
	sb.anti_aliasing = true
	ci.draw_style_box(sb, r)

# centred, stroked text: p.x is the centre, p.y the baseline
static func text(ci: CanvasItem, p: Vector2, s: String, size: int, col: Color, stroke := Color(0, 0, 0, 0), px := 0, f: Font = null) -> void:
	if f == null:
		f = display()
	var w = f.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
	var at = Vector2(p.x - w / 2.0, p.y)
	if px > 0:
		ci.draw_string_outline(f, at + Vector2(0, maxf(2.0, size * 0.07)), s, HORIZONTAL_ALIGNMENT_LEFT, -1, size, px, stroke.darkened(0.25))
		ci.draw_string_outline(f, at, s, HORIZONTAL_ALIGNMENT_LEFT, -1, size, px, stroke)
	ci.draw_string(f, at, s, HORIZONTAL_ALIGNMENT_LEFT, -1, size, col)

static func text_w(s: String, size: int, f: Font = null) -> float:
	return (f if f != null else display()).get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x

# A raised piece: soft shadow, dark outline, lip, face, gloss. `down` 0..1 sinks the face into the lip.
static func slab(ci: CanvasItem, r: Rect2, col: Color, radius := 22.0, lip := 7.0, down := 0.0, line := 3.0) -> void:
	var edge = col.darkened(0.62)
	edge.s = minf(1.0, edge.s * 1.15)
	rounded(ci, Rect2(r.position + Vector2(0, lip * 0.7 + 3.0), r.size).grow(line), Color(0.05, 0.03, 0.02, 0.28), radius + line)
	rounded(ci, r.grow(line), edge, radius + line)
	rounded(ci, r, col.darkened(0.3), radius)
	var face = Rect2(r.position + Vector2(0, lip * down), Vector2(r.size.x, r.size.y - lip))
	rounded(ci, face, col, radius)
	# gloss on the top half, a bright hairline along the top edge
	rounded(ci, Rect2(face.position + Vector2(4, 3), Vector2(face.size.x - 8, face.size.y * 0.48)), Color(1, 1, 1, 0.2), radius - 4)
	rounded(ci, Rect2(face.position + Vector2(radius * 0.6, 4), Vector2(face.size.x - radius * 1.2, 3.5)), Color(1, 1, 1, 0.5), 2)

# A panel: outlined frame colour around a paper inset with an inner top shade (reads as recessed)
static func panel(ci: CanvasItem, r: Rect2, frame := WOOD, paper := CREAM, radius := 26.0, border := 8.0) -> void:
	rounded(ci, Rect2(r.position + Vector2(0, 8), r.size).grow(3), Color(0.05, 0.03, 0.02, 0.3), radius + 3)
	rounded(ci, r.grow(3), frame.darkened(0.62), radius + 3)
	rounded(ci, r, frame.darkened(0.25), radius)
	rounded(ci, Rect2(r.position, r.size - Vector2(0, 5)), frame, radius)
	rounded(ci, Rect2(r.position + Vector2(5, 4), Vector2(r.size.x - 10, 4)), Color(1, 1, 1, 0.35), 2)
	var inner = Rect2(r.position + Vector2(border, border), r.size - Vector2(border * 2, border * 2 + 5))
	rounded(ci, inner.grow(2), frame.darkened(0.45), radius - border + 2)
	rounded(ci, inner, paper, radius - border)
	rounded(ci, Rect2(inner.position, Vector2(inner.size.x, minf(10.0, inner.size.y * 0.3))), Color(0.35, 0.2, 0.05, 0.1), radius - border)

# A pill for HUD read-outs: dark outline, cream face, lip
static func pill(ci: CanvasItem, r: Rect2, col := CREAM, line := OUTLINE) -> void:
	var rad = r.size.y / 2.0
	rounded(ci, Rect2(r.position + Vector2(0, 6), r.size).grow(3), Color(0.05, 0.03, 0.02, 0.26), rad + 3)
	rounded(ci, r.grow(3), line, rad + 3)
	rounded(ci, r, col.darkened(0.16), rad)
	rounded(ci, Rect2(r.position, r.size - Vector2(0, 4)), col, rad)
	rounded(ci, Rect2(r.position + Vector2(rad * 0.7, 3), Vector2(r.size.x - rad * 1.4, 3)), Color(1, 1, 1, 0.7), 2)

# The kit button: a Button that paints itself as a slab with stroked display lettering.
class PButton extends Button:
	const K = preload("res://scripts/ui_kit.gd")
	var col := Color("4FC21A")
	var fsize := 34
	var icon_kind := ""

	func _init() -> void:
		for st in ["normal", "hover", "pressed", "focus", "disabled", "hover_pressed"]:
			add_theme_stylebox_override(st, StyleBoxEmpty.new())
		for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color", "font_disabled_color"]:
			add_theme_color_override(c, Color(0, 0, 0, 0))
		focus_mode = Control.FOCUS_NONE
		button_down.connect(queue_redraw)
		button_up.connect(queue_redraw)

	func _draw() -> void:
		var down = 1.0 if (button_pressed or is_pressed()) else 0.0
		var r = Rect2(Vector2(3, 3), size - Vector2(6, 12))
		K.slab(self, r, col, minf(26.0, r.size.y * 0.42), 8.0, down)
		var fs = fsize
		while fs > 14 and K.text_w(text, fs) > r.size.x - 40.0:
			fs -= 2
		var cy = r.position.y + (r.size.y - 8.0) / 2.0 + 8.0 * down
		K.text(self, Vector2(size.x / 2.0, cy + fs * 0.35), text, fs, Color.WHITE, col.darkened(0.6), maxi(6, fs / 4))

static func button(parent: Node, text: String, col: Color, size := 30) -> Button:
	var b = PButton.new()
	b.text = text
	b.col = col
	b.fsize = size + 4
	parent.add_child(b)
	return b

static func flat_button(parent: Node, text: String, col: Color, size := 22) -> Button:
	var b = Button.new()
	b.text = text
	b.flat = true
	b.add_theme_font_override("font", display())
	b.add_theme_font_size_override("font_size", size)
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
		b.add_theme_color_override(c, col)
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	b.focus_mode = Control.FOCUS_NONE
	parent.add_child(b)
	return b

# a star with an outline, a lower-right shade and a top-left glint; k scales it in (pop), off = empty socket
static func star(ci: CanvasItem, c: Vector2, r: float, on := true, k := 1.0, rot := 0.0) -> void:
	if not on or k <= 0.0:
		ci.draw_colored_polygon(G.star(c, r * 1.12, r * 0.6), Color(0.1, 0.06, 0.03, 0.4))
		ci.draw_colored_polygon(G.star(c, r * 0.94, r * 0.48), Color(0.24, 0.17, 0.12, 0.55))
		if not on:
			return
	var q = r * k
	ci.draw_colored_polygon(G.star(c + Vector2(0, q * 0.1), q * 1.2, q * 0.66, rot), Color("7A4A0A"))
	ci.draw_colored_polygon(G.star(c, q * 1.17, q * 0.64, rot), Color("7A4A0A"))
	ci.draw_colored_polygon(G.star(c, q, q * 0.52, rot), Color("FFB400"))
	ci.draw_colored_polygon(G.star(c + Vector2(-q * 0.05, -q * 0.07), q * 0.8, q * 0.42, rot), Color("FFD21F"))
	ci.draw_colored_polygon(G.star(c + Vector2(-q * 0.1, -q * 0.14), q * 0.44, q * 0.22, rot), Color("FFF2A0"))
	ci.draw_circle(c + Vector2(-q * 0.3, -q * 0.32), q * 0.07, Color(1, 1, 1, 0.9))

# a padlock: steel shackle, gold body with a keyhole, outlined; open 0..1 swings the shackle up
static func padlock(ci: CanvasItem, c: Vector2, s: float, open := 0.0) -> void:
	var line = Color("5A3606")
	var sh = PackedVector2Array()
	for i in 17:
		var a = PI + PI * i / 16.0
		sh.append(c + Vector2(cos(a) * 15.0, -14.0 - open * 12.0 + sin(a) * 17.0) * s)
	var legs = PackedVector2Array([c + Vector2(-15, -4) * s]) + sh + PackedVector2Array([c + Vector2(15, -4 - open * 12.0) * s])
	ci.draw_polyline(legs, Color("3A3F46"), 13.0 * s, true)
	ci.draw_polyline(legs, Color("A9B2BC"), 7.5 * s, true)
	ci.draw_polyline(sh, Color("E3E9EE"), 2.5 * s, true)
	rounded(ci, Rect2(c + Vector2(-27, -11) * s, Vector2(54, 45) * s), line, 11 * s)
	rounded(ci, Rect2(c + Vector2(-24, -8) * s, Vector2(48, 39) * s), Color("E59A00"), 9 * s)
	rounded(ci, Rect2(c + Vector2(-24, -8) * s, Vector2(48, 31) * s), Color("FFC21A"), 9 * s)
	rounded(ci, Rect2(c + Vector2(-20, -5) * s, Vector2(40, 9) * s), Color("FFE680"), 5 * s)
	ci.draw_circle(c + Vector2(0, 8) * s, 5.5 * s, line)
	ci.draw_colored_polygon(PackedVector2Array([c + Vector2(-3, 9) * s, c + Vector2(3, 9) * s, c + Vector2(4.5, 21) * s, c + Vector2(-4.5, 21) * s]), line)

# ---------------------------------------------------------------- icons (drawn, centred on c, size s)
static func icon(ci: CanvasItem, kind: String, c: Vector2, s: float, col: Color) -> void:
	match kind:
		"egg":
			var ol = G.egg(24, s * 1.6 + 7.0)
			for i in ol.size():
				ol[i] += c
			ci.draw_colored_polygon(ol, Color("6B4A2A"))
			var pts = G.egg(24, s * 1.6)
			for i in pts.size():
				pts[i] += c
			ci.draw_colored_polygon(pts, Color("FFF8EA"))
			var sh = G.egg(24, s * 1.6)
			for i in sh.size():
				sh[i] = sh[i] * 0.86 + c + Vector2(-s * 0.06, -s * 0.08)
			for poly in Geometry2D.clip_polygons(pts, sh):
				ci.draw_colored_polygon(poly, Color("EDCB98"))
			ci.draw_colored_polygon(G.ellipse(c + Vector2(-s * 0.13, -s * 0.18), s * 0.07, s * 0.12, 12, -0.3), Color.WHITE)
		"broken":
			# half a shell with a jagged edge and a drop of yolk
			var pts = PackedVector2Array()
			for i in 13:
				var a = PI * i / 12.0
				pts.append(c + Vector2(cos(a) * s * 0.36, sin(a) * s * 0.34 + s * 0.02))
			for i in 7:
				pts.append(c + Vector2(-s * 0.36 + s * 0.72 * i / 6.0, s * 0.02 - (s * 0.16 if i % 2 == 1 else 0.0)))
			ci.draw_colored_polygon(pts, Color("E9D2AE"))
			ci.draw_polyline(G.closed(pts), Color("6B4A2A"), 2.5, true)
			ci.draw_circle(c + Vector2(0, s * 0.12), s * 0.12, Color("FFB21A"))
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
		var r = Rect2(Vector2(3, 3), size - Vector2(6, 12))
		K.rounded(self, Rect2(r.position + Vector2(0, 7), r.size).grow(3), Color(0.05, 0.03, 0.02, 0.28), 23)
		K.rounded(self, r.grow(3), color.darkened(0.62), 23)
		K.rounded(self, r, color.darkened(0.25), 20)
		K.rounded(self, Rect2(r.position, r.size - Vector2(0, 5)), color, 20)
		K.rounded(self, Rect2(r.position + Vector2(16, 4), Vector2(r.size.x - 32, 3)), Color(1, 1, 1, 0.5), 2)
		var body = Rect2(r.position + Vector2(6, 34), Vector2(r.size.x - 12, r.size.y - 45))
		K.rounded(self, body.grow(2), color.darkened(0.45), 16)
		K.rounded(self, body, K.CREAM, 14)
		K.text(self, Vector2(size.x / 2.0, r.position.y + 26), label_text, 20, Color.WHITE, color.darkened(0.55), 5)
		var txt = fmt % int(round(value)) if fmt.count("%") == 1 else fmt
		var fs = 36
		var vw = K.text_w(txt, fs)
		var is_ = 36.0
		var total = is_ + 10.0 + vw
		var x0 = (size.x - total) / 2.0
		var cy = body.get_center().y
		var sc = 1.0 + pop * 0.15
		K.icon(self, icon, Vector2(x0 + is_ / 2.0, cy), is_ * sc, color)
		K.text(self, Vector2(x0 + is_ + 10.0 + vw / 2.0, cy + fs * 0.35), txt, fs, K.INK)
