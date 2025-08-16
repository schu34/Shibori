/**
 * WebGL Shader Templates for Shibori Drawing
 * Contains pre-compiled shader source code for common drawing operations
 */

// Basic vertex shader for simple 2D rendering
export const BASIC_VERTEX_SHADER = `
attribute vec3 a_position;
attribute vec2 a_texCoord;
attribute vec4 a_color;

uniform mat3 u_transform;
uniform vec2 u_resolution;

varying vec2 v_texCoord;
varying vec4 v_color;

void main() {
    vec3 transformedPos = u_transform * vec3(a_position.xy, 1.0);
    vec2 clipSpace = (transformedPos.xy / u_resolution) * 2.0 - 1.0;
    clipSpace.y = -clipSpace.y;
    
    gl_Position = vec4(clipSpace, 0.0, 1.0);
    v_texCoord = a_texCoord;
    v_color = a_color;
}
`;

// Basic fragment shader for solid colors and textures
export const BASIC_FRAGMENT_SHADER = `
precision mediump float;

uniform int u_renderMode;
uniform vec4 u_color;
uniform sampler2D u_texture;
uniform float u_opacity;

varying vec2 v_texCoord;
varying vec4 v_color;

void main() {
    vec4 finalColor;
    
    if (u_renderMode == 0) {
        finalColor = u_color * v_color;
    } else if (u_renderMode == 1) {
        finalColor = texture2D(u_texture, v_texCoord);
    } else if (u_renderMode == 2) {
        vec4 texColor = texture2D(u_texture, v_texCoord);
        finalColor = texColor * v_color * u_color;
    } else {
        finalColor = v_color;
    }
    
    finalColor.a *= u_opacity;
    gl_FragColor = finalColor;
}
`;

// Vertex shader for brush strokes with pressure sensitivity
export const BRUSH_VERTEX_SHADER = `
attribute vec3 a_position;
attribute vec2 a_texCoord;
attribute vec4 a_color;
attribute float a_pressure;
attribute vec2 a_normal;

uniform mat3 u_transform;
uniform vec2 u_resolution;
uniform float u_thickness;
uniform float u_pressureScale;

varying vec2 v_texCoord;
varying vec4 v_color;
varying float v_pressure;
varying vec2 v_strokeCoord;

void main() {
    float actualThickness = u_thickness * (1.0 + a_pressure * u_pressureScale);
    vec2 offsetPos = a_position.xy + a_normal * actualThickness * 0.5;
    
    vec3 transformedPos = u_transform * vec3(offsetPos, 1.0);
    vec2 clipSpace = (transformedPos.xy / u_resolution) * 2.0 - 1.0;
    clipSpace.y = -clipSpace.y;
    
    gl_Position = vec4(clipSpace, 0.0, 1.0);
    v_texCoord = a_texCoord;
    v_color = a_color;
    v_pressure = a_pressure;
    v_strokeCoord = a_position.xy;
}
`;

// Fragment shader for smooth brush strokes
export const BRUSH_FRAGMENT_SHADER = `
precision mediump float;

uniform vec4 u_color;
uniform sampler2D u_brushTexture;
uniform float u_opacity;
uniform float u_feather;
uniform bool u_useBrushTexture;

varying vec2 v_texCoord;
varying vec4 v_color;
varying float v_pressure;
varying vec2 v_strokeCoord;

float smoothStep(float edge0, float edge1, float x) {
    float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
}

void main() {
    vec4 baseColor = u_color * v_color;
    float distFromCenter = length(v_texCoord - 0.5) * 2.0;
    float alpha = 1.0 - smoothStep(1.0 - u_feather, 1.0, distFromCenter);
    alpha *= (0.5 + v_pressure * 0.5);
    
    if (u_useBrushTexture) {
        vec4 brushSample = texture2D(u_brushTexture, v_texCoord);
        baseColor.rgb = mix(baseColor.rgb, baseColor.rgb * brushSample.rgb, brushSample.a);
        alpha *= brushSample.a;
    }
    
    baseColor.a = alpha * u_opacity;
    
    if (baseColor.a < 0.01) {
        discard;
    }
    
    gl_FragColor = baseColor;
}
`;

// Fragment shader for mirroring operations
export const MIRROR_FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D u_sourceTexture;
uniform vec2 u_resolution;
uniform int u_mirrorMode;
uniform vec2 u_mirrorOrigin;

varying vec2 v_texCoord;

vec2 mirrorCoordinate(vec2 coord, int mode, vec2 origin) {
    vec2 mirroredCoord = coord;
    
    if (mode == 1) {
        mirroredCoord.x = 2.0 * origin.x - coord.x;
    } else if (mode == 2) {
        mirroredCoord.y = 2.0 * origin.y - coord.y;
    } else if (mode == 3) {
        mirroredCoord.x = 2.0 * origin.x - coord.x;
        mirroredCoord.y = 2.0 * origin.y - coord.y;
    } else if (mode == 4) {
        mirroredCoord = vec2(coord.y, coord.x);
    }
    
    return mirroredCoord;
}

