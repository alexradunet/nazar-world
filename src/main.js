import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import {
  BRAILLE_GLYPHS,
  GlyphAtlas,
  GlyphField,
  OCTANT_GLYPHS,
  QUADRANT_GLYPHS,
  SEXTANT_GLYPHS,
  addGlyphSprite,
} from './glyph-engine.js';
import './style.css';

const COLORS = {
  mint: 0x7dffca,
  cyan: 0x75eaff,
  magenta: 0xff78e6,
  violet: 0xba9cff,
  dim: 0x45bd86,
  white: 0xffffff,
};

const WORLD = {
  minX: -14,
  maxX: 14,
  minZ: -18,
  maxZ: 12,
};

const app = document.querySelector('#app');
const status = document.querySelector('#status');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03050a);
scene.fog = new THREE.FogExp2(0x03050a, 0.011);

const player = new THREE.Group();
scene.add(player);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 160);
camera.position.set(0, 1.65, 0);
player.position.set(0, 0, 8);
player.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;
app.append(renderer.domElement);
document.body.append(VRButton.createButton(renderer));

const glyphAtlas = new GlyphAtlas(renderer);
const glyphFields = [];
let glyphCount = 0;
let paletteOffset = 0;

const identity = new THREE.Quaternion();
const floorRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
const ceilingRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
const xWallRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
const zAxis = new THREE.Vector3(0, 0, 1);

function hash2(x, z) {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function choose(value, options) {
  return options[Math.floor(value * options.length) % options.length];
}

const world = new GlyphField(glyphAtlas, scene);
glyphFields.push(world);

// A floor made from individually placed, GPU-instanced glyph planes.
for (let x = WORLD.minX; x <= WORLD.maxX; x += 1) {
  for (let z = WORLD.minZ; z <= WORLD.maxZ; z += 1) {
    const noise = hash2(x, z);
    const glyph = noise < 0.46
      ? choose(noise / 0.46, ['.', '.', ':', '+', '·'])
      : choose((noise - 0.46) / 0.54, OCTANT_GLYPHS);
    const color = noise > 0.86
      ? COLORS.cyan
      : noise > 0.66
        ? COLORS.mint
        : noise > 0.48
          ? COLORS.violet
          : COLORS.dim;
    world.add(glyph, color, new THREE.Vector3(x, 0.012, z), floorRotation, 0.72);
  }
}

function addBoundaryWallZ(z, rotationY) {
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotationY, 0));
  for (let x = WORLD.minX; x <= WORLD.maxX; x += 0.9) {
    for (let y = 0.45; y <= 4.5; y += 0.9) {
      const noise = hash2(Math.round(x * 10), Math.round((z + y) * 10));
      const glyph = noise < 0.38
        ? choose(noise / 0.38, ['#', '%', 'H'])
        : choose((noise - 0.38) / 0.62, SEXTANT_GLYPHS);
      const color = noise > 0.78 ? COLORS.cyan : COLORS.mint;
      world.add(glyph, color, new THREE.Vector3(x, y, z), rotation, 0.7);
    }
  }
}

function addBoundaryWallX(x) {
  for (let z = WORLD.minZ; z <= WORLD.maxZ; z += 0.9) {
    for (let y = 0.45; y <= 4.5; y += 0.9) {
      const noise = hash2(Math.round((x + y) * 10), Math.round(z * 10));
      const glyph = noise < 0.38
        ? choose(noise / 0.38, ['#', '=', 'N'])
        : choose((noise - 0.38) / 0.62, SEXTANT_GLYPHS);
      const color = noise > 0.8 ? COLORS.violet : COLORS.mint;
      world.add(glyph, color, new THREE.Vector3(x, y, z), xWallRotation, 0.7);
    }
  }
}

addBoundaryWallZ(WORLD.minZ, 0);
addBoundaryWallZ(WORLD.maxZ, Math.PI);
addBoundaryWallX(WORLD.minX);
addBoundaryWallX(WORLD.maxX);

