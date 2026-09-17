import React, { useState } from 'react';
import { DieType, DiceRollResult } from '@oldbear/shared';
import { Dices, Sparkles, X, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';

interface DiceRollerProps {
  userName: string;
  userColor: string;
  userId: string;
  onRoll: (roll: DiceRollResult) => void;
  rollHistory: DiceRollResult[];
  onClose?: () => void;
}

const DICE_TYPES: { type: DieType; max: number; label: string }[] = [
  { type: 'd4', max: 4, label: 'd4' },
  { type: 'd6', max: 6, label: 'd6' },
  { type: 'd8', max: 8, label: 'd8' },
  { type: 'd10', max: 10, label: 'd10' },
  { type: 'd12', max: 12, label: 'd12' },
  { type: 'd20', max: 20, label: 'd20' },
  { type: 'd100', max: 100, label: 'd100' },
];

export const DiceRoller: React.FC<DiceRollerProps> = ({
  userName,
  userColor,
  userId,
  onRoll,
  rollHistory,
  onClose,
}) => {
  const [modifier, setModifier] = useState<number>(0);
  const [diceCount, setDiceCount] = useState<number>(1);

  const rollDice = (
    diceType: DieType,
    max: number,
    advantageMode: 'normal' | 'advantage' | 'disadvantage' = 'normal'
  ) => {
    let rolls: number[] = [];
    let keptRoll: number | undefined;
    let total = 0;

    if (diceType === 'd20' && (advantageMode === 'advantage' || advantageMode === 'disadvantage')) {
      const r1 = Math.floor(Math.random() * 20) + 1;
      const r2 = Math.floor(Math.random() * 20) + 1;
      rolls = [r1, r2];

      if (advantageMode === 'advantage') {
        keptRoll = Math.max(r1, r2);
      } else {
        keptRoll = Math.min(r1, r2);
      }
      total = keptRoll + modifier;

      if (keptRoll === 20) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
      }
    } else {
      for (let i = 0; i < diceCount; i++) {
        rolls.push(Math.floor(Math.random() * max) + 1);
      }
      total = rolls.reduce((sum, r) => sum + r, 0) + modifier;

      if (diceType === 'd20' && rolls[0] === 20) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.7 } });
      }
    }

    const result: DiceRollResult = {
      id: crypto.randomUUID(),
      userId,
      userName,
      userColor,
      diceType,
      count: diceCount,
      modifier,
      rolls,
      total,
      advantageMode,
      keptRoll,
      timestamp: Date.now(),
    };

    onRoll(result);
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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Dices size={20} color="var(--accent-primary)" />
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem' }}>Dice Roller</h3>
        </div>
        {onClose && (
          <button className="btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Modifier & Count Controls */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Count</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <button
              className="btn-icon"
              style={{ width: '26px', height: '26px' }}
              onClick={() => setDiceCount((c) => Math.max(1, c - 1))}
            >
              -
            </button>
            <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 'bold' }}>{diceCount}</span>
            <button
              className="btn-icon"
              style={{ width: '26px', height: '26px' }}
              onClick={() => setDiceCount((c) => Math.min(10, c + 1))}
            >
              +
            </button>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Modifier</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <button
              className="btn-icon"
              style={{ width: '26px', height: '26px' }}
              onClick={() => setModifier((m) => m - 1)}
            >
              -
            </button>
            <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 'bold' }}>
              {modifier >= 0 ? `+${modifier}` : modifier}
            </span>
            <button
              className="btn-icon"
              style={{ width: '26px', height: '26px' }}
              onClick={() => setModifier((m) => m + 1)}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Standard Dice Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.4rem',
          marginBottom: '0.75rem',
        }}
      >
        {DICE_TYPES.map(({ type, max, label }) => (
          <button
            key={type}
            className="btn btn-secondary"
            style={{
              padding: '0.5rem 0.25rem',
              fontWeight: 700,
              fontSize: '0.85rem',
              borderRadius: 'var(--radius-sm)',
            }}
            onClick={() => rollDice(type, max)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Dedicated d20 Advantage / Disadvantage Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button
          className="btn"
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10b981',
            color: '#10b981',
            fontSize: '0.75rem',
            padding: '0.4rem',
          }}
          onClick={() => rollDice('d20', 20, 'advantage')}
        >
          <Sparkles size={14} /> Adv (2d20)
        </button>

        <button
          className="btn"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#ef4444',
            fontSize: '0.75rem',
            padding: '0.4rem',
          }}
          onClick={() => rollDice('d20', 20, 'disadvantage')}
        >
          <RotateCcw size={14} /> Disadv (2d20)
        </button>
      </div>

      <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.2rem 0 0.5rem' }} />

      {/* Roll History / Log */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {rollHistory.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem' }}>
            No rolls yet. Click a die to roll!
          </div>
        ) : (
          rollHistory
            .slice()
            .reverse()
            .map((roll) => (
              <div
                key={roll.id}
                style={{
                  padding: '0.4rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderLeft: `3px solid ${roll.userColor}`,
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: roll.userColor }}>{roll.userName}</span>
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: '#f8fafc' }}>
                    {roll.total}
                  </span>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  rolled {roll.count > 1 ? `${roll.count}x` : ''}{roll.diceType}
                  {roll.advantageMode !== 'normal' ? ` (${roll.advantageMode})` : ''}
                  {roll.modifier ? ` with ${roll.modifier >= 0 ? `+${roll.modifier}` : roll.modifier}` : ''}:
                  [{roll.rolls.join(', ')}]
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
};
