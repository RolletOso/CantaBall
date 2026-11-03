# CantaBall — Project Handover

Last updated: 2026-11-03

## Project purpose

CantaBall is a browser-based, mobile-first digital adaptation of the childhood bottle-cap football game. It should feel like the tabletop game: players flick their own round bottle-cap pieces (cantas), use rebounds and angles creatively, defend with a goalkeeper, and take turns. It is not intended to become a generic football manager or conventional real-time football game.

## Technical foundation

- Vite + TypeScript + Phaser 3.90.
- Phaser Matter physics with zero gravity.
- Main scene: `src/scenes/CantaBallScene.ts`.
- Match rules/state: `src/game/rules.ts`.
- Main interface: `index.html` and `src/style.css`.
- Repository: `RolletOso/CantaBall`.
- Production build: `npm run build` (TypeScript check + Vite production bundle).
- All feature work must use a branch and pull request. Never push feature work directly to `main`.

## Merged milestones

### PR #1 — Initial browser prototype
- Phaser/Vite/TypeScript scaffold, pitch, teams, ball and initial scene.

### PR #2 — Physics and goalkeeper placeholders
- Matter physics for cantas and ball.
- Flicking, rebounds and initial collision/foul handling.
- Temporary single larger goalkeeper placeholder for each team.
- GitHub Actions build workflow.

### PR #3 — Turn management
- Blue/red alternating turns.
- Select only your own outfield cantas.
- Wait for the ball and pieces to settle before completing a shot.
- Preserve foul state instead of overwriting it with normal turn completion.

### PR #4 — Timed free-kick setup
- Freeze the ball at the foul location.
- Attacker arranges up to three outfield cantas for 20 seconds.
- Defender arranges up to three outfield cantas for 20 seconds.
- Dragging is allowed only during arrangement phases.
- Goalkeepers are excluded; basic ball-distance and piece-spacing restrictions apply.
- Release the pieces and ball for the free kick after both phases.

### PR #5 — Project handover
- Added this maintained project handover and development roadmap.

### PR #6 — Scoring and basic restarts
- Opened goal mouths in both end walls.
- Detects a ball crossing the goal line inside the goal mouth and awards a goal to the attacking team.
- Updates the scoreboard and gives the scoring team the next turn.
- Restricts kickoff to that team's central midfielder.
- Detects an end-line crossing outside the goal and awards a goal kick to the defending team.
- Goal-kick placement and retaining piece positions are initial prototype choices for playtesting.

### PR #7 — Goalkeeper moves and catches
- When the ball is in the active team's half, that team gets a goalkeeper flick followed by its outfield canta move.
- Goalkeeper movement is constrained to its own goal area.
- A goalkeeper collision catches and holds the ball instead of allowing a normal rebound.
- After a catch, the goalkeeper's team gets an outfield move to play the ball back into the pitch.

### PR #8 — Aiming contact and trajectory guides
- Connects the selected outfield canta visually to the ball.
- Highlights the intended contact point.
- Adds a short, power-scaled initial direction cue from the ball with an arrowhead.
- Keeps a pull-back marker to explain flick direction.
- The guide is not a full trajectory or rebound simulation.

### PR #9 — Mobile touch usability
- Enlarges effective touch selection areas for cantas and goalkeepers.
- Applies touch selection tolerance during free-kick arrangement.
- Prevents browser text selection and touch gestures from interfering with pitch interaction.
- Improves mobile button size, spacing, focus visibility and safe-area padding.

## Agreed game rules and design intent

### Teams and pieces
- Two teams: blue and red.
- Each team has 10 ordinary outfield cantas and one goalkeeper.
- Both teams spread across the whole pitch at kickoff; both may have pieces beyond the centre line.
- Outfield cantas are small round caps; the ball is smaller.
- Long-term goalkeeper design: a custom six-canta construction, wider than a normal player, with wide hands but not covering the whole goal mouth. The user will supply/design the final artwork. Until then, use one slightly larger placeholder.

