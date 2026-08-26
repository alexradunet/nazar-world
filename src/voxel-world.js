import * as THREE from 'three';
import { GlyphField } from './glyph-engine.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const LOCAL_RIGHT = new THREE.Vector3(1, 0, 0);
const LOCAL_UP = new THREE.Vector3(0, 1, 0);

const FACES = [
  { normal: new THREE.Vector3(1, 0, 0), offset: [1, 0, 0] },
  { normal: new THREE.Vector3(-1, 0, 0), offset: [-1, 0, 0] },
  { normal: new THREE.Vector3(0, 1, 0), offset: [0, 1, 0] },
  { normal: new THREE.Vector3(0, -1, 0), offset: [0, -1, 0] },
  { normal: new THREE.Vector3(0, 0, 1), offset: [0, 0, 1] },
  { normal: new THREE.Vector3(0, 0, -1), offset: [0, 0, -1] },
].map((face) => ({
  ...face,
  rotation: new THREE.Quaternion().setFromUnitVectors(Z_AXIS, face.normal),
}));

function blockKey(x, y, z) {
  return `${x},${y},${z}`;
}

function patternIndex(x, y, z, face, cell, length) {
  let value = Math.imul(x + 31, 73856093);
  value ^= Math.imul(y + 17, 19349663);
  value ^= Math.imul(z + 47, 83492791);
  value ^= face * 2654435761;
  value ^= cell * 374761393;
  return (value >>> 0) % length;
}

function variedCellColor(baseColor, variation, block, faceIndex, cell, totalCells) {
  const color = new THREE.Color(baseColor);
  if (!variation) return color;

  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  const ramp = totalCells > 1 ? cell / (totalCells - 1) : 0.5;
  const hueNoise = patternIndex(block.x, block.y, block.z, faceIndex + 29, cell + 193, 4096) / 4095;
  const saturationNoise = patternIndex(block.x, block.y, block.z, faceIndex + 43, cell + 389, 4096) / 4095;
  const lightnessNoise = patternIndex(block.x, block.y, block.z, faceIndex + 71, cell + 769, 4096) / 4095;
  const hueOffset = ((hueNoise * 0.72 + ramp * 0.28) - 0.5) * (variation.hue ?? 0);
  const saturation = THREE.MathUtils.clamp(
    hsl.s + (saturationNoise - 0.5) * (variation.saturation ?? 0),
    0,
    1,
  );
  const lightness = THREE.MathUtils.clamp(
    hsl.l + (lightnessNoise - 0.5) * (variation.lightness ?? 0),
    0.08,
    1,
  );
  color.setHSL((hsl.h + hueOffset + 1) % 1, saturation, lightness);
  return color;
}

export class VoxelWorld {
  constructor(atlas, parent, materials, { faceResolution = 8 } = {}) {
    this.atlas = atlas;
    this.parent = parent;
    this.materials = new Map(materials.map((material) => [material.id, material]));
    this.materialList = materials;
    this.faceResolution = faceResolution;
    this.blocks = new Map();
    this.field = new GlyphField(atlas, parent);

    materials.forEach((material) => material.glyphs.forEach((glyph) => atlas.register(glyph)));
  }

  get blockCount() {
    return this.blocks.size;
  }

  get(x, y, z) {
    return this.blocks.get(blockKey(x, y, z)) ?? null;
  }

  has(x, y, z) {
    return this.blocks.has(blockKey(x, y, z));
  }

  set(x, y, z, materialId) {
    if (!this.materials.has(materialId) || y < 0 || y > 8) return false;
    this.blocks.set(blockKey(x, y, z), { x, y, z, materialId });
    return true;
  }

  remove(x, y, z) {
    return this.blocks.delete(blockKey(x, y, z));
  }

  generateDemo() {
    this.blocks.clear();

    // A glyph-block gateway directly in front of the starting area.
    for (let y = 0; y <= 3; y += 1) {
      this.set(-3, y, 0, y === 3 ? 'wood' : 'stone');
      this.set(3, y, 0, y === 3 ? 'wood' : 'stone');
    }
    for (let x = -2; x <= 2; x += 1) this.set(x, 3, 0, 'wood');

    // A stepped ruin, a bright tower, and a floating glass target.
    for (let step = 0; step < 4; step += 1) {
      for (let y = 0; y <= step; y += 1) this.set(-7 + step, y, -5, 'grass');
    }
    for (let y = 0; y <= 4; y += 1) this.set(6, y, -6, y % 2 ? 'glow' : 'stone');
    this.set(0, 1, -1, 'glass');

    // Small material samples close to spawn for mining and placement tests.
    this.set(2, 0, 5, 'stone');
    this.set(2, 1, 5, 'leaves');
    this.set(-2, 0, 4, 'grass');
    this.set(-2, 1, 4, 'glow');
  }

