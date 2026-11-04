# App flow: title -> level (vault + hen + HUD) -> win celebration / fail -> next level. Iris-wipe transitions
# between screens, camera punch and shake on game events, hen reacts to everything that happens in the vault.
extends Node2D

const G = preload("res://scripts/g.gd")
const Vault = preload("res://scripts/vault.gd")
const Hen = preload("res://scripts/hen.gd")
const GroundArt = preload("res://scripts/ground_art.gd")
const Hud = preload("res://scripts/hud.gd")
const Celebrate = preload("res://scripts/celebrate.gd")
const Backdrop = preload("res://scripts/backdrop.gd")
const Iris = preload("res://scripts/iris.gd")
const Hint = preload("res://scripts/hint.gd")
const SAVE_PATH := "user://save.json"
const PLAYABLE := 1 # levels the prototype supports so far (rings, gaps, thorns, pads, flame orbs)

var font: Font
var levels: Array = []
var save = {"level": 1, "streak": 0, "coins": 0, "best": {}}
var idx = 0
var world: Node2D
var vault
var hen
var cam: Camera2D
var hud
var ui: CanvasLayer
var over: CanvasLayer
var iris
var hint
var backdrop
var shake = 0.0
var hen_hold = 0.0
var title_ui: Control
var banner: Control
var _busy = false

func _ready() -> void:
	font = load("res://assets/fonts/fredoka-600-latin.woff2")
	levels = JSON.parse_string(FileAccess.get_file_as_string("res://data/levels.json"))
	_load_save()
	var bl = CanvasLayer.new()
	bl.layer = -5
	add_child(bl)
	backdrop = Backdrop.new()
	bl.add_child(backdrop)
	ui = CanvasLayer.new()
	ui.layer = 5
	add_child(ui)
	over = CanvasLayer.new()
	over.layer = 10
	add_child(over)
	var il = CanvasLayer.new()
	il.layer = 20
	add_child(il)
	iris = Iris.new()
	il.add_child(iris)
	cam = Camera2D.new()
	add_child(cam)
	cam.make_current()
	get_viewport().size_changed.connect(_fit)
	if OS.get_cmdline_user_args().has("--henlab"):
		_hen_lab()
	elif OS.get_cmdline_user_args().has("--level"):
		_start_level(clampi(int(OS.get_cmdline_user_args()[OS.get_cmdline_user_args().find("--level") + 1]), 1, PLAYABLE) - 1)
	else:
		_show_title()

# Review sheet: the hen in every mood, big (run with -- --henlab).
func _hen_lab() -> void:
	var moods = ["idle", "worried", "cheer", "cry", "dance", "celebrate"]
	for i in moods.size():
		var h = Hen.new()
		h.H = 220.0
		h.position = Vector2(200 + (i % 2) * 330, 330 + (i / 2) * 400) - get_viewport_rect().size / 2
		add_child(h)
		h.set_mood(moods[i])
		var l = Label.new()
		l.text = moods[i]
		l.add_theme_font_override("font", font)
		l.add_theme_font_size_override("font_size", 30)
		l.position = h.position + Vector2(-60, 20)
		add_child(l)

# ---------------------------------------------------------------- save
func _load_save() -> void:
	if FileAccess.file_exists(SAVE_PATH):
		var d = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
		if d is Dictionary:
			save.merge(d, true)

func _write_save() -> void:
	var f = FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(save))

# ---------------------------------------------------------------- title
func _show_title() -> void:
	title_ui = Control.new()
	title_ui.set_anchors_preset(Control.PRESET_FULL_RECT)
	ui.add_child(title_ui)
	var sz = get_viewport_rect().size
	var logo = Label.new()
	logo.text = "Eggscape"
	logo.add_theme_font_override("font", font)
	logo.add_theme_font_size_override("font_size", 104)
	logo.add_theme_color_override("font_color", Color("fff3d0"))
	logo.add_theme_color_override("font_outline_color", Color("6b3a14"))
	logo.add_theme_constant_override("outline_size", 26)
	logo.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	logo.size = Vector2(sz.x, 140)
	logo.position = Vector2(0, sz.y * 0.13)
	logo.pivot_offset = logo.size / 2
	title_ui.add_child(logo)
	var bob = create_tween().set_loops()
	bob.tween_property(logo, "rotation", 0.03, 1.2).set_trans(Tween.TRANS_SINE)
	bob.tween_property(logo, "rotation", -0.03, 1.2).set_trans(Tween.TRANS_SINE)
	var h = Hen.new()
	h.H = 300.0
	h.position = Vector2(sz.x / 2 - 10, sz.y * 0.71)
	title_ui.add_child(h)
	var eg = Node2D.new()
	title_ui.add_child(eg)
	var b = Button.new()
	b.text = "PLAY  ·  LEVEL %d" % mini(int(save.level), PLAYABLE)
	b.add_theme_font_override("font", font)
	b.add_theme_font_size_override("font_size", 40)
	for st in ["normal", "hover", "pressed", "focus"]:
		var sb = StyleBoxFlat.new()
		sb.bg_color = Color("58cc02") if st != "pressed" else Color("4fb800")
		sb.set_corner_radius_all(24)
		sb.border_color = Color("46a302")
		sb.border_width_bottom = 2 if st == "pressed" else 10
		sb.content_margin_top = 12 if st == "pressed" else 4
		if st == "focus":
			sb.draw_center = false
			sb.border_width_bottom = 0
		b.add_theme_stylebox_override(st, sb)
	b.size = Vector2(minf(540.0, sz.x - 64.0), 104)
	b.position = Vector2(sz.x / 2 - b.size.x / 2, sz.y * 0.78)
	b.pivot_offset = b.size / 2
	title_ui.add_child(b)
	var br = create_tween().set_loops()
	br.tween_property(b, "scale", Vector2(1.04, 1.04), 0.6).set_trans(Tween.TRANS_SINE)
	br.tween_property(b, "scale", Vector2.ONE, 0.6).set_trans(Tween.TRANS_SINE)
	b.pressed.connect(func():
		Sfx.play("grab")
		Sfx.buzz(15, 0.4)
		h.set_mood("cheer")
		_go(func():
			title_ui.queue_free()
			title_ui = null
			_start_level(mini(int(save.level), PLAYABLE) - 1)))
	h.set_mood("cheer")

