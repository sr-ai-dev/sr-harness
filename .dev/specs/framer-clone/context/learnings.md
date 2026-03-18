# Learnings

## T1
- Tailwind CSS v4 (installed by default) uses CSS-first config: no `tailwind.config.js`, configure via `@theme {}` in index.css with CSS custom properties
- Tailwind v4 requires `@tailwindcss/vite` plugin (not PostCSS plugin); install with `--legacy-peer-deps` due to Vite 8 peer conflict
- `@testing-library/dom` must be installed separately — it is a peer dep of `@testing-library/react` not automatically resolved
- Use `defineConfig` from `vitest/config` (not `vite`) to get proper TypeScript typing for `test` block in vite.config.ts
- Add `"vitest/globals"` to `types[]` in both `tsconfig.app.json` and `tsconfig.node.json` to avoid TS errors on `vi`, `describe`, `it`, `expect` globals
- React 19 with `jsx: "react-jsx"` mode: do NOT import React explicitly in components (causes `noUnusedLocals` TS error); use named imports like `import { useState } from 'react'`
- All npm installs with `@tailwindcss/vite` installed require `--legacy-peer-deps` flag for the session
- Framer editor dark theme base colors: bg=#1a1a1a, surface=#242424, panel=#1e1e1e, toolbar=#252525, border=#333, text=#e0e0e0, muted=#888, canvas=#141414, accent=#0a84ff

## T2
- Zustand v5 with Immer middleware: use `immer` from `zustand/middleware/immer` (not `produce` directly); state mutations inside `set((state) => { ... })` are automatically immutable via Immer
- Manual undo/redo history stack (past/future arrays of JSON-serialized snapshots) is simpler and more testable than temporal middleware like `zundo`
- `useEditorStore.setState({ ... })` can be called directly in tests to reset store between test runs — no need for a dedicated reset action
- Element tree uses flat `ElementMap` (Record<string, Element>) for O(1) access with `rootIds[]` tracking top-level elements
- Immer draft state means `Object.assign(state.elements[id], patch)` works correctly for partial updates

## T3
- EditorLayout, LeftPanel components were already created by T1 with correct data-testid attributes; T3 added Toolbar and RightPanel components
- Toolbar component lives in `src/components/Toolbar/Toolbar.tsx` (capital T directory matching file_scope)
- RightPanel lives in `src/components/editor/RightPanel.tsx` alongside EditorLayout and LeftPanel
- At 1024px viewport: left (240px) + right (240px) = 480px, canvas gets remaining ~544px — comfortably above 400px usability threshold
- All editor-layout tests (10) pass with existing EditorLayout + LeftPanel; Toolbar/RightPanel additions don't break existing test suite

## T4
- happy-dom's `WheelEvent` constructor does not propagate `deltaY` from `EventInit` — use a plain object cast to `WheelEvent` (`{ deltaY, metaKey, clientX, ... } as unknown as WheelEvent`) for unit testing wheel handlers
- `useCanvasNavigation` exposes all event handlers directly so tests can call them without DOM event dispatching
- CSS transform `translate(x, y) scale(zoom)` with `transformOrigin: '0 0'` is the correct approach for pan+zoom; zoom-centered-on-cursor formula: `newX = cursorX - (newZoom/oldZoom) * (cursorX - prevX)`
- Canvas pan tracking uses a `ref` for mouse drag state to avoid stale closure issues; `isPanning` UI indicator is separate `useState`
- Space key `e.target` can be `null` in synthetic keyboard events — always null-check before accessing `.tagName`

## T7
- `LayersPanel` component lives in `src/components/LeftPanel/LayersPanel.tsx`; `LeftPanel.tsx` imports it from `../LeftPanel/LayersPanel`
- Auto-expand parent elements with children using `useEffect` + `setExpandedIds`; do NOT use render-time side-effects (causes stale closure issues)
- `reorderElement` action added to editorStore: moves element within its parent's children array (or rootIds for root elements) and updates zIndex for all siblings to match new index order
- Drag-to-reorder only works within the same parent (cross-parent drops are silently ignored)
- `dragIdRef` (useRef) tracks the dragged element id across dragStart/drop events since dataTransfer is not always reliable in jsdom tests
- Pre-existing `canvas-navigation.test.tsx` had unused `fireEvent` import causing `noUnusedLocals` TS build error; removed the unused import to fix build

