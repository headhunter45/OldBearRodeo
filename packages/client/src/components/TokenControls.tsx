import React from 'react';
import { Token, Player, GameMap } from '@oldbear/shared';
import { Heart, Shield, Plus, Minus, Settings, Trash2, ArrowRightLeft } from 'lucide-react';

interface TokenControlsProps {
  token: Token;
  onUpdateToken: (id: string, updates: Partial<Token>) => void;
  onDeleteToken: (id: string) => void;
  onTransferToken: (id: string, toMapId: string) => void;
  onOpenFullEditor: () => void;
  canControl: boolean;
  isGm: boolean;
  maps: GameMap[];
}

const COMMON_CONDITIONS = ['Blinded', 'Charmed', 'Poisoned', 'Stunned', 'Prone', 'Concentrating'];

export const TokenControls: React.FC<TokenControlsProps> = ({
  token,
  onUpdateToken,
  onDeleteToken,
  onTransferToken,
  onOpenFullEditor,
  canControl,
  isGm,
  maps,
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
      {/* Token Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: token.fillColor || '#1e293b',
            border: `2px solid ${token.ringColor || '#64748b'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '12px',
          }}
        >
          {token.name[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{token.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Speed: {token.speed}ft | Size: {token.size}x
          </div>
        </div>
      </div>

      <div style={{ width: '1px', height: '32px', background: 'var(--border-subtle)' }} />

      {/* HP Quick Controls */}
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

      {/* Temp HP */}
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

      <div style={{ width: '1px', height: '32px', background: 'var(--border-subtle)' }} />

      {/* Quick Condition Badges */}
      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
        {COMMON_CONDITIONS.slice(0, 3).map((cond) => {
          const isActive = (token.conditions || []).includes(cond);
          return (
            <button
              key={cond}
              onClick={() => toggleCondition(cond)}
              style={{
                fontSize: '0.7rem',
                padding: '3px 7px',
                borderRadius: '9999px',
                border: '1px solid',
                borderColor: isActive ? '#f43f5e' : 'var(--border-subtle)',
                backgroundColor: isActive ? 'rgba(244, 63, 94, 0.2)' : 'transparent',
                color: isActive ? '#f43f5e' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {cond}
            </button>
          );
        })}
      </div>

      {/* Move/Copy Token to Another Map (GM Feature) */}
      {isGm && maps.length > 1 && (
        <select
          style={{
            background: 'var(--bg-surface-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 8px',
            fontSize: '0.75rem',
            outline: 'none',
          }}
          value=""
          onChange={(e) => {
            if (e.target.value) {
              onTransferToken(token.id, e.target.value);
            }
          }}
        >
          <option value="" disabled>
            Transfer to map...
          </option>
          {maps
            .filter((m) => m.id !== token.mapId)
            .map((m) => (
              <option key={m.id} value={m.id}>
                Move to {m.name}
              </option>
            ))}
        </select>
      )}

      {/* Full Editor Modal & Delete */}
      <div style={{ display: 'flex', gap: '0.3rem' }}>
        <button className="btn-icon" onClick={onOpenFullEditor} title="Full Token Settings">
          <Settings size={16} />
        </button>
        {isGm && (
          <button
            className="btn-icon"
            onClick={() => onDeleteToken(token.id)}
            title="Delete Token"
            style={{ color: '#f43f5e' }}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
};
