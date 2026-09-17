import React, { useEffect, useState } from 'react';
import { DiceRollResult } from '@oldbear/shared';
import { Sparkles, Dices, X } from 'lucide-react';

interface RollAnnouncementBannerProps {
  roll: DiceRollResult | null;
  onDismiss: () => void;
}

export const RollAnnouncementBanner: React.FC<RollAnnouncementBannerProps> = ({ roll, onDismiss }) => {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!roll) return;
    setAnimating(true);

    const timer = setTimeout(() => {
      setAnimating(false);
      setTimeout(onDismiss, 300); // allow fade out
    }, 4500);

    return () => clearTimeout(timer);
  }, [roll, onDismiss]);

  if (!roll) return null;

  const isNat20 = roll.diceType === 'd20' && roll.rolls.includes(20) && (roll.keptRoll === 20 || roll.rolls[0] === 20);
  const isNat1 = roll.diceType === 'd20' && (roll.keptRoll === 1 || (roll.rolls.length === 1 && roll.rolls[0] === 1));

  const modString = roll.modifier !== 0 ? (roll.modifier > 0 ? `+${roll.modifier}` : `${roll.modifier}`) : '';

  return (
    <div
      style={{
        position: 'fixed',
        top: '4.5rem',
        left: '50%',
        transform: `translateX(-50%) translateY(${animating ? '0' : '-30px'})`,
        opacity: animating ? 1 : 0,
        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        zIndex: 90,
        pointerEvents: 'auto',
      }}
    >
      <div
        className="glass-panel-elevated"
        style={{
          padding: '0.85rem 1.5rem',
          borderRadius: 'var(--radius-lg)',
          border: isNat20
            ? '2px solid #fbbf24'
            : isNat1
            ? '2px solid #f43f5e'
            : '2px solid var(--accent-primary)',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          boxShadow: isNat20
            ? '0 0 35px rgba(251, 191, 36, 0.6), 0 10px 30px rgba(0,0,0,0.8)'
            : isNat1
            ? '0 0 35px rgba(244, 63, 94, 0.6), 0 10px 30px rgba(0,0,0,0.8)'
            : '0 0 25px rgba(99, 102, 241, 0.5), 0 10px 30px rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          minWidth: '320px',
        }}
      >
        {/* Animated Dice Badge */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: roll.userColor || 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            animation: 'pulse 1.5s infinite',
            flexShrink: 0,
          }}
        >
          <Dices size={28} />
        </div>

        {/* Text & Results */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontWeight: 800,
                fontSize: '0.95rem',
                color: roll.userColor || 'white',
              }}
            >
              {roll.userName}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              rolled {roll.count}{roll.diceType} {modString}
              {roll.advantageMode && roll.advantageMode !== 'normal' && (
                <span
                  style={{
                    marginLeft: '6px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: roll.advantageMode === 'advantage' ? 'var(--accent-emerald)' : '#f43f5e',
                    backgroundColor: roll.advantageMode === 'advantage' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                    padding: '1px 5px',
                    borderRadius: '4px',
                  }}
                >
                  {roll.advantageMode.toUpperCase()}
                </span>
              )}
            </span>
          </div>

          {/* Large Total Result */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '2px' }}>
            <span
              style={{
                fontSize: '1.8rem',
                fontWeight: 900,
                color: isNat20 ? '#fbbf24' : isNat1 ? '#f43f5e' : '#ffffff',
                fontFamily: 'var(--font-display)',
                lineHeight: 1,
              }}
            >
              {roll.total}
            </span>

            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              [{roll.rolls.join(', ')}] {modString}
            </span>

            {isNat20 && (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: '#fbbf24',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  letterSpacing: '0.05em',
                }}
              >
                <Sparkles size={13} /> CRITICAL HIT!
              </span>
            )}

            {isNat1 && (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: '#f43f5e',
                  letterSpacing: '0.05em',
                }}
              >
                CRITICAL FAIL!
              </span>
            )}
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          className="btn-icon"
          onClick={onDismiss}
          style={{ width: '26px', height: '26px', color: 'var(--text-muted)' }}
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
