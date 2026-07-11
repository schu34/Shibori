# ADR 001: Use transform-based Canvas 2D mirroring

- Status: Accepted
- Decision date: 2026-07-11
- Owners: rendering work package

## Context

Drawing tools render onto the folded Canvas 2D surface. The application
previously had two ways to create the unfolded pattern:

1. A legacy Canvas 2D path that read `ImageData`, allocated mirrored pixel
   buffers, and copied them cell by cell.
2. A WebGL path that uploaded the folded Canvas 2D surface to a hidden WebGL
   canvas, ran multiple texture passes, and copied the result back into the
   visible Canvas 2D output.

The WebGL-specific implementation was roughly 4,700 lines and also included an
inactive WebGL drawing stack. Earlier strict parity coverage found comparable
white-pixel counts but very low mask overlap, indicating an orientation error
rather than merely antialiasing differences.

A third implementation was prepared using only Canvas 2D transforms. It
downsamples the folded canvas once, uses a clipped transform for diagonal
symmetry, and tiles the completed cell using alternating horizontal and
vertical transforms. It performs no JavaScript per-pixel loop and needs no
second graphics context.

## Decision

Use transform-based Canvas 2D as the sole production unfolded renderer. Remove
the legacy ImageData production path, WebGL production path, inactive WebGL
drawing stack, backend selector, backend-specific test projects, and backend
preference state.

The default top-right-to-bottom-left diagonal preserves the lower-right
drawable triangle and reflects it into the upper-left triangle:

`(x, y) -> (width - y - 1, height - x - 1)`

The Canvas 2D matrix for that reflection is
`[0, -1, -1, 0, width, height]`. The main-diagonal case and alternating grid
orientations are also covered by focused semantic tests.

## Evidence

The opt-in browser harness was run locally in Chromium on 2026-07-11 after a
warm-up. It covered 800, 1600, and 3200 square canvases with no folds, the
default 2x2 diagonal pattern, and the maximum 8x8 diagonal grid.

- Transform Canvas 2D versus legacy ImageData white-mask Jaccard similarity was
  `1.0` in all nine scenarios.
- At 1600x1600, transform Canvas 2D measured `8.4 ms` for the default diagonal
  case and `0.7 ms` for the maximum grid, within the 16.7 ms preview budget.
- At 3200x3200, it measured `35.8 ms` for the default diagonal case and `2.1 ms`
  for the maximum grid, within the 50 ms committed-render budget.
- WebGL was slower than transform Canvas 2D in every measured scenario.
- WebGL similarity ranged from `0.0` to `0.322`, and the asymmetric diagonal
  probe confirmed that its output was vertically flipped.

These are one local browser run with few samples, not universal browser or
hardware guarantees. The evidence JSON recorded the exact user agent. The
remaining opt-in benchmark guards the accepted production transform path at
the 1600 and 3200 budgets and retains an asymmetric diagonal probe.

## Consequences

Benefits:

- One production renderer and one visible graphics model.
- No hidden WebGL canvas, shader compilation, framebuffer lifecycle, texture
  origin convention, or Canvas-to-texture-to-Canvas round trip.
- No full-cell `ImageData` allocations or JavaScript pixel loops in production.
- Fewer backend-specific controls, test projects, debug paths, and dependencies.

Risks and mitigations:

- Canvas 2D performance and resampling can vary by browser and hardware. Keep
  the benchmark opt-in and validate representative target devices when needed.
- A maximum grid performs 64 `drawImage` calls, although measured cell sizes
  made this case inexpensive in the local run.
- Edge antialiasing may vary. Semantic tests use asymmetric geometry and browser
  smoke tests assert visible drawing in every unfolded quadrant rather than
  relying only on aggregate pixel counts.
