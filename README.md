# Shibori

Shibori is a React drawing app for exploring folded, symmetric patterns. You draw on the folded canvas; the app replays that drawing and mirrors it into the unfolded canvas.

> **Core invariant:** a committed mark on the folded canvas must produce the corresponding symmetric pattern on the unfolded canvas. If folded drawing works but unfolding does not, the application is broken.

## Setup and commands

Use Node.js 20 or newer and npm 10.9.2.

```bash
npm ci
npm run dev
```

The main commands are:

- `npm run build` — production TypeScript build and Vite bundle.
- `npm run check` — application, test, and E2E type checks; ESLint; and Jest unit tests.
- `npm run test:e2e:smoke` — focused Chromium pixel checks for folded drawing and unfolded symmetry.
- `npm run test:e2e` — the maintained Playwright suite for interactions, sharing, layout, and canvas behavior.
- `npm run test:e2e:benchmark` — opt-in local renderer performance and semantic benchmark.
- `npm run preview` — serve the production bundle locally.

## Architecture

The application has one state-to-canvas path:

1. `main.tsx` synchronously decodes a valid `?shared=` document before React mounts.
2. Redux owns controls, fold configuration, selection previews, and the persisted command log. History helpers resolve that log into the current drawable scene.
3. `useCanvasEvents` converts one captured primary Pointer Event stream into coordinates. `useCanvasDrawing` owns the local draw, move, or rotate gesture session and delegates drawing geometry to the modes in `src/drawingModes`.
4. `useCanvasRuntime` is the React owner of context setup, sizing, scheduling, and state-driven rendering. It calls one transaction in `src/rendering/canvasRuntime.ts`.
5. That transaction clears once, resolves and replays committed history plus any selection preview onto the folded canvas, draws folded guidance, and updates the unfolded canvas once.
6. `src/rendering/CanvasMirror.ts` is the sole production mirror. It uses Canvas 2D clipping and transforms for diagonal reflection and repeated horizontal/vertical folds.

There is no selectable rendering backend. The rationale and measured local evidence are recorded in [ADR 001: Use transform-based Canvas 2D mirroring](docs/architecture/adr-001-mirroring-backend.md).

## History and share links

History is a discriminated command log: drawable commits plus clear, move, rotate, and delete commands. Drawable commands have stable IDs and capture their rendering style, including thickness, color, and shape fill mode where applicable. Replay therefore does not depend on whatever controls are selected later.

Share documents use schema version 2, strict validation, bounded payloads, and URL-safe Base64. Decoding an original unversioned link runs an explicit migration that assigns IDs and materializes style from the legacy top-level controls; new links always encode version 2.

## Testing expectations

- Run focused Jest tests while changing domain, geometry, state, or runtime logic.
- Run `npm run build` and `npm run check` for every code or configuration change.
- Run `npm run test:e2e:smoke` for any drawing, replay, canvas runtime, fold, or mirroring change.
- Run the full E2E suite before integration and for interaction, sharing, responsive-layout, or canvas-visible changes.
- Run the opt-in benchmark only when changing mirroring semantics or renderer performance.
- Canvas-visible changes require browser pixel evidence; DOM assertions alone cannot prove the folded-to-unfolded invariant.

## Current limitations

Renderer timings in the ADR and benchmark are local evidence, not guarantees across browsers and hardware. The Pointer Events path has automated coverage, but validation on representative physical touch and pen devices remains useful.
