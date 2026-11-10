# Tasks — M16

- [x] 1. Steering: `product.md` (decision, milestone, competition notes), `security.md` (mirror camera rule), `submission.md` (category plan, new eligibility note)
- [x] 2. Shared: `NIGHT_DESK` obstacle, `terminal` prompt kind and zone, `nightdesk.ts` rules, unit tests
- [x] 3. Web: VT323 font, `sfx.key`, `NightDesk.tsx` terminal modal and CSS, 3D desk in the lobby, wiring in `Lobby.tsx`
- [x] 4. Web: `mirrorCam.ts`, mirror button and error toast, camera shader in `Gallery.tsx`
- [x] 5. E2E `e2e/oddities.spec.ts` with screenshots; look at the screenshots and fix what looks wrong
- [x] 6. Run typecheck, unit, integration, build and E2E; store real output in `docs/evidence/`
- [x] 7. Docs: README, PROGRESS, HANDOFF, KIRO-ACTIVITY, ASSETS, specs index, category report

## Changes found while building
- The movement grid sweep failed with the first desk box (`minZ = -10`, flush with the wall): a point pushed out of a box that touches the wall could leave north and end up inside it again. The box now reaches into the wall (`minZ = -10.8`), so it always pushes south.
- The first screenshot showed the desk too small and hidden by the avatar. The monitor is 15% larger, the screen brighter ("GUEST LOGIN"), and a "Night Desk" plaque glows on the desk front.
- The fake camera washed out to almost white; the shader now keeps more of the original colour and maps brightness with a softer curve.
