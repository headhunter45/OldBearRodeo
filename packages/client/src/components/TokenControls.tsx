import React, { useRef, useState } from 'react';
import { Token, Player, GameMap } from '@oldbear/shared';
import { Heart, Shield, Plus, Minus, Settings, Trash2, ArrowRightLeft, Copy, UserCheck, Swords, RotateCw, Lock, Unlock } from 'lucide-react';

interface TokenControlsProps {
  token: Token;
  selectedTokens?: Token[];
  onUpdateToken: (id: string, updates: Partial<Token>) => void;
  onDeleteToken: (id: string) => void;
  onDuplicateToken?: (token: Token) => void;
  onDuplicateTokens?: (tokens: Token[]) => void;
  onTransferToken: (id: string, toMapId: string) => void;
  onSetInitiative?: (token: Token, score: number) => void;
  onOpenFullEditor: () => void;
  canControl: boolean;
  isGm: boolean;
  maps: GameMap[];
  players?: Player[];
}

const ALL_CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated',
  'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained',
  'Stunned', 'Unconscious', 'Concentrating', 'Exhaustion'
];

export const RotationCompass: React.FC<{
  rotation: number;
  onChange: (deg: number) => void;
}> = ({ rotation, onChange }) => {
  const compassRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const calculateAngle = (clientX: number, clientY: number) => {
    if (!compassRef.current) return;
    const rect = compassRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const deg = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI + 90;
    const normalized = Math.round((deg + 360) % 360);
    onChange(normalized);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    calculateAngle(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    calculateAngle(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  return (
    <div
      ref={compassRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        width: '26px',
        height: '26px',
        borderRadius: '50%',
        border: '1.5px solid rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'grab',
        touchAction: 'none',
        flexShrink: 0,
      }}
      title="Drag to rotate"
    >
      {/* North dot */}
      <div
        style={{
          position: 'absolute',
          top: '2px',
          width: '3px',
          height: '3px',
          borderRadius: '50%',
          backgroundColor: '#94a3b8',
        }}
      />
      {/* Rotating arrow indicator */}
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          transform: `rotate(${rotation}deg)`,
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '0',
            height: '0',
            borderLeft: '3.5px solid transparent',
            borderRight: '3.5px solid transparent',
            borderBottom: '8px solid #6366f1',
            marginTop: '3px',
          }}
        />
      </div>
    </div>
  );
};

