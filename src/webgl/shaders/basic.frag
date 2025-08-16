// Basic fragment shader for 2D drawing
// Handles solid colors, textures, and basic effects

precision mediump float;

uniform int u_renderMode;        // 0 = solid color, 1 = texture, 2 = color + texture
uniform vec4 u_color;           // Solid color for mode 0
uniform sampler2D u_texture;    // Texture for modes 1 and 2
uniform float u_opacity;        // Global opacity multiplier

varying vec2 v_texCoord;
varying vec4 v_color;

void main() {
    vec4 finalColor;
    
    if (u_renderMode == 0) {
        // Solid color mode
        finalColor = u_color * v_color;
    } else if (u_renderMode == 1) {
        // Texture mode
        finalColor = texture2D(u_texture, v_texCoord);
    } else if (u_renderMode == 2) {
        // Combined color + texture mode
        vec4 texColor = texture2D(u_texture, v_texCoord);
        finalColor = texColor * v_color * u_color;
    } else {
        // Default fallback
        finalColor = v_color;
    }
    
    // Apply global opacity
    finalColor.a *= u_opacity;
    
    gl_FragColor = finalColor;
}