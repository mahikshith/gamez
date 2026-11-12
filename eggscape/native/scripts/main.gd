# App flow: title -> level (vault + hen + HUD) -> win celebration / fail -> next level. Iris-wipe transitions
# between screens, camera punch and shake on game events, hen reacts to everything that happens in the vault.
extends Node2D

const G = preload("res://scripts/g.gd")
const Vault = preload("res://scripts/vault.gd")
const Hen = preload("res://scripts/mama.gd")
const GroundArt = preload("res://scripts/ground_art.gd")
const Hud = preload("res://scripts/hud.gd")
const Celebrate = preload("res://scripts/celebrate.gd")
const Cheer = preload("res://scripts/cheer.gd")
const TitleArt = preload("res://scripts/title_art.gd")
const Backdrop = preload("res://scripts/backdrop.gd")
const Iris = preload("res://scripts/iris.gd")
const UI = preload("res://scripts/ui_kit.gd")
const Hint = preload("res://scripts/hint.gd")
const MapScreen = preload("res://scripts/map.gd")
const SAVE_PATH := "user://save.json"
const PLAYABLE := 5 # levels the app supports so far: all of World 1

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
var map_ui: Control
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
	# Android sets the real screen size (immersive mode, cutouts) after the first frame: rebuild the title if it changed
	get_viewport().size_changed.connect(func():
		if is_instance_valid(title_ui):
			title_ui.queue_free()
			title_ui = null
			_show_title.call_deferred())
	if OS.get_cmdline_user_args().has("--henlab"):
		_hen_lab()
	elif OS.get_cmdline_user_args().has("--map"):
		var ua = OS.get_cmdline_user_args()
		if ua.has("--save-level"):
			save.level = int(ua[ua.find("--save-level") + 1])
			save.best = {"1": 3, "2": 2}
		_show_map(int(ua[ua.find("--from") + 1]) if ua.has("--from") else -1)
	elif OS.get_cmdline_user_args().has("--level"):
		_start_level(clampi(int(OS.get_cmdline_user_args()[OS.get_cmdline_user_args().find("--level") + 1]), 1, PLAYABLE) - 1)
	else:
		_show_title()

# Review sheet: the hen in every mood and routine, big (run with -- --henlab [page]).
func _hen_lab() -> void:
	var ua = OS.get_cmdline_user_args()
	var page = int(ua[ua.find("--henlab") + 1]) if ua.find("--henlab") + 1 < ua.size() else 0
	var sets = [
		[["front", "idle"], ["level", "idle"], ["front", "happy"], ["level", "happy"], ["level", "worried"], ["front", "cry"], ["front", "dance"], ["level", "gasp"], ["front", "phew"]],
		[["r", "cheer"], ["r", "pump"], ["r", "dance"], ["r", "juggle"], ["r", "backflip"], ["r", "chicks"], ["r", "strut"], ["r", "encourage"], ["level", "cry"]],
		[["v0", "front"], ["v1", "front"], ["v2", "front"], ["v0", "level"], ["v1", "level"], ["v2", "level"]],
	]
	var items = sets[clampi(page, 0, sets.size() - 1)]
	var sz = get_viewport_rect().size
	for i in items.size():
		var h = Hen.new()
		h.H = 190.0
		h.position = Vector2(sz.x * (0.18 + (i % 3) * 0.32), 300 + (i / 3) * 400) - sz / 2
		h.stage_top = -280.0
		if items[i][0] == "r":
			add_child(h)
			h.play(items[i][1], 1.0)
		elif items[i][0].begins_with("v"):
			h.role = items[i][1]
			h.force_variant = int(items[i][0].substr(1))
			add_child(h)
			var again = func(): h.set_mood("happy")
			var tm = Timer.new()
			tm.wait_time = 1.6
			tm.autostart = true
			tm.timeout.connect(again)
			add_child(tm)
			again.call()
		else:
			h.role = items[i][0]
			add_child(h)
			h.set_mood(items[i][1])
		var l = Label.new()
		l.text = items[i][0] + " " + items[i][1]
		l.add_theme_font_override("font", font)
		l.add_theme_font_size_override("font_size", 24)
		l.position = h.position + Vector2(-90, 14)
		add_child(l)

