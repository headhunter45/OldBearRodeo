import React, { useEffect, useState } from 'react';
import { InitiativeItem } from '@oldbear/shared';
import { Swords, X, ShieldAlert } from 'lucide-react';

export interface TurnAnnouncement {
  combatant: InitiativeItem;
  round: number;
}

interface TurnAnnouncementBannerProps {
  announcement: TurnAnnouncement | null;
  onDismiss: () => void;
}

export const TurnAnnouncementBanner: React.FC<TurnAnnouncementBannerProps> = ({
  announcement,
  onDismiss,
}) => {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!announcement) return;
    setAnimating(true);

    const timer = setTimeout(() => {
      setAnimating(false);
      setTimeout(onDismiss, 300); // allow fade out
    }, 4500);

    return () => clearTimeout(timer);
  }, [announcement, onDismiss]);

  if (!announcement) return null;

  const { combatant, round } = announcement;

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
          border: '2px solid #f59e0b',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          boxShadow: '0 0 30px rgba(245, 158, 11, 0.45), 0 10px 30px rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          minWidth: '320px',
        }}
      >
        {/* Animated Swords Badge */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: combatant.color || '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            animation: 'pulse 1.5s infinite',
            flexShrink: 0,
          }}
        >
          <Swords size={26} />
        </div>

        {/* Text & Turn Details */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px' }}>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                color: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                padding: '0.15rem 0.45rem',
                borderRadius: 'var(--radius-full)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Round {round} Turn
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Init {combatant.initiative}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span
              style={{
                fontWeight: 800,
                fontSize: '1.15rem',
                color: combatant.color || '#ffffff',
                letterSpacing: '-0.01em',
              }}
            >
              {combatant.name}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              is up next!
            </span>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          className="btn-icon"
          onClick={() => {
            setAnimating(false);
            setTimeout(onDismiss, 200);
          }}
          style={{
            width: '24px',
            height: '24px',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