### Normal play
- Teams alternate turns.
- Select one of your own cantas, aim, set power and flick.
- A turn is consumed even if the selected canta misses the ball.
- No free dragging/repositioning during ordinary outfield play.
- Creative rebounds, bank shots and multi-canta combinations are central to the game.
- Ball-to-canta contact should rebound the ball; it should not launch the canta.
- A canta-to-canta collision is a foul only if neither involved canta touched the ball before the collision. Ball-first contact makes the later canta collision legal.
- If a player scores, that team retains the next turn; its central midfielder handles kickoff passing.

### Goalkeeper
- When the ball is in a player's half, that player gets two moves on their turn: one goalkeeper move, then one outfield canta move.
- Goalkeeper can catch the ball.
- Current catch behaviour holds the ball in front of the keeper until the team's outfield move releases it.
- Catch timing, possession edge cases and keeper balance need real gameplay testing.

### Fouls and free kicks
- Ball remains at the foul location.
- Attacking team arranges up to three cantas first.
- Defending team arranges up to three cantas second.
- Both phases are time-limited; 20 seconds is the current test value.
- Defender must keep cantas farther from the ball than the attacker.
- After both arrangements, attacking team takes the free kick.

### Restarts and scoring
- Goal increases the score.
- Scoring team retains next turn; its central midfielder makes the kickoff pass.
- A missed ball crossing the end line outside the goal results in a goal kick for the defending team.
- Goal-kick spot and piece positions are initial implementation choices.
- Corner procedure and remaining out-of-play edge cases are not yet defined or implemented.

### Aiming and mobile UX
- Snooker-like aiming: direction, angle, power/speed and point of contact.
- Guide from selected canta should meet the ball.
- A shorter guide from the ball shows initial direction and limited travel.
- Full trajectory prediction should account for collisions and rebounds without misleading players.
- Desktop: click/select, drag aim, power slider, Flick.
- Mobile: tap/select, drag aim, touch power slider, Flick.
- Most testers use phones. Mobile-first usability is essential.

## Current main branch

Latest merged milestones:
- PR #4 merge: `e89c2b178af5ca78abb959f47ee82a30274883d1`.
- PR #5 merge: `a5f2d0f0a71c9cbcd0e1d62303304214c70c97c2`.
- PR #6 merge: `f98a4a2ad46c27d43f0a114856526989c26cdd15`.
- PR #7 merge: `0b595c2ae3b83e4cf9695905a044395a5e6efafa`.
- PR #8 merge: `0bf249f1ebb48549a810fe1e60a10e3128f23593`.
- PR #9 merge: `6b68fb6c6bd7564c026a1433be2ae1fc33ce981a`.

GitHub Actions verifies dependency installation, TypeScript and production bundling. A green build does not verify actual gameplay, physics balance or mobile usability.

## Remaining roadmap

1. Real-device playtest of normal flicking, team turns, fouls, free kicks, goals, goal kicks, goalkeeper moves/catches and touch controls.
2. Define and implement corner rules and any remaining out-of-play rules.
3. Improve trajectory preview to simulate likely ball travel and rebounds.
4. Refine turn retention, goalkeeper possession, foul timing and free-kick edge cases.
5. Further mobile-first layout and performance refinements.
6. Integrate the user's custom six-canta goalkeeper artwork when supplied.
7. Add animations, sound and visual polish.
8. Full desktop/mobile testing and release preparation.

## Known risks and testing needs

- The project is an early playable prototype, not a complete release-ready match.
- Goal detection, goal-kick logic, goalkeeper catch and held-ball release need browser gameplay testing.
- The exact ball-first foul rule is approximated using collision events; simultaneous ball/player contacts need careful testing.
- Free-kick minimum distances (attacker 26, defender 52 game units) are initial tuning values.
- Arrangement controls, mobile hit targets and touch dragging need testing on actual phones.
- The aim line is a short initial direction cue, not a complete collision-aware trajectory.
- Corner rules are not implemented because the restart procedure has not yet been agreed.

## Development workflow

1. Start from the latest `main` and read this handover.
2. Implement one coherent milestone on a feature branch.
3. Run the GitHub Actions production build and fix any failures.
4. Review code and update this handover whenever implementation, rules, risks or roadmap change.
5. Merge only after successful verification and only when the user has authorised automatic merging.
6. Interrupt the user only for a concrete action: device testing, a necessary rules decision, or supplying custom artwork.
