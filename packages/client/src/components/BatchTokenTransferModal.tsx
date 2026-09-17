import React, { useState } from 'react';
import { Token, GameMap } from '@oldbear/shared';
import { X, ArrowRightLeft, Users, Shield, CheckSquare, Square } from 'lucide-react';

interface BatchTokenTransferModalProps {
  tokens: Token[];
  maps: GameMap[];
  currentMapId: string;
  onTransferTokens: (tokenIds: string[], targetMapId: string) => void;
  onClose: () => void;
}

export const BatchTokenTransferModal: React.FC<BatchTokenTransferModalProps> = ({
  tokens,
  maps,
  currentMapId,
  onTransferTokens,
  onClose,
}) => {
  const otherMaps = maps.filter((m) => m.id !== currentMapId);
  const [targetMapId, setTargetMapId] = useState(otherMaps[0]?.id || currentMapId);

  // Default selection: all player tokens
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>(() =>
    tokens
      .filter((t) => t.ownerId || t.isPlayerToken)
      .map((t) => t.id)
  );

  const toggleSelectToken = (id: string) => {
    setSelectedTokenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllPlayerTokens = () => {
    setSelectedTokenIds(
      tokens.filter((t) => t.ownerId || t.isPlayerToken).map((t) => t.id)
    );
  };

  const selectAll = () => {
    setSelectedTokenIds(tokens.map((t) => t.id));
  };

  const clearSelection = () => {
    setSelectedTokenIds([]);
  };

  const handleTransfer = () => {
    if (selectedTokenIds.length === 0 || !targetMapId) return;
    onTransferTokens(selectedTokenIds, targetMapId);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 65,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel-elevated animate-scale-up"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ArrowRightLeft size={22} color="var(--accent-primary)" />
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.2rem', margin: 0 }}>
              Batch Transfer Tokens
            </h2>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Destination Map Selector */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Destination Map
            </label>
            <select
              value={targetMapId}
              onChange={(e) => setTargetMapId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'white',
                marginTop: '0.35rem',
                fontWeight: 600,
              }}
            >
              {maps.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.id === currentMapId ? '(Current Map)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Filter Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem' }}
              onClick={selectAllPlayerTokens}
            >
              <Users size={14} /> Select All Player Tokens
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem' }}
              onClick={selectAll}
            >
              Select All ({tokens.length})
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem' }}
              onClick={clearSelection}
            >
              Deselect All
            </button>
          </div>

          {/* Tokens List */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Select Tokens to Move ({selectedTokenIds.length} of {tokens.length} selected)
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                maxHeight: '260px',
                overflowY: 'auto',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.5rem',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              {tokens.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No tokens available in this session.
                </div>
              ) : (
                tokens.map((t) => {
                  const isSelected = selectedTokenIds.includes(t.id);
                  const isPlayer = Boolean(t.ownerId || t.isPlayerToken);
                  return (
                    <div
                      key={t.id}
                      onClick={() => toggleSelectToken(t.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-surface-elevated)',
                        border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        {isSelected ? (
                          <CheckSquare size={16} color="var(--accent-primary)" />
                        ) : (
                          <Square size={16} color="var(--text-muted)" />
                        )}

                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundImage: t.imageUrl ? `url("${t.imageUrl}")` : 'none',
                            backgroundColor: t.fillColor || '#334155',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#fff',
                          }}
                        >
                          {!t.imageUrl && t.name.slice(0, 1)}
                        </div>

                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t.name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {isPlayer ? 'Player Controllable' : 'GM / NPC'} • HP {t.currentHp}/{t.maxHp}
                          </div>
                        </div>
                      </div>

                      {isPlayer && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            backgroundColor: 'rgba(16, 185, 129, 0.2)',
                            color: 'var(--accent-emerald)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 600,
                          }}
                        >
                          PLAYER
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={selectedTokenIds.length === 0 || targetMapId === currentMapId}
            onClick={handleTransfer}
          >
            Move {selectedTokenIds.length} Tokens
          </button>
        </div>
      </div>
    </div>
  );
};
