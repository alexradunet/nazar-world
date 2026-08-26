import * as THREE from 'three';

const DEFAULT_TILE_SIZE = 128;

export function mosaicGlyph(kind, mask) {
  return `${kind}:${mask.toString(16)}`;
}

export const QUADRANT_GLYPHS = [
  0b0101,
  0b1010,
  0b1001,
  0b0110,
  0b1011,
  0b1101,
].map((mask) => mosaicGlyph('quadrant', mask));

export const SEXTANT_GLYPHS = [
  0b010101,
  0b101010,
  0b100101,
  0b011010,
  0b110011,
  0b101101,
  0b011110,
  0b111001,
].map((mask) => mosaicGlyph('sextant', mask));

export const OCTANT_GLYPHS = [
  0b01010101,
  0b10101010,
  0b10011001,
  0b01100110,
  0b11110000,
  0b00111100,
  0b11011011,
  0b11100111,
].map((mask) => mosaicGlyph('octant', mask));

export const BRAILLE_GLYPHS = [
  0b00000001,
  0b00001001,
  0b00100101,
  0b01010011,
  0b10100101,
  0b11011010,
  0b11100111,
].map((mask) => mosaicGlyph('braille', mask));

function drawMosaic(context, x, y, size, rows, mask) {
  const left = x + size * 0.14;
  const top = y + size * 0.08;
  const cellWidth = size * 0.36;
  const cellHeight = (size * 0.84) / rows;

  for (let cell = 0; cell < rows * 2; cell += 1) {
    if ((mask & (1 << cell)) === 0) continue;
    const column = cell % 2;
    const row = Math.floor(cell / 2);
    context.fillRect(
      left + column * cellWidth,
      top + row * cellHeight,
      cellWidth + 0.5,
      cellHeight + 0.5,
    );
  }
}

function drawBraille(context, x, y, size, mask) {
  const dotMap = [
    [0, 0], [0, 1], [0, 2], [1, 0],
    [1, 1], [1, 2], [0, 3], [1, 3],
  ];
  const radius = size * 0.065;

  dotMap.forEach(([column, row], dot) => {
    if ((mask & (1 << dot)) === 0) return;
    context.beginPath();
    context.arc(
      x + size * (column === 0 ? 0.34 : 0.66),
      y + size * (0.18 + row * 0.215),
      radius,
      0,
      Math.PI * 2,
    );
    context.fill();
  });
}

function drawGlyph(context, glyph, x, y, size) {
  context.fillStyle = '#ffffff';
  const mosaic = /^(quadrant|sextant|octant|braille):([0-9a-f]+)$/.exec(glyph);

  if (mosaic) {
    const mask = Number.parseInt(mosaic[2], 16);
    if (mosaic[1] === 'braille') drawBraille(context, x, y, size, mask);
    else drawMosaic(context, x, y, size, { quadrant: 2, sextant: 3, octant: 4 }[mosaic[1]], mask);
    return;
  }

  context.font = `700 ${size * 0.72}px "Courier New", monospace`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(glyph, x + size / 2, y + size * 0.53);
}

export class GlyphAtlas {
  constructor(renderer, { tileSize = DEFAULT_TILE_SIZE, maxColumns = 16 } = {}) {
    this.renderer = renderer;
    this.tileSize = tileSize;
    this.maxColumns = maxColumns;
    this.glyphs = [];
    this.indices = new Map();
    this.texture = null;
    this.columns = 1;
    this.rows = 1;
  }

  register(glyph) {
    if (!this.indices.has(glyph)) {
      this.indices.set(glyph, this.glyphs.length);
      this.glyphs.push(glyph);
    }
    return this.indices.get(glyph);
  }

  indexOf(glyph) {
    const index = this.indices.get(glyph);
    if (index === undefined) throw new Error(`Glyph "${glyph}" was not registered before atlas build`);
    return index;
  }

  build() {
    this.columns = Math.min(this.maxColumns, Math.max(1, this.glyphs.length));
    this.rows = Math.max(1, Math.ceil(this.glyphs.length / this.columns));

    const canvas = document.createElement('canvas');
    canvas.width = this.columns * this.tileSize;
    canvas.height = this.rows * this.tileSize;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);

    this.glyphs.forEach((glyph, index) => {
      const x = (index % this.columns) * this.tileSize;
      const y = Math.floor(index / this.columns) * this.tileSize;
      drawGlyph(context, glyph, x, y, this.tileSize);
    });