# ---------------------------------------------------------------- save
func _load_save() -> void:
	if FileAccess.file_exists(SAVE_PATH):
		var d = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
		if d is Dictionary:
			save.merge(d, true)
	# 0.2 wrote star keys as "1.0"; keep them as plain level numbers
	var fixed = {}
	for k in save.best:
		fixed[str(int(float(k)))] = save.best[k]
	save.best = fixed

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
	var top = UI.safe_top()
	# logo: white heavy letters with a ginger drop (no outline), gently bobbing
	var logo_sh = UI.label(title_ui, "Eggscape", 96, UI.BRAND_D, 900)
	var logo = UI.label(title_ui, "Eggscape", 96, Color.WHITE, 900)
	# a thick ginger outline on both layers keeps the white letters readable over clouds and sun
	for l in [logo_sh, logo]:
		l.add_theme_color_override("font_outline_color", UI.BRAND_D)
		l.add_theme_constant_override("outline_size", 18)
		l.size = Vector2(sz.x, 130)
		l.pivot_offset = l.size / 2
	logo.position = Vector2(0, top + sz.y * 0.1)
	logo_sh.position = logo.position + Vector2(0, 7)
	# tagline on a white pill so it reads over clouds and sky alike
	var tag_text = "Roll every egg home"
	var tw_px = UI.font(900).get_string_size(tag_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 26).x
	var pill = Panel.new()
	var psb = StyleBoxFlat.new()
	psb.bg_color = Color.WHITE
	psb.set_corner_radius_all(24)
	psb.border_color = Color("D9EEF8")
	psb.border_width_bottom = 4
	psb.anti_aliasing = true
	pill.add_theme_stylebox_override("panel", psb)
	pill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pill.size = Vector2(tw_px + 56, 48)
	pill.position = Vector2(sz.x / 2 - pill.size.x / 2, logo.position.y + 152)
	title_ui.add_child(pill)
	var tag = UI.label(pill, tag_text, 26, UI.BRAND_D, 900)
	tag.size = Vector2(pill.size.x, 44)
	var bob = create_tween().set_loops()
	for l in [logo, logo_sh]:
		pass
	bob.tween_property(logo, "rotation", 0.025, 1.3).set_trans(Tween.TRANS_SINE)
	bob.parallel().tween_property(logo_sh, "rotation", 0.025, 1.3).set_trans(Tween.TRANS_SINE)
	bob.tween_property(logo, "rotation", -0.025, 1.3).set_trans(Tween.TRANS_SINE)
	bob.parallel().tween_property(logo_sh, "rotation", -0.025, 1.3).set_trans(Tween.TRANS_SINE)
	var b_y = sz.y - UI.safe_bottom() - 84 - 92
	# a toy vault turning in the middle, the hen on the hill to the left of her nest (she faces you; tap her)
	var art = TitleArt.new()
	var mid_top = pill.position.y + pill.size.y + 30.0
	var hen_h = minf(sz.y * 0.2, sz.x * 0.4)
	var feet = b_y - 26.0
	art.vault_r = minf(sz.x * 0.22, (feet - hen_h - mid_top - 40.0) * 0.42)
	art.vault_c = Vector2(sz.x / 2, mid_top + art.vault_r * 1.1)
	art.nest_c = Vector2(sz.x * 0.7, feet - 6.0)
	art.nest_w = minf(sz.x * 0.3, 210.0)
	title_ui.add_child(art)
	var h = Hen.new()
	h.role = "front"
	h.pokeable = true
	h.face = 1.0
	h.H = hen_h
	h.position = Vector2(sz.x * 0.3, feet)
	title_ui.add_child(h)
	# says hi: wings up, eyes wide, beak open, then settles into her idle life
	h.set_mood("wow")
	var b = UI.button(title_ui, "PLAY", UI.GREEN, 36)
	b.size = Vector2(minf(520.0, sz.x - 64.0), 84)
	b.position = Vector2(sz.x / 2 - b.size.x / 2, b_y)
	b.pivot_offset = b.size / 2
	var lv: Dictionary = levels[mini(int(save.level), PLAYABLE) - 1]
	var sub = UI.label(title_ui, "Level %d  ·  %s" % [int(lv.id), str(lv.name)], 24, Color.WHITE, 900)
	sub.size = Vector2(sz.x, 36)
	sub.position = Vector2(0, b.position.y + b.size.y + 22)
	var br = create_tween().set_loops()
	br.tween_property(b, "scale", Vector2(1.03, 1.03), 0.7).set_trans(Tween.TRANS_SINE)
	br.tween_property(b, "scale", Vector2.ONE, 0.7).set_trans(Tween.TRANS_SINE)
	b.pressed.connect(func():
		Sfx.play("grab")
		Sfx.buzz(15, 0.4)
		h.set_mood("cheer")
		_go(func():
			title_ui.queue_free()
			title_ui = null
			_show_map(-1)))

