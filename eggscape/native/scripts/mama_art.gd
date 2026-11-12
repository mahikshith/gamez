# Mama hen's art: a line-for-line port of the web game's hen (src/render/hen.js: side body, three-quarter head, cel
# shaded, the farm's brown outline) plus a FRONT view built from the game's first hen (src/render/characters.js
# drawHen: the round front-facing hen) and driven by the same pose keys, so every move reads from either side.
# Units: a 100-unit box centred on (cx, cy), y down, feet at cy + 48. P = a pose (see KEYS), o = draw options.
extends RefCounted

const TAU_ := TAU
const LINE := Color("6b4a2a")
const RED_HI := Color("f0402f")
const RED_LO := Color("b81f17")
const RED_LINE := Color("7a1810")
const BEAK_HI := Color("ffc247")
const BEAK_LO := Color("e57d12")
const BEAK_LINE := Color("8a4a0a")
const LEG_HI := Color("ffb83a")
const LEG_FAR := Color("d77f17")
const LEG_LINE := Color("8a4a0a")
const EYE := Color("2a1d14")
const HI := Color("fffdf7")
const MID := Color("fbf0dc")
const LO := Color("efdcba")
const SHADE := Color("ddbf8f")
const SCAL := Color(150 / 255.0, 104 / 255.0, 58 / 255.0, 0.55)
const WING := [Color("fffaf0"), Color("f1e1c3")]
const WING_LO := Color("d6b583")
const FAR := [Color("e6d3b0"), Color("cfb084")]
const TAIL := [Color("fbf1de"), Color("e9d4ad")]
const TAIL_LO := Color("cfab76")

const KEYS := ["lift", "sq", "lean", "sway", "dx", "hx", "hy", "hr", "comb", "wa", "wf", "sp", "puff", "tufts", "tail", "tsp",
	"fL", "fR", "sL", "sR", "eWide", "eHappy", "eSqueeze", "brow", "browY", "pdx", "pdy", "beak", "tear", "blush", "sweat", "spin", "twirl", "grit", "wink", "fw"]

static func rest() -> Dictionary:
	var P = {}
	for k in KEYS:
		P[k] = 0.0
	P.puff = 1.0
	P.blush = 0.3
	return P

static func pose(o: Dictionary) -> Dictionary:
	var P = rest()
	for k in o:
		P[k] = o[k]
	return P

static func ss(a: float, b: float, x: float) -> float:
	var k = clampf((x - a) / (b - a), 0.0, 1.0)
	return k * k * (3.0 - 2.0 * k)

static func fract(x: float) -> float:
	return x - floorf(x)

static func hsh(n: float) -> float:
	return fract(sin(n * 127.1 + 311.7) * 43758.5453)

static func ease_out_back(x: float) -> float:
	return 1.0 + 2.70158 * pow(x - 1.0, 3) + 1.70158 * pow(x - 1.0, 2)

static func outline_w(s: float, base := 2.8) -> float:
	return maxf(base, 110.0 / s)

static func _o(o: Dictionary, k: String, d):
	return o[k] if o.has(k) and o[k] != null else d

# ================================================================== SIDE VIEW (hen.js drawHenPose)
static func draw_side(c, P: Dictionary, cx: float, cy: float, h: float, o := {}) -> void:
	if not (h > 0.0):
		return
	var tt: float = _o(o, "tt", 0.0)
	var calm: bool = _o(o, "calm", false)
	var face: float = _o(o, "face", -1.0)
	var fs = 1.0 if face >= 0.0 else -1.0
	var f = {eWide = P.eWide, eHappy = P.eHappy, eSqueeze = P.eSqueeze, brow = P.brow, browY = P.browY, pdx = P.pdx, pdy = P.pdy,
		beak = P.beak, tear = P.tear, blush = P.blush, blink = _o(o, "blink", 0.0), grit = P.grit, wink = P.wink}
	c.save()
	c.translate(cx, cy)
	c.scale(h / 100.0, h / 100.0)
	_enter(c, o, calm)
	c.translate(_o(o, "x", 0.0) + P.dx, 0)
	var ol = outline_w(h)
	_shadow(c, o, P, -2.0 * fs)
	c.save()
	var tw = cos(P.twirl)
	var sxx = (signf(tw) * 0.3 if absf(tw) < 0.3 else tw) if tw != 0.0 else 0.3
	c.scale(fs * maxf(0.1, absf(face)) * sxx, 1.0)
	if P.spin != 0.0:
		var py = 14.0 - P.lift
		c.translate(0, py)
		c.rotate(P.spin)
		c.translate(0, -py)
	_legs(c, P, ol)
	c.save()
	c.translate(0, 44.0 - P.lift)
	c.rotate(P.lean + P.sway)
	var sy = 1.0 + P.sq
	var sx = 1.0 - 0.7 * P.sq
	c.scale(sx * P.puff, sy * P.puff)
	c.translate(0, -44)
	var H = Vector2(21.0 + P.hx, -25.0 + P.hy)
	var fw = clampf(P.fw, 0.0, 1.0)
	_wing(c, ol, 9.0 - 14.0 * fw, -6.0 - 5.0 * fw, P.wf - 0.12, P.sp, true)
	_tail(c, P, ol)
	if P.tufts > 0.02:
		_tufts(c, P.tufts, tt, ol, TUFTS)
	_body(c, H, ol)
	_head(c, H, P, f, tt, ol, _o(o, "hat", null))
	_wing(c, ol, 1, -1, P.wa, P.sp, false)
	if P.sweat > 0.02:
		var k = fract(tt * 0.8)
		drop(c, H.x - 15.0, H.y - 8.0 + k * 9.0, 3.6, ol * 0.7, (1.0 - k * 0.6) * clampf(P.sweat, 0.0, 1.0))
	c.restore()
	_extras_in(c, o, ol, tt)
	c.restore()
	_extras_out(c, o, ol, tt, fs)
	c.restore()

