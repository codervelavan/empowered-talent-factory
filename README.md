# EmpowerED Careers: AI Talent Factory

A single-page, scroll-driven 3D site built with Vite, TypeScript and three.js (r160). It's a port of the design handoff prototype (`design_handoff_empowered_talent_factory`). All copy, colours, timings and camera framing are final and carried over unchanged.

**Live site:** https://codervelavan.github.io/empowered-talent-factory/

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/
npm run deploy     # build and publish dist/ to the gh-pages branch (GitHub Pages)
```

The build uses a relative base (`./`), so `dist/` works from any folder or sub-path.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | All page markup (story iframe, station, factory HUD, panels, drawers, header). |
| `src/main.ts` | Entry: loads the styles and starts the modules in the prototype's order. |
| `src/bridge.ts` | Typed contract for the `window.__*` hooks the modules use to call each other. |
| `src/config.ts` | URLs for files in `public/` (story intro, optional narration audio). |
| `src/data/content.ts` | Industries, ecosystem data, figure poses, globe land mask, `CAREER_CFG`. |
| `src/data/guideLines.ts` | Voice guide narration (final copy). |
| `src/station/station.ts` | Departure board, the Career/Build/Workforce rides (SVG line renderer and ride state machine), story handover and replay. |
| `src/factory/scene.ts` | three.js factory, halls, globe and camera poses; exposes `window.FACTORY`. |
| `src/factory/controller.ts` | Factory UI: routes, free mode, globe UI, drawers, menu, hash navigation, flat fallback page. |
| `src/factory/sketches.ts` | Line-drawn SVG scenes used by the factory intro. |
| `src/guide/guide.ts` | Voice tour guide and caption strip. |
| `src/styles/*.css` | Prototype CSS, split into base, guide and station. |
| `public/story-intro.html` | The story intro, embedded unchanged (renamed from `EmpowerED Story Intro.html`). |
| `public/audio/` | Optional `<line-id>.mp3` recordings. When a file is present it plays instead of speech synthesis. Line ids are listed in `guideLines.ts`. |

## Before launch

- **Assessment and drive links:** `CAREER_CFG` in `src/data/content.ts` still has empty `url`s. Fill them in.
- **Placeholders:** several panels show `[PLACEHOLDER]` (band names, eligibility terms, case study, Evidence & Impact). These come from the handoff and are unchanged.

## Notes on the port

- The station, scene and controller are lifted from the prototype largely verbatim, as the handoff asked. The changes are:
  - module imports replace globals and the CDN import map;
  - asset URLs go through `config.ts`.
- **Typing.** The whole of `src/` is strict TypeScript, including the three engine files.
  - Those files were typed in place rather than rewritten, so they still read like the prototype. The typing uses parameter annotations, small local interfaces (scene areas, poses, pins, stop boards, 3D controls) and DOM casts.
  - The cross-module API is typed in `bridge.ts`. That includes the full `window.FACTORY` surface (`FactoryApi`) and the `window.__*` hooks.
- **Fixed from the prototype:**
  - Below 1180px wide, the guide caption stayed hidden for the whole ride. It read the line map's computed opacity while the map was still fading in, so it thought it was still on the board.
  - It now reads the map's target opacity, so during rides the caption sits above the line map as specified.