## T11
- Persistence module lives in `src/store/persistence.ts` — standalone, no React deps; store is accessed via `useEditorStore.getState()` and `useEditorStore.setState()` directly
- `setNotificationHandler()` enables test-time interception of warn/error notifications without coupling to any UI component
- Auto-save uses `useEditorStore.subscribe()` with a debounced `setTimeout` (2 s); unsubscribe returned for cleanup
- `localStorage` mock must be assigned via `Object.defineProperty(globalThis, 'localStorage', ...)` with `configurable: true` so tests can reset between runs
- `vi.useFakeTimers()` / `vi.advanceTimersByTimeAsync()` is required to test debounced auto-save without real delays
- Export uses `document.createElement('a')` + `URL.createObjectURL` pattern; both must be mocked in tests (jsdom lacks Blob URL support)
- Schema validation checks: `schemaVersion === SCHEMA_VERSION` (exact match), `elements` is a non-null non-array object, `rootIds` is an array

## T5
- Use `useRef` for drag state in resize/move handlers to avoid stale closure issues (same pattern as T4's pan tracking)
- `setPointerCapture` on the drag target ensures pointerMove/pointerUp events fire even when cursor leaves the element
- Resize logic for directional handles: `w`/`n` handles adjust both position (x/y) and dimensions; `e`/`s` handles only adjust dimensions
- Minimum size clamp uses `Math.min(dx, origSize - MIN_SIZE)` for the delta to prevent x/y from moving past the minimum boundary
- For multi-select drag, iterate all `selectedIds` and apply `orig[id] + delta` — store each element's original position at pointerDown to avoid cumulative drift
- Dynamic `require()` inside Vitest tests causes module resolution failure; always use static top-level imports for component rendering tests
- `useEditorStore.setState({...})` for store reset in beforeEach should NOT include functions (canUndo, canRedo, etc.) — only reset plain data fields

## T6
- `ComponentLibrary` and `componentTypes.ts` already existed in `src/components/library/` (not `LeftPanel/` as task file_scope stated); tests import from `../components/library/ComponentLibrary`
- Wrap `e.dataTransfer` calls in null-check (`if (e.dataTransfer)`) — jsdom's `fireEvent.dragStart` without explicit `dataTransfer` option yields a DataTransfer with no `setData` method
- Canvas drag-drop: `DRAG_DATA_KEY = 'application/x-component-id'` used for library→canvas drops; fall back to `text/plain` for broader compatibility
- `createDefaultElement.ts` factory returns fully-typed `Element` union with all required fields — do not use partials since store's `addElement` requires complete `Element`
- Store's `useEditorStore.setState()` in `beforeEach` must include `breakpoint: 'desktop'` when resetting (already noted in T9 learnings — confirmed again here)
- Drag-drop coordinate calculation: `canvasX = (clientX - rect.left - transform.x) / transform.zoom` handles pan and zoom offset; jsdom has no layout so rect is (0,0) in tests

## T9
- `Breakpoint` type and `BREAKPOINT_WIDTHS` constant added to `editorStore.ts`; exported from `store/index.ts`
- `BreakpointSwitcher` is a standalone component using `useEditorStore` directly — no props needed; lives at `src/components/Toolbar/BreakpointSwitcher.tsx`
- Toolbar renders BreakpointSwitcher between two `flex: 1` spacers to center it in the toolbar
- Canvas viewport frame uses `overflow: hidden` to clip overflowing elements at the breakpoint boundary (satisfies R5-S3 graceful handling)
- `data-breakpoint` and `data-viewport-width` attributes on the viewport div enable test assertions without computed style access (jsdom doesn't compute inline styles reliably)
- Store `setState` in `beforeEach` must include `breakpoint: 'desktop'` to reset the new field between tests
