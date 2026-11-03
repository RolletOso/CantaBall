import Phaser from 'phaser';
import {
  INITIAL_MATCH_STATE,
  advanceFreeKickSetup,
  awardFoul,
  finishShot,
  otherTeam,
  recordGoal,
  startShot,
  teamLabel,
  type MatchState,
  type Team,
} from '../game/rules';

type Piece = {
  id: string;
  team: Team;
  kind: 'outfield' | 'keeper';
  body: MatterJS.BodyType;
};

type Position = { x: number; y: number };

const W = 900;
const H = 600;
const PITCH = { left: 42, right: 858, top: 38, bottom: 562 };
const BALL_RADIUS = 7;
const CANTA_RADIUS = 12;
const KEEPER_RADIUS = 15;
const SETTLED_SPEED = 0.16;
const SETTLED_DURATION_MS = 250;
const MIN_SHOT_DURATION_MS = 450;
const ARRANGEMENT_SECONDS = 20;
const MAX_ARRANGED_CANTAS = 3;
const MIN_ATTACKER_BALL_DISTANCE = 26;
const MIN_DEFENDER_BALL_DISTANCE = 52;
const MIN_PIECE_SPACING = 30;

export class CantaBallScene extends Phaser.Scene {
  private pieces: Piece[] = [];
  private ball!: MatterJS.BodyType;
  private selected: Piece | null = null;
  private aimPoint: Phaser.Math.Vector2 | null = null;
  private draggedPiece: Piece | null = null;
  private dragStart: Position | null = null;
  private power = 0.45;
  private shotInProgress = false;
  private shotStartedAt = 0;
  private settledSince: number | null = null;
  private foulText = '';
  private cantasThatTouchedBallThisShot = new Set<number>();
  private arrangedCantaIds = new Set<string>();
  private arrangementEndsAt = 0;
  private lastDisplayedSeconds = -1;
  private foulBallPosition: Position | null = null;
  private ballFrozenForSetPiece = false;
  private keeperMovePending = false;
  private shotByKeeper = false;
  private keeperHasBall = false;
  private match: MatchState = { ...INITIAL_MATCH_STATE, scores: { ...INITIAL_MATCH_STATE.scores } };
  private graphics!: Phaser.GameObjects.Graphics;

  constructor() { super('CantaBallScene'); }

  create() {
    this.drawPitch();
    this.graphics = this.add.graphics().setDepth(5);
    this.createBoundaries();
    this.createTeams();
    this.createBall();
    this.matter.world.on('collisionstart', this.onCollisionStart, this);
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);

