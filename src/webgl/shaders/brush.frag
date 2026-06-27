// Fragment shader for brush stroke rendering
// Creates smooth, anti-aliased brush strokes with texture support

precision mediump float;

uniform vec4 u_color;           // Base brush color
uniform sampler2D u_brushTexture; // Brush texture (optional)
uniform float u_opacity;        // Global opacity
uniform float u_feather;        // Edge feathering amount
uniform bool u_useBrushTexture; // Whether to use brush texture

varying vec2 v_texCoord;
varying vec4 v_color;
varying float v_pressure;
varying vec2 v_strokeCoord;

// Smooth step function for anti-aliasing
float smoothStep(float edge0, float edge1, float x) {
    float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
}

void main() {
    vec4 baseColor = u_color * v_color;
    
    // Calculate distance from center of stroke for anti-aliasing
    float distFromCenter = length(v_texCoord - 0.5) * 2.0;
    
    // Create smooth edge with feathering
    float alpha = 1.0 - smoothStep(1.0 - u_feather, 1.0, distFromCenter);
    
    // Apply pressure to alpha for variable opacity
    alpha *= (0.5 + v_pressure * 0.5);
    
    if (u_useBrushTexture) {
        // Sample brush texture for additional detail
        vec4 brushSample = texture2D(u_brushTexture, v_texCoord);
        baseColor.rgb = mix(baseColor.rgb, baseColor.rgb * brushSample.rgb, brushSample.a);
        alpha *= brushSample.a;
    }
    
    // Apply global opacity
    baseColor.a = alpha * u_opacity;
    
    // Discard nearly transparent pixels for performance
    if (baseColor.a < 0.01) {
        discard;
    }
    
    gl_FragColor = baseColor;
}