static func _enter(c, o: Dictionary, calm: bool) -> void:
	var en = _o(o, "enter", null)
	if en != null and en < 0.6 and not calm:
		var pop = maxf(0.001, ease_out_back(clampf(en / 0.5, 0.0, 1.0)))
		c.alpha *= clampf(en * 8.0, 0.0, 1.0)
		c.translate(0, 48)
		c.scale(pop, pop)
		c.translate(0, -48)

static func _shadow(c, o: Dictionary, P: Dictionary, x: float) -> void:
	var sh = _o(o, "shadow", 0.0)
	if sh > 0.0:
		var k = 1.0 / (1.0 + maxf(0.0, P.lift) / 22.0)
		c.begin_path()
		c.oval(x, 48.5, 34.0 * k, 7.0 * k)
		c.fill_path(Color(0, 0, 0, sh * k))

static func _extras_in(c, o: Dictionary, ol: float, tt: float) -> void:
	var b = _o(o, "burst", null)
	if b != null and b.u >= 0.0:
		burst(c, b.u, b.k, ol)
	var lo = _o(o, "loose", 0.0)
	if lo > 0.0:
		loose(c, tt, ol, lo)

static func _extras_out(c, o: Dictionary, ol: float, tt: float, fs: float) -> void:
	var nt = _o(o, "notes", 0.0)
	if nt > 0.05:
		notes(c, tt, ol, nt)
	var hu = _o(o, "heart", -1.0)
	if hu >= 0.0 and hu < 1.0:
		heart(c, 14.0 * fs, -58.0 - hu * 16.0, 7.0 + 2.0 * sin(minf(1.0, hu * 3.0) * PI), ol, 1.0 - ss(0.65, 1.0, hu))

# a filled shape with a hard two-tone split: lo covers the part below y = cut
static func _two_tone(c, ol: float, path: Callable, hi, lo: Color, cut: float, line := LINE, w := 1.0) -> void:
	c.begin_path()
	path.call(c)
	c.fill_path(hi)
	c.save()
	c.clip_path()
	c.fill_rect(-200, cut, 400, 400, lo)
	c.restore()
	c.begin_path()
	path.call(c)
	c.stroke_path(line, ol * w)

static func _legs(c, P: Dictionary, o: float) -> void:
	var L = [{x = -6.0, st = P.sL, up = P.fL, c = LEG_FAR}, {x = 5.0, st = P.sR, up = P.fR, c = LEG_HI}]
	for l in L:
		var fy = minf(48.0, 48.0 - P.lift - l.up)
		var top = 32.0 - P.lift
		var fx = l.x + l.st
		var air = clampf((l.up + P.lift) / 6.0, 0.0, 1.0)
		var curl = air * 3.5
		for ps in [0, 1]:
			var col = l.c if ps else LEG_LINE
			c.begin_path()
			c.move_to(l.x, top)
			c.line_to(fx, fy)
			c.stroke_path(col, 4.4 + (0.0 if ps else o * 1.4))
			c.begin_path()
			c.move_to(fx, fy)
			c.line_to(fx + 9.0 - curl * 0.6, fy + 0.6 + curl)
			c.move_to(fx, fy)
			c.line_to(fx + 6.0 - curl * 0.4, fy + 2.2 + curl * 0.8)
			c.move_to(fx, fy)
			c.line_to(fx - 4.5 + curl * 0.3, fy + 1.0 + curl * 0.6)
			c.stroke_path(col, 2.8 + (0.0 if ps else o * 1.4))
		c.begin_path()
		for i in range(1, 4):
			var u = 0.4 + i * 0.15
			var x = lerpf(l.x, fx, u)
			var y = lerpf(top, fy, u)
			c.move_to(x - 2.0, y - 0.6)
			c.line_to(x + 2.0, y + 0.6)
		c.stroke_path(LEG_LINE, o * 0.5)

