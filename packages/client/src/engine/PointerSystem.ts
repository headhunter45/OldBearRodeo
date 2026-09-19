import { ScreenMarker } from '@oldbear/shared';

export function renderMarkers(
  ctx: CanvasRenderingContext2D,
  markers: ScreenMarker[],
  now: number,
  gridSize: number = 50,
  scaleFtPerCell: number = 5,
  selectedMarkerId: string | null = null
): ScreenMarker[] {
  // Return non-expired or persistent markers
  const activeMarkers: ScreenMarker[] = [];

  for (const marker of markers) {
    const elapsed = now - marker.createdAt;
    const isPersist = Boolean(marker.persist);

    if (!isPersist && elapsed > marker.durationMs) {
      continue;
    }
    activeMarkers.push(marker);

    const progress = elapsed / (marker.durationMs || 1);
    const alpha = isPersist ? 1 : Math.max(0, 1 - progress);
    const isSelected = selectedMarkerId === marker.id;

    ctx.save();
    ctx.globalAlpha = alpha;

    switch (marker.type) {
      case 'laser':
        renderLaser(ctx, marker);
        break;
      case 'arrow':
        renderArrow(ctx, marker, isSelected);
        break;
      case 'crosshair':
        renderCrosshair(ctx, marker, elapsed, isSelected);
        break;
      case 'circle':
        renderCircle(ctx, marker, gridSize, scaleFtPerCell, isSelected);
        break;
      case 'rectangle':
        renderRectangle(ctx, marker, gridSize, scaleFtPerCell, isSelected);
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

function renderArrow(ctx: CanvasRenderingContext2D, marker: ScreenMarker, isSelected?: boolean) {
  const targetX = marker.targetX ?? marker.x;
  const targetY = marker.targetY ?? marker.y;
  const fromX = marker.x;
  const fromY = marker.y;

  const angle = Math.atan2(targetY - fromY, targetX - fromX);
  const headLen = 16;

  if (isSelected) {
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    ctx.restore();
  }

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
  const labelPrefix = marker.locked ? '🔒 ' : marker.persist ? '📌 ' : '';
  renderUserLabel(ctx, `${labelPrefix}${marker.userName}`, fromX, fromY - 10, marker.color);
}

function renderCrosshair(ctx: CanvasRenderingContext2D, marker: ScreenMarker, elapsed: number, isSelected?: boolean) {
  const { x, y, color } = marker;
  const size = 18;
  const pulse = Math.sin(elapsed / 150) * 3;

  if (isSelected) {
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, size + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

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

  const labelPrefix = marker.locked ? '🔒 ' : marker.persist ? '📌 ' : '';
  renderUserLabel(ctx, `${labelPrefix}${marker.userName}`, x, y - size - 12, color);
}

function renderCircle(
  ctx: CanvasRenderingContext2D,
  marker: ScreenMarker,
  gridSize: number,
  scaleFtPerCell: number,
  isSelected?: boolean
) {
  const { x, y, radius = 50, color } = marker;
  const radiusFt = Math.round((radius / gridSize) * scaleFtPerCell);

  if (isSelected) {
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

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
  const labelPrefix = marker.locked ? '🔒 ' : marker.persist ? '📌 ' : '';
  const label = `${radiusFt} ft radius`;
  renderUserLabel(ctx, `${labelPrefix}${marker.userName}: ${label}`, x, y - radius - 10, color);
}

function renderRectangle(
  ctx: CanvasRenderingContext2D,
  marker: ScreenMarker,
  gridSize: number,
  scaleFtPerCell: number,
  isSelected?: boolean
) {
  const { x, y, width = 100, height = 100, color } = marker;
  const widthFt = Math.round((Math.abs(width) / gridSize) * scaleFtPerCell);
  const heightFt = Math.round((Math.abs(height) / gridSize) * scaleFtPerCell);

  if (isSelected) {
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3.5;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(x - 5, y - 5, width + 10, height + 10);
    ctx.restore();
  }

  ctx.fillStyle = hexToRgba(color, 0.2);
  ctx.fillRect(x, y, width, height);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 4]);
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.strokeRect(x, y, width, height);

  const labelPrefix = marker.locked ? '🔒 ' : marker.persist ? '📌 ' : '';
  const label = `${widthFt}ft × ${heightFt}ft`;
  renderUserLabel(ctx, `${labelPrefix}${marker.userName}: ${label}`, x + width / 2, y - 10, color);
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

export function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith('rgba')) return hex;
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
