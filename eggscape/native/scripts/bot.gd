# Physics soak test (run: godot --headless -- --level N --bot SEED). Turns random rings by random amounts, logs
# every egg event, and checks every physics frame that no egg is inside a ring wall away from a gap (tunnelling)
# and no egg leaves the vault except through a gap. Prints one summary line at the end.
extends Node

const G = preload("res://scripts/g.gd")
var vault
var t := 0.0
var next := 0.5
var stats := {"saved": 0, "broke": 0, "cracks": 0, "tunnel": 0, "deep": 0.0, "maxv": 0.0, "end": "none", "t_end": 0.0}
var rng := RandomNumberGenerator.new()

func attach(v, seed: int) -> void:
	vault = v
	rng.seed = seed
	v.saved_egg.connect(func(_e): stats.saved += 1)
	v.broke_egg.connect(func(_e, why):
		stats.broke += 1
		print("  break ", why, " t=", snappedf(t, 0.01)))
	v.cracked_egg.connect(func(_e): stats.cracks += 1)
	v.finished.connect(func(w):
		stats.end = "win" if w else "fail"
		stats.t_end = t)

func _physics_process(dt: float) -> void:
	if vault == null or not is_instance_valid(vault):
		return
	t += dt
	next -= dt
	if next <= 0.0 and not vault.done:
		next = rng.randf_range(0.6, 2.0)
		if rng.randf() < 0.35:
			# random nudge: shakes eggs loose and tests odd states
			var ring = vault.rings[rng.randi() % vault.rings.size()]
			ring.target += rng.randf_range(-2.5, 2.5)
		else:
			# greedy: bring a gap of the ring just outside a resting egg round to that egg
			var live = vault.eggs.filter(func(x): return is_instance_valid(x) and x.alive and not x.saved)
			if not live.is_empty():
				var e = live[rng.randi() % live.size()]
				var d = e.position.length() / G.PPM
				for ring in vault.rings:
					if ring.r > d:
						var ea = e.position.angle()
						var best = 9.0
						for g in ring.gaps:
							var diff = G.wrapa(ea - (g.a + ring.angle))
							if absf(diff) < absf(best):
								best = diff
						ring.target = ring.angle + best
						break
	for e in vault.eggs:
		if not is_instance_valid(e) or not e.alive or e.saved:
			continue
		stats.maxv = maxf(stats.maxv, e.linear_velocity.length() / G.PPM)
		var lp: Vector2 = e.position
		var d = lp.length() / G.PPM
		for ring in vault.rings:
			var pen = G.RING_TH / 2 + G.EGG_W / 2 * 0.55 - absf(d - ring.r)
			if pen <= 0.0:
				continue
			# inside the wall band: fine only if the egg's angle sits in a gap (ring-local)
			var a = G.wrapa(lp.angle() - ring.angle)
			var in_gap = false
			for g in ring.gaps:
				if absf(G.wrapa(a - g.a)) < g.half + 0.25 / ring.r:
					in_gap = true
			if not in_gap:
				stats.tunnel += 1
				stats.deep = maxf(stats.deep, pen)

func report() -> String:
	return "saved=%d broke=%d cracks=%d end=%s@%.1fs tunnel_frames=%d deepest=%.3fm maxv=%.1fm/s" % [stats.saved, stats.broke, stats.cracks, stats.end, stats.t_end, stats.tunnel, stats.deep, stats.maxv]