# ---------------------------------------------------------------- level
func _go(swap: Callable) -> void:
	if _busy:
		return
	_busy = true
	Sfx.play("whoosh", -6.0)
	await iris.close()
	swap.call()
	await iris.open()
	_busy = false

func _clear_level() -> void:
	for c in over.get_children():
		c.queue_free()
	if world:
		world.queue_free()
		world = null
	if hud:
		hud.queue_free()
		hud = null

func _start_level(i: int) -> void:
	_clear_level()
	idx = i
	var lv: Dictionary = levels[i]
	world = Node2D.new()
	add_child(world)
	vault = Vault.new()
	vault.setup(lv)
	var back = GroundArt.new()
	back.vault = vault
	back.z_index = -2
	var front = GroundArt.new()
	front.vault = vault
	front.front = true
	front.z_index = 6
	vault.add_child(back)
	vault.add_child(front)
	vault.move_child(back, 0)
	world.add_child(vault)
	hen = Hen.new()
	hen.H = 120.0
	hen.face = -1
	hen.z_index = 4
	var hx: float = (vault.nest_x + vault.nest_w / 2 + 0.75) * G.PPM
	hen.position = Vector2(hx, vault.ground_y * G.PPM)
	vault.add_child(hen)
	vault.saved_egg.connect(_on_saved)
	vault.broke_egg.connect(_on_broke)
	vault.cracked_egg.connect(func(_e):
		shake = maxf(shake, 5.0)
		_hen_mood("worried", 0.8))
	vault.finished.connect(_on_finished)
	hud = Hud.new()
	hud.font = font
	hud.title = "%d  %s" % [int(lv.id), str(lv.name)]
	hud.n_eggs = vault.n_eggs
	hud.target = vault.target
	hud.restart.connect(func(): _go(func(): _start_level(idx)))
	ui.add_child(hud)
	if i == 0:
		hint = Hint.new()
		hint.radius = float(vault.rings[1].r) * G.PPM
		hint.z_index = 8
		vault.add_child(hint)
		vault.grabbed.connect(func():
			if is_instance_valid(hint):
				hint.dismiss())
	_fit()
	var ua = OS.get_cmdline_user_args()
	if ua.has("--autowin"):
		# screenshot helper: skip play and show the win stage
		get_tree().create_timer(0.5).timeout.connect(func():
			vault.n_saved = vault.n_eggs
			vault.done = true
			_on_finished(true))
	if ua.has("--bot"):
		var bot = preload("res://scripts/bot.gd").new()
		add_child(bot)
		bot.attach(vault, int(ua[ua.find("--bot") + 1]))
		tree_exiting.connect(func(): print("BOT L%d seed %s: %s" % [int(lv.id), ua[ua.find("--bot") + 1], bot.report()]))
		return
	_banner(str(lv.get("intro", {}).get("title", lv.name)), str(lv.get("intro", {}).get("line", lv.get("tip", ""))))

