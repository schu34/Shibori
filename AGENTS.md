# AGENTS.md — Shibori repository guidance

## Non-negotiable product invariant

**🚨 Mirroring and unfolding are the core purpose of this application. A committed mark on the folded canvas must produce the corresponding symmetric pattern on the unfolded canvas. If folded drawing works but unfolding does not, the application is broken. 🚨**

Preserve this invariant for every drawing tool, history replay, undo, clear, move, rotate, share-link load, fold configuration, and canvas dimension.

## Stack and ownership

- React 19 and TypeScript, built with Vite.
- Redux Toolkit with the `shibori` reducer as the durable application state boundary.
- HTML Canvas 2D plus `perfect-freehand` for drawing.
- Jest and React Testing Library for unit/component tests; Playwright for rendered browser behavior.
- npm is the only supported package manager. Use Node.js 20 or newer.

The current data flow is:

`shared URL bootstrap -> Redux command log/domain -> Pointer Event gesture session/drawing mode -> one canvas runtime transaction -> folded replay/guidance -> transform Canvas 2D mirror`

There is one production renderer. Do not introduce a renderer selector or a second replay/mirroring path without a new architectural decision and parity evidence.

## Critical files

- `src/main.tsx` and `src/services/bootstrapSharedState.ts` — synchronous shared-link bootstrap before React mount.
- `src/store/index.ts` and `src/store/shiboriCanvasState.ts` — store construction, application state, and reducer invariants.
- `src/types/DrawingMode.ts` — discriminated history commands and drawing-mode contracts.
- `src/utils/historyOperations.ts` — stable IDs, command creation, and command-log scene resolution.
- `src/utils/historyRenderer.ts` — replay of resolved drawable history.
- `src/utils/urlStateUtils.ts` — share schema v2, strict validation, encoding, decoding, and legacy migration.
- `src/hooks/useCanvasEvents.ts` — primary Pointer Event capture and coordinate conversion.
- `src/hooks/useCanvasDrawing.ts` — one local draw/move/rotate gesture session and committed commands.
- `src/drawingModes/DrawingModeFactory.ts` and `src/drawingModes/*Mode.ts` — tool behavior and geometry.
- `src/hooks/useCanvasRuntime.ts` and `src/rendering/canvasRuntime.ts` — sole owner of sizing, contexts, replay, previews, guidance, scheduling, and mirror transactions.
- `src/rendering/CanvasMirror.ts` — sole transform-based Canvas 2D unfolded renderer.
- `src/services/CanvasService.ts` — shared canvas clearing, clipping, coordinates, guidance, and download operations.
- `tests/smoke.spec.ts` and `tests/utils/canvasHelpers.ts` — required browser pixel checks for the core invariant.
- `docs/architecture/adr-001-mirroring-backend.md` — renderer decision and benchmark evidence.

## Interaction rules

- Use Pointer Events for mouse, touch, and pen. Do not add parallel mouse and touch handler stacks.
- Accept one primary pointer gesture at a time, capture it on pointer down, and handle pointer up, pointer cancel, and lost capture.
- Keep the in-progress gesture session local to the drawing hook. Persist only committed history commands and intentional application previews.
- Convert client coordinates through the displayed-to-backing-store scale before passing them to a drawing mode.
- Preserve the existing selection keyboard behavior: arrows nudge, Shift increases the step, Delete/Backspace deletes, and Escape clears selection.

## History and sharing invariants

- History is a discriminated command log. Do not add fields to every command when they apply to only one command family.
- Every drawable must have a stable ID before it can be targeted by move, rotate, or delete.
- A drawable commit must snapshot its rendering style. Later control changes must not alter replayed history.
- Clear remains an undoable history command; it is not permission to erase the log.
- Structural fold or dimension changes clear incompatible history atomically.
- Share schema v2 is strict and bounded. Validate untrusted input at the URL/Redux boundary, not on every internal action.
- New share links always encode v2. Keep original unversioned links working only through the explicit migration path.
- Shared state must be loaded synchronously before React mounts so the first canvas transaction sees the restored command log.

Any new drawing-affecting state must be considered in all of: the history command/style snapshot, scene replay, URL serialization and migration, undo behavior, and folded-to-unfolded browser coverage.

## Canvas and mirroring rules

- `useCanvasRuntime` is the only React owner of context acquisition, backing-store sizing, state replay, and unfolded scheduling.
- A committed replay is one transaction: clear once, resolve/replay once, draw folded guidance once, and mirror at most once.
- Live previews and committed replay must use the same drawing semantics.
- Preserve full gesture geometry, clip rendering to the drawable folded region, and keep invalid-region guidance out of the folded backing store.
- The accepted top-right-to-bottom-left diagonal preserves the lower-right triangle and reflects it into the upper-left. Focused semantic tests protect this orientation.

## Validation sequence

Use this sequence after changes:

```bash
npm run build
npm run check
npm run test:e2e:smoke
npm run test:e2e
```

Also run `git diff --check`. Use `npx playwright test --list` when changing Playwright configuration without needing to start a server. Run `npm run test:e2e:benchmark` for mirroring or renderer-performance changes; it is opt-in and machine-dependent.

For a focused Playwright test:

```bash
npm run test:e2e -- tests/basic.spec.ts
npm run test:e2e -- --grep "test name"
```

`npm run build` and `npm run check` are required for all code/configuration work. Browser pixel checks are required for every canvas-visible change. A passing unit test, DOM assertion, aggregate log, or type check is not enough to establish that mirroring still works.

When browser execution is unavailable because of the environment, report that limitation explicitly; do not claim rendered verification from non-browser gates.
