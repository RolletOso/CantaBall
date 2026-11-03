# CantaBall — Project Handover

Last updated: 2026-11-03

## Project purpose

CantaBall is a browser-based, mobile-first digital adaptation of the childhood bottle-cap football game. It should feel like the tabletop game: players flick their own round bottle-cap pieces (cantas), use rebounds and angles creatively, defend with a goalkeeper, and take turns. This is not intended to become a generic football manager or conventional real-time football game.

## Current technical foundation

- Vite + TypeScript + Phaser 3.90.
- Phaser Matter physics, with zero gravity.
- Main scene: `src/scenes/CantaBallScene.ts`.
- Match rules/state: `src/game/rules.ts`.
- Main interface: `index.html` and `src/style.css`.
- GitHub repository: `RolletOso/CantaBall`.
- Production build: `npm run build`, which runs TypeScript checking and Vite production bundling.
- All work is developed on branches and integrated through pull requests. Never push feature work directly to `main`.

### PR #5 — Project handover
- Added this maintained handover document with game concept, agreed rules, completed milestones, gaps, risks and roadmap.

## Merged milestones

### PR #1 — Initial browser prototype
- Phaser/Vite/TypeScript scaffold.
- Pitch, teams, ball and initial scene.

### PR #2 — Physics and goalkeeper placeholders
- Matter physics for cantas and ball.
- Flicking, rebounds and initial collision/foul handling.
- Temporary single larger goalkeeper placeholder for each side.
- Build workflow added.

### PR #3 — Turn management
- Blue/red alternating turns.
- Players can select only their own outfield cantas.
- Waits for the ball and pieces to settle before completing a shot.
- Foul state is preserved instead of being overwritten by ordinary turn completion.

### PR #4 — Timed free-kick setup
- Ball freezes at the foul position.
- Attacker gets 20 seconds to reposition up to three outfield cantas.
- Defender gets 20 seconds to reposition up to three outfield cantas.
- Repositioning is by dragging during the arrangement phases only.
- Goalkeepers are excluded from arrangement moves.
- Basic ball-distance and piece-spacing restrictions.
- After both phases, pieces and ball are released for the free kick.

## Agreed game rules and design intent

### Teams and pieces
- Two teams, blue and red.
- Each team has 10 ordinary outfield cantas and one goalkeeper.
- Both teams are spread across the whole pitch at kickoff; both sides can have pieces beyond the centre line.
- Outfield cantas are small round caps; the ball is smaller.
- The long-term goalkeeper design is a custom six-canta construction, wider than a normal player, with wide hands but not covering the whole goal mouth. The user will supply/design the final goalkeeper artwork. Until then use a single slightly larger placeholder.

### Normal play
- Teams alternate turns.
- On a normal outfield move, select one of your own cantas, aim, set power and flick.
- A turn is consumed even if the selected canta misses the ball.
- No free dragging/repositioning during ordinary play.
- Creative rebounds, bank shots and multi-canta combinations are core to the game.
- Ball-to-canta contact should rebound the ball; it should not launch the canta.
- A canta-to-canta collision is a foul only if neither involved canta touched the ball before the collision. Ball-first contact makes the later canta collision legal.
- If a player scores, that team retains the next turn; midfielders handle kickoff passing after a goal.

### Foul and free kick
- Ball remains at the foul location.
- Attacking team arranges up to three cantas first.
- Defending team arranges up to three cantas second.
- Both arrangement phases are time-limited; 20 seconds is the current test value.
- Defender must keep cantas farther from the ball than the attacker.
- After arrangements, attacking team takes the free kick.

### Goalkeeper
- When the ball is in a player's half, that player should receive two moves on their turn: one goalkeeper move and one outfield canta move.
- Goalkeeper should be able to catch the ball.
- Exact catch/possession/release procedure still needs to be designed and implemented.

### Restarts and scoring
- Goal increases the score.
- Scoring team retains next turn; midfielders handle kickoff passing.
- A missed ball going over the end line results in a goal kick.
- Exact goal-kick procedure, corner procedure, and all out-of-play edge cases still need implementation.
- Corner arrangement rules remain to be confirmed.

### Aiming and mobile UX
- Snooker-like aiming: direction, angle, power/speed and point of contact.
- Aim guide from selected canta should meet the ball.
- A shorter guide from the ball shows initial direction and limited travel.
- Trajectory previews should avoid misleading predictions around rebounds.
- Desktop: click/select, drag aim, power slider, Flick.
- Mobile: tap/select, drag aim, touch power slider, Flick.
- Most testers will use phones. Mobile-first layout and touch handling are essential.

## Current repository state

- PR #4 was merged after its retried GitHub Actions build passed.
- Merge commit: `e89c2b178af5ca78abb959f47ee82a30274883d1`.
- PR #5 added this handover document and was merged after its production build passed.
- PR #5 merge commit: `a5f2d0f0a71c9cbcd0e1d62303304214c70c97c2`.
- The build workflow checks dependency installation, TypeScript and production bundling.
- A green build is not a substitute for real gameplay testing on desktop and phones.

## Remaining roadmap

1. Goalkeeper movement and catching, including the agreed extra goalkeeper move when the ball is in that team's half.
2. Goal detection, score updates, kickoff and goal-kick restarts (currently being implemented).
3. Corners and remaining out-of-play rules.
4. Refine turn retention and free-kick edge cases.
5. Improve aim/contact/trajectory indicators and rebound physics.
6. Mobile-first interaction and layout refinements.
7. Final custom goalkeeper artwork supplied by the user; then integrate it.
8. Animations, sound, visual polish and performance.
9. Full desktop/mobile playtesting and release preparation.

## Known risks and work still to verify

- The current scene is a prototype; there is no complete match loop yet.
- Goal-mouth openings and goal detection are not implemented; current side boundaries are still simple walls.
- Goalkeeper catching and the two-move goalkeeper/outfield turn are not implemented.
- Scoring, kickoff, goal kicks, corners and end-line restarts are not implemented.
- The exact ball-first foul rule is approximated using collision events; simultaneous ball/player contacts need careful gameplay testing.
- Set-piece minimum distances (attacker 26, defender 52 game units) are initial tuning values, not final rule decisions.
- Arrangement controls and touch dragging need real-device testing.
- Build checks do not verify the actual game feel, physics balance or mobile usability.

## Development workflow

1. Start from the latest `main`.
2. Read this handover and inspect the existing code before changing it.
3. Implement one coherent milestone on a feature branch.
4. Run the GitHub Actions production build; diagnose and fix failures rather than merging around them.
5. Review the changed code and update this handover whenever rules, implementation status, risks or next steps change.
6. Merge only after successful verification and only when the user has explicitly authorised automatic merging. Otherwise, request the user's merge action.
7. Keep the user-facing update brief and only interrupt for a concrete user action, a necessary rules decision, supplied artwork, or device testing.

