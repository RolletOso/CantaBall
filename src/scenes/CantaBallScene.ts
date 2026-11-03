import Phaser from 'phaser';
import type { Team } from '../game/rules';

type Piece = {
  id: string;
  team: Team;
  kind: 'outfield' | 'keeper';
  body: MatterJS.BodyType;
};

const W = 900;
const H = 600;
const PITCH = { left: 42, right: 858, top: 38, bottom: 562 };
const BALL_RADIUS = 7;
const CANTA_RADIUS = 12;
const KEEPER_RADIUS = 15;

export class CantaBallScene extends Phaser.Scene {
  private pieces: Piece[] = [];
  private ball!: MatterJS.BodyType;
  private selected: Piece | null = null;
  private aimPoint: Phaser.Math.Vector2 | null = null;
  private power = 0.45;
  private shotInProgress = false;
  private foulText = '';
  private lastFoulAt = 0;
  private cantasThatTouchedBallThisShot = new Set<number>();
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

    const powerInput = document.querySelector<HTMLInputElement>('#power');
    powerInput?.addEventListener('input', () => {
      this.power = Number(powerInput.value) / 100;
      const output = document.querySelector('#power-value');
      if (output) output.textContent = powerInput.value + '%';
    });
    document.querySelector('#cancel-button')?.addEventListener('click', () => this.clearSelection());
    document.querySelector('#flick-button')?.addEventListener('click', () => this.flick());
    this.refreshControls();
  }

  update() {
    this.graphics.clear();
    this.drawPieces();
    this.drawBall();
    this.drawAim();
    if (this.shotInProgress && this.allPiecesSettled()) {
      this.shotInProgress = false;
      const turn = document.querySelector('#turn-label');
      if (turn) turn.textContent = 'BLUE TEAM: TURN COMPLETE';
      this.refreshControls();
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
    this.matter.add.rectangle(PITCH.left, H/2, 8, H, options);
    this.matter.add.rectangle(PITCH.right, H/2, 8, H, options);
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

    // Temporary goalkeeper placeholder: one slightly wider canta.
    // Replace it with the custom six-canta artwork when that design is ready.
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
      this.graphics.lineStyle(piece === this.selected ? 4 : 2, piece === this.selected ? 0xd5f36a : 0xf4f5ee, 0.98);
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

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (this.shotInProgress) return;
    const point = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
    const hit = this.pieces.find(piece => {
      if (piece.team !== 'blue' || piece.kind !== 'outfield') return false;
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
    if (this.selected && pointer.isDown && !this.shotInProgress) {
      this.aimPoint = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
    }
  }

  private onPointerUp() { /* Flick is confirmed with the on-screen button. */ }

  private drawAim() {
    if (!this.selected || !this.aimPoint) return;
    const start = this.selected.body.position;
    const dx = start.x - this.aimPoint.x;
    const dy = start.y - this.aimPoint.y;
    const length = Math.hypot(dx,dy);
    if (length < 2) return;
    const ux = dx/length, uy = dy/length;
    // Pull-back guide: the line ends at the selected canta, not at an arbitrary point beyond it.
    this.graphics.lineStyle(2, 0xffffff, 0.88);
    this.graphics.lineBetween(start.x-ux*70, start.y-uy*70, start.x, start.y);
    this.graphics.fillStyle(0xd5f36a, 1).fillCircle(start.x-ux*70, start.y-uy*70, 4);
    // Short, deliberately limited preview from the selected canta towards the ball.
    this.graphics.lineStyle(2, 0xd5f36a, 0.82);
    this.graphics.lineBetween(start.x, start.y, start.x+ux*54, start.y+uy*54);
  }

  private flick() {
    if (!this.selected || !this.aimPoint || this.shotInProgress) return;
    const start = this.selected.body.position;
    const dx = start.x - this.aimPoint.x;
    const dy = start.y - this.aimPoint.y;
    const length = Math.hypot(dx,dy);
    if (length < 4) return;
    const force = 0.0009 + this.power*0.0031;
    this.cantasThatTouchedBallThisShot.clear();
    this.matter.applyForce(this.selected.body, { x: dx/length*force, y: dy/length*force });
    this.shotInProgress = true;
    this.clearSelection();
    const turn = document.querySelector('#turn-label');
    if (turn) turn.textContent = 'BALL IN PLAY';
    this.refreshControls();
  }

  private onCollisionStart(event: MatterJS.IEventCollision<MatterJS.BodyType>) {
    // Record ball contacts before checking canta-to-canta contacts in this step.
    for (const pair of event.pairs) {
      const a = pair.bodyA as unknown as { id: number; label?: string; isStatic: boolean };
      const b = pair.bodyB as unknown as { id: number; label?: string; isStatic: boolean };
      if (a.label !== 'ball' && b.label !== 'ball') continue;
      const other = a.label === 'ball' ? b : a;
      const piece = this.pieces.find(p => p.body.id === other.id);
      if (piece) this.cantasThatTouchedBallThisShot.add(piece.body.id);
    }

    for (const pair of event.pairs) {
      const a = pair.bodyA as unknown as { id: number; label?: string; isStatic: boolean };
      const b = pair.bodyB as unknown as { id: number; label?: string; isStatic: boolean };
      if (a.label === 'ball' || b.label === 'ball') continue;
      const aPiece = this.pieces.find(p => p.body.id === a.id);
      const bPiece = this.pieces.find(p => p.body.id === b.id);
      if (!aPiece || !bPiece || aPiece.body.isStatic || bPiece.body.isStatic) continue;

      // Contact is legal if either canta has already played the ball this shot.
      const eitherCantaTouchedBall =
        this.cantasThatTouchedBallThisShot.has(aPiece.body.id) ||
        this.cantasThatTouchedBallThisShot.has(bPiece.body.id);
      if (eitherCantaTouchedBall) continue;

      const now = this.time.now;
      if (now - this.lastFoulAt < 700) continue;
      this.lastFoulAt = now;
      this.foulText = 'FOUL: cantas collided before ball contact';
      const helper = document.querySelector('#helper-text');
      if (helper) helper.textContent = 'Foul: the cantas collided before either touched the ball. Set-piece restart is the next development step.';
      const instruction = document.querySelector('#instruction');
      if (instruction) instruction.textContent = 'Foul detected';
      const turn = document.querySelector('#turn-label');
      if (turn) turn.textContent = 'SET PIECE';
      break;
    }
  }

  private allPiecesSettled() {
    const bodies = [...this.pieces.map(p => p.body), this.ball];
    return bodies.every(body => Math.abs(body.velocity.x) + Math.abs(body.velocity.y) < 0.16);
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
    if (instruction) instruction.textContent = this.selected ? 'Aim your flick' : 'Select a canta';
    if (helper && !this.foulText) helper.textContent = this.selected
      ? 'Pull back to aim your canta, adjust power, then flick it into the ball.'
      : 'Choose one of your blue outfield cantas. The canta itself moves and strikes the ball.';
    if (flick) flick.disabled = !this.selected || this.shotInProgress;
    if (cancel) cancel.disabled = !this.selected;
  }
}