static func _wing(c, o: float, x: float, y: float, raise: float, sp: float, far: bool) -> void:
	c.save()
	c.translate(x, y)
	c.rotate(PI - 0.3 + raise)
	if far:
		c.scale(0.94, 0.94)
	sp = clampf(sp, 0.0, 1.2)
	var L = 37.0 + 9.0 * sp
	var W = 13.0 + 4.0 * sp
	var n = 4
	var dip = 3.4 + 2.4 * sp
	var T = []
	for i in n + 1:
		var b = float(i) / n
		T.append(Vector2(L * (1.0 - b * 0.8), -W * (0.05 + b * (0.8 + 0.25 * sp))))
	var path = func(cc):
		cc.move_to(0, W * 0.55)
		cc.bez_to(L * 0.3, W * 1.05, L * 0.78, W * 0.75, L, 0)
		for i in n:
			var p0 = T[i]
			var p1 = T[i + 1]
			var m = (p0 + p1) / 2.0
			var d = p1 - p0
			var l = maxf(d.length(), 0.001)
			cc.quad_to(m.x - (d.y / l) * dip, m.y + (d.x / l) * dip, p1.x, p1.y)
		cc.quad_to(-5, -W * 0.5, 0, W * 0.55)
		cc.close_path()
	var col = FAR if far else WING
	var lo = Color("bf9d6e") if far else WING_LO
	c.begin_path()
	path.call(c)
	c.fill_path(col[0])
	c.save()
	c.clip_path()
	c.fill_rect(-20, -60, L + 40, 60 + W * 0.15, col[1])
	c.fill_rect(-20, -60, L + 40, 60 - W * 0.45, lo)
	c.begin_path()
	for i in 3:
		var u = i / 3.0
		var x0 = lerpf(L * 0.62, L * 0.12, u)
		var y0 = lerpf(W * 0.25, -W * 0.25, u)
		var x1 = lerpf(L * 0.62, L * 0.12, u + 1.0 / 3.0)
		var y1 = lerpf(W * 0.25, -W * 0.25, u + 1.0 / 3.0)
		c.move_to(x0, y0)
		c.quad_to((x0 + x1) / 2.0 - 1.5, (y0 + y1) / 2.0 - 3.4, x1, y1)
	for i in range(1, n):
		var tp = T[i]
		c.move_to(tp.x + 1.0, tp.y + 1.2)
		c.line_to(lerpf(tp.x, L * 0.5, 0.45), lerpf(tp.y, -W * 0.05, 0.6))
	c.stroke_path(LINE, o * 0.6)
	c.restore()
	c.begin_path()
	path.call(c)
	c.stroke_path(LINE, o)
	c.restore()

static func _tail(c, P: Dictionary, o: float) -> void:
	c.save()
	c.translate(-33, -2)
	c.rotate(P.tail)
	var spread = 0.27 * (1.0 + 0.5 * clampf(P.tsp, -0.6, 1.0))
	for i in [0, 4, 1, 3, 2]:
		var a = -2.05 + (i - 2) * spread
		var ln = 27.0 - absf(i - 2) * 3.0
		var w = 10.0
		c.save()
		c.rotate(a)
		var path = func(cc):
			cc.move_to(0, -w * 0.4)
			cc.line_to(ln - w * 0.5, -w * 0.5)
			cc.arc(ln - w * 0.5, 0, w * 0.5, -PI / 2, PI / 2)
			cc.line_to(0, w * 0.4)
			cc.close_path()
		_two_tone(c, o, path, TAIL[0] if i == 2 else TAIL[1], TAIL_LO, 0.4)
		c.begin_path()
		c.move_to(4, 0.2)
		c.line_to(ln - 4.0, 0.2)
		c.stroke_path(Color(150 / 255.0, 104 / 255.0, 58 / 255.0, 0.6), o * 0.5)
		c.restore()
	c.restore()

const TUFTS := [[33, 6, -0.35], [34, 20, 0.2], [-38, 20, 2.75], [-39, 4, -2.95], [-20, -13, -1.9], [8, -13, -1.5]]
const TUFTS_FRONT := [[-36, 8, -2.6], [-40, 22, 2.9], [37, 6, -0.5], [41, 21, 0.25], [-14, -30, -1.9], [14, -30, -1.25]]

static func _tufts(c, k: float, tt: float, o: float, list: Array) -> void:
	var L = 1.0 + 4.0 * clampf(k, 0.0, 1.2)
	var w = 3.6
	for i in list.size():
		var t = list[i]
		c.save()
		c.translate(t[0], t[1])
		c.rotate(t[2] + sin(tt * 19.0 + i * 2.0) * 0.07)
		c.begin_path()
		c.move_to(-6, -w)
		c.quad_to(L, -w * 1.1, L + w, 0)
		c.quad_to(L, w * 1.1, -6, w)
		c.close_path()
		c.solid(MID, LINE, o)
		c.restore()

static func _body_path(c) -> void:
	c.move_to(22, -9)
	c.bez_to(37, 0, 37, 26, 17, 35)
	c.bez_to(3, 41, -19, 40, -30, 29)
	c.bez_to(-40, 19, -43, 3, -37, -8)
	c.bez_to(-29, -15, -12, -14, 0, -13)
	c.bez_to(10, -12, 17, -12, 22, -9)
	c.close_path()

static func _neck_path(c, H: Vector2) -> void:
	c.move_to(0, -11)
	c.quad_to(H.x - 13.0, H.y + 10.0, H.x - 10.0, H.y + 4.0)
	c.line_to(H.x + 9.0, H.y + 6.0)
	c.quad_to(H.x + 12.0, H.y + 17.0, 31, -1)
	c.close_path()

static func _sil(c, H: Vector2) -> void:
	_body_path(c)
	_neck_path(c, H)
	c.circle(H.x, H.y, 13)

static func _body(c, H: Vector2, o: float) -> void:
	c.begin_path()
	_sil(c, H)
	c.stroke_path(LINE, o * 2.0)
	c.fill_path(LINE)
	var g = c.rad(-12, -16, 4, 66, [HI, MID, LO])
	c.save()
	c.begin_path()
	_sil(c, H)
	c.clip_path()
	c.fill_rect(-60, -60, 120, 120, SHADE)
	c.translate(-4.5, -5.5)
	c.begin_path()
	_sil(c, H)
	c.fill_path(g)
	c.translate(4.5, 5.5)
	c.begin_path()
	for p in [[22, 6], [29, 13], [17, 15], [25, 22], [12, 25], [20, 30], [4, 31], [-8, 33], [-20, 28], [-28, 20]]:
		c.move_to(p[0] - 4.0, p[1])
		c.quad_to(p[0], p[1] + 4.0, p[0] + 4.0, p[1])
	for i in 3:
		var x = H.x - 8.0 + i * 5.0
		var y = H.y + 13.0 + i * 1.5
		c.move_to(x, y)
		c.quad_to(x - 1.0, y + 5.0, x - 3.0, y + 8.0)
	c.stroke_path(SCAL, o * 0.6)
	c.restore()

