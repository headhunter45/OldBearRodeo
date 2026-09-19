import { Token } from '@oldbear/shared';

const imageCache = new Map<string, HTMLImageElement>();

export function getCachedImage(url?: string): HTMLImageElement | null {
  if (!url) return null;
  let img = imageCache.get(url);
  if (!img) {
    img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    imageCache.set(url, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export function traceTokenShape(
  ctx: CanvasRenderingContext2D,
  shape: 'circle' | 'square' | 'rounded' | 'hexagon' | 'octagon',
  radius: number
) {
  ctx.beginPath();
  switch (shape) {
    case 'square':
      ctx.rect(-radius, -radius, radius * 2, radius * 2);
      break;
    case 'rounded':
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-radius, -radius, radius * 2, radius * 2, radius * 0.28);
      } else {
        ctx.rect(-radius, -radius, radius * 2, radius * 2);
      }
      break;
    case 'hexagon':
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    case 'octagon':
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i + Math.PI / 8;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    case 'circle':
    default:
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      break;
  }
}

export function renderToken(
  ctx: CanvasRenderingContext2D,
  token: Token,
  gridSize: number,
  isSelected: boolean,
  canControl: boolean,
  isGm: boolean
) {
  const isProp = Boolean(token.isProp);
  const propW = (isProp && token.propWidth !== undefined ? token.propWidth : token.size) * gridSize;
  const propH = (isProp && token.propHeight !== undefined ? token.propHeight : token.size) * gridSize;
  const cx = token.x + propW / 2;
  const cy = token.y + propH / 2;

  // Custom rendering for props (walls, furniture, carpets, decorative items)
  if (isProp) {
    ctx.save();
    ctx.translate(cx, cy);
    if (token.rotation) {
      ctx.rotate((token.rotation * Math.PI) / 180);
    }

    // Selection glow
    if (isSelected) {
      ctx.save();
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#6366f1';
      ctx.shadowBlur = 12;
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(-propW / 2 - 3, -propH / 2 - 3, propW + 6, propH + 6, 4);
        ctx.stroke();
      } else {
        ctx.strokeRect(-propW / 2 - 3, -propH / 2 - 3, propW + 6, propH + 6);
      }
      ctx.restore();
    }

    // Draw prop image or fallback block
    const img = getCachedImage(token.imageUrl);
    if (img) {
      ctx.drawImage(img, -propW / 2, -propH / 2, propW, propH);
    } else {
      ctx.fillStyle = token.fillColor || 'rgba(30, 41, 59, 0.85)';
      ctx.fillRect(-propW / 2, -propH / 2, propW, propH);
      ctx.strokeStyle = token.ringColor || '#eab308';
      ctx.lineWidth = 2;
      ctx.strokeRect(-propW / 2, -propH / 2, propW, propH);

      ctx.fillStyle = '#f8fafc';
      ctx.font = `600 ${Math.max(11, Math.min(propW, propH) * 0.2)}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(token.name || 'Prop', 0, 0);
    }

    // Optional border if ringColor is explicitly set
    if (token.ringColor && token.ringColor !== 'transparent') {
      ctx.strokeStyle = token.ringColor;
      ctx.lineWidth = Math.max(1, token.borderWidth || 2);
      ctx.strokeRect(-propW / 2, -propH / 2, propW, propH);
    }

    ctx.restore();

    // Render name label for props when selected or GM
    if (isSelected && token.name) {
      renderTokenLabel(ctx, token.name, cx, cy + propH / 2 + 12);
    }
    return;
  }

  const tokenDiameter = token.size * gridSize;
  const radius = tokenDiameter / 2;
  const shape = token.clipShape || (token.clipCircle === false ? 'square' : 'circle');
  const bWidth = token.borderWidth || Math.max(3, tokenDiameter * 0.05);

  ctx.save();
  ctx.translate(cx, cy);
  if (token.rotation) {
    ctx.rotate((token.rotation * Math.PI) / 180);
  }

  // 1. Selection Glow
  if (isSelected) {
    traceTokenShape(ctx, shape, radius + 4);
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#6366f1';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // 2. Token Base Background Fill
  traceTokenShape(ctx, shape, radius);
  ctx.fillStyle = token.fillColor || '#1e293b';
  ctx.fill();

  // 3. Clipped Image (or initials)
  const img = getCachedImage(token.imageUrl);
  ctx.save();
  traceTokenShape(ctx, shape, radius - bWidth / 2);
  ctx.clip();

  if (img) {
    const zoom = token.clipZoom || 1.0;
    const panX = ((token.clipPanX || 0) / 100) * radius;
    const panY = ((token.clipPanY || 0) / 100) * radius;
    const drawSize = tokenDiameter * zoom;
    const drawX = -drawSize / 2 + panX;
    const drawY = -drawSize / 2 + panY;
    ctx.drawImage(img, drawX, drawY, drawSize, drawSize);
  } else {
    // Elegant fallback avatar with initials
    ctx.fillStyle = token.fillColor || '#334155';
    ctx.fillRect(-radius, -radius, tokenDiameter, tokenDiameter);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(14, radius * 0.55)}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initials = token.name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
    ctx.fillText(initials || '?', 0, 0);
  }
  ctx.restore();

  // 4. Outer Ring
  traceTokenShape(ctx, shape, radius - bWidth / 2);
  ctx.strokeStyle = token.ringColor || '#64748b';
  ctx.lineWidth = bWidth;
  ctx.stroke();

  // 5. Conditions / Statuses
  if (token.conditions && token.conditions.length > 0) {
    renderConditionBadges(ctx, token.conditions, radius);
  }

  ctx.restore(); // restore rotation & translation

  // 6. Health Bar (render unrotated in world space above token)
  renderHealthBar(ctx, token, cx, cy - radius - 14, tokenDiameter, isGm || canControl);

  // 7. Token Name Label
  renderTokenLabel(ctx, token.name, cx, cy + radius + 12);
}

function renderHealthBar(
  ctx: CanvasRenderingContext2D,
  token: Token,
  cx: number,
  y: number,
  width: number,
  showNumericHp: boolean
) {
  if (token.isProp) return;

  const barWidth = Math.max(width * 0.9, 44);
  const barHeight = 7;
  const x = cx - barWidth / 2;

  const max = Math.max(1, token.maxHp || 1);
  const current = Math.max(0, token.currentHp || 0);
  const temp = Math.max(0, token.tempHp || 0);

  const hpRatio = Math.min(1, current / max);
  const tempRatio = Math.min(1, temp / max);

  // Background
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, barWidth, barHeight, 3);
  ctx.fill();
  ctx.stroke();

  // Current HP fill
  let hpColor = '#10b981'; // green
  if (hpRatio <= 0.25) hpColor = '#ef4444'; // red
  else if (hpRatio <= 0.5) hpColor = '#f59e0b'; // amber

  if (hpRatio > 0) {
    ctx.fillStyle = hpColor;
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, (barWidth - 1) * hpRatio, barHeight - 1, 2);
    ctx.fill();
  }

  // Temp HP overlay in sky blue
  if (tempRatio > 0) {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, (barWidth - 1) * tempRatio, barHeight - 1, 2);
    ctx.fill();
  }

  // Numeric text ONLY for GM or owner
  if (showNumericHp) {
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const hpText = temp > 0 ? `${current}+${temp}/${max}` : `${current}/${max}`;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(hpText, cx, y - 6);
  }

  ctx.restore();
}

function renderTokenLabel(ctx: CanvasRenderingContext2D, name: string, cx: number, y: number) {
  ctx.save();
  ctx.font = '600 11px Inter, sans-serif';
  const metrics = ctx.measureText(name);
  const pw = metrics.width + 10;
  const ph = 18;

  ctx.fillStyle = 'rgba(11, 15, 25, 0.85)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cx - pw / 2, y - ph / 2, pw, ph, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, cx, y);
  ctx.restore();
}

const CONDITION_STYLES: Record<string, { bg: string; text: string; code: string }> = {
  Poisoned: { bg: '#16a34a', text: '#ffffff', code: 'Po' },
  Stunned: { bg: '#ca8a04', text: '#ffffff', code: 'St' },
  Blinded: { bg: '#9333ea', text: '#ffffff', code: 'Bl' },
  Charmed: { bg: '#db2777', text: '#ffffff', code: 'Ch' },
  Prone: { bg: '#ea580c', text: '#ffffff', code: 'Pr' },
  Concentrating: { bg: '#0284c7', text: '#ffffff', code: 'Co' },
  Invisible: { bg: '#0d9488', text: '#ffffff', code: 'In' },
  Paralyzed: { bg: '#dc2626', text: '#ffffff', code: 'Pa' },
  Frightened: { bg: '#e11d48', text: '#ffffff', code: 'Fr' },
  Unconscious: { bg: '#7f1d1d', text: '#ffffff', code: 'Un' },
  Exhaustion: { bg: '#475569', text: '#ffffff', code: 'Ex' },
  Deafened: { bg: '#7c3aed', text: '#ffffff', code: 'De' },
  Grappled: { bg: '#c2410c', text: '#ffffff', code: 'Gr' },
  Restrained: { bg: '#b91c1c', text: '#ffffff', code: 'Re' },
  Petrified: { bg: '#52525b', text: '#ffffff', code: 'Pe' },
  Incapacitated: { bg: '#991b1b', text: '#ffffff', code: 'Ic' },
};

function renderConditionBadges(ctx: CanvasRenderingContext2D, conditions: string[], radius: number) {
  const badgeRadius = Math.max(9, radius * 0.22);
  const startAngle = Math.PI / 5; // top right
  const angleStep = Math.PI / 6;

  conditions.forEach((cond, i) => {
    const style = CONDITION_STYLES[cond] || {
      bg: '#6366f1',
      text: '#ffffff',
      code: cond.slice(0, 2).toUpperCase(),
    };

    const angle = startAngle + i * angleStep;
    const bx = Math.cos(angle) * (radius - 2);
    const by = -Math.sin(angle) * (radius - 2);

    ctx.save();
    ctx.beginPath();
    ctx.arc(bx, by, badgeRadius, 0, Math.PI * 2);
    ctx.fillStyle = style.bg;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.fillStyle = style.text;
    ctx.font = `bold ${Math.max(9, badgeRadius * 0.95)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.code, bx, by);
    ctx.restore();
  });
}