function addColumn(x, z, glyph, color, height = 5.4) {
  const rings = 10;
  for (let y = 0.45; y <= height; y += 0.75) {
    for (let index = 0; index < rings; index += 1) {
      const angle = (index / rings) * Math.PI * 2;
      const normal = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
      const rotation = new THREE.Quaternion().setFromUnitVectors(zAxis, normal);
      const position = new THREE.Vector3(x, y, z).addScaledVector(normal, 0.72);
      world.add(glyph, color, position, rotation, 0.52);
    }
  }
}

addColumn(-7, -8, '@', COLORS.magenta);
addColumn(7, -8, '@', COLORS.violet);
addColumn(-9, 3, '&', COLORS.cyan, 3.9);
addColumn(9, 3, '&', COLORS.cyan, 3.9);

function addRuinWall(x1, z1, x2, z2, height, glyph, color) {
  const delta = new THREE.Vector2(x2 - x1, z2 - z1);
  const length = delta.length();
  const steps = Math.max(1, Math.round(length / 0.75));
  const normal = new THREE.Vector3(-delta.y / length, 0, delta.x / length);
  const rotation = new THREE.Quaternion().setFromUnitVectors(zAxis, normal);

  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    const x = THREE.MathUtils.lerp(x1, x2, progress);
    const z = THREE.MathUtils.lerp(z1, z2, progress);
    for (let y = 0.45; y <= height; y += 0.75) {
      world.add(glyph, color, new THREE.Vector3(x, y, z), rotation, 0.56);
    }
  }
}

addRuinWall(-11, -2, -4, -2, 2.7, '/', COLORS.cyan);
addRuinWall(4, -2, 11, -2, 2.7, '\\', COLORS.violet);
addRuinWall(-4, 6, 4, 6, 1.95, QUADRANT_GLYPHS[3], COLORS.magenta);

function addText(text, centerX, y, z, color, size = 0.5) {
  const spacing = size * 0.92;
  const startX = centerX - ((text.length - 1) * spacing) / 2;
  [...text].forEach((glyph, index) => {
    if (glyph !== ' ') {
      world.add(glyph, color, new THREE.Vector3(startX + index * spacing, y, z), identity, size);
    }
  });
}

addText('THE NULL IS LISTENING', 0, 4.2, WORLD.minZ + 0.03, COLORS.white, 0.52);
addText('FIND 5 SIGILS', 0, 2.35, 1.5, COLORS.white, 0.42);

// A bright punctuation trail makes the first objective readable from spawn.
for (let z = 7; z >= 3; z -= 0.65) {
  world.add('^', COLORS.cyan, new THREE.Vector3(0, 0.025, z), floorRotation, 0.38);
}

// Sparse overhead stars give the room depth without conventional geometry.
for (let index = 0; index < 180; index += 1) {
  const x = THREE.MathUtils.lerp(WORLD.minX + 1, WORLD.maxX - 1, hash2(index, 2));
  const z = THREE.MathUtils.lerp(WORLD.minZ + 1, WORLD.maxZ - 1, hash2(index, 7));
  const y = THREE.MathUtils.lerp(5.4, 8.5, hash2(index, 13));
  const glyph = index % 7 === 0 ? '+' : choose(hash2(index, 19), BRAILLE_GLYPHS);
  const color = index % 11 === 0 ? COLORS.magenta : COLORS.cyan;
  world.add(glyph, color, new THREE.Vector3(x, y, z), ceilingRotation, index % 7 === 0 ? 0.42 : 0.25);
}

// The portal is its own local glyph field so its entire ASCII ring can animate.
const portal = new THREE.Group();
portal.position.set(0, 2.25, WORLD.minZ + 0.08);
scene.add(portal);
const portalField = new GlyphField(glyphAtlas, portal);
glyphFields.push(portalField);
const portalGlyphs = 32;
for (let index = 0; index < portalGlyphs; index += 1) {
  const angle = (index / portalGlyphs) * Math.PI * 2;
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, angle - Math.PI / 2));
  const position = new THREE.Vector3(Math.cos(angle) * 1.6, Math.sin(angle) * 1.6, 0.04);
  portalField.add(index % 2 ? '0' : '1', index % 2 ? COLORS.magenta : COLORS.cyan, position, rotation, 0.5);
}

