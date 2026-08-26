# ASCII // VR

A Three.js/WebXR game experiment where the world, objects, collectibles, portal, and VR controllers are composed from GPU-instanced glyphs.

**Live demo:** https://alexradunet.github.io/nazar-world/

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. On desktop, click the scene and use **WASD + mouse**. Mine blocks with the **left mouse button**, place blocks with the **right mouse button**, select materials with **1–6**, and press **Space** to shift the color spectrum. Find all five floating glyph sigils to unlock the portal.

## VR

Click **Enter VR** in a WebXR-capable browser. Use the left thumbstick to move and the right thumbstick to snap-turn. The right trigger mines the targeted block and the left trigger places the selected material.

WebXR requires a secure context. `localhost` is accepted for local development; testing from a standalone headset over your LAN generally requires HTTPS or a secure tunnel.

## Structure

- `src/glyph-engine.js` — shared atlas, mosaic generation, mixed-glyph instancing, and text-sprite composition
- `src/main.js` — generated world, glyph entities, game loop, and desktop/XR controls
- `src/voxel-world.js` — voxel storage, exposed-face compilation, ray picking, and collision
- `src/style.css` — HUD and presentation
- `index.html` — application shell

Each `GlyphField` can mix characters and per-instance colors in one `THREE.InstancedMesh`. A shader adjustment selects each character from a shared atlas, so adding a larger glyph vocabulary does not create one draw call per character.

See [`docs/GLYPH_ENGINE.md`](docs/GLYPH_ENGINE.md) for the character vocabulary, data model, rendering pipeline, and implementation roadmap.

## Glyph voxels

Minecraft-like blocks are stored in a sparse 3D grid. Only exposed faces are rendered, and every face is an 8×8 texture made from 64 independently colored glyph cells compiled into the shared instanced field. Each cell receives deterministic palette, hue, saturation, and brightness variation, so neighboring glyphs do not collapse into one flat tint. Hidden voxel data handles targeting and collision without introducing visible conventional cube meshes.

Six bright, face-aware materials combine ASCII and mosaic glyphs: grass, stone, wood, leaves, glass, and glow. Grass blocks use different top, side-edge, side-earth, and bottom styles; logs use separate bark and ring styles.

## Procedural mosaic vocabulary

Terrain uses 2×4 octants, boundary walls use 2×3 sextants, ruins can use 2×2 quadrants, and sparse particles use 2×4 Braille dots. These are drawn procedurally into the glyph atlas rather than relying on installed Unicode fonts, because many current headset fonts do not yet include the newer ranges. The resulting textures retain the same cell geometry and remain GPU-instanced.

## Deployment

Pushes to `main` automatically build and deploy the site through `.github/workflows/deploy-pages.yml`. Vite's base path is configured for `/nazar-world/` in `vite.config.js`.
