import { Point } from './Viewport.js';

export interface RulerMeasurement {
  start: Point;
  end: Point;
  distancePx: number;
  distanceFt: number;
  speedFt: number;
  isOverSpeed: boolean;
  color: string;
}

export function measureDistance(
  start: Point,
  end: Point,
  gridSize: number,
  speedFt: number = 30,
  scaleFtPerCell: number = 5
): RulerMeasurement {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distancePx = Math.hypot(dx, dy);

  // Convert pixels to 5ft grid increments
  const gridCells = distancePx / gridSize;
  const distanceFt = Math.round(gridCells * scaleFtPerCell);
  const isOverSpeed = distanceFt > speedFt;

  let color = '#10b981'; // emerald
  if (isOverSpeed) {
    color = '#ef4444'; // red exceeded
  } else if (distanceFt >= speedFt * 0.8) {
    color = '#f59e0b'; // amber close
  }

  return {
    start,
    end,
    distancePx,
    distanceFt,
    speedFt,
    isOverSpeed,
    color,
  };
}

export function drawRuler(
  ctx: CanvasRenderingContext2D,
  measurement: RulerMeasurement
) {
  const { start, end, distanceFt, speedFt, isOverSpeed, color } = measurement;

  ctx.save();
  // Draw ruler line
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.stroke();

  // Draw end points
  ctx.beginPath();
  ctx.arc(start.x, start.y, 5, 0, Math.PI * 2);
  ctx.arc(end.x, end.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.shadowBlur = 0;
  ctx.fill();

  // Draw distance badge
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const label = isOverSpeed
    ? `⚠️ ${distanceFt} ft (Max: ${speedFt} ft)`
    : `${distanceFt} ft`;

  ctx.font = 'bold 13px Inter, sans-serif';
  const textMetrics = ctx.measureText(label);
  const paddingX = 10;
  const paddingY = 6;
  const badgeWidth = textMetrics.width + paddingX * 2;
  const badgeHeight = 26;

  // Badge background
  ctx.fillStyle = isOverSpeed ? 'rgba(127, 29, 29, 0.9)' : 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(
    midX - badgeWidth / 2,
    midY - badgeHeight / 2 - 14,
    badgeWidth,
    badgeHeight,
    6
  );
  ctx.fill();
  ctx.stroke();

  // Badge text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, midX, midY - 14);

  ctx.restore();
}
