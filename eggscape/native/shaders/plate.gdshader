// The vault's back plate: a deep glassy disc the rings sit in. Radial depth, an inset shadow under the rim, a soft
// top-left sheen, faint dust motes, a bright bevelled lip and a drop shadow on the world behind it.
shader_type canvas_item;

uniform float R = 400.0;
uniform vec4 c_mid : source_color = vec4(0.12, 0.36, 0.58, 1.0);
uniform vec4 c_edge : source_color = vec4(0.03, 0.12, 0.27, 1.0);
uniform float alpha = 0.93;
varying vec2 lp;

void vertex() { lp = VERTEX; }

void fragment() {
	float d = length(lp);
	float aa = max(fwidth(d), 0.35);
	float u = d / R;
	vec3 col = mix(c_mid.rgb, c_edge.rgb, smoothstep(0.0, 1.0, u * u));
	// lit from the top-left: the far side of the bowl catches light, the near rim throws a shadow inward
	vec2 n = lp / max(d, 0.001);
	float side = dot(n, normalize(vec2(-0.5, -0.8)));
	col += vec3(0.10, 0.16, 0.20) * smoothstep(0.55, 1.0, u) * max(-side, 0.0);
	col *= 1.0 - 0.42 * smoothstep(0.86, 1.0, u) * max(side, 0.0);
	col *= 1.0 - 0.16 * smoothstep(0.9, 1.0, u);
	// sheen band
	float band = lp.x * 0.62 + lp.y * 0.78;
	col += vec3(0.06, 0.09, 0.11) * (1.0 - smoothstep(0.0, R * 0.42, abs(band + R * 0.42))) * (1.0 - u * 0.5);
	float a = (1.0 - smoothstep(R - aa, R + aa, d)) * alpha;
	// lip
	float lip = 1.0 - smoothstep(0.0, 3.4, abs(d - R + 3.0));
	vec3 lipc = mix(vec3(0.62, 0.86, 0.98), vec3(1.0), max(-side, 0.0));
	col = mix(col, lipc, lip * (0.35 + 0.5 * max(-side, 0.0)));
	a = max(a, lip * 0.8 * (1.0 - smoothstep(R + 2.0, R + 3.5, d)));
	// drop shadow outside
	float sd = length(lp - vec2(6.0, 16.0));
	float sh = (1.0 - smoothstep(R - 14.0, R + 22.0, sd)) * 0.26;
	float inside = 1.0 - smoothstep(R - aa, R + aa + 3.0, d);
	COLOR = vec4(mix(vec3(0.02, 0.06, 0.10), col, inside), mix(sh, a, inside));
}