static func _comb(c, o: float, lobes: Array, base: Array) -> void:
	var path = func(cc):
		for l in lobes:
			cc.circle(l[0], l[1], l[2])
		cc.move_to(base[0].x, base[0].y)
		for i in range(1, base.size()):
			cc.line_to(base[i].x, base[i].y)
		cc.close_path()
	c.begin_path()
	path.call(c)
	c.stroke_path(RED_LINE, o * 2.0)
	c.fill_path(RED_LINE)
	c.begin_path()
	path.call(c)
	var top = 1e9
	var bot = -1e9
	for l in lobes:
		top = minf(top, l[1] - l[2])
	for b in base:
		bot = maxf(bot, b.y)
	c.fill_path(c.lin(0, top, 0, bot, [RED_HI, RED_LO]))

static func _head(c, H: Vector2, P: Dictionary, f: Dictionary, tt: float, o: float, hat) -> void:
	c.save()
	c.translate(H.x, H.y)
	c.rotate(P.hr)
	c.begin_path()
	c.oval(-6, -6.5, 4.2, 2.6, -0.6)
	c.fill_path(Color(1, 1, 1, 0.75))
	c.save()
	c.translate(1, -10)
	c.rotate(P.comb)
	c.translate(-1, 10)
	_comb(c, o, [[-7, -12, 4], [-2, -15.5, 4.8], [4, -15, 4.5], [8.6, -11.2, 3.5]], [Vector2(-8, -8), Vector2(10, -8), Vector2(10, -12), Vector2(-8, -13)])
	c.dot(-3, -17.5, 1.5, Color(1, 1, 1, 0.5))
	c.dot(-8, -13.5, 1.1, Color(1, 1, 1, 0.5))
	c.restore()
	if f.blush > 0.01:
		c.begin_path()
		c.oval(-3, 5.5, 4, 2.4)
		c.fill_path(Color(1, 120 / 255.0, 120 / 255.0, clampf(f.blush, 0.0, 1.0)))
	var NE = {x = 0.5, y = -1.5, k = 1.0}
	var FE = {x = 10.0, y = -3.0, k = 0.64}
	_eyes(c, [NE, FE], f, o, 0)
	if f.tear > 0.01:
		c.save()
		c.alpha *= clampf(f.tear, 0.0, 1.0)
		c.begin_path()
		c.move_to(NE.x - 1.0, NE.y + 3.0)
		c.quad_to(NE.x - 4.0 + sin(tt * 8.0), NE.y + 9.0, NE.x - 3.0, NE.y + 15.0)
		c.stroke_path(Color(120 / 255.0, 205 / 255.0, 1.0, 0.95), 3.0)
		for i in 2:
			var k = fract(tt * 1.8 + i * 0.5)
			drop(c, NE.x - 3.0 - k * 3.0, NE.y + 15.0 + k * 20.0, 2.4, 1.0, 1.0 - k * 0.7)
			var k2 = fract(tt * 1.8 + i * 0.5 + 0.25)
			drop(c, FE.x + 4.0 + k2 * 10.0, FE.y + k2 * 18.0 + k2 * k2 * 8.0, 2.2, 1.0, 1.0 - k2 * 0.7)
		c.restore()
	var open = clampf(f.beak / 5.0, 0.0, 1.2)
	c.begin_path()
	c.move_to(8, 6 + open * 3)
	c.quad_to(13.5, 8.5 + open * 3.0, 10.5, 14.5 + open * 3.0)
	c.quad_to(6.5, 13 + open * 3.0, 6.5, 7 + open * 2.5)
	c.close_path()
	c.solid(c.lin(0, 6, 0, 16, [RED_HI, RED_LO]), RED_LINE, o * 0.8)
	c.save()
	c.translate(9, 1)
	if open > 0.08:
		c.save()
		c.rotate(open * 0.62)
		c.begin_path()
		c.move_to(0, 0)
		c.line_to(10.5, 1)
		c.line_to(9.5, 3.8)
		c.line_to(0, 4.4)
		c.close_path()
		c.solid(c.lin(0, 0, 10, 4, [BEAK_HI, BEAK_LO]), BEAK_LINE, o * 0.8)
		c.restore()
		var ca = cos(open * 0.62)
		var sa = sin(open * 0.62)
		c.begin_path()
		c.move_to(0.5, 0)
		c.line_to(10.5, 0.3)
		c.line_to(10.0 * ca - 0.8 * sa, 10.0 * sa + 0.8 * ca)
		c.line_to(0.5, 4)
		c.close_path()
		c.fill_path(Color("5a1710"))
		c.begin_path()
		c.oval(4.5, 2.6 + open * 1.8, 3.4, 1.2 + open * 0.7, open * 0.2)
		c.fill_path(Color("ff7a8a"))
	c.begin_path()
	c.move_to(-0.5, -4)
	c.quad_to(6.5, -4.8, 12, 0.8)
	c.quad_to(6, 2.6, -0.5, 2.6)
	c.close_path()
	c.solid(c.lin(0, -5, 0, 3, [BEAK_HI, BEAK_LO]), BEAK_LINE, o * 0.8)
	c.begin_path()
	c.oval(3.5, -2.4, 2.4, 0.8, 0.1)
	c.fill_path(Color(1, 1, 1, 0.55))
	c.restore()
	if hat is Callable:
		hat.call(c, P, o)
	c.restore()

