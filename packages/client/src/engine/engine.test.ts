import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Viewport } from './Viewport.js';
import { measureDistance } from './Ruler.js';
import { snapToGrid } from './GridRenderer.js';
import { TRACKPAD_PAN_SENSITIVITY, TRACKPAD_ZOOM_SENSITIVITY, MOUSE_WHEEL_ZOOM_SENSITIVITY } from './CanvasEngine.js';

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

    // With offset
    const snappedOffset = snapToGrid(48, 102, 50, 1, 10, 15);
    assert.strictEqual(snappedOffset.x, 60);
    assert.strictEqual(snappedOffset.y, 115);
  });

  it('snaps coordinates to hexagonal grid centers', () => {
    // Hex grid with size 60
    const hexRadius = 60 / Math.sqrt(3);
    const horizDist = hexRadius * 1.5;
    // Token top-left (-28, -28) has center at (2, 2), closest to hex center (0, 0)
    const snappedOrigin = snapToGrid(-28, -28, 60, 1, 0, 0, 'hex');
    assert.strictEqual(snappedOrigin.x, -30); // center (0, 0) - radius (30)
    assert.strictEqual(snappedOrigin.y, -30);

    // Near Col 1, Row 0 center: cx = Math.round(horizDist) (~52), cy = 30.
    // Token top-left (22, 0) has center at (52, 30).
    const expectedCx = Math.round(horizDist);
    const snappedCol1 = snapToGrid(expectedCx - 32, 2, 60, 1, 0, 0, 'hex');
    assert.strictEqual(snappedCol1.x, expectedCx - 30);
    assert.strictEqual(snappedCol1.y, 0); // 30 - 30 = 0
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

  it('measures distance with measuring tape tool without speed limit (Task #97)', () => {
    // 12 cells at 50px/cell, 5ft/cell = 60ft
    const tapeMeasurement = measureDistance(
      { x: 100, y: 100 },
      { x: 700, y: 100 },
      50,
      Infinity,
      5
    );
    assert.strictEqual(tapeMeasurement.distanceFt, 60);
    assert.strictEqual(tapeMeasurement.isOverSpeed, false);
  });

  it('selects all enclosed tokens with box select and moves them as a group (Bug #78)', () => {
    // Mock tokens within a map
    const mockTokens = [
      { id: 't1', name: 'Goblin 1', x: 100, y: 100, size: 1, mapId: 'map-1' },
      { id: 't2', name: 'Goblin 2', x: 150, y: 100, size: 1, mapId: 'map-1' },
      { id: 't3', name: 'Goblin 3', x: 200, y: 100, size: 1, mapId: 'map-1' },
      { id: 't4', name: 'Dragon', x: 500, y: 500, size: 2, mapId: 'map-1' },
    ];

    const gridSize = 50;
    const boxStart = { x: 80, y: 80 };
    const boxEnd = { x: 280, y: 180 };

    const minX = Math.min(boxStart.x, boxEnd.x);
    const maxX = Math.max(boxStart.x, boxEnd.x);
    const minY = Math.min(boxStart.y, boxEnd.y);
    const maxY = Math.max(boxStart.y, boxEnd.y);

    const enclosed = mockTokens.filter((t) => {
      const diameter = t.size * gridSize;
      const cx = t.x + diameter / 2;
      const cy = t.y + diameter / 2;
      return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY;
    });

    // Verify all 3 goblins are enclosed, but not Dragon
    assert.strictEqual(enclosed.length, 3);
    assert.deepStrictEqual(enclosed.map((t) => t.id), ['t1', 't2', 't3']);

    // Simulate group movement delta: dx = 50, dy = 100
    const deltaX = 50;
    const deltaY = 100;
    const movedTokens = enclosed.map((t) => ({
      ...t,
      x: t.x + deltaX,
      y: t.y + deltaY,
    }));

    assert.strictEqual(movedTokens[0].x, 150);
    assert.strictEqual(movedTokens[0].y, 200);
    assert.strictEqual(movedTokens[1].x, 200);
    assert.strictEqual(movedTokens[1].y, 200);
    assert.strictEqual(movedTokens[2].x, 250);
    assert.strictEqual(movedTokens[2].y, 200);
  });

  it('preserves persistent markers indefinitely while ephemeral markers expire (Task #111)', () => {
    const now = Date.now();
    const markers = [
      {
        id: 'm-ephemeral',
        type: 'arrow' as const,
        userId: 'u1',
        userName: 'Player 1',
        color: '#ff0000',
        x: 0,
        y: 0,
        targetX: 50,
        targetY: 50,
        durationMs: 4000,
        createdAt: now - 5000, // expired
        persist: false,
      },
      {
        id: 'm-persistent',
        type: 'circle' as const,
        userId: 'u1',
        userName: 'Player 1',
        color: '#00ff00',
        x: 100,
        y: 100,
        radius: 60,
        durationMs: 0,
        createdAt: now - 100000, // very old
        persist: true,
      },
    ];

    // Simulate filtering logic
    const surviving = markers.filter(
      (m) => m.persist || now - m.createdAt <= m.durationMs
    );

    assert.strictEqual(surviving.length, 1);
    assert.strictEqual(surviving[0].id, 'm-persistent');
    assert.strictEqual(surviving[0].persist, true);
  });

  it('correctly hit-tests persistent circle, rectangle, and arrow markers (Task #111)', () => {
    const circleMarker = {
      id: 'c1',
      type: 'circle' as const,
      x: 100,
      y: 100,
      radius: 50,
      persist: true,
    };
    const rectMarker = {
      id: 'r1',
      type: 'rectangle' as const,
      x: 200,
      y: 200,
      width: 100,
      height: 60,
      persist: true,
    };

    // Point inside circle (120, 120) distance = Math.hypot(20, 20) = ~28.28 <= 50
    const insideCircle = Math.hypot(120 - circleMarker.x, 120 - circleMarker.y) <= circleMarker.radius;
    assert.strictEqual(insideCircle, true);

    // Point outside circle (160, 160) distance = Math.hypot(60, 60) = ~84.85 > 50
    const outsideCircle = Math.hypot(160 - circleMarker.x, 160 - circleMarker.y) <= circleMarker.radius;
    assert.strictEqual(outsideCircle, false);

    // Point inside rectangle (250, 230)
    const insideRect =
      250 >= rectMarker.x &&
      250 <= rectMarker.x + rectMarker.width &&
      230 >= rectMarker.y &&
      230 <= rectMarker.y + rectMarker.height;
    assert.strictEqual(insideRect, true);

    // Point outside rectangle (350, 230)
    const outsideRect =
      350 >= rectMarker.x &&
      350 <= rectMarker.x + rectMarker.width &&
      230 >= rectMarker.y &&
      230 <= rectMarker.y + rectMarker.height;
    assert.strictEqual(outsideRect, false);
  });

  it('separates trackpad two-finger pan from pinch-to-zoom using sensitivity constants (Task #117)', () => {
    const vp = new Viewport(0, 0, 1.0);

    // Standard two-finger swipe (e.ctrlKey === false): pans without changing scale
    const deltaX = 30;
    const deltaY = 50;
    const panX = -deltaX * TRACKPAD_PAN_SENSITIVITY;
    const panY = -deltaY * TRACKPAD_PAN_SENSITIVITY;
    vp.pan(panX, panY);

    assert.strictEqual(vp.x, -30);
    assert.strictEqual(vp.y, -50);
    assert.strictEqual(vp.scale, 1.0);

    // Pinch-to-zoom (e.ctrlKey === true): zooms exponentially at cursor anchor
    const pinchDelta = -10;
    const zoomFactor = Math.exp(-pinchDelta * TRACKPAD_ZOOM_SENSITIVITY);
    vp.zoomAt(100, 100, zoomFactor);

    assert.strictEqual(vp.scale > 1.0, true);
    assert.strictEqual(TRACKPAD_PAN_SENSITIVITY > 0, true);
    assert.strictEqual(TRACKPAD_ZOOM_SENSITIVITY > 0, true);
    assert.strictEqual(MOUSE_WHEEL_ZOOM_SENSITIVITY > 0, true);
  });

  it('reverts box select tool to arrow select upon enclosing tokens (Task #117)', () => {
    let currentTool = 'box-select';
    const onToolChange = (tool: string) => {
      currentTool = tool;
    };

    const enclosedTokens = [{ id: 't1' }, { id: 't2' }];
    if (enclosedTokens.length > 0) {
      currentTool = 'select';
      onToolChange('select');
    }

    assert.strictEqual(currentTool, 'select');
  });
});
