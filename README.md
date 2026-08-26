# ASCII // VR

A Three.js/WebXR experiment that builds a navigable 3D room from GPU-instanced ASCII glyphs.

**Live demo:** https://alexradunet.github.io/nazar-world/

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. On desktop, click the scene and use **WASD + mouse**. Press **Space** to shift the color spectrum.

## VR

Click **Enter VR** in a WebXR-capable browser. Use the left thumbstick to move, the right thumbstick to snap-turn, and either trigger to shift colors.

WebXR requires a secure context. `localhost` is accepted for local development; testing from a standalone headset over your LAN generally requires HTTPS or a secure tunnel.

## Structure

- `src/main.js` — scene, glyph batching, generated world, desktop and XR controls
- `src/style.css` — HUD and presentation
- `index.html` — application shell

The world renders glyphs as `THREE.InstancedMesh` batches grouped by character and color, avoiding one object/draw call per glyph.

## Deployment

Pushes to `main` automatically build and deploy the site through `.github/workflows/deploy-pages.yml`. Vite's base path is configured for `/nazar-world/` in `vite.config.js`.
