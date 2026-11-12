// One solid arc of a vault ring as a lit, bevelled bar: analytic arc SDF (round ends), flat top with rounded
// shoulders, one top-left key light fixed in the world while the ring turns, tight specular, dark outline,
// wood grain and plank seams that travel with the ring, a soft contact shadow, and a warm rim while it is held.
shader_type canvas_item;

uniform float ra = 200.0;
uniform float rb = 11.0;
uniform float ap = 1.0;
uniform vec4 c_base : source_color = vec4(0.84, 0.54, 0.27, 1.0);
uniform vec4 c_lit : source_color = vec4(0.97, 0.76, 0.47, 1.0);
uniform vec4 c_dark : source_color = vec4(0.56, 0.31, 0.12, 1.0);
uniform vec4 c_line : source_color = vec4(0.29, 0.17, 0.07, 1.0);
uniform float held = 0.0;
uniform float grain = 1.0;
uniform float seam = 96.0;

varying vec2 lp;
varying vec2 mx;
varying vec2 my;

void vertex() {
	lp = VERTEX;
	mx = normalize(MODEL_MATRIX[0].xy);
	my = normalize(MODEL_MATRIX[1].xy);
}

float arc(vec2 q, out vec2 g) {
	vec2 p = vec2(abs(q.y), q.x);
	float sy = q.y < 0.0 ? -1.0 : 1.0;
	vec2 sc = vec2(sin(ap), cos(ap));
	float d;
	vec2 gp;
	if (sc.y * p.x > sc.x * p.y) {
		vec2 e = p - sc * ra;
		d = length(e);
		gp = e / max(d, 0.0001);
	} else {
		float l = length(p);
		d = abs(l - ra);
		gp = p / max(l, 0.0001) * (l < ra ? -1.0 : 1.0);
	}
	g = vec2(gp.y, gp.x * sy);
	return d;
}

void fragment() {
	vec2 g;
	float d = arc(lp, g);
	float aa = max(fwidth(d), 0.35);
	float a = 1.0 - smoothstep(rb - aa, rb + aa, d);
	// contact shadow: the same arc sampled a little up-left of this pixel (light from the top-left)
	vec2 off = vec2(dot(vec2(4.0, 9.0), mx), dot(vec2(4.0, 9.0), my));
	vec2 g2;
	float d2 = arc(lp - off, g2);
	float sh = (1.0 - smoothstep(rb - 5.0, rb + 7.0, d2)) * 0.34;
	float t = clamp(d / rb, 0.0, 1.0);
	vec2 gw = mx * g.x + my * g.y;
	float k = smoothstep(0.2, 1.0, t);
	vec3 N = normalize(vec3(gw * k * 1.25, 1.0 - k * 0.8));
	vec3 L = normalize(vec3(-0.5, -0.78, 0.52));
	float diff = dot(N, L);
	vec3 col = mix(c_dark.rgb, c_base.rgb, smoothstep(-0.25, 0.42, diff));
	col = mix(col, c_lit.rgb, smoothstep(0.5, 0.92, diff));
	// grain: fine streaks along the arc, plank seams across it
	float l = length(lp);
	float s = atan(lp.y, lp.x) * ra;
	float streak = sin((l - ra) * 1.9 + sin(s * 0.043) * 1.7 + sin(s * 0.011) * 2.3);
	col *= 1.0 - grain * 0.07 * (0.5 + 0.5 * streak);
	float sm = abs(fract(s / seam) - 0.5) * seam;
	col = mix(col, c_dark.rgb * 0.8, grain * (1.0 - smoothstep(0.6, 1.8, sm)) * 0.55);
	vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
	col += vec3(1.0, 0.95, 0.85) * pow(max(dot(N, H), 0.0), 28.0) * 0.38;
	// bounce light on the shaded shoulder, then the outline
	col += c_lit.rgb * 0.16 * smoothstep(0.1, -0.5, diff) * k;
	col = mix(col, c_line.rgb, smoothstep(0.74, 0.9, t) * 0.92);
	col += vec3(1.0, 0.72, 0.28) * held * (0.22 + 0.5 * smoothstep(0.55, 0.95, t));
	float halo = held * exp(-max(d - rb, 0.0) / 7.0) * 0.55;
	vec3 under = mix(vec3(0.02, 0.05, 0.09), vec3(1.0, 0.8, 0.35), clamp(halo / max(halo + sh, 0.001), 0.0, 1.0));
	float ua = max(sh, halo);
	COLOR = vec4(mix(under, col, a), a + (1.0 - a) * ua);
}