  rebuild(paletteOffset = 0) {
    this.field.clear();
    const resolution = this.faceResolution;
    const cellSize = 0.92 / resolution;

    for (const block of this.blocks.values()) {
      const material = this.materials.get(block.materialId);
      const center = new THREE.Vector3(block.x, block.y + 0.5, block.z);

      FACES.forEach((face, faceIndex) => {
        const [dx, dy, dz] = face.offset;
        if (this.has(block.x + dx, block.y + dy, block.z + dz)) return;

        const faceCenter = center.clone().addScaledVector(face.normal, 0.505);
        const right = LOCAL_RIGHT.clone().applyQuaternion(face.rotation);
        const up = LOCAL_UP.clone().applyQuaternion(face.rotation);

        for (let row = 0; row < resolution; row += 1) {
          for (let column = 0; column < resolution; column += 1) {
            const cell = row * resolution + column;
            const style = material.sample?.({
              block,
              normal: face.normal,
              faceIndex,
              row,
              column,
              resolution,
            }) ?? material;
            const glyphs = style.glyphs ?? material.glyphs;
            const colors = style.colors ?? material.colors ?? [style.color ?? material.color];
            const glyph = glyphs[
              patternIndex(block.x, block.y, block.z, faceIndex, cell, glyphs.length)
            ];
            const baseColor = colors[
              patternIndex(block.x, block.y, block.z, faceIndex + 11, cell + 97, colors.length)
            ];
            const color = variedCellColor(
              baseColor,
              style.variation ?? material.variation,
              block,
              faceIndex,
              cell,
              resolution * resolution,
            );
            const horizontal = (column - (resolution - 1) / 2) * cellSize;
            const vertical = ((resolution - 1) / 2 - row) * cellSize;
            const position = faceCenter
              .clone()
              .addScaledVector(right, horizontal)
              .addScaledVector(up, vertical);

            this.field.add(
              glyph,
              color,
              position,
              face.rotation,
              cellSize * 0.9,
              {
                voxel: { x: block.x, y: block.y, z: block.z },
                normal: { x: face.normal.x, y: face.normal.y, z: face.normal.z },
                materialId: block.materialId,
              },
            );
          }
        }
      });
    }

    this.field.flush();
    this.field.setPaletteOffset(paletteOffset);
  }

  raycast(raycaster) {
    const origin = raycaster.ray.origin;
    const direction = raycaster.ray.direction.clone().normalize();
    const maxDistance = Number.isFinite(raycaster.far) ? raycaster.far : 100;

    // Shift X/Z by half a cell because voxel coordinates identify block centers,
    // while Y coordinates identify block bottoms.
    const grid = new THREE.Vector3(origin.x + 0.5, origin.y, origin.z + 0.5);
    const cell = new THREE.Vector3(Math.floor(grid.x), Math.floor(grid.y), Math.floor(grid.z));
    const step = new THREE.Vector3(Math.sign(direction.x), Math.sign(direction.y), Math.sign(direction.z));
    const tDelta = new THREE.Vector3(
      direction.x === 0 ? Infinity : Math.abs(1 / direction.x),
      direction.y === 0 ? Infinity : Math.abs(1 / direction.y),
      direction.z === 0 ? Infinity : Math.abs(1 / direction.z),
    );
    const tMax = new THREE.Vector3(
      direction.x > 0 ? (cell.x + 1 - grid.x) / direction.x : direction.x < 0 ? (grid.x - cell.x) / -direction.x : Infinity,
      direction.y > 0 ? (cell.y + 1 - grid.y) / direction.y : direction.y < 0 ? (grid.y - cell.y) / -direction.y : Infinity,
      direction.z > 0 ? (cell.z + 1 - grid.z) / direction.z : direction.z < 0 ? (grid.z - cell.z) / -direction.z : Infinity,
    );

    const normal = new THREE.Vector3();
    let distance = 0;

    for (let iteration = 0; iteration < 256 && distance <= maxDistance; iteration += 1) {
      const block = this.get(cell.x, cell.y, cell.z);
      if (block) {
        if (normal.lengthSq() === 0) {
          const axis = ['x', 'y', 'z'].sort((a, b) => Math.abs(direction[b]) - Math.abs(direction[a]))[0];
          normal[axis] = -Math.sign(direction[axis]);
        }
        return {
          voxel: { x: block.x, y: block.y, z: block.z },
          normal: { x: normal.x, y: normal.y, z: normal.z },
          materialId: block.materialId,
          point: origin.clone().addScaledVector(direction, distance),
          distance,
        };
      }

      normal.set(0, 0, 0);
      if (tMax.x <= tMax.y && tMax.x <= tMax.z) {
        cell.x += step.x;
        distance = tMax.x;
        tMax.x += tDelta.x;
        normal.x = -step.x;
      } else if (tMax.y <= tMax.z) {
        cell.y += step.y;
        distance = tMax.y;
        tMax.y += tDelta.y;
        normal.y = -step.y;
      } else {
        cell.z += step.z;
        distance = tMax.z;
        tMax.z += tDelta.z;
        normal.z = -step.z;
      }
    }

    return null;
  }

  collidesPlayer(x, z, radius = 0.28) {
    for (const block of this.blocks.values()) {
      if (block.y > 1) continue;
      if (
        Math.abs(x - block.x) < 0.5 + radius
        && Math.abs(z - block.z) < 0.5 + radius
      ) return true;
    }
    return false;
  }

  placementIntersectsPlayer(voxel, playerPosition, radius = 0.42) {
    if (voxel.y > 1) return false;
    return (
      Math.abs(playerPosition.x - voxel.x) < 0.5 + radius
      && Math.abs(playerPosition.z - voxel.z) < 0.5 + radius
    );
  }
}
