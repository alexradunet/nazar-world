# Nazar Glyph Engine

## Principle

Every visible object is a composition of glyph cells. Physics, collision, audio, and behavior are ordinary game data, but their visible representation is always emitted through the glyph renderer.

A glyph cell contains:

```js
{
  glyph,       // ASCII, Unicode, sextant token, or octant token
  color,
  position,    // local or world-space Vector3
  rotation,    // surface-aligned, billboarded, or free Quaternion
  scale,
  layer,       // terrain, actor, effect, interface
  tags,        // solid, collectible, hostile, destructible, etc.
}
```

A glyph entity owns a transform, behavior, optional collider, and one or more glyph cells. This keeps gameplay independent from presentation while enforcing the all-glyph visual rule.

## Character vocabulary

| Family | Best use |
| --- | --- |
| ASCII letters and symbols | Actors, items, labels, readable state |
| `#`, `%`, `@`, `&` | Dense structures, machines, creatures |
| `.`, `:`, `*`, `+` | Trails, particles, stars, controller rays |
| `/`, `\\`, `|`, `-`, `_` | Silhouettes, weapons, architecture |
| Box-drawing characters | Connected walls, frames, doors, pipes |
| `░`, `▒`, `▓`, `█` | Material density, shadow, damage |
| Quadrants | Coarse 2×2 surface detail |
| Sextants | 2×3 terrain and silhouettes |
| Octants | 2×4 high-detail terrain and sprites |
| Braille | 2×4 sparse particles, fields, distant LOD |

## Rendering pipeline

1. Register every glyph used by the scene in `GlyphAtlas`.
2. Draw classic text and procedural mosaics into one canvas atlas.
3. Store atlas index, color, and transform as per-instance attributes.
4. Render each `GlyphField` with one `THREE.InstancedMesh` draw call.
5. Let a small shader modification select the correct atlas tile per instance.

This scales much better than creating one material or mesh per character. Static terrain can occupy one field, while independently animated actors use their own fields.

## World compilation

The eventual level format should be a set of plain-text layers:

```text
################
#......$.......#
#..../\\.......#
#...<@>....+...#
################
```

A compiler can turn each symbol into:

- one or more 3D glyph cells;
- collision and interaction metadata;
- elevation or voxel faces;
- actor or item spawns;
- material and color rules.

Sextant, octant, quadrant, and Braille patterns can be selected from local density, surface normal, lighting, damage, or distance. This makes the character itself carry visual information instead of acting as a decorative texture.

## Gameplay systems to add next

1. **Incremental chunk rebuilds:** update only the edited voxel chunk instead of rebuilding the whole voxel field.
2. **Editable fields:** change atlas indices and transforms in place without recreating an instanced mesh.
3. **Text-map compiler:** author rooms and entities as character grids.
4. **Expanded collision:** add vertical movement, stepping, gravity, and grounded block traversal.
5. **Glyph animation:** swap atlas indices for character-based animation frames.
6. **LOD grammar:** octants nearby, sextants at medium range, ASCII punctuation far away.
7. **Glyph editor:** VR placement, recoloring, rotation, and deletion of cells.
8. **Persistence:** serialize player-built glyph structures as compact text/JSON.

## Current prototype

The prototype already uses:

- octant terrain;
- sextant boundary walls;
- quadrant ruin surfaces;
- procedural Braille star and particle fields;
- ASCII architecture and portal pieces;
- editable glyph voxels with 2×2 character-textured exposed faces;
- voxel-DDA block targeting, mining, placement, and simple collision;
- text-authored collectible sigils;
- glyph-composed VR controllers and rays;
- one shared atlas with mixed-glyph instancing;
- a collectible objective and portal completion state.