// Glyph entities are authored as tiny text sprites. Their presentation is
// entirely character-based while position, collection, and behavior remain data.
const sigils = [];
const sigilPositions = [
  [0, 3.2],
  [-9, -13],
  [8, -11],
  [-10, 0],
  [9, 5],
];
const sigilSymbols = ['*', '$', '?', '!', '@'];
const sigilColors = [COLORS.cyan, COLORS.magenta, COLORS.violet, COLORS.mint, COLORS.white];

sigilPositions.forEach(([x, z], index) => {
  const group = new THREE.Group();
  group.position.set(x, 1.4, z);
  scene.add(group);

  const field = new GlyphField(glyphAtlas, group);
  addGlyphSprite(field, [' /\\ ', `<${sigilSymbols[index]}>`, ' \\/ '], sigilColors[index], 0.34);
  field.add('*', COLORS.white, new THREE.Vector3(0, 0, 0.16), identity, 0.2);
  glyphFields.push(field);
  sigils.push({ group, field, baseY: group.position.y, phase: index * 1.37, active: true });
});

// VR input is represented by characters too: a bracket-shaped controller and
// a dotted glyph ray replace conventional controller meshes.
const controllers = [];
for (let index = 0; index < 2; index += 1) {
  const controller = renderer.xr.getController(index);
  controller.visible = false;
  controller.addEventListener('connected', () => { controller.visible = true; });
  controller.addEventListener('disconnected', () => { controller.visible = false; });
  controller.addEventListener('selectstart', shiftPalette);
  player.add(controller);

  const field = new GlyphField(glyphAtlas, controller);
  addGlyphSprite(field, index === 0 ? ['[+'] : ['+]'], COLORS.mint, 0.1);
  for (let ray = 1; ray <= 12; ray += 1) {
    field.add(
      ray === 12 ? '>' : '.',
      ray === 12 ? COLORS.magenta : COLORS.mint,
      new THREE.Vector3(0, 0, -ray * 0.18),
      identity,
      ray === 12 ? 0.1 : 0.055,
    );
  }
  glyphFields.push(field);
  controllers.push(controller);
}

// Every field shares one atlas. A field can mix any registered character and
// color in a single instanced draw call.
glyphAtlas.build();
glyphFields.forEach((field) => field.flush());
glyphCount = glyphFields.reduce((total, field) => total + field.count, 0);

let collectedSigils = 0;
let worldDecoded = false;

function updateStatus(message = '') {
  const objective = `${collectedSigils}/${sigils.length} sigils`;
  status.textContent = `${objective} // ${glyphCount.toLocaleString()} glyphs${message ? ` // ${message}` : ''}`;
}

updateStatus('find the glyphs');

function shiftPalette() {
  paletteOffset = (paletteOffset + 0.11) % 1;
  glyphFields.forEach((field) => field.setPaletteOffset(paletteOffset));
  updateStatus(`spectrum ${Math.round(paletteOffset * 360)}°`);
}

// Desktop controls.
const keys = new Set();
let pitch = 0;

addEventListener('keydown', (event) => {
  keys.add(event.code);
  if (event.code === 'Space' && !event.repeat) {
    event.preventDefault();
    shiftPalette();
  }
});
addEventListener('keyup', (event) => keys.delete(event.code));

renderer.domElement.addEventListener('click', () => {
  if (!renderer.xr.isPresenting) renderer.domElement.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  document.body.classList.toggle('pointer-locked', document.pointerLockElement === renderer.domElement);
});

document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== renderer.domElement || renderer.xr.isPresenting) return;
  player.rotation.y -= event.movementX * 0.0022;
  pitch = THREE.MathUtils.clamp(pitch - event.movementY * 0.0022, -1.35, 1.35);
  camera.rotation.x = pitch;
});