    const powerInput = document.querySelector<HTMLInputElement>('#power');
    powerInput?.addEventListener('input', () => {
      this.power = Number(powerInput.value) / 100;
      const output = document.querySelector('#power-value');
      if (output) output.textContent = powerInput.value + '%';
    });
    document.querySelector('#cancel-button')?.addEventListener('click', () => this.clearSelection());
    document.querySelector('#flick-button')?.addEventListener('click', () => this.flick());
    document.querySelector('#arrangement-done')?.addEventListener('click', () => this.finishArrangementPhase());
    this.refreshControls();
  }

  update() {
    this.graphics.clear();
    this.drawPieces();
    this.drawBall();
    this.clampGoalkeeperPositions();
    this.drawAim();

    if (this.isArrangementPhase()) {
      this.updateArrangementTimer();
      return;
    }

    if (!this.shotInProgress) return;
    if (this.resolveEndLineCrossing()) return;

    const elapsed = this.time.now - this.shotStartedAt;
    if (elapsed < MIN_SHOT_DURATION_MS || !this.allPiecesSettled()) {
      this.settledSince = null;
      return;
    }

    if (this.settledSince === null) {
      this.settledSince = this.time.now;
      return;
    }

    if (this.time.now - this.settledSince >= SETTLED_DURATION_MS) {
      this.completeCurrentShot();
    }
  }

  private drawPitch() {
    const g = this.add.graphics();
    g.fillStyle(0x176b43, 1).fillRect(0, 0, W, H);
    g.lineStyle(3, 0xe5f2e8, 0.8).strokeRect(PITCH.left, PITCH.top, PITCH.right-PITCH.left, PITCH.bottom-PITCH.top);
    g.lineStyle(2, 0xe5f2e8, 0.7).lineBetween(W/2, PITCH.top, W/2, PITCH.bottom);
    g.strokeCircle(W/2, H/2, 82);
    g.fillStyle(0xe5f2e8, 0.8).fillCircle(W/2, H/2, 3);
    g.strokeRect(PITCH.left, 205, 112, 190).strokeRect(PITCH.right-112, 205, 112, 190);
    g.strokeRect(PITCH.left, 255, 38, 90).strokeRect(PITCH.right-38, 255, 38, 90);
    g.lineStyle(4, 0xd5f36a, 1).lineBetween(PITCH.left-5, 267, PITCH.left-5, 333);
    g.lineStyle(4, 0xff7777, 1).lineBetween(PITCH.right+5, 267, PITCH.right+5, 333);
    for (let x = 124; x < PITCH.right; x += 82) {
      g.lineStyle(1, 0xffffff, 0.035).lineBetween(x, PITCH.top, x, PITCH.bottom);
    }
  }

  private createBoundaries() {
    const options = { isStatic: true, restitution: 0.65, label: 'pitch-wall' };
    this.matter.add.rectangle(W/2, PITCH.top, W, 8, options);
    this.matter.add.rectangle(W/2, PITCH.bottom, W, 8, options);
    // Leave a goal-mouth opening in each end wall.
    const wallHeight = (PITCH.bottom - PITCH.top - 66) / 2;
    const upperY = PITCH.top + wallHeight / 2;
    const lowerY = 333 + wallHeight / 2;
    this.matter.add.rectangle(PITCH.left, upperY, 8, wallHeight, options);
    this.matter.add.rectangle(PITCH.left, lowerY, 8, wallHeight, options);
    this.matter.add.rectangle(PITCH.right, upperY, 8, wallHeight, options);
    this.matter.add.rectangle(PITCH.right, lowerY, 8, wallHeight, options);
  }

  private addPiece(id: string, team: Team, kind: Piece['kind'], x: number, y: number, radius: number) {
    const body = this.matter.add.circle(x, y, radius, {
      label: kind === 'keeper' ? 'keeper' : 'canta',
      friction: 0.015,
      frictionAir: kind === 'keeper' ? 0.045 : 0.035,
      restitution: 0.35,
      density: kind === 'keeper' ? 0.012 : 0.018,
      slop: 0.01,
    });
    this.pieces.push({ id, team, kind, body });
  }

  private createTeams() {
    const blue: Array<[number, number]> = [
      [150,170],[150,300],[150,430],[265,115],[265,245],
      [265,375],[265,505],[390,180],[390,420],[480,300],
    ];
    const red: Array<[number, number]> = [
      [750,170],[750,300],[750,430],[635,115],[635,245],
      [635,375],[635,505],[510,180],[510,420],[420,300],
    ];
    blue.forEach(([x,y], i) => this.addPiece('blue-'+(i+1), 'blue', 'outfield', x, y, CANTA_RADIUS));
    red.forEach(([x,y], i) => this.addPiece('red-'+(i+1), 'red', 'outfield', x, y, CANTA_RADIUS));
    this.addPiece('blue-keeper', 'blue', 'keeper', PITCH.left + 22, H/2, KEEPER_RADIUS);
    this.addPiece('red-keeper', 'red', 'keeper', PITCH.right - 22, H/2, KEEPER_RADIUS);
  }

  private createBall() {
    this.ball = this.matter.add.circle(W/2, H/2, BALL_RADIUS, {
      label: 'ball',
      friction: 0.002,
      frictionAir: 0.012,
      restitution: 0.88,
      density: 0.0012,
      slop: 0.005,
    });
  }

  private drawPieces() {
    for (const piece of this.pieces) {
      const { x, y } = piece.body.position;
      const radius = piece.kind === 'keeper' ? KEEPER_RADIUS : CANTA_RADIUS;
      const color = piece.team === 'blue' ? 0x2d83ee : 0xe64b4b;
      this.graphics.fillStyle(color, 1).fillCircle(x, y, radius);
      this.graphics.lineStyle(piece === this.selected || piece === this.draggedPiece ? 4 : 2, piece === this.selected || piece === this.draggedPiece ? 0xd5f36a : 0xf4f5ee, 0.98);
      this.graphics.strokeCircle(x, y, radius);
      this.graphics.fillStyle(0xffffff, 0.38).fillCircle(x-3, y-3, Math.max(2, radius*0.22));
    }
  }

  private drawBall() {
    const { x, y } = this.ball.position;
    this.graphics.fillStyle(0x18221c, 0.28).fillCircle(x+2, y+3, BALL_RADIUS+1);
    this.graphics.fillStyle(0xf8f5df, 1).fillCircle(x, y, BALL_RADIUS);
    this.graphics.lineStyle(1, 0x34443a, 0.8).strokeCircle(x, y, BALL_RADIUS);
  }

  private isArrangementPhase() {
    return this.match.phase === 'free-kick-attacker-setup' || this.match.phase === 'free-kick-defender-setup';
  }

  private setupTeam(): Team {
    return this.match.phase === 'free-kick-defender-setup'
      ? otherTeam(this.match.activeTeam)
      : this.match.activeTeam;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    const point = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);

    if (this.isArrangementPhase()) {
      if (this.draggedPiece) return;
      const team = this.setupTeam();
      const hit = this.pieces.find(piece =>
        piece.team === team &&
        piece.kind === 'outfield' &&
        Phaser.Math.Distance.Between(point.x, point.y, piece.body.position.x, piece.body.position.y) <= CANTA_RADIUS + 8
      );
      if (!hit) return;
      if (!this.arrangedCantaIds.has(hit.id) && this.arrangedCantaIds.size >= MAX_ARRANGED_CANTAS) return;

      this.draggedPiece = hit;
      this.dragStart = { x: hit.body.position.x, y: hit.body.position.y };
      return;
    }

    if (this.shotInProgress ||
      (this.match.phase !== 'ready' && this.match.phase !== 'free-kick-shot' && this.match.phase !== 'kickoff-ready')) return;
    const hit = this.pieces.find(piece => {
      if (piece.team !== this.match.activeTeam) return false;
      if (this.keeperMovePending) return piece.kind === 'keeper' &&
        Phaser.Math.Distance.Between(point.x, point.y, piece.body.position.x, piece.body.position.y) <= KEEPER_RADIUS + 8;
      if (piece.kind !== 'outfield') return false;
      if (this.match.phase === 'kickoff-ready' && piece.id !== this.match.activeTeam + '-10') return false;
      return Phaser.Math.Distance.Between(point.x, point.y, piece.body.position.x, piece.body.position.y) <= CANTA_RADIUS + 7;
    });

    if (hit) {
      this.selected = hit;
      this.aimPoint = point;
      this.refreshControls();
    } else if (this.selected) {
      this.aimPoint = point;
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (this.draggedPiece && this.isArrangementPhase()) {
      this.tryMoveArrangedPiece(this.draggedPiece, pointer.worldX, pointer.worldY);
      return;
    }

    if (this.selected && pointer.isDown && !this.shotInProgress &&
      (this.match.phase === 'ready' || this.match.phase === 'free-kick-shot' || this.match.phase === 'kickoff-ready')) {
      this.aimPoint = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
    }
  }

  private onPointerUp() {
    if (!this.draggedPiece || !this.dragStart) return;
    const current = this.draggedPiece.body.position;
    const moved = Phaser.Math.Distance.Between(this.dragStart.x, this.dragStart.y, current.x, current.y) >= 6;
    if (moved) this.arrangedCantaIds.add(this.draggedPiece.id);
    this.draggedPiece = null;
    this.dragStart = null;
    this.updateArrangementMoveCount();
  }

  private tryMoveArrangedPiece(piece: Piece, rawX: number, rawY: number) {
    const x = Phaser.Math.Clamp(rawX, PITCH.left + CANTA_RADIUS, PITCH.right - CANTA_RADIUS);
    const y = Phaser.Math.Clamp(rawY, PITCH.top + CANTA_RADIUS, PITCH.bottom - CANTA_RADIUS);
    const minimumBallDistance = this.match.phase === 'free-kick-defender-setup'
      ? MIN_DEFENDER_BALL_DISTANCE
      : MIN_ATTACKER_BALL_DISTANCE;

    if (Phaser.Math.Distance.Between(x, y, this.ball.position.x, this.ball.position.y) < minimumBallDistance) return;

    for (const other of this.pieces) {
      if (other === piece) continue;
      const distance = Phaser.Math.Distance.Between(x, y, other.body.position.x, other.body.position.y);
      if (distance < MIN_PIECE_SPACING) return;
    }

    this.matter.body.setPosition(piece.body, { x, y });
    this.matter.body.setVelocity(piece.body, { x: 0, y: 0 });
  }

  private drawAim() {
    if (!this.selected || !this.aimPoint ||
      (this.match.phase !== 'ready' && this.match.phase !== 'free-kick-shot' && this.match.phase !== 'kickoff-ready')) return;

    const start = this.selected.body.position;
    const dx = start.x - this.aimPoint.x;
    const dy = start.y - this.aimPoint.y;
    const pullLength = Math.hypot(dx, dy);
    if (pullLength < 2) return;

    const ux = dx / pullLength;
    const uy = dy / pullLength;
    const pullHandleDistance = 48;

    // Keep the familiar pull-back marker so players can read flick direction.
    this.graphics.lineStyle(2, 0xffffff, 0.82);
    this.graphics.lineBetween(
      start.x - ux * pullHandleDistance,
      start.y - uy * pullHandleDistance,
      start.x,
      start.y
    );
    this.graphics.fillStyle(0xd5f36a, 1).fillCircle(
      start.x - ux * pullHandleDistance,
      start.y - uy * pullHandleDistance,
      4
    );

    if (this.selected.kind !== 'keeper') {
      // Connect the selected canta to the ball so the intended contact is obvious.
      this.graphics.lineStyle(1.5, 0xffffff, 0.38);
      this.graphics.lineBetween(start.x, start.y, this.ball.position.x, this.ball.position.y);
      this.graphics.lineStyle(1.5, 0xd5f36a, 0.9);
      this.graphics.strokeCircle(this.ball.position.x, this.ball.position.y, BALL_RADIUS + 4);
    }

    // Short, power-scaled preview from the ball; this is an initial direction cue,
    // not a promise of the final path after rebounds.
    const previewLength = 24 + this.power * 34;
    const previewStart = this.selected.kind === 'keeper' ? start : this.ball.position;
    const endX = previewStart.x + ux * previewLength;
    const endY = previewStart.y + uy * previewLength;
    this.graphics.lineStyle(2.5, 0xd5f36a, 0.92);
    this.graphics.lineBetween(previewStart.x, previewStart.y, endX, endY);
    const arrowSize = 6;
    const sideX = -uy * arrowSize;
    const sideY = ux * arrowSize;
    this.graphics.fillStyle(0xd5f36a, 1);
    this.graphics.fillTriangle(
      endX, endY,
      endX - ux * arrowSize * 1.6 + sideX,
      endY - uy * arrowSize * 1.6 + sideY,
      endX - ux * arrowSize * 1.6 - sideX,
      endY - uy * arrowSize * 1.6 - sideY
    );
  }

  private flick() {
    if (!this.selected || !this.aimPoint || this.shotInProgress ||
      (this.match.phase !== 'ready' && this.match.phase !== 'free-kick-shot' && this.match.phase !== 'kickoff-ready')) return;
    if (this.selected.team !== this.match.activeTeam) return;
    if (this.keeperMovePending && this.selected.kind !== 'keeper') return;
    if (!this.keeperMovePending && this.selected.kind === 'keeper') return;

    const start = this.selected.body.position;
    const dx = start.x - this.aimPoint.x;
    const dy = start.y - this.aimPoint.y;
    const length = Math.hypot(dx,dy);
    if (length < 4) return;

    this.shotByKeeper = this.selected.kind === 'keeper';
    if (this.keeperHasBall) this.releaseCaughtBall();
    this.match = startShot(this.match, this.selected.id);
    this.cantasThatTouchedBallThisShot.clear();
    this.foulText = '';
    this.shotStartedAt = this.time.now;
    this.settledSince = null;
    const force = 0.0009 + this.power*0.0031;
    this.matter.applyForce(this.selected.body, { x: dx/length*force, y: dy/length*force });
    this.shotInProgress = true;
    this.clearSelection();
    this.setStatus('BALL IN PLAY', 'Your canta is moving. Wait for the ball and pieces to settle.');
  }

  private onCollisionStart(event: MatterJS.IEventCollision<MatterJS.BodyType>) {
    if (!this.shotInProgress || this.match.phase !== 'shot' || this.match.foulAwardedTo) return;

    // A goalkeeper catches rather than rebounds the ball.
    for (const pair of event.pairs) {
      const a = pair.bodyA as unknown as { id: number; label?: string };
      const b = pair.bodyB as unknown as { id: number; label?: string };
      if (a.label !== 'ball' && b.label !== 'ball') continue;
      const other = a.label === 'ball' ? b : a;
      if (other.label !== 'keeper') continue;
      const keeper = this.pieces.find(piece => piece.body.id === other.id && piece.kind === 'keeper');
      if (keeper) {
        this.handleKeeperCatch(keeper);
        return;
      }
    }

    for (const pair of event.pairs) {
      const a = pair.bodyA as unknown as { id: number; label?: string };
      const b = pair.bodyB as unknown as { id: number; label?: string };
      if (a.label !== 'ball' && b.label !== 'ball') continue;
      const other = a.label === 'ball' ? b : a;
      const piece = this.pieces.find(p => p.body.id === other.id);
      if (piece) this.cantasThatTouchedBallThisShot.add(piece.body.id);
    }

    for (const pair of event.pairs) {
      const a = pair.bodyA as unknown as { id: number; label?: string };
      const b = pair.bodyB as unknown as { id: number; label?: string };
      if (a.label === 'ball' || b.label === 'ball') continue;

      const aPiece = this.pieces.find(p => p.body.id === a.id);
      const bPiece = this.pieces.find(p => p.body.id === b.id);
      if (!aPiece || !bPiece || aPiece.body.isStatic || bPiece.body.isStatic) continue;

      const eitherCantaTouchedBall =
        this.cantasThatTouchedBallThisShot.has(aPiece.body.id) ||
        this.cantasThatTouchedBallThisShot.has(bPiece.body.id);
      if (eitherCantaTouchedBall) continue;

      this.match = awardFoul(this.match, this.match.activeTeam);
      if (this.match.foulAwardedTo) {
        this.foulBallPosition = { x: this.ball.position.x, y: this.ball.position.y };
        this.freezeBallForSetPiece();
        this.foulText = 'FOUL: cantas collided before ball contact';
        this.setStatus(
          'FOUL — PLAY STOPPING',
          'Neither canta touched the ball before contact. The other team has been awarded a free kick.'
        );
      }
      break;
    }
  }


  private handleKeeperCatch(keeper: Piece) {
    this.shotInProgress = false;
    this.shotByKeeper = false;
    this.settledSince = null;
    this.keeperMovePending = false;
    this.keeperHasBall = true;
    this.stopAllBodies();
    const inward = keeper.team === 'blue' ? 1 : -1;
    this.matter.body.setStatic(this.ball, true);
    this.matter.body.setPosition(this.ball, {
      x: keeper.body.position.x + inward * (KEEPER_RADIUS + BALL_RADIUS + 2),
      y: keeper.body.position.y,
    });
    this.match = {
      ...this.match,
      activeTeam: keeper.team,
      phase: 'ready',
      selectedCantaId: null,
      foulAwardedTo: null,
      isFreeKickShot: false,
      isKickoffShot: false,
    };
    this.clearSelection();
    this.setStatus(
      teamLabel(keeper.team) + ' GOALKEEPER CATCH',
      'Your goalkeeper has caught the ball. Choose an outfield canta to play it back into the pitch.'
    );
  }

  private releaseCaughtBall() {
    if (!this.keeperHasBall) return;
    this.matter.body.setStatic(this.ball, false);
    this.matter.body.setVelocity(this.ball, { x: 0, y: 0 });
    this.matter.body.setAngularVelocity(this.ball, 0);
    this.keeperHasBall = false;
  }

  private ballIsInTeamHalf(team: Team) {
    return team === 'blue' ? this.ball.position.x < W / 2 : this.ball.position.x > W / 2;
  }

  private prepareTurn() {
    this.keeperMovePending = !this.keeperHasBall && this.ballIsInTeamHalf(this.match.activeTeam);
    if (this.keeperMovePending) {
      this.setStatus(
        teamLabel(this.match.activeTeam) + ' GOALKEEPER MOVE',
        'The ball is in your half. Move your goalkeeper first, then take your outfield canta move.'
      );
    } else {
      this.setStatus(
        teamLabel(this.match.activeTeam) + " TEAM'S TURN",
        'Select one of your own outfield cantas, aim, adjust power and flick.'
      );
    }
  }

  private clampGoalkeeperPositions() {
    for (const piece of this.pieces) {
      if (piece.kind !== 'keeper') continue;
      const minX = piece.team === 'blue' ? PITCH.left + KEEPER_RADIUS : W / 2 + 280;
      const maxX = piece.team === 'blue' ? PITCH.left + 118 : PITCH.right - KEEPER_RADIUS;
      const x = Phaser.Math.Clamp(piece.body.position.x, minX, maxX);
      const y = Phaser.Math.Clamp(piece.body.position.y, 255, 345);
      if (x !== piece.body.position.x || y !== piece.body.position.y) {
        this.matter.body.setPosition(piece.body, { x, y });
        this.matter.body.setVelocity(piece.body, { x: 0, y: 0 });
      }
    }
  }

  private freezeBallForSetPiece() {
    if (this.ballFrozenForSetPiece) return;
    this.matter.body.setVelocity(this.ball, { x: 0, y: 0 });
    this.matter.body.setAngularVelocity(this.ball, 0);
    this.matter.body.setStatic(this.ball, true);
    this.ballFrozenForSetPiece = true;
  }

  private freezeAllPiecesForArrangement() {
    for (const piece of this.pieces) {
      this.matter.body.setVelocity(piece.body, { x: 0, y: 0 });
      this.matter.body.setAngularVelocity(piece.body, 0);
      this.matter.body.setStatic(piece.body, true);
    }
    if (this.foulBallPosition) {
      this.matter.body.setPosition(this.ball, this.foulBallPosition);
    }
    this.freezeBallForSetPiece();
  }

  private releaseSetPieceBodies() {
    for (const piece of this.pieces) this.matter.body.setStatic(piece.body, false);
    this.matter.body.setStatic(this.ball, false);
    this.matter.body.setVelocity(this.ball, { x: 0, y: 0 });
    this.matter.body.setAngularVelocity(this.ball, 0);
    this.ballFrozenForSetPiece = false;
  }

  private resolveEndLineCrossing(): boolean {
    const { x, y } = this.ball.position;
    if (x >= PITCH.left - BALL_RADIUS && x <= PITCH.right + BALL_RADIUS) return false;

    const crossedLeft = x < PITCH.left - BALL_RADIUS;
    const isGoal = y >= 267 && y <= 333;
    this.shotInProgress = false;
    this.settledSince = null;
    this.clearSelection();
    this.stopAllBodies();

    if (isGoal) {
      this.keeperMovePending = false;
      const scoringTeam: Team = crossedLeft ? 'red' : 'blue';
      this.match = recordGoal(this.match, scoringTeam);
      this.resetBall(W / 2, H / 2);
      const blueScore = document.querySelector('#blue-score');
      const redScore = document.querySelector('#red-score');
      if (blueScore) blueScore.textContent = String(this.match.scores.blue);
      if (redScore) redScore.textContent = String(this.match.scores.red);
      this.setStatus(
        teamLabel(scoringTeam) + ' SCORES!',
        'Goal! Your team keeps the next turn. The central midfielder must make the kickoff pass.'
      );
      return true;
    }

    const defendingTeam: Team = crossedLeft ? 'blue' : 'red';
    const goalKickX = crossedLeft ? PITCH.left + 82 : PITCH.right - 82;
    this.match = {
      ...this.match,
      activeTeam: defendingTeam,
      phase: 'ready',
      selectedCantaId: null,
      foulAwardedTo: null,
      isFreeKickShot: false,
      isKickoffShot: false,
    };
    this.resetBall(goalKickX, H / 2);
    this.prepareTurn();
    this.setStatus(
      teamLabel(defendingTeam) + ' GOAL KICK',
      'The ball went over the end line outside the goal. The defending team has the goal kick.'
    );
    return true;
  }

  private stopAllBodies() {
    for (const piece of this.pieces) {
      this.matter.body.setVelocity(piece.body, { x: 0, y: 0 });
      this.matter.body.setAngularVelocity(piece.body, 0);
    }
  }

  private resetBall(x: number, y: number) {
    this.matter.body.setStatic(this.ball, false);
    this.matter.body.setPosition(this.ball, { x, y });
    this.matter.body.setVelocity(this.ball, { x: 0, y: 0 });
    this.matter.body.setAngularVelocity(this.ball, 0);
    this.ballFrozenForSetPiece = false;
  }

  private allPiecesSettled() {
    const bodies = [...this.pieces.map(piece => piece.body), this.ball];
    return bodies.every(body =>
      Math.abs(body.velocity.x) + Math.abs(body.velocity.y) < SETTLED_SPEED
    );
  }

  private completeCurrentShot() {
    this.shotInProgress = false;
    this.settledSince = null;
    const wasKeeperMove = this.shotByKeeper && !this.match.foulAwardedTo;
    this.shotByKeeper = false;
    if (this.match.foulAwardedTo) {
      this.match = finishShot(this.match);
    } else if (wasKeeperMove) {
      this.match = { ...this.match, phase: 'ready', selectedCantaId: null };
      this.keeperMovePending = false;
    } else {
      this.match = finishShot(this.match);
    }
    this.clearSelection();

    if (this.match.phase === 'free-kick-attacker-setup') {
      this.beginArrangementPhase();
      return;
    }

    if (this.match.phase === 'ready') {
      this.foulBallPosition = null;
      this.foulText = '';
      if (wasKeeperMove) {
        this.setStatus(
          teamLabel(this.match.activeTeam) + ' OUTFIELD MOVE',
          'Goalkeeper move complete. Now select one of your outfield cantas and take your move.'
        );
      } else {
        this.foulBallPosition = null;
        this.foulText = '';
        this.prepareTurn();
      }
    }
  }

  private beginArrangementPhase() {
    this.freezeAllPiecesForArrangement();
    this.arrangedCantaIds.clear();
    this.draggedPiece = null;
    this.dragStart = null;
    this.arrangementEndsAt = this.time.now + ARRANGEMENT_SECONDS * 1000;
    this.lastDisplayedSeconds = -1;
    this.updateArrangementTimer();
    this.setStatus(
      teamLabel(this.setupTeam()) + ' TEAM — SET UP FREE KICK',
      'Drag up to three of your outfield cantas into position. The ball is fixed at the foul location.'
    );
    this.refreshControls();
  }

  private updateArrangementTimer() {
    const seconds = Math.max(0, Math.ceil((this.arrangementEndsAt - this.time.now) / 1000));
    const timer = document.querySelector('#arrangement-timer');
    if (timer && seconds !== this.lastDisplayedSeconds) {
      timer.textContent = seconds + 's';
      this.lastDisplayedSeconds = seconds;
    }
    if (seconds <= 0) this.finishArrangementPhase();
  }

  private finishArrangementPhase() {
    if (!this.isArrangementPhase()) return;
    this.draggedPiece = null;
    this.dragStart = null;
    this.arrangedCantaIds.clear();
    this.match = advanceFreeKickSetup(this.match);

    if (this.match.phase === 'free-kick-defender-setup') {
      this.beginArrangementPhase();
      return;
    }

    if (this.match.phase === 'free-kick-shot') {
      this.releaseSetPieceBodies();
      this.foulText = '';
      this.setStatus(
        teamLabel(this.match.activeTeam) + ' FREE KICK — TAKE YOUR SHOT',
        'The defence is set. Choose one of your cantas and flick towards the ball.'
      );
      this.refreshControls();
    }
  }

  private updateArrangementMoveCount() {
    const counter = document.querySelector('#arrangement-count');
    if (counter) counter.textContent = this.arrangedCantaIds.size + ' / ' + MAX_ARRANGED_CANTAS + ' cantas moved';
  }

  private setStatus(label: string, helperText: string) {
    const turn = document.querySelector('#turn-label');
    const helper = document.querySelector('#helper-text');
    if (turn) turn.textContent = label;
    if (helper) helper.textContent = helperText;
    this.refreshControls();
  }

  private clearSelection() {
    this.selected = null;
    this.aimPoint = null;
    this.refreshControls();
  }

  private refreshControls() {
    const instruction = document.querySelector('#instruction');
    const helper = document.querySelector('#helper-text');
    const flick = document.querySelector<HTMLButtonElement>('#flick-button');
    const cancel = document.querySelector<HTMLButtonElement>('#cancel-button');
    const teamChip = document.querySelector('#team-chip');
    const powerInput = document.querySelector<HTMLInputElement>('#power');
    const arrangementPanel = document.querySelector<HTMLElement>('#arrangement-panel');
    const arrangementDone = document.querySelector<HTMLButtonElement>('#arrangement-done');
    const arranging = this.isArrangementPhase();

    if (teamChip) teamChip.textContent = teamLabel(this.match.activeTeam);
    if (arrangementPanel) arrangementPanel.hidden = !arranging;
    if (arrangementDone) arrangementDone.disabled = !arranging;
    if (instruction) {
      if (arranging) instruction.textContent = this.setupTeam() + ' team setup';
      else if (this.match.phase === 'free-kick-shot') instruction.textContent = 'Take the free kick';
      else if (this.match.phase === 'kickoff-ready') instruction.textContent = 'Kickoff pass';
      else if (this.keeperMovePending) instruction.textContent = 'Move goalkeeper';
      else instruction.textContent = this.selected ? 'Aim your flick' : 'Select a canta';
    }

    if (helper && !this.shotInProgress) {
      if (arranging) {
        helper.textContent = 'Drag up to three ' + teamLabel(this.setupTeam()).toLowerCase() + ' cantas to arrange the free kick.';
      } else if (this.match.phase === 'free-kick-shot') {
        helper.textContent = 'The defensive wall is set. Select your canta and take the free kick.';
      } else if (this.match.phase === 'kickoff-ready') {
        helper.textContent = 'Your team scored. Select your central midfielder to make the kickoff pass.';
      } else if (this.keeperMovePending) {
        helper.textContent = 'The ball is in your half. Select your goalkeeper, aim and flick it into position before your outfield move.';
      } else if (!this.foulText) {
        helper.textContent = 'Choose one of your ' + teamLabel(this.match.activeTeam).toLowerCase() + ' outfield cantas. Your selected canta moves and strikes the ball.';
      }
    }

    if (flick) flick.disabled = !this.selected || this.shotInProgress ||
      (this.match.phase !== 'ready' && this.match.phase !== 'free-kick-shot' && this.match.phase !== 'kickoff-ready');
    if (cancel) cancel.disabled = !this.selected || this.shotInProgress;
    if (powerInput) powerInput.disabled = this.shotInProgress || arranging ||
      (this.match.phase !== 'ready' && this.match.phase !== 'free-kick-shot' && this.match.phase !== 'kickoff-ready');
    this.updateArrangementMoveCount();
  }
}