export const TokenControls: React.FC<TokenControlsProps> = ({
  token,
  selectedTokens,
  onUpdateToken,
  onDeleteToken,
  onDuplicateToken,
  onDuplicateTokens,
  onTransferToken,
  onSetInitiative,
  onOpenFullEditor,
  canControl,
  isGm,
  maps,
  players = [],
}) => {
  if (!canControl && !isGm) return null;

  const handleHpDelta = (delta: number) => {
    const newHp = Math.max(0, Math.min(token.maxHp, token.currentHp + delta));
    onUpdateToken(token.id, { currentHp: newHp });
  };

  const toggleCondition = (cond: string) => {
    const existing = token.conditions || [];
    const updated = existing.includes(cond)
      ? existing.filter((c) => c !== cond)
      : [...existing, cond];
    onUpdateToken(token.id, { conditions: updated });
  };

  return (
    <div
      className="floating-hud glass-panel animate-fade-in"
      style={{
        bottom: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '0.6rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        maxWidth: '92vw',
        overflowX: 'auto',
      }}
    >
      {/* Token Identity: Square, Non-Squished Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        {token.imageUrl ? (
          <img
            src={token.imageUrl}
            alt={token.name}
            style={{
              width: '36px',
              height: '36px',
              minWidth: '36px',
              borderRadius: 'var(--radius-sm)',
              border: `2px solid ${token.ringColor || '#64748b'}`,
              objectFit: 'cover',
              aspectRatio: '1 / 1',
              flexShrink: 0,
              backgroundColor: token.fillColor || '#1e293b',
            }}
          />
        ) : (
          <div
            style={{
              width: '36px',
              height: '36px',
              minWidth: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: token.fillColor || '#1e293b',
              border: `2px solid ${token.ringColor || '#64748b'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '13px',
              flexShrink: 0,
              aspectRatio: '1 / 1',
            }}
          >
            {token.name[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>{token.name}</span>
            {selectedTokens && selectedTokens.length > 1 && (
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  backgroundColor: 'var(--accent-primary)',
                  color: 'white',
                  padding: '1px 6px',
                  borderRadius: '999px',
                }}
              >
                +{selectedTokens.length - 1} more
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {selectedTokens && selectedTokens.length > 1
              ? `${selectedTokens.length} items selected`
              : token.isProp
                ? `Size: ${token.propWidth ?? token.size}×${token.propHeight ?? token.size} tiles${token.locked ? ' | 🔒 Locked' : ''}`
                : `Speed: ${token.speed}ft | Size: ${token.size}x${token.locked ? ' | 🔒 Locked' : ''}`}
          </div>
        </div>
      </div>

      {/* HP Quick Controls & Temp HP (Only for characters/monsters, not props - Task #115) */}
      {!token.isProp && (
        <>
          <div style={{ width: '1px', height: '32px', background: 'var(--border-subtle)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Heart size={16} color="#ef4444" />
            <button
              className="btn-icon"
              style={{ width: '28px', height: '28px' }}
              onClick={() => handleHpDelta(-5)}
              title="Take 5 Damage"
            >
              -5
            </button>
            <button
              className="btn-icon"
              style={{ width: '28px', height: '28px' }}
              onClick={() => handleHpDelta(-1)}
              title="Take 1 Damage"
            >
              <Minus size={14} />
            </button>
            <span style={{ minWidth: '46px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.875rem' }}>
              {token.currentHp}/{token.maxHp}
            </span>
            <button
              className="btn-icon"
              style={{ width: '28px', height: '28px' }}
              onClick={() => handleHpDelta(1)}
              title="Heal 1 HP"
            >
              <Plus size={14} />
            </button>
            <button
              className="btn-icon"
              style={{ width: '28px', height: '28px' }}
              onClick={() => handleHpDelta(5)}
              title="Heal 5 HP"
            >
              +5
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span title="Temp HP" style={{ display: 'inline-flex' }}>
              <Shield size={16} color="#0ea5e9" />
            </span>
            <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: '600' }}>
              +{token.tempHp || 0}
            </span>
            <button
              className="btn-icon"
              style={{ width: '24px', height: '24px' }}
              onClick={() => onUpdateToken(token.id, { tempHp: (token.tempHp || 0) + 1 })}
              title="Add 1 Temp HP"
            >
              <Plus size={12} />
            </button>
            {(token.tempHp || 0) > 0 && (
              <button
                className="btn-icon"
                style={{ width: '24px', height: '24px' }}
                onClick={() => onUpdateToken(token.id, { tempHp: Math.max(0, (token.tempHp || 0) - 1) })}
                title="Subtract 1 Temp HP"
              >
                <Minus size={12} />
              </button>
            )}
          </div>
        </>
      )}

      {/* Active Condition Tags & Add Selector (Only for characters/monsters, not props - Task #115) */}
      {!token.isProp && (
        <>
          <div style={{ width: '1px', height: '32px', background: 'var(--border-subtle)' }} />
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {(token.conditions || []).map((cond) => (
              <span
                key={cond}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: '9999px',
                  border: '1px solid #f43f5e',
                  backgroundColor: 'rgba(244, 63, 94, 0.2)',
                  color: '#f43f5e',
                }}
              >
                {cond}
                <button
                  onClick={() => toggleCondition(cond)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f43f5e',
                    cursor: 'pointer',
                    fontSize: '11px',
                    padding: '0 2px',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                  title={`Remove ${cond}`}
                >
                  ✕
                </button>
              </span>
            ))}
            <select
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                outline: 'none',
              }}
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  toggleCondition(e.target.value);
                }
              }}
            >
              <option value="" disabled>
                + Add Status...
              </option>
              {ALL_CONDITIONS.filter((c) => !(token.conditions || []).includes(c)).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div style={{ width: '1px', height: '32px', background: 'var(--border-subtle)' }} />

      {/* Rotation Control with Degree Input & Drag Compass (Task #114 & #115) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <RotationCompass
          rotation={token.rotation || 0}
          onChange={(deg) => {
            if (selectedTokens && selectedTokens.length > 1) {
              selectedTokens.forEach((t) => onUpdateToken(t.id, { rotation: deg }));
            } else {
              onUpdateToken(token.id, { rotation: deg });
            }
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <input
            type="number"
            min={0}
            max={360}
            value={Math.round(token.rotation || 0)}
            onChange={(e) => {
              const deg = ((parseFloat(e.target.value) || 0) % 360 + 360) % 360;
              if (selectedTokens && selectedTokens.length > 1) {
                selectedTokens.forEach((t) => onUpdateToken(t.id, { rotation: deg }));
              } else {
                onUpdateToken(token.id, { rotation: deg });
              }
            }}
            style={{
              width: '42px',
              padding: '2px 4px',
              fontSize: '0.78rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'white',
              textAlign: 'center',
            }}
            title="Rotation in degrees (0 - 360°)"
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>°</span>
        </div>
      </div>

      <div style={{ width: '1px', height: '32px', background: 'var(--border-subtle)' }} />

      {/* Full Editor Modal, Duplicate & Delete */}
      <div style={{ display: 'flex', gap: '0.3rem' }}>
        {onDuplicateToken && (
          <button
            className="btn-icon"
            onClick={() => {
              if (selectedTokens && selectedTokens.length > 1 && onDuplicateTokens) {
                onDuplicateTokens(selectedTokens);
              } else {
                onDuplicateToken(token);
              }
            }}
            title={selectedTokens && selectedTokens.length > 1 ? `Duplicate ${selectedTokens.length} Tokens (Ctrl+D)` : "Duplicate Token (Ctrl+D)"}
          >
            <Copy size={16} />
          </button>
        )}
        <button
          className="btn-icon"
          onClick={() => {
            const newLocked = !token.locked;
            if (selectedTokens && selectedTokens.length > 1) {
              selectedTokens.forEach((t) => onUpdateToken(t.id, { locked: newLocked }));
            } else {
              onUpdateToken(token.id, { locked: newLocked });
            }
          }}
          title={token.locked ? "Unlock (Allow moving)" : "Lock (Prevent moving)"}
          style={{
            color: token.locked ? '#f59e0b' : 'var(--text-secondary)',
            backgroundColor: token.locked ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
          }}
        >
          {token.locked ? <Lock size={16} /> : <Unlock size={16} />}
        </button>
        <button className="btn-icon" onClick={onOpenFullEditor} title="Full Token Settings">
          <Settings size={16} />
        </button>
        {isGm && (
          <button
            className="btn-icon"
            onClick={() => {
              if (selectedTokens && selectedTokens.length > 1) {
                selectedTokens.forEach((t) => onDeleteToken(t.id));
              } else {
                onDeleteToken(token.id);
              }
            }}
            title={selectedTokens && selectedTokens.length > 1 ? `Delete ${selectedTokens.length} Tokens` : "Delete Token"}
            style={{ color: '#f43f5e' }}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
};