func _banner(title: String, line: String) -> void:
	var sz = get_viewport_rect().size
	var box = Control.new()
	box.set_anchors_preset(Control.PRESET_FULL_RECT)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(box)
	banner = box
	var panel = Panel.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.16, 0.09, 0.04, 0.82)
	sb.set_corner_radius_all(26)
	panel.add_theme_stylebox_override("panel", sb)
	panel.size = Vector2(minf(620.0, sz.x - 40.0), 170)
	panel.position = Vector2(sz.x / 2 - panel.size.x / 2, sz.y - 230)
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(panel)
	var t = Label.new()
	t.text = title
	t.add_theme_font_override("font", font)
	t.add_theme_font_size_override("font_size", 40)
	t.add_theme_color_override("font_color", Color("ffd34a"))
	t.position = Vector2(24, 14)
	t.size = Vector2(panel.size.x - 48, 50)
	panel.add_child(t)
	var l = Label.new()
	l.text = line
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.add_theme_font_override("font", font)
	l.add_theme_font_size_override("font_size", 26)
	l.add_theme_color_override("font_color", Color("fff3dc"))
	l.position = Vector2(24, 64)
	l.size = Vector2(panel.size.x - 48, 96)
	panel.add_child(l)
	panel.position.y += 260
	var tw = create_tween()
	tw.tween_property(panel, "position:y", panel.position.y - 260, 0.45).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT).set_delay(0.3)
	tw.tween_interval(3.6)
	tw.tween_property(panel, "position:y", panel.position.y + 40, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
	tw.tween_callback(box.queue_free)

func _fit() -> void:
	if vault == null or not is_instance_valid(vault):
		return
	var sz = get_viewport_rect().size
	var top = 120.0
	var bottom = 40.0
	var R: float = (vault.outer_r + 0.3) * G.PPM
	var gy: float = (vault.ground_y + 0.55) * G.PPM
	var hen_r: float = (vault.nest_x + vault.nest_w / 2 + 1.3) * G.PPM
	var half_w = maxf(R, hen_r)
	var h = R + gy
	var z = minf(sz.x / (half_w * 2.0), (sz.y - top - bottom) / h)
	cam.zoom = Vector2(z, z)
	# centre the content box under the HUD
	var content_mid = (gy - R) / 2.0
	# on tall phones push the vault down toward the thumbs and leave the spare room to the sky
	var spare = maxf(0.0, (sz.y - top - bottom) - h * z)
	cam.position = Vector2(0, content_mid - (top - bottom) / 2.0 / z - spare * 0.35 / z)

# ---------------------------------------------------------------- reactions
func _hen_mood(m: String, hold: float) -> void:
	if hen == null:
		return
	hen.set_mood(m)
	hen_hold = hold

func _on_saved(_e) -> void:
	hud.saved += 1
	hud.pop = 1.0
	_hen_mood("cheer", 1.1)
	_punch(0.035)

func _on_broke(_e, why: String) -> void:
	hud.broken += 1
	shake = 14.0
	_hen_mood("cry", 1.4)

func _on_finished(won: bool) -> void:
	var stars: int = vault.stars()
	if won:
		save.streak = int(save.streak) + 1
		var gain = 10 + stars * 10
		save.coins = int(save.coins) + gain
		var key = str(levels[idx].id)
		save.best[key] = maxi(int(save.best.get(key, 0)), stars)
		save.level = maxi(int(save.level), mini(idx + 2, PLAYABLE))
		_write_save()
		_hen_mood("dance", 99.0)
	else:
		save.streak = 0
		_write_save()
		_hen_mood("cry", 99.0)
	await get_tree().create_timer(0.9).timeout
	if is_instance_valid(banner):
		banner.queue_free()
	var c = Celebrate.new()
	c.font = font
	over.add_child(c)
	var titles = ["", "Phew, made it!", "Great job!", "Perfect!"]
	var subs = ["", "%d of %d eggs home" % [vault.n_saved, vault.n_eggs], "Every egg home", "Every egg, not a crack"]
	if won:
		c.open(true, stars, 10 + stars * 10, int(save.streak), titles[stars], subs[stars])
	else:
		c.open(false, 0, 0, 0, "Out of eggs!", "Save %d eggs to open the vault" % vault.target)
	c.next_pressed.connect(func(): _go(func():
		_clear_level()
		if idx + 1 < PLAYABLE:
			_start_level(idx + 1)
		else:
			_show_title()))
	c.retry_pressed.connect(func(): _go(func(): _start_level(idx)))

func _punch(k: float) -> void:
	var z = cam.zoom
	var tw = create_tween()
	tw.tween_property(cam, "zoom", z * (1.0 + k), 0.08).set_trans(Tween.TRANS_SINE)
	tw.tween_property(cam, "zoom", z, 0.25).set_trans(Tween.TRANS_SINE)

# ---------------------------------------------------------------- per frame
func _process(dt: float) -> void:
	if vault and is_instance_valid(vault) and hen:
		backdrop.sway = vault.rings[0].angle if vault.rings.size() > 0 else 0.0
		hen_hold -= dt
		if hen_hold <= 0.0 and not vault.done:
			hen.set_mood("worried" if vault.falling_fast() else "idle")
	shake = move_toward(shake, 0.0, dt * 40.0)
	cam.offset = Vector2(randf_range(-1, 1), randf_range(-1, 1)) * shake

func _unhandled_input(ev: InputEvent) -> void:
	if vault == null or not is_instance_valid(vault) or _busy:
		return
	if ev is InputEventScreenTouch or ev is InputEventScreenDrag:
		if ev.index != 0:
			return
		var wp: Vector2 = get_viewport().get_canvas_transform().affine_inverse() * ev.position
		vault.pointer(ev, wp)