renderer.xr.addEventListener('sessionstart', () => {
  if (document.pointerLockElement) document.exitPointerLock();
  camera.rotation.x = 0;
});

renderer.xr.addEventListener('sessionend', () => {
  camera.position.set(0, 1.65, 0);
  pitch = 0;
});

const clock = new THREE.Clock();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const movement = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
let snapTurnReady = true;

function applyBounds() {
  player.position.x = THREE.MathUtils.clamp(player.position.x, WORLD.minX + 0.8, WORLD.maxX - 0.8);
  player.position.z = THREE.MathUtils.clamp(player.position.z, WORLD.minZ + 0.8, WORLD.maxZ - 0.8);
}

function updateDesktopMovement(delta) {
  movement.set(0, 0, 0);
  if (keys.has('KeyW') || keys.has('ArrowUp')) movement.z -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) movement.z += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) movement.x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) movement.x += 1;
  if (movement.lengthSq() === 0) return;

  movement.normalize().applyQuaternion(player.quaternion);
  player.position.addScaledVector(movement, delta * 4.2);
  applyBounds();
}

function updateXRMovement(delta) {
  const session = renderer.xr.getSession();
  if (!session) return;

  const xrCamera = renderer.xr.getCamera(camera);
  const viewCamera = xrCamera.cameras?.[0] ?? xrCamera;
  viewCamera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
  forward.normalize();
  right.crossVectors(forward, up).normalize();

  for (const source of session.inputSources) {
    const axes = source.gamepad?.axes;
    if (!axes || axes.length < 2) continue;
    const x = axes[axes.length - 2];
    const y = axes[axes.length - 1];

    if (source.handedness === 'left' || session.inputSources.length === 1) {
      if (Math.abs(x) > 0.14) player.position.addScaledVector(right, x * delta * 2.6);
      if (Math.abs(y) > 0.14) player.position.addScaledVector(forward, -y * delta * 2.6);
    }

    if (source.handedness === 'right') {
      if (Math.abs(x) > 0.72 && snapTurnReady) {
        player.rotation.y -= Math.sign(x) * Math.PI / 6;
        snapTurnReady = false;
      } else if (Math.abs(x) < 0.35) {
        snapTurnReady = true;
      }
    }
  }

  applyBounds();
}

const cameraWorldPosition = new THREE.Vector3();
const sigilFacingTarget = new THREE.Vector3();

function updateSigils(elapsed) {
  camera.getWorldPosition(cameraWorldPosition);

  sigils.forEach((sigil) => {
    if (!sigil.active) return;

    sigil.group.position.y = sigil.baseY + Math.sin(elapsed * 1.8 + sigil.phase) * 0.16;
    sigilFacingTarget.set(cameraWorldPosition.x, sigil.group.position.y, cameraWorldPosition.z);
    sigil.group.lookAt(sigilFacingTarget);

    const dx = player.position.x - sigil.group.position.x;
    const dz = player.position.z - sigil.group.position.z;
    if (dx * dx + dz * dz < 1.35 * 1.35) {
      sigil.active = false;
      sigil.group.visible = false;
      collectedSigils += 1;
      updateStatus(collectedSigils === sigils.length ? 'portal unlocked' : 'sigil acquired');
    }
  });

  if (collectedSigils === sigils.length && !worldDecoded) {
    const portalDx = player.position.x - portal.position.x;
    const portalDz = player.position.z - portal.position.z;
    if (portalDx * portalDx + portalDz * portalDz < 2.1 * 2.1) {
      worldDecoded = true;
      updateStatus('WORLD DECODED');
    }
  }
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (renderer.xr.isPresenting) updateXRMovement(delta);
  else updateDesktopMovement(delta);

  updateSigils(elapsed);
  portal.rotation.z += delta * (collectedSigils === sigils.length ? 0.55 : 0.12);
  const pulseAmount = collectedSigils === sigils.length ? 0.11 : 0.035;
  const pulse = 1 + Math.sin(elapsed * 2.1) * pulseAmount;
  portal.scale.setScalar(pulse);

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
