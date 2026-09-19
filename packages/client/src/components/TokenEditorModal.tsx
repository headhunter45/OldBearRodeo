import React, { useState, useEffect, useRef } from 'react';
import { Token, Player } from '@oldbear/shared';
import { X, Upload, Check, ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';
import { saveAsset } from '../storage/db.js';
import { traceTokenShape } from '../engine/TokenRenderer.js';

interface TokenEditorModalProps {
  token: Token;
  onClose: () => void;
  onSave: (updates: Partial<Token>) => void;
  players: Player[];
  isGm: boolean;
}

const RING_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b', '#ffffff'];
const FILL_COLORS = ['#0f172a', '#1e293b', '#1e3a8a', '#7f1d1d', '#064e3b', '#78350f', '#581c87', '#000000'];

const ALL_CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated',
  'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained',
  'Stunned', 'Unconscious', 'Concentrating', 'Exhaustion'
];

export const TokenEditorModal: React.FC<TokenEditorModalProps> = ({
  token,
  onClose,
  onSave,
  players,
  isGm,
}) => {
  const [name, setName] = useState(token.name);
  const [imageUrl, setImageUrl] = useState(token.imageUrl || '');
  const [size, setSize] = useState(token.size);
  const [speed, setSpeed] = useState(token.speed || 30);
  const [currentHp, setCurrentHp] = useState(token.currentHp);
  const [maxHp, setMaxHp] = useState(token.maxHp);
  const [tempHp, setTempHp] = useState(token.tempHp || 0);
  const [ringColor, setRingColor] = useState(token.ringColor || '#3b82f6');
  const [fillColor, setFillColor] = useState(token.fillColor || '#1e293b');
  const [ownerId, setOwnerId] = useState(token.ownerId || '');
  const [isPlayerToken, setIsPlayerToken] = useState(token.isPlayerToken || token.ownerId === 'unassigned');
  const [clipShape, setClipShape] = useState<'circle' | 'square' | 'rounded' | 'hexagon' | 'octagon'>(
    token.clipShape || (token.clipCircle === false ? 'square' : 'circle')
  );
  const [borderWidth, setBorderWidth] = useState(token.borderWidth || 4);
  const [clipZoom, setClipZoom] = useState(token.clipZoom || 1.0);
  const [clipPanX, setClipPanX] = useState(token.clipPanX || 0);
  const [clipPanY, setClipPanY] = useState(token.clipPanY || 0);
  const [isProp, setIsProp] = useState(token.isProp || false);
  const [conditions, setConditions] = useState<string[]>(token.conditions || []);

  const [previewImg, setPreviewImg] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const touchDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(1);

  // Load preview image element
  useEffect(() => {
    if (!imageUrl) {
      setPreviewImg(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setPreviewImg(img);
    img.onerror = () => setPreviewImg(null);
    img.src = imageUrl;
  }, [imageUrl]);

  // Render interactive canvas preview with shape clipping, zoom, pan, and border (Bug #72)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = (w - 20) / 2;

    ctx.clearRect(0, 0, w, h);

    // Dark backdrop with subtle grid
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(cx, cy);

    const zoom = clipZoom;
    const panX = (clipPanX / 100) * r;
    const panY = (clipPanY / 100) * r;
    const drawSize = r * 2 * zoom;

    if (previewImg) {
      // 1. Draw entire uncropped image lightly dimmed in background to show cropping area
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.drawImage(previewImg, -drawSize / 2 + panX, -drawSize / 2 + panY, drawSize, drawSize);
      ctx.restore();
    }

    // 2. Token base background
    traceTokenShape(ctx, clipShape, r);
    ctx.fillStyle = fillColor;
    ctx.fill();

    // 3. Clipped image / initials
    ctx.save();
    traceTokenShape(ctx, clipShape, r - borderWidth / 2);
    ctx.clip();

    if (previewImg) {
      ctx.drawImage(previewImg, -drawSize / 2 + panX, -drawSize / 2 + panY, drawSize, drawSize);
    } else {
      ctx.fillStyle = fillColor;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(22, r * 0.5)}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initials = name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();
      ctx.fillText(initials || '?', 0, 0);
    }
    ctx.restore();

    // 4. Outer Ring
    traceTokenShape(ctx, clipShape, r - borderWidth / 2);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = borderWidth;
    ctx.stroke();

    // 5. Guides when dragging
    if (isDragging) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.moveTo(0, -r);
      ctx.lineTo(0, r);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }, [previewImg, clipShape, borderWidth, ringColor, fillColor, clipZoom, clipPanX, clipPanY, name, isDragging]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: clipPanX,
      panY: clipPanY,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    const r = (180 - 20) / 2;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const nextPanX = Math.round(Math.max(-100, Math.min(100, dragStartRef.current.panX + (dx / r) * 100)));
    const nextPanY = Math.round(Math.max(-100, Math.min(100, dragStartRef.current.panY + (dy / r) * 100)));
    setClipPanX(nextPanX);
    setClipPanY(nextPanY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setClipZoom((prev) => Math.max(0.5, Math.min(4.0, Number((prev + delta).toFixed(2)))));
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        panX: clipPanX,
        panY: clipPanY,
      };
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistRef.current = dist;
      touchStartZoomRef.current = clipZoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && isDragging && dragStartRef.current) {
      const r = (180 - 20) / 2;
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      const nextPanX = Math.round(Math.max(-100, Math.min(100, dragStartRef.current.panX + (dx / r) * 100)));
      const nextPanY = Math.round(Math.max(-100, Math.min(100, dragStartRef.current.panY + (dy / r) * 100)));
      setClipPanX(nextPanX);
      setClipPanY(nextPanY);
    } else if (e.touches.length === 2 && touchDistRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = dist / touchDistRef.current;
      setClipZoom(Math.max(0.5, Math.min(4.0, Number((touchStartZoomRef.current * scale).toFixed(2)))));
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    dragStartRef.current = null;
    touchDistRef.current = null;
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setImageUrl(dataUrl);
      // Save asset to local browser IndexedDB
      await saveAsset({
        id: crypto.randomUUID(),
        name: file.name,
        type: isProp ? 'prop' : 'token',
        dataUrl,
        isProp,
        layer: isProp ? 'prop' : 'token',
        createdAt: Date.now(),
      });
    };
    reader.readAsDataURL(file);
  };

  const toggleCondition = (c: string) => {
    setConditions((prev) =>
      prev.includes(c) ? prev.filter((item) => item !== c) : [...prev, c]
    );
  };

  const handleSave = () => {
    onSave({
      name,
      imageUrl,
      size: Number(size),
      speed: Number(speed),
      currentHp: Number(currentHp),
      maxHp: Number(maxHp),
      tempHp: Number(tempHp),
      ringColor,
      fillColor,
      clipCircle: clipShape === 'circle',
      clipShape,
      borderWidth: Number(borderWidth),
      clipZoom: Number(clipZoom),
      clipPanX: Number(clipPanX),
      clipPanY: Number(clipPanY),
      ownerId: ownerId || (isPlayerToken ? 'unassigned' : undefined),
      isPlayerToken,
      isProp,
      conditions,
    });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel-elevated animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.5rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700 }}>
            Edit Token
          </h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Token Preview & Interactive Cropper (Bug #72) */}
        <div style={{ marginBottom: '1.25rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', padding: '1rem', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Move size={15} /> Token Preview & Crop
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setClipZoom((z) => Math.min(4.0, Number((z + 0.1).toFixed(2))))}
                title="Zoom In"
                style={{ width: '28px', height: '28px' }}
              >
                <ZoomIn size={15} />
              </button>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setClipZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))}
                title="Zoom Out"
                style={{ width: '28px', height: '28px' }}
              >
                <ZoomOut size={15} />
              </button>
              <button
                type="button"
                className="btn-icon"
                onClick={() => {
                  setClipZoom(1.0);
                  setClipPanX(0);
                  setClipPanY(0);
                }}
                title="Reset Crop & Pan"
                style={{ width: '28px', height: '28px' }}
              >
                <RotateCcw size={15} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div
              style={{
                position: 'relative',
                width: '180px',
                height: '180px',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: '#090d16',
                border: '1px solid var(--border-subtle)',
                cursor: isDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                userSelect: 'none',
                boxShadow: `0 4px 20px ${ringColor}22`,
                flexShrink: 0,
              }}
            >
              <canvas
                ref={canvasRef}
                width={180}
                height={180}
                style={{ width: '100%', height: '100%', display: 'block' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: '4px',
                  right: '6px',
                  fontSize: '0.65rem',
                  color: 'rgba(255, 255, 255, 0.7)',
                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  pointerEvents: 'none',
                }}
              >
                {clipZoom.toFixed(1)}x
              </div>
            </div>

            <div style={{ flex: 1, minWidth: '180px' }}>
              <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', marginBottom: '0.6rem' }}>
                <Upload size={16} /> Upload Image
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />
              </label>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>• Drag</span> preview to pan image.
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>• Scroll or pinch</span> to zoom in/out.
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                Dimmed area shows full picture outside the token border.
              </div>
            </div>
          </div>
        </div>

        {/* Ring & Fill Color Palettes */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Ring Color</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
            {RING_COLORS.map((c) => (
              <div
                key={c}
                onClick={() => setRingColor(c)}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: c,
                  cursor: 'pointer',
                  border: ringColor === c ? '2px solid white' : '1px solid transparent',
                  transform: ringColor === c ? 'scale(1.15)' : 'none',
                  transition: 'transform 0.15s',
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Background Fill Color</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
            {FILL_COLORS.map((c) => (
              <div
                key={c}
                onClick={() => setFillColor(c)}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: c,
                  cursor: 'pointer',
                  border: fillColor === c ? '2px solid white' : '1px solid transparent',
                  transform: fillColor === c ? 'scale(1.15)' : 'none',
                  transition: 'transform 0.15s',
                }}
              />
            ))}
          </div>
        </div>

        {/* Form Inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Token Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'white',
                marginTop: '0.25rem',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Speed (ft)</label>
            <input
              type="number"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'white',
                marginTop: '0.25rem',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Current HP</label>
            <input
              type="number"
              value={currentHp}
              onChange={(e) => setCurrentHp(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'white',
                marginTop: '0.25rem',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Max HP</label>
            <input
              type="number"
              value={maxHp}
              onChange={(e) => setMaxHp(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'white',
                marginTop: '0.25rem',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Size (Grid cells)</label>
            <select
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'white',
                marginTop: '0.25rem',
              }}
            >
              <option value={1}>1x1 (Medium)</option>
              <option value={2}>2x2 (Large)</option>
              <option value={3}>3x3 (Huge)</option>
              <option value={4}>4x4 (Gargantuan)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Border Shape</label>
            <select
              value={clipShape}
              onChange={(e) => setClipShape(e.target.value as any)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'white',
                marginTop: '0.25rem',
              }}
            >
              <option value="circle">Circle</option>
              <option value="square">Square</option>
              <option value="rounded">Rounded Square</option>
              <option value="hexagon">Hexagon</option>
              <option value="octagon">Octagon</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Border Width ({borderWidth}px)
            </label>
            <input
              type="range"
              min="1"
              max="16"
              step="1"
              value={borderWidth}
              onChange={(e) => setBorderWidth(Number(e.target.value))}
              style={{ width: '100%', marginTop: '0.4rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Image Zoom ({clipZoom.toFixed(2)}x)
            </label>
            <input
              type="range"
              min="0.5"
              max="4.0"
              step="0.05"
              value={clipZoom}
              onChange={(e) => setClipZoom(Number(e.target.value))}
              style={{ width: '100%', marginTop: '0.4rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Pan Image (X: {clipPanX}%, Y: {clipPanY}%)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={clipPanX}
                onChange={(e) => setClipPanX(Number(e.target.value))}
                title="Pan X"
                style={{ flex: 1 }}
              />
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={clipPanY}
                onChange={(e) => setClipPanY(Number(e.target.value))}
                title="Pan Y"
                style={{ flex: 1 }}
              />
            </div>
          </div>

          {isGm && (
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Assigned Player & Ownership</label>
              <select
                value={ownerId}
                onChange={(e) => {
                  const val = e.target.value;
                  setOwnerId(val);
                  setIsPlayerToken(val !== '');
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'white',
                  marginTop: '0.25rem',
                }}
              >
                <option value="">GM Only (NPC / Monster)</option>
                <option value="unassigned">⭐ Unclaimed Player Token (Any player can choose upon joining)</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    Player: {p.name} ({p.role})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Conditions Selector */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
            Conditions & Statuses
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {ALL_CONDITIONS.map((c) => {
              const active = conditions.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCondition(c)}
                  style={{
                    fontSize: '0.75rem',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid',
                    borderColor: active ? '#f43f5e' : 'var(--border-subtle)',
                    backgroundColor: active ? 'rgba(244, 63, 94, 0.2)' : 'var(--bg-surface)',
                    color: active ? '#f43f5e' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {/* Prop toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <input
            type="checkbox"
            id="isPropCheck"
            checked={isProp}
            onChange={(e) => setIsProp(e.target.checked)}
          />
          <label htmlFor="isPropCheck" style={{ fontSize: '0.875rem' }}>
            Treat as Map Prop (no health bar)
          </label>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Check size={16} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
