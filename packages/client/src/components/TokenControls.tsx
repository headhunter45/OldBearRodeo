import React from 'react';
import { Token, Player, GameMap } from '@oldbear/shared';
import { Heart, Shield, Plus, Minus, Settings, Trash2, ArrowRightLeft, Copy, UserCheck } from 'lucide-react';

interface TokenControlsProps {
  token: Token;
  onUpdateToken: (id: string, updates: Partial<Token>) => void;
  onDeleteToken: (id: string) => void;
  onDuplicateToken?: (token: Token) => void;
  onTransferToken: (id: string, toMapId: string) => void;
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

export const TokenControls: React.FC<TokenControlsProps> = ({
  token,
  onUpdateToken,
  onDeleteToken,
  onDuplicateToken,
  onTransferToken,
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

      {/* Active Condition Tags & Add Selector */}
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
            background: 'var(--bg-surface-elevated)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '3px 6px',
            fontSize: '0.72rem',
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

      {/* Assign to Player (GM Feature) */}
      {isGm && players.length > 0 && (
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
          value={token.ownerId || ''}
          onChange={(e) => {
            onUpdateToken(token.id, { ownerId: e.target.value || undefined });
          }}
          title="Assign control of this token to a player"
        >
          <option value="">Assigned: GM Only</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              Assigned: {p.name}
            </option>
          ))}
        </select>
      )}

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

      {/* Full Editor Modal, Duplicate & Delete */}
      <div style={{ display: 'flex', gap: '0.3rem' }}>
        {onDuplicateToken && (
          <button
            className="btn-icon"
            onClick={() => onDuplicateToken(token)}
            title="Duplicate Token (Ctrl+D)"
          >
            <Copy size={16} />
          </button>
        )}
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
