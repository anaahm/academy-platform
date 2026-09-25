# Academy v29 — experience and reliability

Base: `b9fd7cca4fd333188e3b83c2edea61edf5b0f29c`.

## Implemented

- Fixed decorative `display: grid !important` exposing the hidden student dashboard to guests.
- Removed literal backslash-newline text from HTML.
- Shared readable typography, responsive dashboard grids, larger subject cards, consistent focus, touch targets and reduced motion. Preserved every student service and admin-configured artwork.
- Dashboard lists all subjects; removed the fixed notification badge, made-up playback times and unsupported bonus claim.
- Image fallback for subject artwork; safe blank URL handling; exact YouTube embed host validation; player stops when closed.
- Consistent live broadcast targeting; stage-scoped assignment reads; notification polling pauses while hidden/offline and ignores obsolete users.
- Atomic lesson completion and quiz record/stat updates avoid duplicate awards or partially saved profile data. These are consistency improvements, not server-side anti-cheat.
- Teacher submission read failure no longer locks out the whole teacher portal. Unknown counts display as unknown with an error; assignment removal is atomic.
- Strict question validation accepts `text/opts` and `question/options`, rejects invalid indices, and reports the exact question instead of silently dropping it.
- Ranking requests ignore stale responses; modal keyboard/focus handling, image errors, and login/logout mobile navigation improved.
- PWA v29 fails installation safely and only deletes this application's old caches.

## Validation

`npm ci --ignore-scripts && npm test` runs:

- Existing syntax / duplicate ID / local asset reference checks across 23 HTML pages and 33 asset scripts.
- Six regression tests for URLs, video embeds, question validation, targeting, CSS parsing / grid syntax, and hidden-state specificity.
- 26 DOM smoke scenarios using in-memory Firebase fixtures. Covers all 23 page boots, student/guest/admin/teacher states, admin and teacher navigation, assignment submission, planner creation, lesson completion double-click, quiz result, live modal, image failure, confirm Escape after Tab, logout navigation removal and partial teacher read failure.

These tests are not a Firebase emulator and do not assert real backend permissions, network latency or visual layout. The browser available in this session permits the public deployed website but blocks local preview URLs.

## Deployment and remaining gates

- `firebase.rules.production.json` is reference source only. Deploy it in Firebase after reviewing it in the Firebase emulator/console; a GitHub Pages deployment does not deploy rules.
- The rule changes grant an active assignment owner access only to that assignment's submission collection, allow owned collection deletion, and require active teachers to create/update pending teacher content.
- Real authenticated student/teacher/admin acceptance tests require corresponding test accounts. No production student records were created, altered or deleted by the tests.
- XP, quiz grading and certificates remain calculated in the client and student profiles remain self-writable. Reliable anti-cheat requires trusted backend grading/award endpoints and a coordinated rules migration. Do not treat this release as completing that migration.
- Cross-device authenticated visual QA and load testing remain separate release gates. No claim of exhaustive testing or capacity certification is made.
