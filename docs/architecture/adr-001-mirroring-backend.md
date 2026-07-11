# ADR 001: Prefer a transform-based Canvas 2D mirroring backend

- Status: Proposed; production switch intentionally deferred
- Date: 2026-07-10
- Owners: rendering work package

## Context

The visible folded canvas is Canvas 2D in every production mode. The current
Canvas 2D mirror backend downsamples that canvas, reads `ImageData`, creates up
to four full cell-sized pixel buffers with JavaScript loops, and writes those
buffers into the unfolded canvas. The WebGL mode uploads the same Canvas 2D
source, executes several render-to-texture passes in a hidden WebGL canvas, then
copies that canvas back into the user-visible Canvas 2D output.

The WebGL-specific implementation is 4,674 lines across
`WebGLCanvasService`, `WebGLPaintbrushMode`, `src/webgl`, and the raw shaders.
`WebGLPaintbrushMode` is not part of the active drawing factory, so this cost is
primarily supporting the mirror operation.

The previous benchmark API cannot inform the decision: its Canvas 2D result is
hard-coded to zero and its source and target are the same canvas. WP0's strict
backend comparison then found that the default diagonal pattern has similar
white-pixel counts in Canvas 2D and WebGL but near-zero mask overlap.

## Decision

Prefer the transform-based Canvas 2D prototype as the eventual single
production mirroring backend. Remove the WebGL production backend if the
prepared browser benchmark confirms the performance gates below.

Do not switch or delete either production backend in this work package. The
prototype and benchmark remain isolated so the application retains its current
fallback while the browser measurements are pending.

Retain WebGL only if all of the following are demonstrated:

1. It matches the intended folded/unfolded pixel mask for diagonal and
   non-diagonal scenarios.
2. It provides at least a 2x median improvement over transform Canvas 2D at a
   representative worst case, not merely over the per-pixel legacy path.
3. Transform Canvas 2D misses the interaction budgets below on supported
   target hardware.
4. Its implementation is reduced to an instance-owned `MirrorBackend`; the
   unused drawing stack and global resource ownership are removed.

## Intended fold semantics

For the default top-right-to-bottom-left diagonal, drawing is clipped to the
lower-right triangle. Unfolding must preserve those source pixels and reflect
them into the upper-left triangle:

`(x, y) -> (width - y - 1, height - x - 1)`

The existing Canvas 2D pixel implementation follows that equation. The focused
unit test uses an asymmetric lower-right marker and proves that both the source
and expected upper-left reflection remain present. The main-diagonal variant is
also covered.

The transform prototype encodes the same rule without reading pixels:

- Downsample the full-resolution folded canvas once.
- Copy the source cell.
- Clip the opposite triangle.
- Draw the source through the anti-diagonal matrix
  `[0, -1, -1, 0, width, height]`.
- Tile the completed cell with alternating horizontal and vertical Canvas 2D
  transforms.

The prototype's focused test verifies the diagonal matrix plus the four grid
orientations for the default 2x2 pattern.

## WebGL parity diagnosis

The shader's anti-diagonal equation is nominally correct. The likely defect is
the surrounding texture-origin pipeline:

1. A DOM canvas is uploaded with `texImage2D`, but the code never establishes
   an explicit `UNPACK_FLIP_Y_WEBGL` convention.
2. Quad bottom vertices use texture coordinate `v = 0`, while WebGL viewports
   use a bottom-left origin and DOM canvases use a top-left origin.
3. The grid code adjusts the viewport's Y position but does not correct the
   texture sampling orientation within each cell.
4. The final texture is rendered to the hidden WebGL canvas and copied with
   Canvas 2D `drawImage`, again without an explicit origin correction.
5. The separate debugging path `textureToImageData` does explicitly flip rows,
   but the production copy path does not use it.

This predicts a per-cell vertical inversion. Because alternating rows already
select vertical and combined mirror textures, a per-cell inversion is not
equivalent to one global flip; that explains why global transform comparisons
can have near-zero overlap despite similar total pixel counts.

This is a source-trace diagnosis, not a newly executed GPU probe. The opt-in
coordinate probe is prepared to confirm the exact regions once browser
execution is available.

## Performance evidence

### Static work comparison

| Path | Per update work |
| --- | --- |
| Legacy Canvas 2D | One downsample; `getImageData`; up to four cell-sized `ImageData` allocations and JavaScript pixel loops; one `putImageData` per grid cell |
| Transform Canvas 2D prototype | One downsample draw; one clipped diagonal draw when active; one transformed `drawImage` per grid cell |
| Current WebGL | DOM texture upload; source-cell render; optional diagonal render; three flip renders; one draw per grid cell; final texture render; copy back to visible Canvas 2D |

The transform path removes the known JavaScript pixel-loop bottleneck without
introducing a second graphics context or GPU resource lifecycle.

### Browser measurements

The harness covers 800, 1600, and 3200 square canvases with no folds, the
default 2x2 diagonal pattern, and a 64-cell maximum grid. It measures legacy
ImageData Canvas 2D, transform Canvas 2D, and current WebGL after a warm-up, and
reports pairwise white-mask Jaccard similarity.

Measurements are **not executed in this ADR**. The local Vite server first
failed with `listen EPERM: operation not permitted ::1:5173`. The required
out-of-sandbox run was then rejected because the execution account had reached
its usage limit. No timing numbers have been inferred or fabricated.

Run when browser execution is available:

```bash
npm run test:e2e:benchmark
npm run test:e2e:parity
```

The benchmark attaches `renderer-evidence.json` to the Playwright result and
prints the same JSON between `RENDERER_EVIDENCE_START` and
`RENDERER_EVIDENCE_END` markers.

## Performance gates

Use the project target hardware, not a CI software renderer, for the final
decision.

- 1600x1600 default and maximum-grid previews: transform Canvas 2D median at or
  below 16.7 ms.
- 3200x3200 committed render: transform Canvas 2D median at or below 50 ms.
- Pixel parity: Canvas 2D legacy versus transform Canvas 2D Jaccard similarity
  at least 0.98 for each fixture, with any residual difference visually
  explained by resampling at edges.
- Semantic probe: both source and analytically expected diagonal-reflection
  regions contain the asymmetric marker.

If transform Canvas 2D passes these gates, WebGL has no demonstrated product
benefit that offsets its correctness and maintenance cost, and should be
removed.

## Consequences

### Benefits

- One graphics API and one visible rendering model.
- No hidden WebGL canvas, shader compilation, framebuffer lifecycle, or
  Canvas-to-texture-to-Canvas round trip.
- Diagonal semantics are expressed directly as geometry instead of color-aware
  per-pixel copying or implicit texture-origin conventions.
- The benchmark can compare the prototype without changing production mode.

### Risks

- Browser Canvas 2D implementations may differ in resampling quality and
  acceleration.
- A 64-cell grid still performs 64 draw calls.
- Edge antialiasing may not be bit-identical to `putImageData`; mask tolerance
  must not conceal a transform or orientation error.
- Removal must wait for real timing and visual evidence at 3200x3200.

## Follow-up

1. Execute the opt-in benchmark and strict parity project on representative
   Chrome hardware.
2. Attach the JSON results to this ADR and change its status to Accepted or
   Rejected.
3. If accepted, integrate the transform renderer behind the existing backend
   seam, rerun all mirroring/replay/share tests, then remove WebGL in a separate
   reviewable change.
4. If rejected for performance, first fix WebGL's texture-origin convention and
   strict parity, then reduce it to the narrow `MirrorBackend` described above.
