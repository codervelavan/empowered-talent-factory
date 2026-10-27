# Opening verification

## Changes

Eight visitor-controlled scenes connect a small engineering company's AI adoption problem with a graduate's experience gap and an engineer's need to evolve. A single enquiry follows the journey into an expert-led team, a reviewed output, and the actual shared company lobby.

The opening has an isolated Three.js stage and camera, sharing the existing WebGL renderer and animation loop. The real factory is revealed at the invitation. Finger joints animate a licensed 25-joint skinned hand; seven original comic illustrations are loaded progressively. Text, controls and progress are HTML. Runtime textures, geometry, skeleton resources and input subscriptions are cleaned up on exit. The existing factory quality caps apply.

## Checks completed

- `npm run typecheck` and `npm run build` pass.
- `git diff --check` passes.
- Production static build tested under `/empowered-talent-factory/`, including artwork and hand asset paths.
- Desktop 1440×900, portrait default 389×652, narrow phone 320×568, and short landscape 844×390 inspected. No horizontal page overflow at the narrow and landscape sizes. Narrow brand lockup avoids the menu.
- All eight captions and illustration transitions reviewed during browser navigation.
- Connection gate blocks Continue and forward arrows until connected.
- Pointer drag outside the workbench resets the card and leaves the gate closed. A valid drop unlocks Continue.
- Keyboard activation and the explicit connection button unlock the same action.
- The connection remains completed when going back and forward through the story.
- Language changes repaint captions and controls without resetting progress. Tamil narrative and Back/Continue verified.
- Reduced motion can be enabled during the story and switches to still compositions and explicit controls.
- Enter EmpowerED reveals and reaches the existing shared lobby. Career, Workforce and AI journey controls remain available.
- Career route opens; browser Back returns to the common lobby and Forward restores Career. The home route is deliberately excluded from same-audience stop matching.
- Skip reaches the lobby; reloading after completion suppresses the opening for the session.
- Replay restarts the story. Replay while already playing cleans up without firing the previous completion callback.
- A local fault-injection server returned 404 for every opening WebP and GLB. All readable scenes, the connection button and navigation remained functional.
- A separate fault-injection server disabled WebGL contexts. The standard page opened and contained all eight narrative beats.
- No console errors observed in the normal production preview. The intentional fault tests produce expected missing-asset/WebGL diagnostics.

## Limits and existing behavior

Viewport tests do not establish physical midrange-phone frame rates. Physical Android/iOS performance remains unmeasured. The factory's large JavaScript bundle still produces Vite's size advisory; the build succeeds. New illustration files total approximately 2.18 MB, and the hand is 94 KB.

Tamil follows the repository's existing draft-for-native-review policy. Existing enquiry and assessment endpoints remain unconfigured; this work adds no forms or endpoints.

See `opening-assets.md` for the complete generation prompt set, source and retained hand license.
