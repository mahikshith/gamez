// Screen finish under the UI: a soft vignette that pulls the eye to the vault.
shader_type canvas_item;
uniform float strength = 0.34;
void fragment() {
	vec2 q = UV - 0.5;
	float v = smoothstep(0.36, 0.95, length(q * vec2(1.2, 1.0)));
	COLOR = vec4(0.03, 0.05, 0.13, v * strength);
}