    this.texture?.dispose();
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.texture.needsUpdate = true;
    return this.texture;
  }

  createMaterial({ cellBackground = 0 } = {}) {
    if (!this.texture) throw new Error('Build the glyph atlas before creating a glyph field');

    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      alphaTest: cellBackground > 0 ? 0 : 0.16,
      side: THREE.DoubleSide,
      toneMapped: false,
      vertexColors: true,
    });
    const atlasGrid = new THREE.Vector2(this.columns, this.rows);
    const inset = 0.5 / this.tileSize;

    material.onBeforeCompile = (shader) => {
      shader.uniforms.glyphAtlasGrid = { value: atlasGrid };
      shader.uniforms.glyphTileInset = { value: inset };
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute float glyphIndex;
uniform vec2 glyphAtlasGrid;
uniform float glyphTileInset;`,
        )
        .replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
#ifdef USE_MAP
  vec2 glyphCell = vec2(mod(glyphIndex, glyphAtlasGrid.x), floor(glyphIndex / glyphAtlasGrid.x));
  vec2 glyphUv = mix(vec2(glyphTileInset), vec2(1.0 - glyphTileInset), uv);
  vMapUv = (glyphCell + glyphUv) / glyphAtlasGrid;
#endif`,
        );

      if (cellBackground > 0) {
        shader.uniforms.glyphCellBackground = { value: cellBackground };
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
uniform float glyphCellBackground;`,
          )
          .replace(
            '#include <map_fragment>',
            `#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D(map, vMapUv);
  float glyphCoverage = sampledDiffuseColor.a;
  diffuseColor.rgb *= mix(glyphCellBackground, 1.0, glyphCoverage);
  diffuseColor.a = 1.0;
#endif`,
          );
      }
    };
    material.customProgramCacheKey = () => `nazar-glyph-atlas-v2-${cellBackground > 0 ? 'cells' : 'glyphs'}`;
    return material;
  }
}

export class GlyphField {
  constructor(atlas, parent, materialOptions = {}) {
    this.atlas = atlas;
    this.parent = parent;
    this.materialOptions = materialOptions;
    this.instances = [];
    this.mesh = null;
    this.baseColors = [];
  }

  get count() {
    return this.instances.length;
  }

  add(glyph, color, position, quaternion, scale = 1, data = null) {
    const size = typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : scale;
    const matrix = new THREE.Matrix4();
    matrix.compose(position, quaternion, size);
    this.atlas.register(glyph);
    this.instances.push({ glyph, color: new THREE.Color(color), matrix, data });
  }

  clear() {
    if (this.mesh) {
      this.parent.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
    this.instances.length = 0;
    this.baseColors.length = 0;
    this.mesh = null;
  }

  dataForInstance(instanceId) {
    return this.instances[instanceId]?.data ?? null;
  }

  flush() {
    if (this.mesh || this.instances.length === 0) return this.mesh;

    const geometry = new THREE.PlaneGeometry(1, 1);
    const glyphIndices = new Float32Array(this.instances.length);
    geometry.setAttribute('glyphIndex', new THREE.InstancedBufferAttribute(glyphIndices, 1));

    const mesh = new THREE.InstancedMesh(
      geometry,
      this.atlas.createMaterial(this.materialOptions),
      this.instances.length,
    );

    this.instances.forEach(({ glyph, color, matrix }, index) => {
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, color);
      glyphIndices[index] = this.atlas.indexOf(glyph);
      this.baseColors.push(color);
    });

    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    geometry.getAttribute('glyphIndex').needsUpdate = true;
    mesh.frustumCulled = false;
    this.parent.add(mesh);
    this.mesh = mesh;
    return mesh;
  }

  setPaletteOffset(offset) {
    if (!this.mesh) return;
    const hsl = { h: 0, s: 0, l: 0 };
    const shifted = new THREE.Color();

    this.baseColors.forEach((color, index) => {
      color.getHSL(hsl);
      shifted.setHSL((hsl.h + offset) % 1, hsl.s, hsl.l);
      this.mesh.setColorAt(index, shifted);
    });
    this.mesh.instanceColor.needsUpdate = true;
  }
}

export function addGlyphSprite(field, rows, color, cellSize = 0.32) {
  const height = rows.length;
  const width = Math.max(...rows.map((row) => [...row].length));

  rows.forEach((row, rowIndex) => {
    [...row].forEach((glyph, columnIndex) => {
      if (glyph === ' ') return;
      field.add(
        glyph,
        color,
        new THREE.Vector3(
          (columnIndex - (width - 1) / 2) * cellSize,
          ((height - 1) / 2 - rowIndex) * cellSize,
          0,
        ),
        new THREE.Quaternion(),
        cellSize * 0.9,
      );
    });
  });
}
