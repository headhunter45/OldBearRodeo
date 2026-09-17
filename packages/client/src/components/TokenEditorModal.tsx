import React, { useState } from 'react';
import { Token, Player } from '@oldbear/shared';
import { X, Upload, Check } from 'lucide-react';
import { saveAsset } from '../storage/db.js';

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
  const [isProp, setIsProp] = useState(token.isProp || false);
  const [conditions, setConditions] = useState<string[]>(token.conditions || []);

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
        type: 'token',
        dataUrl,
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
      ownerId: ownerId || undefined,
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

        {/* Token Preview */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: fillColor,
              border: `4px solid ${ringColor}`,
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 0 15px ${ringColor}44`,
            }}
          >
            {imageUrl ? (
              <img src={imageUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '2rem', fontWeight: 'bold' }}>{name[0]?.toUpperCase() || '?'}</span>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
              <Upload size={16} /> Upload Image
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />
            </label>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              Images will be clipped to a circular token with a custom ring.
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

          {isGm && (
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Assigned Player</label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
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
                <option value="">GM Only</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role})
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
