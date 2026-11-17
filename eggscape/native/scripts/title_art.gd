# Title screen props, drawn with the Canvas 2D painter: a toy egg vault turning in the middle (its rings swing their
# gaps round and now and then an egg rolls out, bounces down and hops into the nest) and the straw nest beside the hen.
extends Node2D

const C2D = preload("res://scripts/c2d.gd")
const Art = preload("res://scripts/world_art.gd")
const Cheer = preload("res://scripts/cheer.gd")

var vault_c := Vector2.ZERO
var vault_r := 120.0
var nest_c := Vector2.ZERO
var nest_w := 160.0
var t := 0.0
var _c = C2D.new()

func _process(dt: float) -> void:
	t += dt
	queue_redraw()

func _draw() -> void:
	var c = _c
	c.begin(self)
	# toy vault
	Art._emblem(c, vault_c, vault_r, Color("C98A4B"), t * 1.4)
	# one egg every 4 s: rolls out of the vault, arcs down and lands in the nest
	var u = fposmod(t, 4.0) / 1.3
	if u < 1.0:
		var a = vault_c + Vector2(vault_r * 0.2, vault_r * 0.1)
		var b = nest_c + Vector2(0, -nest_w * 0.12)
		var p = a.lerp(b, u) + Vector2(0, -sin(u * PI) * vault_r * 0.9)
		c.save()
		c.translate(0, 0)
		Cheer.egg(c, p.x, p.y, vault_r * 0.3, u * TAU)
		c.restore()
	# nest: a straw bowl with three eggs that wobble in turn
	var w = nest_w
	for i in 3:
		var wob = sin(t * 3.0 + i * 2.1) * 0.08 * maxf(0.0, sin(t * 0.9 + i))
		Cheer.egg(c, nest_c.x + (i - 1) * w * 0.22, nest_c.y - w * 0.13 - (4.0 if i == 1 else 0.0), w * 0.26, wob)
	c.begin_path()
	c.move_to(nest_c.x - w * 0.5, nest_c.y - w * 0.12)
	c.quad_to(nest_c.x, nest_c.y + w * 0.32, nest_c.x + w * 0.5, nest_c.y - w * 0.12)
	c.quad_to(nest_c.x, nest_c.y - w * 0.02, nest_c.x - w * 0.5, nest_c.y - w * 0.12)
	c.close_path()
	c.solid(Color("D9A55A"), Color("8A5A2A"), 4)
	c.begin_path()
	for i in 9:
		var x = nest_c.x - w * 0.42 + i * w * 0.105
		c.move_to(x, nest_c.y - w * 0.06 + absf(i - 4) * 1.5)
		c.line_to(x + w * 0.07, nest_c.y + w * 0.04 - absf(i - 4) * 1.2)
	c.stroke_path(Color("A8743A"), 3)
