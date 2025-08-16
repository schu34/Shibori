// Basic vertex shader for 2D drawing
// Transforms vertices from canvas coordinates to WebGL clip space

attribute vec3 a_position;
attribute vec2 a_texCoord;
attribute vec4 a_color;

uniform mat3 u_transform;     // 2D transformation matrix
uniform vec2 u_resolution;    // Canvas resolution for coordinate conversion

varying vec2 v_texCoord;
varying vec4 v_color;

void main() {
    // Transform position using 2D transformation matrix
    vec3 transformedPos = u_transform * vec3(a_position.xy, 1.0);
    
    // Convert from canvas coordinates to WebGL clip space
    // Canvas: (0,0) top-left, (width,height) bottom-right
    // WebGL: (-1,-1) bottom-left, (1,1) top-right
    vec2 clipSpace = (transformedPos.xy / u_resolution) * 2.0 - 1.0;
    
    // Flip Y coordinate to match canvas coordinate system
    clipSpace.y = -clipSpace.y;
    
    gl_Position = vec4(clipSpace, 0.0, 1.0);
    
    // Pass through varying values
    v_texCoord = a_texCoord;
    v_color = a_color;
}