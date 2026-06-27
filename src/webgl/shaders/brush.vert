// Vertex shader for brush stroke rendering
// Optimized for smooth, variable-width strokes with pressure sensitivity

attribute vec3 a_position;
attribute vec2 a_texCoord;
attribute vec4 a_color;
attribute float a_pressure;  // Pressure/thickness at this vertex
attribute vec2 a_normal;     // Normal vector for stroke width

uniform mat3 u_transform;     // 2D transformation matrix
uniform vec2 u_resolution;    // Canvas resolution
uniform float u_thickness;    // Base stroke thickness
uniform float u_pressureScale; // Pressure sensitivity multiplier

varying vec2 v_texCoord;
varying vec4 v_color;
varying float v_pressure;
varying vec2 v_strokeCoord;   // Coordinate along stroke for effects

void main() {
    // Calculate actual thickness based on pressure
    float actualThickness = u_thickness * (1.0 + a_pressure * u_pressureScale);
    
    // Offset position by normal vector scaled by thickness
    vec2 offsetPos = a_position.xy + a_normal * actualThickness * 0.5;
    
    // Transform position
    vec3 transformedPos = u_transform * vec3(offsetPos, 1.0);
    
    // Convert to clip space
    vec2 clipSpace = (transformedPos.xy / u_resolution) * 2.0 - 1.0;
    clipSpace.y = -clipSpace.y;
    
    gl_Position = vec4(clipSpace, 0.0, 1.0);
    
    // Pass through varying values
    v_texCoord = a_texCoord;
    v_color = a_color;
    v_pressure = a_pressure;
    v_strokeCoord = a_position.xy;
}