# Eyes for both views. E = [{x, y, k}...]; near = index of the near eye (the one a wink shuts); mode 0 = side
# (three-quarter: brows tilt toward the beak), 1 = front (mirror pairs).
static func _eyes(c, E: Array, f: Dictionary, o: float, mode: int) -> void:
	var bl: float = f.blink
	var a0: float = c.alpha
	var wink = clampf(f.wink, 0.0, 1.0)
	var haps = []
	for i in E.size():
		haps.append(maxf(f.eHappy, wink) if i == 0 else f.eHappy * (1.0 - wink))
	var big = 1.0 if mode == 0 else 1.06
	for i in E.size():
		var e = E[i]
		var dotW = (1.0 - f.eWide) * (1.0 - haps[i]) * (1.0 - f.eSqueeze)
		if dotW > 0.01:
			c.alpha = a0 * dotW
			var px = e.x + f.pdx * (0.5 if mode == 0 else 0.6) * e.k
			var py = e.y + f.pdy * 0.4
			c.begin_path()
			c.oval(px, py, 3.6 * e.k * big, 4.6 * big * (1.0 - bl * 0.85) + 0.3)
			c.fill_path(EYE)
			if bl < 0.5:
				c.dot(px - 1.2 * e.k, py - 1.5, 1.35 * (0.6 + 0.4 * e.k), Color.WHITE)
	if f.eWide > 0.01:
		c.alpha = a0 * f.eWide * (1.0 - f.eHappy) * (1.0 - f.eSqueeze)
		for e in E:
			c.begin_path()
			c.oval(e.x, e.y - 0.5, 5.0 * e.k * big, 6.0 * big * (1.0 - bl * 0.8) + 0.2)
			c.solid(Color.WHITE, EYE, o * 0.8)
			if bl < 0.5:
				var px = e.x + clampf(f.pdx, -2.0, 2.0) * e.k
				var py = e.y + clampf(f.pdy, -2.0, 2.0)
				c.dot(px, py, 2.7 * (0.7 + 0.3 * e.k), EYE)
				c.dot(px - 0.8 * e.k, py - 0.9, 0.95, Color.WHITE)
	for i in E.size():
		if haps[i] <= 0.01:
			continue
		var e = E[i]
		c.alpha = a0 * haps[i]
		c.begin_path()
		c.move_to(e.x - 4.5 * e.k * big, e.y + 1.5)
		c.quad_to(e.x, e.y - 5.0, e.x + 4.5 * e.k * big, e.y + 1.5)
		c.stroke_path(EYE, o * 1.3)
	if f.eSqueeze > 0.01:
		c.alpha = a0 * f.eSqueeze * (1.0 - f.eHappy)
		c.begin_path()
		for i in E.size():
			var e = E[i]
			var d = (1.0 if i == 0 else -1.0) if mode == 0 else signf(e.x)
			var w = 4.0 * e.k
			c.move_to(e.x - d * w, e.y - 4.0)
			c.line_to(e.x + d * w, e.y - 0.5)
			c.line_to(e.x - d * w, e.y + 3.0)
		c.stroke_path(EYE, o * 1.2)
	if f.brow > 0.01:
		c.alpha = a0 * f.brow * (1.0 - f.eHappy)
		c.begin_path()
		if mode == 0:
			var NE = E[0]
			var FE = E[1]
			c.move_to(NE.x - 4.5, NE.y - 7.0 + f.browY)
			c.line_to(NE.x + 3.5, NE.y - 10.0 + f.browY)
			c.move_to(FE.x - 1.5, FE.y - 9.5 + f.browY)
			c.line_to(FE.x + 2.8, FE.y - 7.5 + f.browY)
		else:
			for e in E:
				var s = signf(e.x)
				c.move_to(e.x - s * 5.0, e.y - 10.5 + f.browY)
				c.line_to(e.x + s * 4.0, e.y - 7.5 + f.browY)
		c.stroke_path(EYE, o * 1.05)
	if f.grit > 0.01:
		c.alpha = a0 * clampf(f.grit, 0.0, 1.0)
		c.begin_path()
		if mode == 0:
			var NE = E[0]
			var FE = E[1]
			c.move_to(NE.x - 4.5, NE.y - 10.5)
			c.line_to(NE.x + 3.5, NE.y - 8.0)
			c.move_to(FE.x - 1.5, FE.y - 8.0)
			c.line_to(FE.x + 2.8, FE.y - 10.0)
		else:
			for e in E:
				var s = signf(e.x)
				c.move_to(e.x - s * 5.0, e.y - 8.0)
				c.line_to(e.x + s * 4.0, e.y - 11.0)
		c.stroke_path(EYE, o * 1.05)
	c.alpha = a0

# ================================================================== FRONT VIEW (characters.js drawHen, posed)
static func _body_half(c, sx: float) -> void:
	c.move_to(0, -36)
	c.bez_to(sx * 19, -36, sx * 26, -23, sx * 28, -10)
	c.bez_to(sx * 41, 2, sx * 43, 24, sx * 31, 35)
	c.bez_to(sx * 22, 43, sx * 10, 44, 0, 44)

