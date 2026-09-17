import { GameMap } from '@oldbear/shared';
import { Viewport } from './Viewport.js';

export function snapToGrid(
  x: number,
  y: number,
  gridSize: number,
  tokenSize = 1,
  offsetX = 0,
  offsetY = 0,
  gridType: 'square' | 'hex' | 'none' = 'square'
): { x: number; y: number } {
  if (gridType === 'none' || gridSize <= 0) {
    return { x, y };
  }

  if (gridType === 'hex') {
    const hexRadius = gridSize / Math.sqrt(3);
    const hexHeight = gridSize;
    const horizDist = hexRadius * 1.5;
    const vertDist = hexHeight;

    const tokRadius = (tokenSize * gridSize) / 2;
    const centerX = x + tokRadius;
    const centerY = y + tokRadius;

    const baseCol = Math.round((centerX - offsetX) / horizDist);
    let bestCx = centerX;
    let bestCy = centerY;
    let minDiffSq = Infinity;

    for (let c = baseCol - 2; c <= baseCol + 2; c++) {
      const colOffset = Math.abs(c) % 2 === 1 ? hexHeight / 2 : 0;
      const baseRow = Math.round((centerY - offsetY - colOffset) / vertDist);
      for (let r = baseRow - 2; r <= baseRow + 2; r++) {
        const cx = c * horizDist + offsetX;
        const cy = r * vertDist + colOffset + offsetY;
        const diffSq = (centerX - cx) ** 2 + (centerY - cy) ** 2;
        if (diffSq < minDiffSq) {
          minDiffSq = diffSq;
          bestCx = cx;
          bestCy = cy;
        }
      }
    }

    return {
      x: Math.round(bestCx - tokRadius),
      y: Math.round(bestCy - tokRadius),
    };
  }

  const offX = ((offsetX % gridSize) + gridSize) % gridSize;
  const offY = ((offsetY % gridSize) + gridSize) % gridSize;
  const halfGrid = gridSize / 2;
  const centerOffset = tokenSize % 2 === 1 ? 0 : halfGrid;
  const snappedX = Math.round((x - offX - centerOffset) / gridSize) * gridSize + offX + centerOffset;
  const snappedY = Math.round((y - offY - centerOffset) / gridSize) * gridSize + offY + centerOffset;
  return { x: snappedX, y: snappedY };
}

export function renderGrid(
  ctx: CanvasRenderingContext2D,
  map: GameMap,
  viewport: Viewport,
  canvasWidth: number,
  canvasHeight: number
) {
  if (map.showGrid === false || map.gridType === 'none' || map.gridSize <= 0) return;

  const { gridSize, gridColor, gridOpacity, width: mapWidth, height: mapHeight } = map;

  const offsetX = (((map.gridOffsetX || 0) % gridSize) + gridSize) % gridSize;
  const offsetY = (((map.gridOffsetY || 0) % gridSize) + gridSize) % gridSize;

  // Viewport bounds in world coordinates
  const topLeft = viewport.screenToWorld(0, 0);
  const bottomRight = viewport.screenToWorld(canvasWidth, canvasHeight);

  const startX = Math.max(0, Math.floor(topLeft.x / gridSize) * gridSize);
  const endX = Math.min(mapWidth, Math.ceil(bottomRight.x / gridSize) * gridSize);

  const startY = Math.max(0, Math.floor(topLeft.y / gridSize) * gridSize);
  const endY = Math.min(mapHeight, Math.ceil(bottomRight.y / gridSize) * gridSize);

  ctx.save();
  ctx.strokeStyle = gridColor || 'rgba(255, 255, 255, 0.4)';
  ctx.globalAlpha = gridOpacity ?? 0.4;
  ctx.lineWidth = Math.max(1 / viewport.scale, 1); // Maintain crisp 1px visible line

  ctx.beginPath();

  if (map.gridType === 'square') {
    // Vertical grid lines with offset
    const firstLineX = startX + (((offsetX - (startX % gridSize)) % gridSize) + gridSize) % gridSize;
    for (let x = firstLineX; x <= endX; x += gridSize) {
      ctx.moveTo(x, Math.max(0, startY));
      ctx.lineTo(x, Math.min(mapHeight, endY));
    }
    // Horizontal grid lines with offset
    const firstLineY = startY + (((offsetY - (startY % gridSize)) % gridSize) + gridSize) % gridSize;
    for (let y = firstLineY; y <= endY; y += gridSize) {
      ctx.moveTo(Math.max(0, startX), y);
      ctx.lineTo(Math.min(mapWidth, endX), y);
    }
  } else if (map.gridType === 'hex') {
    // Hexagonal grid points
    const hexRadius = gridSize / Math.sqrt(3);
    const hexHeight = gridSize;
    const horizDist = hexRadius * 1.5;
    const vertDist = hexHeight;

    for (let col = Math.floor(startX / horizDist); col * horizDist <= endX; col++) {
      for (let row = Math.floor(startY / vertDist); row * vertDist <= endY; row++) {
        const cx = col * horizDist + offsetX;
        const cy = row * vertDist + (col % 2 ? hexHeight / 2 : 0) + offsetY;
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
