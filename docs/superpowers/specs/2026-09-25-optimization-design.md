# Optimization mode redesign

Status: implemented; browser visual/FPS validation remains pending.
The screenshot reported by the user exposed unacceptable billboard gaps.
The user authorized replacing the image planes with textured outer surfaces.

## Preserved gameplay

- `worldMeta.superOptimization` remains the existing toggle.
- WATER/HOT_WATER use SNOW gameplay properties; LAVA/VOLCANIC_LAVA use
  STONE properties. Canonical stored IDs preserve original textures and
  restore ordinary behavior after the mode is disabled.
- Replacements are solid cubes. In survival (also when mode is unspecified),
  destroying them removes the cell without drops for players, bots or
  explosions, including moving-block explosions. Real snow and stone keep
  normal drops. Other modes retain replacement drops. Fluid work
  is paused. New optimized placements do not enqueue propagation.
- Volcano eruptions, steam particles and lava embers are disabled; geyser
  lift still queries its original hot-water/lava arrangement.
- Ordinary fluid placement performs a local immediate step independently
  of the background queue, while optimization keeps liquids immobile.

## Seam-preserving distant terrain

The normal live radius is 1. A preload belt of radius 2 prepares all vertical
chunks, including diagonal neighbors. Data unloads beyond radius 3 subject
to existing save protection. Live geometry stays visible until a cached
replacement is complete, even beyond the normal live radius.

The existing `distantImages3d` public name/file now owns static textured
surfaces, not screenshots. Surface vertices, UVs, colors and indices retain
exact world positions. Caves, slopes, vertical faces and structures keep
their visible topology. Camera motion cannot reorient or separate them.

The cache merges vertical meshes by material, removes lighting/wind
attributes, shares original texture maps, and uses MeshBasicMaterial without
shadows or animation. It does not reduce triangle counts. Lower attribute
cost, fewer meshes and simpler shading provide the rendering savings.

At most 32 columns and 64 MiB of attribute/index buffers are retained. Shared
textures and transient assembly arrays are outside that accounting. Build at
most one column per 200 ms. Evict farthest surfaces outside radius 2 first.
If no replacement fits, preserve live geometry rather than opening a hole.

## Atomic transitions

Dirty cached columns in the preload belt rebuild all loaded vertical chunks,
including empty chunks. Readiness includes dirty and mesh queues plus queued
and in-flight generation/saved-load jobs. Invalidation marks the old surface
stale without removing it. A complete successful build replaces it atomically.
Source geometry is released only after the current replacement is installed.
The cache records its original vertical chunk keys. If source data unloads
during reconstruction, replacement and near handoff wait for those keys to
be restored. There is no timed deletion without replacement.

On returning nearby, keep the old surface until live geometry is ready.
Deferred distant changes retain the last known surface. Empty completed
columns replace old surfaces with an empty result instead of ghost terrain.

World/dimension changes and disabling the mode dispose owned geometry and
materials. Shared terrain textures are not disposed by this cache. Surfaces
are session-only and do not alter world saves.

## Verification and limits

- Geometric ray tests cross both sides of adjacent column seams and check
  original heights; rotating/flying the camera must not alter cache geometry.
- Renderer integration tests exercise disposal, edits to one vertical chunk,
  reconstruction of the whole column, pending generation and fallback past
  the old eight-second timeout.
- Existing fluid, optimization, input, world and gameplay smoke tests remain
  applicable; new tests retain source IDs, drops and normal immediate flow.
- The user checks actual browser visuals/FPS per AGENTS.md. Automated geometry
  tests do not establish rendering quality or 60 FPS.
- Never-loaded or evicted distant terrain has no cached representation.
  Sky/fog remains beyond the known terrain frontier. The cache is a static
  last-known surface, not a simulated distant world.