void main() {
    vec2 coord = v_texCoord;
    vec4 color = vec4(0.0);
    
    if (u_mirrorMode == 0) {
        color = texture2D(u_sourceTexture, coord);
    } else {
        vec4 originalColor = texture2D(u_sourceTexture, coord);
        vec2 mirroredCoord = mirrorCoordinate(coord, u_mirrorMode, u_mirrorOrigin);
        mirroredCoord = clamp(mirroredCoord, 0.0, 1.0);
        vec4 mirroredColor = texture2D(u_sourceTexture, mirroredCoord);
        color = originalColor + mirroredColor;
        color = min(color, 1.0);
    }
    
    gl_FragColor = color;
}
`;

// Copy shader for rendering to texture
export const COPY_VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;

varying vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`;

export const COPY_FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D u_texture;
uniform float u_opacity;

varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_texture, v_texCoord);
    color.a *= u_opacity;
    gl_FragColor = color;
}
`;

/**
 * Shader template registry for easy access
 */
export const SHADER_TEMPLATES = {
  basic: {
    vertex: BASIC_VERTEX_SHADER,
    fragment: BASIC_FRAGMENT_SHADER
  },
  brush: {
    vertex: BRUSH_VERTEX_SHADER,
    fragment: BRUSH_FRAGMENT_SHADER
  },
  mirror: {
    vertex: BASIC_VERTEX_SHADER, // Uses basic vertex shader
    fragment: MIRROR_FRAGMENT_SHADER
  },
  copy: {
    vertex: COPY_VERTEX_SHADER,
    fragment: COPY_FRAGMENT_SHADER
  }
} as const;

/**
 * Get shader template by name
 */
export function getShaderTemplate(name: keyof typeof SHADER_TEMPLATES): {
  vertex: string;
  fragment: string;
} {
  const template = SHADER_TEMPLATES[name];
  if (!template) {
    throw new Error(`Shader template "${name}" not found`);
  }
  return template;
}

/**
 * Validate shader source for WebGL compatibility
 */
export function validateShaderSource(source: string, type: 'vertex' | 'fragment'): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for required precision qualifier in fragment shaders
  if (type === 'fragment' && !source.includes('precision')) {
    errors.push('Fragment shader must include precision qualifier (e.g., "precision mediump float;")');
  }

  // Check for main function
  if (!source.includes('void main(')) {
    errors.push('Shader must contain a main() function');
  }

  // Check for gl_Position in vertex shaders
  if (type === 'vertex' && !source.includes('gl_Position')) {
    errors.push('Vertex shader must set gl_Position');
  }

  // Check for output in fragment shaders
  if (type === 'fragment' && !source.includes('gl_FragColor') && !source.includes('out ')) {
    errors.push('Fragment shader must set gl_FragColor or use output variables');
  }

  // Check for deprecated features
  if (source.includes('varying') && source.includes('#version 300')) {
    warnings.push('Using "varying" keyword with GLSL ES 3.0 - consider using "in"/"out"');
  }

  if (source.includes('attribute') && source.includes('#version 300')) {
    warnings.push('Using "attribute" keyword with GLSL ES 3.0 - consider using "in"');
  }

  // Check for texture2D vs texture function
  if (source.includes('texture2D') && source.includes('#version 300')) {
    warnings.push('Using "texture2D" with GLSL ES 3.0 - consider using "texture"');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Convert GLSL ES 1.0 shader to GLSL ES 3.0
 */
export function upgradeShaderToGLSL3(source: string, type: 'vertex' | 'fragment'): string {
  let upgraded = source;

  // Add version directive if not present
  if (!upgraded.includes('#version')) {
    upgraded = '#version 300 es\n' + upgraded;
  }

  // Replace attribute with in (vertex shaders only)
  if (type === 'vertex') {
    upgraded = upgraded.replace(/\battribute\b/g, 'in');
  }

  // Replace varying with in/out
  if (type === 'vertex') {
    upgraded = upgraded.replace(/\bvarying\b/g, 'out');
  } else {
    upgraded = upgraded.replace(/\bvarying\b/g, 'in');
  }

  // Replace texture2D with texture
  upgraded = upgraded.replace(/\btexture2D\b/g, 'texture');

  // Replace gl_FragColor with output variable
  if (type === 'fragment' && upgraded.includes('gl_FragColor')) {
    upgraded = 'out vec4 fragColor;\n' + upgraded;
    upgraded = upgraded.replace(/\bgl_FragColor\b/g, 'fragColor');
  }

  return upgraded;
}