import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Viewport } from './Viewport.js';
import { measureDistance } from './Ruler.js';
import { snapToGrid } from './GridRenderer.js';

describe('Canvas Engine Utilities', () => {
  it('correctly maps screen to world coordinates', () => {
    const vp = new Viewport(100, 50, 2.0);
    const world = vp.screenToWorld(200, 150);
    assert.strictEqual(world.x, 50);
    assert.strictEqual(world.y, 50);

    const screen = vp.worldToScreen(50, 50);
    assert.strictEqual(screen.x, 200);
    assert.strictEqual(screen.y, 150);
  });

  it('snaps coordinates to grid intervals', () => {
    const snapped = snapToGrid(48, 102, 50);
    assert.strictEqual(snapped.x, 50);
    assert.strictEqual(snapped.y, 100);
  });

  it('measures distance and flags speed excess', () => {
    // 6 cells = 30ft (at 50px/cell, 5ft/cell)
    const measurementNormal = measureDistance(
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      50,
      30,
      5
    );
    assert.strictEqual(measurementNormal.distanceFt, 30);
    assert.strictEqual(measurementNormal.isOverSpeed, false);

    // 8 cells = 40ft (exceeds 30ft speed)
    const measurementOver = measureDistance(
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      50,
      30,
      5
    );
    assert.strictEqual(measurementOver.distanceFt, 40);
    assert.strictEqual(measurementOver.isOverSpeed, true);
    assert.strictEqual(measurementOver.color, '#ef4444');
  });
});
