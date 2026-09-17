import React, { useState } from 'react';
import { InitiativeState, InitiativeItem, Token } from '@oldbear/shared';
import { Swords, Plus, ChevronRight, ChevronLeft, ArrowUpDown, Trash2, X } from 'lucide-react';

interface InitiativeTrackerProps {
  initiative: InitiativeState;
  onUpdateInitiative: (state: InitiativeState) => void;
  tokens: Record<string, Token>;
  selectedToken?: Token | null;
  isGm: boolean;
  onClose?: () => void;
}

export const InitiativeTracker: React.FC<InitiativeTrackerProps> = ({
  initiative,
  onUpdateInitiative,
  tokens,
  selectedToken,
  isGm,
  onClose,
}) => {
  const [newName, setNewName] = useState('');
  const [newInit, setNewInit] = useState(10);

  const handleNextTurn = () => {
    if (initiative.items.length === 0) return;
    let nextIndex = initiative.currentTurnIndex + 1;
    let nextRound = initiative.round;
    if (nextIndex >= initiative.items.length) {
      nextIndex = 0;
      nextRound += 1;
    }
    onUpdateInitiative({
      ...initiative,
      currentTurnIndex: nextIndex,
      round: nextRound,
    });
  };

  const handlePrevTurn = () => {
    if (initiative.items.length === 0) return;
    let prevIndex = initiative.currentTurnIndex - 1;
    let prevRound = initiative.round;
    if (prevIndex < 0) {
      prevIndex = Math.max(0, initiative.items.length - 1);
      prevRound = Math.max(1, prevRound - 1);
    }
    onUpdateInitiative({
      ...initiative,
      currentTurnIndex: prevIndex,
      round: prevRound,
    });
  };

  const handleSort = () => {
    const sorted = [...initiative.items].sort((a, b) => b.initiative - a.initiative);
    onUpdateInitiative({
      ...initiative,
      items: sorted,
      currentTurnIndex: 0,
    });
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const item: InitiativeItem = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      initiative: Number(newInit),
      color: '#6366f1',
    };

    const items = [...initiative.items, item].sort((a, b) => b.initiative - a.initiative);
    onUpdateInitiative({ ...initiative, items });
    setNewName('');
    setNewInit(10);
  };

  const handleAddSelectedToken = () => {
    if (!selectedToken) return;
    const roll = Math.floor(Math.random() * 20) + 1;
    const item: InitiativeItem = {
      id: crypto.randomUUID(),
      tokenId: selectedToken.id,
      name: selectedToken.name,
      initiative: roll,
      hp: selectedToken.currentHp,
      maxHp: selectedToken.maxHp,
      color: selectedToken.ringColor,
    };

    const items = [...initiative.items, item].sort((a, b) => b.initiative - a.initiative);
    onUpdateInitiative({ ...initiative, items });
  };

  const handleRemove = (id: string) => {
    const items = initiative.items.filter((item) => item.id !== id);
    onUpdateInitiative({
      ...initiative,
      items,
      currentTurnIndex: Math.min(initiative.currentTurnIndex, Math.max(0, items.length - 1)),
    });
  };

  return (
    <div
      className="glass-panel-elevated animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '520px',
        width: '320px',
        padding: '1rem',
      }}
    >
      {/* Header & Round Counter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Swords size={20} color="var(--accent-gold)" />
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem' }}>
            Round {initiative.round}
          </h3>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {isGm && (
            <button className="btn-icon" onClick={handleSort} title="Sort Highest to Lowest">
              <ArrowUpDown size={16} />
            </button>
          )}
          {onClose && (
            <button className="btn-icon" onClick={onClose}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Turn Navigation */}
      {isGm && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handlePrevTurn}>
            <ChevronLeft size={16} /> Prev Turn
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleNextTurn}>
            Next Turn <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Add Selected Token Button */}
      {isGm && selectedToken && (
        <button
          className="btn btn-secondary"
          style={{ width: '100%', marginBottom: '0.75rem', fontSize: '0.8rem' }}
          onClick={handleAddSelectedToken}
        >
          <Plus size={14} /> Add Selected: {selectedToken.name}
        </button>
      )}

      {/* Combatants List */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem' }}>
        {initiative.items.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem' }}>
            No combatants added yet.
          </div>
        ) : (
          initiative.items.map((item, idx) => {
            const isCurrent = idx === initiative.currentTurnIndex;
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isCurrent ? 'rgba(99, 102, 241, 0.25)' : 'var(--bg-surface-elevated)',
                  border: isCurrent ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  boxShadow: isCurrent ? '0 0 10px var(--accent-glow)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: item.color || '#6366f1',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                    }}
                  >
                    {item.initiative}
                  </div>
                  <div>
                    <div style={{ fontWeight: isCurrent ? 700 : 500, fontSize: '0.85rem' }}>{item.name}</div>
                    {item.hp !== undefined && item.maxHp !== undefined && (
                      <div style={{ fontSize: '0.7rem', color: '#10b981' }}>
                        HP: {item.hp}/{item.maxHp}
                      </div>
                    )}
                  </div>
                </div>

                {isGm && (
                  <button
                    className="btn-icon"
                    style={{ width: '24px', height: '24px', color: '#f43f5e' }}
                    onClick={() => handleRemove(item.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Custom Combatant Form */}
      {isGm && (
        <form onSubmit={handleAddCustom} style={{ display: 'flex', gap: '0.35rem' }}>
          <input
            type="text"
            placeholder="Combatant name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{
              flex: 2,
              padding: '0.4rem 0.6rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'white',
              fontSize: '0.8rem',
            }}
          />
          <input
            type="number"
            placeholder="Init"
            value={newInit}
            onChange={(e) => setNewInit(Number(e.target.value))}
            style={{
              width: '50px',
              padding: '0.4rem 0.4rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'white',
              fontSize: '0.8rem',
              textAlign: 'center',
            }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '0.4rem 0.6rem' }}>
            <Plus size={16} />
          </button>
        </form>
      )}
    </div>
  );
};
