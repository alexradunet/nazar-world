# ASCII // VR

A Three.js/WebXR game experiment where the world, objects, collectibles, portal, and VR controllers are composed from GPU-instanced glyphs.

**Live demo:** https://alexradunet.github.io/nazar-world/

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. On desktop, click the scene and use **WASD + mouse**. Press **Space** to shift the color spectrum. Find all five floating glyph sigils to unlock the portal.

## VR

Click **Enter VR** in a WebXR-capable browser. Use the left thumbstick to move, the right thumbstick to snap-turn, and either trigger to shift colors.

WebXR requires a secure context. `localhost` is accepted for local development; testing from a standalone headset over your LAN generally requires HTTPS or a secure tunnel.

## Structure

- `src/glyph-engine.js` — shared atlas, mosaic generation, mixed-glyph instancing, and text-sprite composition
- `src/main.js` — generated world, glyph entities, game loop, and desktop/XR controls
- `src/style.css` — HUD and presentation
- `index.html` — application shell

Each `GlyphField` can mix characters and per-instance colors in one `THREE.InstancedMesh`. A shader adjustment selects each character from a shared atlas, so adding a larger glyph vocabulary does not create one draw call per character.

See [`docs/GLYPH_ENGINE.md`](docs/GLYPH_ENGINE.md) for the character vocabulary, data model, rendering pipeline, and implementation roadmap.

## Procedural mosaic vocabulary

Terrain uses 2×4 octants, boundary walls use 2×3 sextants, ruins can use 2×2 quadrants, and sparse particles use 2×4 Braille dots. These are drawn procedurally into the glyph atlas rather than relying on installed Unicode fonts, because many current headset fonts do not yet include the newer ranges. The resulting textures retain the same cell geometry and remain GPU-instanced.

## Deployment

Pushes to `main` automatically build and deploy the site through `.github/workflows/deploy-pages.yml`. Vite's base path is configured for `/nazar-world/` in `vite.config.js`.