static func _body_front(c) -> void:
	# one closed outline: the right half down, then the left half back up
	c.move_to(0, -36)
	c.bez_to(19, -36, 26, -23, 28, -10)
	c.bez_to(41, 2, 43, 24, 31, 35)
	c.bez_to(22, 43, 10, 44, 0, 44)
	c.bez_to(-10, 44, -22, 43, -31, 35)
	c.bez_to(-43, 24, -41, 2, -28, -10)
	c.bez_to(-26, -23, -19, -36, 0, -36)
	c.close_path()

# raise (side-view wing units: 0 folded, ~1.5 up, ~2.5 over the face) -> the front wing's angle
static func _front_ang(raise: float) -> float:
	return -0.12 - raise * 1.3 - 0.8 * maxf(0.0, raise - 2.0)

static func _wing_front(c, sx: float, x: float, y: float, ang: float, s: float, o: float) -> void:
	c.save()
	c.translate(sx * x, y)
	c.scale(sx * s, s)
	c.rotate(ang)
	c.begin_path()
	c.move_to(-6, -1)
	c.bez_to(-11, 9, -7, 22, 1, 29)
	c.quad_to(3, 25, 5, 27)
	c.quad_to(6, 22, 9, 22)
	c.bez_to(11, 12, 10, 3, 6, -2)
	c.quad_to(0, -6, -6, -1)
	c.close_path()
	c.fill_path(c.lin(0, -4, 0, 30, [Color("fffdf8"), Color("e2d3bd")]))
	c.save()
	c.clip_path()
	c.fill_rect(-20, 18, 40, 20, Color(0.84, 0.71, 0.51, 0.55))
	c.restore()
	c.stroke_path(LINE, o)
	c.begin_path()
	c.move_to(-1, 10)
	c.quad_to(2, 17, 1, 23)
	c.move_to(5, 9)
	c.quad_to(6, 14, 6, 19)
	c.stroke_path(LINE, o * 0.6)
	c.restore()

static func _feet_front(c, P: Dictionary, o: float) -> void:
	for ps in [0, 1]:
		var col = LEG_HI if ps else LEG_LINE
		for sx in [-1.0, 1.0]:
			var up = P.fL if sx < 0 else P.fR
			var st = P.sL if sx < 0 else P.sR
			var x = sx * 10.0 + sx * st * 0.35
			var fy = minf(48.0, 48.0 - P.lift - up)
			var top = 36.0 - P.lift
			var curl = clampf((up + P.lift) / 6.0, 0.0, 1.0) * 2.5
			c.begin_path()
			c.move_to(x, top)
			c.line_to(x, fy)
			c.stroke_path(col, 4.0 + (0.0 if ps else o * 1.4))
			c.begin_path()
			c.move_to(x - 6.0 + curl, fy + 1.5 + curl)
			c.line_to(x, fy)
			c.line_to(x + 6.0 - curl, fy + 1.5 + curl)
			c.move_to(x, fy)
			c.line_to(x + sx * 1.5, fy + 3.0 + curl)
			c.stroke_path(col, 3.0 + (0.0 if ps else o * 1.4))