# ---------------------------------------------------------------- map
func _show_map(from_level: int) -> void:
	_clear_level()
	if is_instance_valid(map_ui):
		map_ui.queue_free()
	map_ui = MapScreen.new()
	map_ui.levels = levels
	map_ui.save = save
	map_ui.playable = PLAYABLE
	map_ui.from_level = from_level
	ui.add_child(map_ui)
	map_ui.open()
	map_ui.play.connect(func(i): _go(func():
		map_ui.queue_free()
		map_ui = null
		_start_level(i)))

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
	hen.H = 150.0
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
	hud.title = "%d  %s" % [int(lv.id), str(lv.name)]
	hud.n_eggs = vault.n_eggs
	hud.target = vault.target
	hud.time_limit = vault.time_limit
	vault.eggs_changed.connect(func(): hud.n_eggs = vault.n_eggs)
	vault.thief_event.connect(_on_thief)
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
	_cam_reset()
	_fit()
	var ua = OS.get_cmdline_user_args()
	if ua.has("--autowin"):
		# screenshot helper: skip play and show the win stage
		get_tree().create_timer(0.5).timeout.connect(func():
			vault.n_saved = vault.n_eggs
			vault.done = true
			_on_finished(true))
	if ua.has("--test-curtain") or ua.has("--test-curtain-cold"):
		# dev check: a burning egg dropped onto the first thorn curtain burns it away, a plain one breaks
		get_tree().create_timer(0.3).timeout.connect(func():
			for ring in vault.rings:
				for g in ring.gaps:
					if g.curtain != null:
						ring.angle = PI / 2 - g.a
						ring.target = ring.angle
						var wa = PI / 2
						var e = vault.eggs[0]
						if not ua.has("--test-curtain-cold"):
							e.fire = 6.0
							e.fire_kind = "fire_red"
						e.position = Vector2.from_angle(wa) * (ring.r - 0.35) * G.PPM
						e.linear_velocity = Vector2.ZERO
						get_tree().create_timer(2.5).timeout.connect(func(): print("CURTAIN alive=", g.curtain.alive, " egg alive=", e.alive, " ch=", e.ch))
						return)
	if ua.has("--autofail"):
		get_tree().create_timer(0.5).timeout.connect(func():
			vault.done = true
			_on_finished(false))
	if ua.has("--bot"):
		var bot = preload("res://scripts/bot.gd").new()
		add_child(bot)
		bot.attach(vault, int(ua[ua.find("--bot") + 1]))
		tree_exiting.connect(func(): print("BOT L%d seed %s: %s" % [int(lv.id), ua[ua.find("--bot") + 1], bot.report()]))
		return
	_banner(str(lv.get("intro", {}).get("title", lv.name)), str(lv.get("intro", {}).get("line", lv.get("tip", ""))))

