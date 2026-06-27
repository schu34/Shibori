// Fragment shader for mirroring operations
// Handles horizontal, vertical, and diagonal mirroring for shibori patterns

precision mediump float;

uniform sampler2D u_sourceTexture; // Source canvas texture
uniform vec2 u_resolution;         // Canvas resolution
uniform int u_mirrorMode;          // 0=none, 1=horizontal, 2=vertical, 3=both, 4=diagonal
uniform vec2 u_mirrorOrigin;       // Origin point for mirroring (0.5, 0.5 = center)

varying vec2 v_texCoord;

// Mirror coordinate based on mode and origin
vec2 mirrorCoordinate(vec2 coord, int mode, vec2 origin) {
    vec2 mirroredCoord = coord;
    
    if (mode == 1) {
        // Horizontal mirror
        mirroredCoord.x = 2.0 * origin.x - coord.x;
    } else if (mode == 2) {
        // Vertical mirror
        mirroredCoord.y = 2.0 * origin.y - coord.y;
    } else if (mode == 3) {
        // Both horizontal and vertical
        mirroredCoord.x = 2.0 * origin.x - coord.x;
        mirroredCoord.y = 2.0 * origin.y - coord.y;
    } else if (mode == 4) {
        // Diagonal mirror (swap x and y)
        mirroredCoord = vec2(coord.y, coord.x);
    }
    
    return mirroredCoord;
}

void main() {
    vec2 coord = v_texCoord;
    vec4 color = vec4(0.0);
    
    if (u_mirrorMode == 0) {
        // No mirroring, just sample original
        color = texture2D(u_sourceTexture, coord);
    } else {
        // Sample both original and mirrored coordinates
        vec4 originalColor = texture2D(u_sourceTexture, coord);
        
        vec2 mirroredCoord = mirrorCoordinate(coord, u_mirrorMode, u_mirrorOrigin);
        
        // Clamp mirrored coordinates to valid range
        mirroredCoord = clamp(mirroredCoord, 0.0, 1.0);
        
        vec4 mirroredColor = texture2D(u_sourceTexture, mirroredCoord);
        
        // Combine original and mirrored colors
        // Use additive blending for drawing strokes
        color = originalColor + mirroredColor;
        
        // Prevent oversaturation
        color = min(color, 1.0);
    }
    
    gl_FragColor = color;
}