static func draw_front(c, P: Dictionary, cx: float, cy: float, h: float, o := {}) -> void:
	if not (h > 0.0):
		return
	var tt: float = _o(o, "tt", 0.0)
	var calm: bool = _o(o, "calm", false)
	var face: float = _o(o, "face", -1.0)
	var fs = 1.0 if face >= 0.0 else -1.0
	var f = {eWide = P.eWide, eHappy = P.eHappy, eSqueeze = P.eSqueeze, brow = P.brow, browY = P.browY, pdx = P.pdx * fs, pdy = P.pdy,
		beak = P.beak, tear = P.tear, blush = P.blush, blink = _o(o, "blink", 0.0), grit = P.grit, wink = P.wink}
	c.save()
	c.translate(cx, cy)
	c.scale(h / 100.0, h / 100.0)
	_enter(c, o, calm)
	c.translate(_o(o, "x", 0.0) + P.dx, 0)
	var ol = outline_w(h)
	_shadow(c, o, P, 0.0)
	c.save()
	var tw = absf(cos(P.twirl))
	c.scale(maxf(0.3, tw) * _o(o, "squeeze", 1.0), 1.0)
	if P.spin != 0.0:
		var py = 14.0 - P.lift
		c.translate(0, py)
		c.rotate(P.spin)
		c.translate(0, -py)
	_feet_front(c, P, ol)
	c.save()
	c.translate(0, 44.0 - P.lift)
	c.rotate(P.sway * fs + P.lean * 0.25 * fs)
	var sy = 1.0 + P.sq
	var sx = 1.0 - 0.7 * P.sq
	c.scale(sx * P.puff, sy * P.puff)
	c.translate(0, -44)
	var HX = P.hx * 0.45 * fs
	var HY = P.hy * 0.6
	# tail fan peeking out behind her, on the side away from where she looks
	c.save()
	c.translate(-27.0 * fs, 10)
	c.scale(-fs * 0.8, 0.8)
	c.rotate(0.75 + P.tail * 1.2)
	for i in 3:
		c.save()
		c.rotate(-0.55 + i * 0.45 * (1.0 + 0.3 * clampf(P.tsp, -0.6, 1.0)))
		c.begin_path()
		c.oval(0, -13, 6.5, 15)
		c.solid(Color("fffaf0") if i == 1 else Color("efe2cd"), LINE, ol)
		c.restore()
	c.restore()
	if P.tufts > 0.02:
		_tufts(c, P.tufts, tt, ol, TUFTS_FRONT)
	# comb (wobbles from its base, follows the head)
	c.save()
	c.translate(HX, -33.0 + HY)
	c.rotate(-P.comb * 0.9 * fs + P.hr * 0.4 * fs)
	c.begin_path()
	c.move_to(-11, 2)
	c.arc(-7, -3, 5.5, PI * 0.85, PI * 1.75)
	c.arc(0, -8, 6.5, PI * 1.1, PI * 1.9)
	c.arc(7.5, -3, 5.5, PI * 1.25, PI * 2.15)
	c.line_to(9, 4)
	c.close_path()
	c.fill_path(c.lin(0, -15, 0, 4, [RED_HI, RED_LO]))
	c.stroke_path(RED_LINE, ol)
	c.dot(-2, -10.5, 1.4, Color(1, 1, 1, 0.5))
	c.restore()
	# body: outline under, two-tone fill (a tan crescent low on the side away from the light), belly, scallops
	c.begin_path()
	_body_front(c)
	c.stroke_path(LINE, ol * 2.0)
	c.fill_path(SHADE)
	c.save()
	c.clip_path()
	c.translate(-3.5, -4.5)
	c.begin_path()
	_body_front(c)
	c.fill_path(c.rad(-9, -14, 4, 56, [Color("fffdf8"), MID, LO]))
	c.translate(3.5, 4.5)
	c.begin_path()
	c.oval(0, 22, 22, 19)
	c.fill_path(Color(1, 253 / 255.0, 246 / 255.0, 0.85))
	c.begin_path()
	for p in [[-10, 16], [0, 19], [10, 16], [-5, 27], [5, 27], [-14, 30], [14, 30]]:
		c.move_to(p[0] - 4.0, p[1])
		c.quad_to(p[0], p[1] + 4.0, p[0] + 4.0, p[1])
	c.stroke_path(SCAL, ol * 0.6)
	c.restore()
	# face
	c.save()
	c.translate(HX, HY)
	c.translate(0, -12)
	c.rotate(P.hr * 0.55 * fs)
	c.translate(0, 12)
	_face_front(c, P, f, tt, ol, fs)
	var hat = _o(o, "hat", null)
	if hat is Callable:
		c.save()
		c.translate(0, -20)
		hat.call(c, P, ol)
		c.restore()
	c.restore()
	# wings: the near one (the side she faces) is wa, the far one wf
	var near = P.wa
	var far = P.wf
	var raiseR = near if fs > 0 else far
	var raiseL = far if fs > 0 else near
	var spS = 1.0 + 0.12 * clampf(P.sp, 0.0, 1.2)
	for sxw in [-1.0, 1.0]:
		var r = raiseL if sxw < 0 else raiseR
		var up = clampf(r, 0.0, 1.2)
		_wing_front(c, sxw, 27.0 + 5.0 * up, 1.0 - 2.0 * up, _front_ang(r), spS, ol)
	if P.sweat > 0.02:
		var k = fract(tt * 0.8)
		drop(c, 27.0 * fs, -30.0 + k * 8.0, 4.0, ol * 0.7, (1.0 - k * 0.6) * clampf(P.sweat, 0.0, 1.0))
	c.restore()
	_extras_in(c, o, ol, tt)
	c.restore()
	_extras_out(c, o, ol, tt, fs)
	c.restore()

static func _face_front(c, P: Dictionary, f: Dictionary, tt: float, o: float, fs: float) -> void:
	var ey = -16.0
	if f.blush > 0.01:
		c.begin_path()
		c.oval(-17, -6, 5, 3.2)
		c.oval(17, -6, 5, 3.2)
		c.fill_path(Color(1, 110 / 255.0, 120 / 255.0, clampf(f.blush, 0.0, 1.0) * 0.85))
	# the near eye (for a wink) is on the side she faces
	var E = [{x = 10.0 * fs, y = ey, k = 1.0}, {x = -10.0 * fs, y = ey, k = 1.0}]
	_eyes(c, E, f, o, 1)
	if f.tear > 0.01:
		c.save()
		c.alpha *= clampf(f.tear, 0.0, 1.0)
		for sx in [-1.0, 1.0]:
			c.begin_path()
			c.move_to(sx * 12.0, ey + 3.0)
			c.quad_to(sx * (17.0 + sin(tt * 8.0) * 1.5), ey + 12.0, sx * 16.0, ey + 24.0)
			c.stroke_path(Color(120 / 255.0, 205 / 255.0, 1.0, 0.9), 3.4)
			for i in 2:
				var k = fract(tt * 1.8 + i * 0.5 + (0.25 if sx > 0 else 0.0))
				drop(c, sx * (16.0 + k * 9.0), ey + 22.0 + k * 22.0, 2.6, 1.0, 1.0 - k * 0.7)
		c.restore()
	# beak: open is the side view's 0..5.5 scaled to the front beak's 0..7.5
	var open = clampf(f.beak, 0.0, 6.0) * 1.4
	var op = open > 0.5
	c.begin_path()
	c.oval(0, (1.0 if op else -1.0) + open * 1.05, 3.6, 5.2)
	c.solid(c.lin(0, -4, 0, 6 + open, [RED_HI, RED_LO]), RED_LINE, o * 0.8)
	if op:
		c.begin_path()
		c.move_to(-5.5, -8)
		c.line_to(5.5, -8)
		c.line_to(0, -2 + open * 1.4)
		c.close_path()
		c.solid(Color("7a1f1a"), BEAK_LINE, o * 0.8)
		c.begin_path()
		c.oval(0, -4.5 + open * 0.8, 2.6, 0.9 + open * 0.25)
		c.fill_path(Color("ff7a8a"))
		c.begin_path()
		c.move_to(-4.2, -5 + open * 0.9)
		c.quad_to(0, -3 + open * 0.9, 4.2, -5 + open * 0.9)
		c.line_to(0, -1 + open * 1.4)
		c.close_path()
		c.solid(BEAK_LO, BEAK_LINE, o * 0.8)
	c.begin_path()
	c.move_to(-6, -9.5)
	c.quad_to(0, -13, 6, -9.5)
	c.line_to(0, -5.0 if op else -2.5)
	c.close_path()
	c.solid(c.lin(0, -12, 0, -3, [BEAK_HI, BEAK_LO]), BEAK_LINE, o * 0.8)
	c.begin_path()
	c.oval(-1.8, -10.4, 2.2, 0.8, -0.1)
	c.fill_path(Color(1, 1, 1, 0.55))