func _banner(title: String, line: String) -> void:
	# tip card: white rounded card at the bottom, rises in, leaves after a few seconds or on the first ring grab
	var sz = get_viewport_rect().size
	var box = Control.new()
	box.set_anchors_preset(Control.PRESET_FULL_RECT)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(box)
	banner = box
	var card = Panel.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color.WHITE
	sb.set_corner_radius_all(24)
	sb.border_color = Color("E6DED3")
	sb.border_width_bottom = 5
	sb.anti_aliasing = true
	card.add_theme_stylebox_override("panel", sb)
	card.size = Vector2(minf(640.0, sz.x - 32.0), 146)
	# sits in the sky between the top bar and the vault (_fit keeps that room free), never over the rings or the hen
	card.position = Vector2(sz.x / 2 - card.size.x / 2, UI.safe_top() + 136.0)
	card.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(card)
	var t = UI.label(card, title, 30, UI.BRAND, 900, HORIZONTAL_ALIGNMENT_LEFT)
	t.position = Vector2(26, 14)
	t.size = Vector2(card.size.x - 52, 40)
	var l = UI.label(card, line, 22, UI.INK, 800, HORIZONTAL_ALIGNMENT_LEFT)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.vertical_alignment = VERTICAL_ALIGNMENT_TOP
	l.position = Vector2(26, 56)
	l.custom_minimum_size = Vector2(card.size.x - 52, 0)
	l.update_minimum_size()
	l.size = Vector2(card.size.x - 52, 80)
	# grow the card to fit the tip (2 or 3 lines)
	var lines = maxi(1, l.get_line_count())
	l.size.y = lines * 30.0
	card.size.y = 64.0 + lines * 30.0 + 14.0
	var y0 = card.position.y
	card.position.y = y0 - 40
	card.modulate.a = 0.0
	var tw = create_tween()
	tw.tween_property(card, "position:y", y0, 0.45).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT).set_delay(0.35)
	tw.parallel().tween_property(card, "modulate:a", 1.0, 0.25).set_delay(0.35)
	tw.tween_interval(4.5)
	tw.tween_property(card, "position:y", y0 - 40, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
	tw.parallel().tween_property(card, "modulate:a", 0.0, 0.3)
	tw.tween_callback(box.queue_free)

func _fit() -> void:
	if vault == null or not is_instance_valid(vault):
		return
	var sz = get_viewport_rect().size
	var top = UI.safe_top() + 140.0
	var bottom = UI.safe_bottom() + 30.0
	var R: float = (vault.outer_r + 0.3) * G.PPM
	var gy: float = (vault.ground_y + 0.55) * G.PPM
	var hen_r: float = (vault.nest_x + vault.nest_w / 2 + 1.3) * G.PPM
	var half_w = maxf(R, hen_r)
	var h = R + gy
	var z = minf(sz.x / (half_w * 2.0), (sz.y - top - bottom) / h)
	# keep a strip of sky under the top bar for the tip card when the screen allows it without shrinking the vault much
	var z_res = minf(sz.x / (half_w * 2.0), (sz.y - top - 190.0 - bottom) / h)
	if z_res >= z * 0.9:
		z = z_res
		top += 190.0
	cam_zoom = z
	# centre the content box under the HUD
	var content_mid = (gy - R) / 2.0
	# on tall phones push the vault down toward the thumbs and leave the spare room to the sky
	var spare = maxf(0.0, (sz.y - top - bottom) - h * z)
	cam_pos = Vector2(0, content_mid - (top - bottom) / 2.0 / z - spare * 0.35 / z)
	_cam_apply(0.0)

# ---------------------------------------------------------------- reactions
func _hen_mood(m: String, hold: float) -> void:
	if hen == null:
		return
	hen.set_mood(m)
	hen_hold = hold

func _on_thief(kind: String) -> void:
	if kind in ["grab", "stash", "phase"]:
		_hen_mood("worried", 1.4)
		shake = maxf(shake, 4.0)
	elif kind == "in":
		_hen_mood("wow", 1.0)
	elif kind in ["bonk", "hit", "trapped"]:
		_hen_mood("cheer", 1.1)
	elif kind == "beaten":
		_hen_mood("cheer", 2.0)
		_punch(0.05)

func _on_saved(_e) -> void:
	hud.saved += 1
	hud.pop = 1.0
	_hen_mood("cheer", 1.1)
	_punch(0.035)
	cam_focus = Vector2(vault.nest_x * G.PPM, vault.ground_y * G.PPM)
	cam_focus_t = 0.5

func _on_broke(_e, why: String) -> void:
	hud.broken += 1
	hud.shake = 1.0
	shake = 14.0
	_punch(-0.03)
	_cam_kick(0.02 if randf() < 0.5 else -0.02)
	_hen_mood("sad", 1.4)

func _on_finished(won: bool) -> void:
	var stars: int = vault.stars()
	cam_out_kind = "win" if won else "fail"
	cam_out = 0.0
	var key0 = str(int(levels[idx].id))
	var first_world = int(save.best.get(key0, 0)) == 0 and (idx == 0 or int(levels[idx].world) != int(levels[idx - 1].world))
	var routine = Cheer.pick(stars, int(save.streak), levels[idx].has("boss"), first_world, str(save.get("routine", "")))
	if won:
		save.routine = routine
		save.streak = int(save.streak) + 1
		var gain = 10 + stars * 10
		save.coins = int(save.coins) + gain
		var key = str(int(levels[idx].id))
		save.best[key] = maxi(int(save.best.get(key, 0)), stars)
		save.level = maxi(int(save.level), mini(idx + 2, PLAYABLE))
		_write_save()
		_hen_mood("celebrate", 99.0)
	else:
		save.streak = 0
		_write_save()
		_hen_mood("sad", 99.0)
	await get_tree().create_timer(0.9).timeout
	if is_instance_valid(banner):
		banner.queue_free()
	var c = Celebrate.new()
	over.add_child(c)
	var secs = int(vault.play_t)
	var tstr = "%d:%02d" % [secs / 60, secs % 60]
	if won:
		var titles = ["", "Phew, made it!", "Great job!", "Perfect!"]
		var subs = ["", "%d of %d eggs made it home" % [vault.n_saved, vault.n_eggs], "Every egg home", "Every egg home, not one crack"]
		c.open(true, stars, [["EGGS", vault.n_saved, "%d/" + str(vault.n_eggs), UI.BRAND, "egg"],
			["COINS", 10 + stars * 10, "+%d", UI.GOLD_D, "coin"], ["TIME", 0, tstr, UI.BLUE, "clock"]], titles[stars], subs[stars], routine)
	else:
		c.open(false, 0, [["EGGS SAVED", vault.n_saved, "%d/" + str(vault.target), UI.BRAND, "crack"]], "So close!", "Save %d eggs to open the vault" % vault.target)
	var was = idx
	c.next_pressed.connect(func(): _go(func(): _show_map(was)))
	c.retry_pressed.connect(func(): _go(func(): _start_level(idx)))
	c.home_pressed.connect(func(): _go(func(): _show_map(-1)))

func _punch(k: float) -> void:
	cam_pv += k * 22.0

# ---------------------------------------------------------------- camera
# The level camera is a base framing (_fit) plus a few layered moves, all springs or eases so nothing snaps:
#   intro    the level opens close on the eggs in the middle and pulls back to the whole vault (1.1 s)
#   lean     it drifts a little toward an egg that is falling fast, and leans in a touch while it falls
#   punch    a quick zoom spring: in on a save, out on a break (plus the shake and a small tilt kick)
#   outro    on a win it pushes in on the nest; on a fail it eases out and tilts
var cam_zoom := 1.0
var cam_pos := Vector2.ZERO
var cam_intro := 1.0
var cam_lean := Vector2.ZERO
var cam_lean_z := 0.0
var cam_p := 0.0
var cam_pv := 0.0
var cam_tilt := 0.0
var cam_tv := 0.0
var cam_out := 0.0
var cam_out_kind := ""
var cam_focus := Vector2.ZERO
var cam_focus_t := 0.0

func _cam_reset() -> void:
	cam_intro = 0.0
	cam_lean = Vector2.ZERO
	cam_lean_z = 0.0
	cam_p = 0.0
	cam_pv = 0.0
	cam_tilt = 0.0
	cam_tv = 0.0
	cam_out = 0.0
	cam_out_kind = ""
	cam_focus_t = 0.0
	cam.rotation = 0.0
	cam.ignore_rotation = false

func _cam_kick(rad: float) -> void:
	cam_tv += rad * 30.0

func _cam_apply(dt: float) -> void:
	if vault == null or not is_instance_valid(vault):
		cam.rotation = 0.0
		return
	cam_intro = minf(1.0, cam_intro + dt / 1.1)
	var ki = 1.0 - pow(1.0 - cam_intro, 3.0)
	# lean toward the fastest falling egg
	var want = Vector2.ZERO
	var want_z = 0.0
	var best = 3.0 * G.PPM
	for e in vault.eggs:
		if is_instance_valid(e) and e.alive and not e.saved and e.linear_velocity.y > best:
			best = e.linear_velocity.y
			want = (e.position - cam_pos) * 0.07
			want_z = 0.025
	if cam_focus_t > 0.0:
		cam_focus_t -= dt
		want = (cam_focus - cam_pos) * 0.1
		want_z = 0.03
	var a = 1.0 - exp(-dt * 3.0)
	cam_lean = cam_lean.lerp(want, a)
	cam_lean_z = lerpf(cam_lean_z, want_z, a)
	# springs: zoom punch and tilt
	if dt > 0.0:
		cam_pv += (-170.0 * cam_p - 15.0 * cam_pv) * dt
		cam_p += cam_pv * dt
		cam_tv += (-120.0 * cam_tilt - 9.0 * cam_tv) * dt
		cam_tilt += cam_tv * dt
	# outro
	var zo = 0.0
	var po = Vector2.ZERO
	if cam_out_kind != "":
		cam_out = minf(1.0, cam_out + dt / 0.9)
		var ko = cam_out * cam_out * (3.0 - 2.0 * cam_out)
		if cam_out_kind == "win":
			var nest = Vector2((vault.nest_x) * G.PPM, vault.ground_y * G.PPM)
			zo = 0.14 * ko
			po = (nest - cam_pos) * 0.3 * ko
		else:
			zo = -0.06 * ko
			cam_tilt = lerpf(cam_tilt, 0.025, a)
	var start_pos = Vector2(0, 0)
	var pos = start_pos.lerp(cam_pos, ki) + cam_lean + po
	var z = cam_zoom * lerpf(1.32, 1.0, ki) * (1.0 + cam_lean_z + cam_p + zo)
	cam.zoom = Vector2(z, z)
	cam.position = pos
	cam.rotation = cam_tilt + (1.0 - ki) * 0.05

# ---------------------------------------------------------------- per frame
func _process(dt: float) -> void:
	if vault and is_instance_valid(vault) and hud:
		hud.time_left = vault.time_left
		hud.cursed = vault.curse_t > 0.0
	if vault and is_instance_valid(vault) and hen:
		backdrop.sway = vault.rings[0].angle if vault.rings.size() > 0 else 0.0
		hen_hold -= dt
		if hen_hold <= 0.0 and not vault.done:
			hen.set_mood("worried" if vault.falling_fast() else "idle")
	shake = move_toward(shake, 0.0, dt * 40.0)
	cam.offset = Vector2(randf_range(-1, 1), randf_range(-1, 1)) * shake
	_cam_apply(dt)

func _unhandled_input(ev: InputEvent) -> void:
	if vault == null or not is_instance_valid(vault) or _busy:
		return
	if ev is InputEventScreenTouch or ev is InputEventScreenDrag:
		if ev.index != 0:
			return
		var wp: Vector2 = get_viewport().get_canvas_transform().affine_inverse() * ev.position
		vault.pointer(ev, wp)
