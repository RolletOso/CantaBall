import Phaser from 'phaser';
import type { Team } from '../game/rules';

type Canta = { id: string; team: Team; x: number; y: number; radius: number };

const W = 900;
const H = 600;
const PITCH = { left: 42, right: 858, top: 38, bottom: 562 };

export class CantaBallScene extends Phaser.Scene {
  private cantas: Canta[] = [];
  private selected: Canta | null = null;
  private ball!: Phaser.Physics.Matter.Image;
  private aimPoint: Phaser.Math.Vector2 | null = null;
  private power = 0.45;
  private isMoving = false;

  constructor() { super('CantaBallScene'); }

  create() {
    this.drawPitch();
    this.createTeams();
    this.createBall();
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
    this.refreshControls();
  }

  update() {
    if (this.isMoving && this.ball && this.ball.body) {
      const speed = this.ball.body.velocity;
      const settled = Math.abs(speed.x) + Math.abs(speed.y) < 0.12;
      if (settled) this.isMoving = false;
    }
    this.drawAim();
  }

  private drawPitch() {
    const g = this.add.graphics();
    g.fillStyle(0x176b43, 1).fillRect(0, 0, W, H);
    g.lineStyle(3, 0xe5f2e8, 0.8).strokeRect(PITCH.left, PITCH.top, PITCH.right-PITCH.left, PITCH.bottom-PITCH.top);
    g.lineStyle(2, 0xe5f2e8, 0.7).lineBetween(W/2, PITCH.top, W/2, PITCH.bottom);
    g.strokeCircle(W/2, H/2, 82);
    g.fillStyle(0xe5f2e8, 0.8).fillCircle(W/2, H/2, 3);
    // Penalty areas and goal mouths.
    g.strokeRect(PITCH.left, 205, 112, 190).strokeRect(PITCH.right-112, 205, 112, 190);
    g.strokeRect(PITCH.left, 255, 38, 90).strokeRect(PITCH.right-38, 255, 38, 90);
    g.fillStyle(0xd5f36a, 1).fillRect(PITCH.left-8, 267, 8, 66);
    g.fillStyle(0xff7777, 1).fillRect(PITCH.right, 267, 8, 66);
    // Pitch stripes.
    for (let x= W/2+205; x < PITCH.right; x += 82) g.lineStyle(1, 0xffffff, 0.035).lineBetween(x, PITCH.top, x, PITCH.bottom);
  }

  private createTeams() {
    const positions: Array<[number, number]> = [
      [150,170],[150,300],[150,430],[265,115],[265,245],[265,375],[265,505],[390,180],[390,420],[480,300],
      [750,170],[750,300],[750,430],[635,115],[635,245],[635,375],[635,505],[510,180],[510,420],[420,300],
    ];
    positions.forEach(([x,y], index) => {
      const team: Team = index < 10 ? 'blue' : 'red';
      const canta: Canta = { id: team + '-' + (index % 10 + 1), team, x, y, radius: 13 };
      this.cantas.push(canta);
      this.drawCanta(canta);
    });
  }

  private drawCanta(canta: Canta) {
    const color = canta.team === 'blue' ? 0x2d83ee : 0xe64b4b;
    const circle = this.add.circle(canta.x, canta.y, canta.radius, color).setStrokeStyle(2, 0xf4f5ee, 0.95);
    circle.setInteractive(new Phaser.Geom.Circle(0, 0, canta.radius + 6), Phaser.Geom.Circle.Contains);
    circle.setData('cantaId', canta.id);
    circle.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (canta.team !== 'blue' || this.isMoving) return;
      this.selected = canta;
      this.aimPoint = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
      this.refreshControls();
    });
    this.add.circle(canta.x - 3, canta.y - 4, 3, 0xffffff, 0.45);
  }

  private createBall() {
    this.ball = this.matter.add.image(W/2, H/2, undefined, undefined, {
      shape: { type: 'circle', radius: 7 },
      friction: 0.02,
      frictionAir: 0.025,
      restitution: 0.82,
      density: 0.0005,
    });
    this.ball.setCircle(7);
    this.ball.setDisplaySize(14, 14);
    this.ball.setTint(0xf8f5df);
    this.ball.setFixedRotation();
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (!this.selected || this.isMoving) return;
    this.aimPoint = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
  }
  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (this.selected && pointer.isDown && !this.isMoving) this.aimPoint = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
  }
  private onPointerUp() { /* Aim is confirmed with the Flick button. */ }

  private drawAim() {
    const old = this.children.getByName('aim-guides');
    old?.destroy();
    if (!this.selected || !this.aimPoint) return;
    const g = this.add.graphics().setName('aim-guides').setDepth(20);
    const dx = this.aimPoint.x - this.selected.x;
    const dy = this.aimPoint.y - this.selected.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx/len, uy = dy/len;
    g.lineStyle(2, 0xffffff, 0.85);
    g.lineBetween(this.selected.x, this.selected.y, this.selected.x + ux*len, this.selected.y + uy*len);
    g.lineStyle(2, 0xd5f36a, 0.9);
    g.lineBetween(this.ball.x, this.ball.y, this.ball.x - ux*75, this.ball.y - uy*75);
    g.fillStyle(0xd5f36a, 1).fillCircle(this.ball.x - ux*75, this.ball.y - uy*75, 4);
  }

  private flick() {
    if (!this.selected || this.isMoving) return;
    const dx = this.aimPoint ? this.selected.x - this.aimPoint.x : 0;
    const dy = this.aimPoint ? this.selected.y - this.aimPoint.y : 0;
    const length = Math.hypot(dx,dy) || 1;
    const force = Math.min(0.035, this.power * 0.035);
    this.matter.applyForce(this.ball, this.ball.position, { x: dx/length*force, y: dy/length*force });
    this.isMoving = true;
    this.clearSelection();
    const turn = document.querySelector('#turn-label');
    if (turn) turn.textContent = 'BALL IN PLAY';
    // Temporary prototype: later turns will be driven by the full rules engine.
    this.time.delayedCall(1400, () => {
      if (!this.isMoving) {
        const label = document.querySelector('#turn-label');
        if (label) label.textContent = "RED TEAM'S TURN";
      }
    });
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
    if (helper) helper.textContent = this.selected
      ? 'Drag to set your flick direction. Adjust power, then flick.'
      : 'Choose a blue canta to select it, then aim towards the ball.';
    if (flick) flick.disabled = !this.selected || this.isMoving;
    if (cancel) cancel.disabled = !this.selected;
  }
}
