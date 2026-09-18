import React, { useState } from 'react';
import { InitiativeState, InitiativeItem, Token, Player } from '@oldbear/shared';
import { Swords, Plus, ChevronRight, ChevronLeft, ArrowUpDown, Trash2, X, Dices, HelpCircle, ChevronDown, GripVertical, Pencil, Check } from 'lucide-react';
import { useDraggableWindow } from '../hooks/useDraggableWindow.js';

interface InitiativeTrackerProps {
  initiative: InitiativeState;
  onUpdateInitiative: (state: InitiativeState) => void;
  tokens: Record<string, Token>;
  selectedToken?: Token | null;
  players?: Record<string, Player> | Player[];
  isGm: boolean;
  onClose?: () => void;
}

export const InitiativeTracker: React.FC<InitiativeTrackerProps> = ({
  initiative,
  onUpdateInitiative,
  tokens,
  selectedToken,
  players,
  isGm,
  onClose,
}) => {
  const [newName, setNewName] = useState('');
  const [newInit, setNewInit] = useState(10);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState<number>(0);
  const [selectedInitScore, setSelectedInitScore] = useState<string>('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const { windowRef, position, isDragging, handleMouseDown } = useDraggableWindow({
    storageKey: 'obr_init_tracker_pos',
  });

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if ((e.target as HTMLElement).closest('input, button')) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }

    const newItems = [...initiative.items];
    const [movedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, movedItem);

    // Update the initiative numbers to fit the new reordered position (Bug #67)
    let calculatedScore: number;
    if (newItems.length === 1) {
      calculatedScore = movedItem.initiative;
    } else if (targetIndex === 0) {
      const nextScore = newItems[1].initiative;
      calculatedScore = nextScore + 1;
    } else if (targetIndex === newItems.length - 1) {
      const prevScore = newItems[newItems.length - 2].initiative;
      calculatedScore = Math.max(0, prevScore - 1);
    } else {
      const prevScore = newItems[targetIndex - 1].initiative;
      const nextScore = newItems[targetIndex + 1].initiative;
      if (prevScore > nextScore + 1) {
        calculatedScore = Math.round((prevScore + nextScore) / 2);
      } else {
        calculatedScore = prevScore;
      }
    }

    newItems[targetIndex] = {
      ...movedItem,
      initiative: calculatedScore,
    };

    // Keep turn index tracking the active combatant
    let newTurnIndex = initiative.currentTurnIndex;
    if (initiative.currentTurnIndex === draggedIndex) {
      newTurnIndex = targetIndex;
    } else if (draggedIndex < initiative.currentTurnIndex && targetIndex >= initiative.currentTurnIndex) {
      newTurnIndex = initiative.currentTurnIndex - 1;
    } else if (draggedIndex > initiative.currentTurnIndex && targetIndex <= initiative.currentTurnIndex) {
      newTurnIndex = initiative.currentTurnIndex + 1;
    }

    onUpdateInitiative({
      ...initiative,
      items: newItems,
      currentTurnIndex: newTurnIndex,
    });

    setDraggedIndex(null);
  };

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

  const getTokenInitiativeBonus = (token?: Token | null, itemName?: string): number => {
    const playerList: Player[] = Array.isArray(players) ? players : Object.values(players || {});
    if (token) {
      if (typeof token.initiativeBonus === 'number') return token.initiativeBonus;
      if (typeof token.character?.initiativeBonus === 'number') return token.character.initiativeBonus;
      if (token.ownerId && playerList.length > 0) {
        const owner = playerList.find((p) => p.id === token.ownerId);
        if (typeof owner?.dndBeyondCharacter?.initiativeBonus === 'number') {
          return owner.dndBeyondCharacter.initiativeBonus;
        }
      }
    }
    const nameToMatch = (token?.name || itemName || '').toLowerCase();
    if (nameToMatch && playerList.length > 0) {
      for (const p of playerList) {
        if (token && p.assignedTokenIds?.includes(token.id) && typeof p.dndBeyondCharacter?.initiativeBonus === 'number') {
          return p.dndBeyondCharacter.initiativeBonus;
        }
        if (p.dndBeyondCharacter?.name?.toLowerCase() === nameToMatch && typeof p.dndBeyondCharacter?.initiativeBonus === 'number') {
          return p.dndBeyondCharacter.initiativeBonus;
        }
      }
    }
    return 0;
  };

  const handleAddSelectedToken = () => {
    if (!selectedToken) return;
    const bonus = getTokenInitiativeBonus(selectedToken);
    const roll = Math.floor(Math.random() * 20) + 1 + bonus;
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

  const handleRerollItem = (item: InitiativeItem) => {
    const token = item.tokenId ? tokens[item.tokenId] : Object.values(tokens).find((t) => t.name.toLowerCase() === item.name.toLowerCase());
    const bonus = getTokenInitiativeBonus(token, item.name);
    const roll = Math.floor(Math.random() * 20) + 1 + bonus;
    const items = initiative.items
      .map((i) => (i.id === item.id ? { ...i, initiative: roll } : i))
      .sort((a, b) => b.initiative - a.initiative);
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
      ref={windowRef}
      className="glass-panel-elevated animate-fade-in draggable-window"
      style={{
        position: 'fixed',
        left: position ? `${position.x}px` : undefined,
        top: position ? `${position.y}px` : '4.5rem',
        right: position ? 'auto' : '1rem',
        display: 'flex',
        flexDirection: 'column',
        height: isMinimized ? 'auto' : '100%',
        maxHeight: isMinimized ? '46px' : '520px',
        width: '320px',
        padding: '0.75rem 1rem',
        zIndex: 45,
        boxShadow: isDragging ? '0 16px 36px rgba(0,0,0,0.6)' : '0 10px 25px rgba(0,0,0,0.4)',
        transition: isDragging ? 'none' : 'max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
      }}
    >
      {/* Header & Round Counter */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: isMinimized ? '0' : '0.75rem',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Swords size={20} color="var(--accent-gold)" />
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem' }}>
            Round {initiative.round}
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <div
            title="Initiative Tracker Guide:&#10;• Click Next/Prev Turn to advance rounds&#10;• Click Add (with optional score) to add token&#10;• As GM, click any initiative circle to edit score directly&#10;• Click dice icon to reroll using character bonus"
            style={{ color: 'var(--text-muted)', cursor: 'help', display: 'flex', alignItems: 'center', padding: '0 4px' }}
          >
            <HelpCircle size={15} />
          </div>
          {isGm && (
            <button className="btn-icon" onClick={handleSort} title="Sort Highest to Lowest">
              <ArrowUpDown size={16} />
            </button>
          )}
          {/* Minimize button */}
          <button
            className="btn-icon"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized((v) => !v);
            }}
            title={isMinimized ? 'Expand window' : 'Minimize window'}
            style={{ width: '24px', height: '24px' }}
          >
            <ChevronDown
              size={16}
              className={`chevron-minimize ${isMinimized ? 'minimized' : ''}`}
            />
          </button>
          {onClose && (
            <button className="btn-icon" onClick={onClose} style={{ width: '24px', height: '24px' }}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div
        className={`draggable-window-body ${isMinimized ? 'minimized' : ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
        }}
      >

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

      {/* Add Selected Token Button with optional custom score (Bug #53) */}
      {isGm && selectedToken && (
        <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.75rem' }}>
          <button
            className="btn btn-secondary"
            style={{ flex: 1, fontSize: '0.8rem', justifyContent: 'center' }}
            onClick={() => {
              if (selectedInitScore.trim() !== '') {
                const score = Number(selectedInitScore);
                const item: InitiativeItem = {
                  id: crypto.randomUUID(),
                  tokenId: selectedToken.id,
                  name: selectedToken.name,
                  initiative: isNaN(score) ? 10 : score,
                  hp: selectedToken.currentHp,
                  maxHp: selectedToken.maxHp,
                  color: selectedToken.ringColor,
                };
                const items = [...initiative.items, item].sort((a, b) => b.initiative - a.initiative);
                onUpdateInitiative({ ...initiative, items });
                setSelectedInitScore('');
              } else {
                handleAddSelectedToken();
              }
            }}
          >
            <Plus size={14} /> Add: {selectedToken.name}
          </button>
          <input
            type="number"
            placeholder="Score"
            value={selectedInitScore}
            onChange={(e) => setSelectedInitScore(e.target.value)}
            title="Optional manual initiative score for token (leave blank to roll with character bonus)"
            style={{
              width: '56px',
              padding: '0.35rem 0.4rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'white',
              fontSize: '0.8rem',
              textAlign: 'center',
            }}
          />
        </div>
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
                draggable={!editingItemId}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.45rem 0.55rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isCurrent ? 'rgba(99, 102, 241, 0.25)' : 'var(--bg-surface-elevated)',
                  border: isCurrent ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  borderTop: dragOverIndex === idx && draggedIndex !== idx ? '2px solid var(--accent-primary)' : undefined,
                  boxShadow: isCurrent ? '0 0 10px var(--accent-glow)' : 'none',
                  opacity: draggedIndex === idx ? 0.4 : 1,
                  cursor: 'grab',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <GripVertical
                    size={14}
                    style={{ color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0 }}
                  />

                  {editingItemId === item.id ? (
                    <input
                      type="number"
                      autoFocus
                      value={editScore}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setEditScore(Number(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const items = initiative.items
                            .map((it) => (it.id === item.id ? { ...it, initiative: editScore } : it))
                            .sort((a, b) => b.initiative - a.initiative);
                          onUpdateInitiative({ ...initiative, items });
                          setEditingItemId(null);
                        }
                        if (e.key === 'Escape') setEditingItemId(null);
                      }}
                      style={{
                        width: '38px',
                        height: '28px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-surface)',
                        border: '2px solid var(--accent-primary)',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        textAlign: 'center',
                        padding: 0,
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      onClick={(e) => {
                        if (isGm) {
                          e.stopPropagation();
                          setEditingItemId(item.id);
                          setEditScore(item.initiative);
                        }
                      }}
                      title={isGm ? "Click to edit initiative score" : undefined}
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
                        cursor: isGm ? 'pointer' : 'default',
                        userSelect: 'none',
                        border: '1.5px solid rgba(255, 255, 255, 0.4)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        flexShrink: 0,
                      }}
                    >
                      {item.initiative}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: isCurrent ? 700 : 500, fontSize: '0.85rem' }}>{item.name}</div>
                    {item.hp !== undefined && item.maxHp !== undefined && (
                      <div style={{ fontSize: '0.7rem', color: '#10b981' }}>
                        HP: {item.hp}/{item.maxHp}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {editingItemId === item.id ? (
                    <>
                      <button
                        className="btn-icon"
                        title="Save initiative score (Enter)"
                        style={{
                          width: '24px',
                          height: '24px',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.5)',
                          backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const items = initiative.items
                            .map((it) => (it.id === item.id ? { ...it, initiative: editScore } : it))
                            .sort((a, b) => b.initiative - a.initiative);
                          onUpdateInitiative({ ...initiative, items });
                          setEditingItemId(null);
                        }}
                      >
                        <Check size={13} />
                      </button>
                      <button
                        className="btn-icon"
                        title="Cancel (Esc)"
                        style={{
                          width: '24px',
                          height: '24px',
                          color: '#f43f5e',
                          border: '1px solid rgba(244, 63, 94, 0.5)',
                          backgroundColor: 'rgba(244, 63, 94, 0.2)',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItemId(null);
                        }}
                      >
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      {isGm && (
                        <button
                          className="btn-icon"
                          title="Reroll Initiative (using character bonus)"
                          style={{ width: '24px', height: '24px', color: 'var(--text-secondary)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRerollItem(item);
                          }}
                        >
                          <Dices size={13} />
                        </button>
                      )}
                      {isGm && (
                        <button
                          className="btn-icon"
                          title="Edit Initiative Score"
                          style={{ width: '24px', height: '24px', color: 'var(--text-secondary)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingItemId(item.id);
                            setEditScore(item.initiative);
                          }}
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      {isGm && (
                        <button
                          className="btn-icon"
                          style={{ width: '24px', height: '24px', color: '#f43f5e' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(item.id);
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </>
                  )}
                </div>
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
    </div>
  );
};
