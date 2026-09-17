import { ScreenMarker } from '@oldbear/shared';

export function renderMarkers(
  ctx: CanvasRenderingContext2D,
  markers: ScreenMarker[],
  now: number,
  gridSize: number = 50,
  scaleFtPerCell: number = 5
): ScreenMarker[] {
  // Return non-expired markers
  const activeMarkers: ScreenMarker[] = [];

  for (const marker of markers) {
    const elapsed = now - marker.createdAt;
    if (elapsed > marker.durationMs) {
      continue;
    }
    activeMarkers.push(marker);

    const progress = elapsed / marker.durationMs;
    const alpha = Math.max(0, 1 - progress);

    ctx.save();
    ctx.globalAlpha = alpha;

    switch (marker.type) {
      case 'laser':
        renderLaser(ctx, marker);
        break;
      case 'arrow':
        renderArrow(ctx, marker);
        break;
      case 'crosshair':
        renderCrosshair(ctx, marker, elapsed);
        break;
      case 'circle':
        renderCircle(ctx, marker, gridSize, scaleFtPerCell);
        break;
      case 'rectangle':
        renderRectangle(ctx, marker, gridSize, scaleFtPerCell);
        break;
    }

    ctx.restore();
  }

  return activeMarkers;
}

function renderLaser(ctx: CanvasRenderingContext2D, marker: ScreenMarker) {
  const points = marker.points || [{ x: marker.x, y: marker.y }];
  if (points.length < 2) {
    // Single laser point dot
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = marker.color;
    ctx.shadowColor = marker.color;
    ctx.shadowBlur = 12;
    ctx.fill();
    return;
  }

  // Draw smooth fading trail
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = marker.color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = marker.color;
  ctx.shadowBlur = 10;
  ctx.stroke();

  // Head dot
  const head = points[points.length - 1];
  ctx.beginPath();
  ctx.arc(head.x, head.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

function renderArrow(ctx: CanvasRenderingContext2D, marker: ScreenMarker) {
  const targetX = marker.targetX ?? marker.x;
  const targetY = marker.targetY ?? marker.y;
  const fromX = marker.x;
  const fromY = marker.y;

  const angle = Math.atan2(targetY - fromY, targetX - fromX);
  const headLen = 16;

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(targetX, targetY);
  ctx.strokeStyle = marker.color;
  ctx.lineWidth = 4;
  ctx.shadowColor = marker.color;
  ctx.shadowBlur = 8;
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(targetX, targetY);
  ctx.lineTo(
    targetX - headLen * Math.cos(angle - Math.PI / 6),
    targetY - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    targetX - headLen * Math.cos(angle + Math.PI / 6),
    targetY - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fillStyle = marker.color;
  ctx.fill();

  // User label
  renderUserLabel(ctx, marker.userName, fromX, fromY - 10, marker.color);
}

function renderCrosshair(ctx: CanvasRenderingContext2D, marker: ScreenMarker, elapsed: number) {
  const { x, y, color } = marker;
  const size = 18;
  const pulse = Math.sin(elapsed / 150) * 3;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;

  // Crosshair lines
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x + size, y);
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y + size);
  ctx.stroke();

  // Outer pulsating circle
  ctx.beginPath();
  ctx.arc(x, y, size + 4 + pulse, 0, Math.PI * 2);
  ctx.stroke();

  renderUserLabel(ctx, marker.userName, x, y - size - 12, color);
}

function renderCircle(
  ctx: CanvasRenderingContext2D,
  marker: ScreenMarker,
  gridSize: number,
  scaleFtPerCell: number
) {
  const { x, y, radius = 50, color } = marker;
  const radiusFt = Math.round((radius / gridSize) * scaleFtPerCell);

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(color, 0.2);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 4]);
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.stroke();

  // Center point
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Radius label
  const label = `${radiusFt} ft radius`;
  renderUserLabel(ctx, `${marker.userName}: ${label}`, x, y - radius - 10, color);
}

function renderRectangle(
  ctx: CanvasRenderingContext2D,
  marker: ScreenMarker,
  gridSize: number,
  scaleFtPerCell: number
) {
  const { x, y, width = 100, height = 100, color } = marker;
  const widthFt = Math.round((Math.abs(width) / gridSize) * scaleFtPerCell);
  const heightFt = Math.round((Math.abs(height) / gridSize) * scaleFtPerCell);

  ctx.fillStyle = hexToRgba(color, 0.2);
  ctx.fillRect(x, y, width, height);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 4]);
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.strokeRect(x, y, width, height);

  const label = `${widthFt}ft × ${heightFt}ft`;
  renderUserLabel(ctx, `${marker.userName}: ${label}`, x + width / 2, y - 10, color);
}

function renderUserLabel(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  color: string
) {
  ctx.save();
  ctx.font = '500 11px Inter, sans-serif';
  const metrics = ctx.measureText(name);
  const pw = metrics.width + 10;
  const ph = 18;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - pw / 2, y - ph / 2, pw, ph, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, x, y);
  ctx.restore();
}

function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith('rgba')) return hex;
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