# ================================================================== shared bits
static func drop(c, x: float, y: float, r: float, o: float, a := 1.0) -> void:
	c.save()
	c.alpha *= a
	c.begin_path()
	c.move_to(x, y - r * 2.1)
	c.quad_to(x + r * 1.05, y - r * 0.6, x + r, y)
	c.arc(x, y, r, 0, PI)
	c.quad_to(x - r * 1.05, y - r * 0.6, x, y - r * 2.1)
	c.close_path()
	c.solid(Color("8fdcff"), Color("2f7fb8"), o)
	c.dot(x - r * 0.35, y - r * 0.2, r * 0.3, Color(1, 1, 1, 0.85))
	c.restore()

static func feather(c, x: float, y: float, rot: float, ln: float, o: float, a: float) -> void:
	c.save()
	c.alpha *= a
	c.translate(x, y)
	c.rotate(rot)
	var p = func(cc):
		cc.move_to(0, -ln / 2.0)
		cc.quad_to(ln * 0.36, 0, 0, ln / 2.0)
		cc.quad_to(-ln * 0.36, 0, 0, -ln / 2.0)
		cc.close_path()
	c.begin_path()
	p.call(c)
	c.fill_path(HI)
	c.save()
	c.clip_path()
	c.fill_rect(0, -ln, ln, ln * 2.0, LO)
	c.restore()
	c.begin_path()
	p.call(c)
	c.stroke_path(LINE, o * 0.8)
	c.restore()

static func burst(c, u: float, k: float, o: float) -> void:
	if u > 1.0:
		return
	for i in 10:
		var sd = 1.0 if i % 2 else -1.0
		var a = -PI / 2 + sd * (0.5 + hsh(k * 9 + i) * 0.85)
		var sp = 60.0 + hsh(k * 3 + i * 7) * 40.0
		var x = sd * 30.0 - 4.0 + cos(a) * sp * u * 0.7
		var y = -12.0 + sin(a) * sp * u * 0.75 + 80.0 * u * u
		feather(c, x, y, a + PI / 2 + u * (4.0 if hsh(i + k) > 0.5 else -4.0), 15.0 + hsh(i * 2) * 5.0, o, 1.0 - ss(0.5, 1.0, u))

static func loose(c, tt: float, o: float, w: float) -> void:
	for i in 2:
		var k = fract(tt * 0.7 + i * 0.5)
		feather(c, (30.0 if i else -40.0) + sin(tt * 4.0 + i) * 4.0, -10.0 - k * 26.0 + k * k * 18.0, sin(tt * 3.0 + i * 2) * 0.8, 13, o, (1.0 - k) * clampf(w, 0.0, 1.0))

static func notes(c, tt: float, o: float, w: float) -> void:
	c.save()
	for i in 3:
		var k = fract(tt * 0.6 + i / 3.0)
		var nx = (i - 1) * 40.0 + sin(tt * 2.0 + i) * 4.0
		var ny = -46.0 - k * 28.0
		c.alpha = sin(k * PI) * w
		c.begin_path()
		c.oval(nx, ny, 4.5, 3.4, -0.4)
		c.solid(Color("ff7a9a"), LINE, o * 0.8)
		c.begin_path()
		c.move_to(nx + 3.8, ny - 1.0)
		c.line_to(nx + 3.8, ny - 14.0)
		c.quad_to(nx + 10.0, ny - 11.0, nx + 8.0, ny - 6.0)
		c.stroke_path(LINE, o * 0.8)
	c.restore()

static func heart(c, x: float, y: float, r: float, o: float, a := 1.0) -> void:
	if a <= 0.01:
		return
	c.save()
	c.alpha *= a
	c.translate(x, y)
	c.begin_path()
	c.move_to(0, r * 0.9)
	c.bez_to(-r * 1.4, -r * 0.1, -r * 0.7, -r * 1.25, 0, -r * 0.45)
	c.bez_to(r * 0.7, -r * 1.25, r * 1.4, -r * 0.1, 0, r * 0.9)
	c.close_path()
	c.solid(Color("ff6f8f"), Color("8a2a3a"), o * 0.8)
	c.begin_path()
	c.oval(-r * 0.42, -r * 0.35, r * 0.22, r * 0.14, -0.6)
	c.fill_path(Color(1, 1, 1, 0.6))
	c.restore()
