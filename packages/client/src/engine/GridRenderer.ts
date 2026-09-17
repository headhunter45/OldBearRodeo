import { GameMap } from '@oldbear/shared';
import { Viewport } from './Viewport.js';

export function snapToGrid(x: number, y: number, gridSize: number, tokenSize = 1): { x: number; y: number } {
  const halfGrid = gridSize / 2;
  const snappedX = Math.round((x - (tokenSize % 2 === 1 ? 0 : halfGrid)) / gridSize) * gridSize + (tokenSize % 2 === 1 ? 0 : halfGrid);
  const snappedY = Math.round((y - (tokenSize % 2 === 1 ? 0 : halfGrid)) / gridSize) * gridSize + (tokenSize % 2 === 1 ? 0 : halfGrid);
  return { x: snappedX, y: snappedY };
}

export function renderGrid(
  ctx: CanvasRenderingContext2D,
  map: GameMap,
  viewport: Viewport,
  canvasWidth: number,
  canvasHeight: number
) {
  if (map.gridType === 'none' || map.gridSize <= 0) return;

  const { gridSize, gridColor, gridOpacity, width: mapWidth, height: mapHeight } = map;

  // Viewport bounds in world coordinates
  const topLeft = viewport.screenToWorld(0, 0);
  const bottomRight = viewport.screenToWorld(canvasWidth, canvasHeight);

  const startX = Math.max(0, Math.floor(topLeft.x / gridSize) * gridSize);
  const endX = Math.min(mapWidth, Math.ceil(bottomRight.x / gridSize) * gridSize);

  const startY = Math.max(0, Math.floor(topLeft.y / gridSize) * gridSize);
  const endY = Math.min(mapHeight, Math.ceil(bottomRight.y / gridSize) * gridSize);

  ctx.save();
  ctx.strokeStyle = gridColor || 'rgba(255, 255, 255, 0.2)';
  ctx.globalAlpha = gridOpacity ?? 0.25;
  ctx.lineWidth = 1 / viewport.scale; // maintain crisp 1px screen width

  ctx.beginPath();

  if (map.gridType === 'square') {
    // Vertical lines
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, Math.max(0, startY));
      ctx.lineTo(x, Math.min(mapHeight, endY));
    }
    // Horizontal lines
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(Math.max(0, startX), y);
      ctx.lineTo(Math.min(mapWidth, endX), y);
    }
  } else if (map.gridType === 'hex') {
    // Hexagonal grid points
    const hexRadius = gridSize / Math.sqrt(3);
    const hexHeight = gridSize;
    const hexWidth = hexRadius * 2;
    const horizDist = hexRadius * 1.5;
    const vertDist = hexHeight;

    for (let col = Math.floor(startX / horizDist); col * horizDist <= endX; col++) {
      for (let row = Math.floor(startY / vertDist); row * vertDist <= endY; row++) {
        const cx = col * horizDist;
        const cy = row * vertDist + (col % 2 ? hexHeight / 2 : 0);
        drawHexagon(ctx, cx, cy, hexRadius);
      }
    }
  }

  ctx.stroke();
  ctx.restore();
}

function drawHexagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
}
