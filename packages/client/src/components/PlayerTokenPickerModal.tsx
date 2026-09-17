import React from 'react';
import { Token, Player } from '@oldbear/shared';
import { X, UserCheck, Shield, Heart } from 'lucide-react';

interface PlayerTokenPickerModalProps {
  availableTokens: Token[];
  player: Player;
  onClaimToken: (token: Token) => void;
  onClose: () => void;
}

export const PlayerTokenPickerModal: React.FC<PlayerTokenPickerModalProps> = ({
  availableTokens,
  player,
  onClaimToken,
  onClose,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(10px)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="glass-panel-elevated animate-scale-up"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: '0 25px 50px rgba(0,0,0,0.8)',
          border: '1px solid var(--accent-primary)',
        }}
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
            <UserCheck size={22} color="var(--accent-primary)" />
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.2rem', margin: 0 }}>
                Welcome, {player.name}!
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Select your character token to claim control
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* List of Available Tokens */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {availableTokens.map((tok) => (
            <div
              key={tok.id}
              onClick={() => {
                onClaimToken(tok);
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    backgroundImage: tok.imageUrl ? `url("${tok.imageUrl}")` : 'none',
                    backgroundColor: tok.fillColor || '#1e293b',
                    border: `2px solid ${tok.ringColor || 'var(--accent-primary)'}`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: '#fff',
                  }}
                >
                  {!tok.imageUrl && tok.name.slice(0, 2).toUpperCase()}
                </div>

                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{tok.name}</div>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Heart size={12} color="#f43f5e" /> {tok.currentHp}/{tok.maxHp} HP
                    </span>
                    <span>•</span>
                    <span>Speed {tok.speed || 30}ft</span>
                  </div>
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onClaimToken(tok);
                  onClose();
                }}
              >
                Claim Token
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            You can also import a D&D Beyond sheet at any time.
          </span>
          <button className="btn btn-secondary" onClick={onClose}>
            Skip for Now
          </button>
        </div>
      </div>
    </div>
  );
};
