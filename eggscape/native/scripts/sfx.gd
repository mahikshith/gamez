# Sound effects synthesized at start (no audio files ship), plus haptics. Autoload "Sfx".
extends Node

const RATE := 22050
var _s = {}
var _players: Array[AudioStreamPlayer] = []
var _next = 0
var haptics = true

func _ready() -> void:
	for i in 12:
		var p = AudioStreamPlayer.new()
		add_child(p)
		_players.append(p)
	_s.click = _tone(0.045, [1800.0], 140.0, 0.35, 0.25)
	_s.grab = _tone(0.06, [420.0, 630.0], 60.0, 0.35, 0.1)
	_s.crack = _tone(0.2, [310.0, 170.0], 30.0, 0.25, 0.7)
	_s.splat = _splat()
	_s.save = _chime([880.0, 1318.5], 0.09, 0.5)
	_s.coin = _chime([1568.0, 2093.0], 0.05, 0.16)
	_s.fanfare = _chime([523.25, 659.25, 783.99, 1046.5], 0.11, 0.9)
	_s.fail = _chime([392.0, 329.6, 261.6], 0.2, 0.9)
	_s.whoosh = _whoosh()
	for i in 3:
		_s["star%d" % i] = _bell(659.25 * pow(1.26, i), 0.7)
	_s.burn = _tone(0.3, [0.0], 12.0, 0.0, 0.45)

func play(name: String, db := 0.0, pitch := 1.0) -> void:
	if not _s.has(name):
		return
	var p = _players[_next]
	_next = (_next + 1) % _players.size()
	p.stream = _s[name]
	p.volume_db = db
	p.pitch_scale = pitch
	p.play()

func buzz(ms: int, amp := 0.6) -> void:
	if haptics and OS.has_feature("mobile"):
		Input.vibrate_handheld(ms, amp)

func _wav(buf: PackedFloat32Array) -> AudioStreamWAV:
	var data = PackedByteArray()
	data.resize(buf.size() * 2)
	for i in buf.size():
		data.encode_s16(i * 2, int(clampf(buf[i], -1.0, 1.0) * 30000.0))
	var w = AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = data
	return w

# Decaying tones plus a noise share; freqs glide from the first to the last over the sound.
func _tone(dur: float, freqs: Array, decay: float, tone_amp: float, noise_amp: float) -> AudioStreamWAV:
	var n = int(dur * RATE)
	var buf = PackedFloat32Array()
	buf.resize(n)
	var ph = 0.0
	var lp = 0.0
	for i in n:
		var t = float(i) / RATE
		var k = t / dur
		var f: float = lerpf(freqs[0], freqs[freqs.size() - 1], k)
		ph += TAU * f / RATE
		var env = exp(-t * decay)
		lp += (randf_range(-1.0, 1.0) - lp) * 0.35
		buf[i] = (sin(ph) * tone_amp + lp * noise_amp) * env
	return _wav(buf)

func _splat() -> AudioStreamWAV:
	var dur = 0.4
	var n = int(dur * RATE)
	var buf = PackedFloat32Array()
	buf.resize(n)
	var lp = 0.0
	var ph = 0.0
	for i in n:
		var t = float(i) / RATE
		lp += (randf_range(-1.0, 1.0) - lp) * 0.12
		ph += TAU * lerpf(140.0, 60.0, t / dur) / RATE
		buf[i] = (lp * 1.6 * exp(-t * 10.0) + sin(ph) * 0.5 * exp(-t * 14.0))
	return _wav(buf)

func _chime(notes: Array, gap: float, dur: float) -> AudioStreamWAV:
	var n = int(dur * RATE)
	var buf = PackedFloat32Array()
	buf.resize(n)
	for j in notes.size():
		var start = int(j * gap * RATE)
		var f: float = notes[j]
		for i in range(start, n):
			var t = float(i - start) / RATE
			var env = minf(1.0, t * 300.0) * exp(-t * 6.0)
			buf[i] += (sin(TAU * f * t) + 0.3 * sin(TAU * f * 2.0 * t)) * env * 0.28
	return _wav(buf)

func _bell(f: float, dur: float) -> AudioStreamWAV:
	var n = int(dur * RATE)
	var buf = PackedFloat32Array()
	buf.resize(n)
	for i in n:
		var t = float(i) / RATE
		var env = minf(1.0, t * 400.0) * exp(-t * 5.0)
		buf[i] = (sin(TAU * f * t) + 0.5 * sin(TAU * f * 2.0 * t) * exp(-t * 4.0) + 0.25 * sin(TAU * f * 3.01 * t) * exp(-t * 8.0)) * env * 0.32
	return _wav(buf)

func _whoosh() -> AudioStreamWAV:
	var dur = 0.35
	var n = int(dur * RATE)
	var buf = PackedFloat32Array()
	buf.resize(n)
	var lp = 0.0
	for i in n:
		var t = float(i) / RATE
		var k = t / dur
		lp += (randf_range(-1.0, 1.0) - lp) * lerpf(0.05, 0.4, k)
		buf[i] = lp * sin(PI * k) * 0.8
	return _wav(buf)
