import React, { useState } from 'react';
import {
  Share2,
  Dices,
  Swords,
  User,
  Map,
  Volume2,
  Menu,
  Plus,
  Copy,
  Check,
} from 'lucide-react';
import { Player, GameMap } from '@oldbear/shared';

interface TopBarProps {
  roomName: string;
  activeMapName: string;
  isGm: boolean;
  players: Player[];
  localPlayer: Player | null;
  onOpenDice: () => void;
  onOpenInitiative: () => void;
  onOpenCharacter: () => void;
  onOpenMaps: () => void;
  onOpenSoundboard: () => void;
  onAddNewToken: () => void;
  onToggleMobileDrawer: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  roomName,
  activeMapName,
  isGm,
  players,
  localPlayer,
  onOpenDice,
  onOpenInitiative,
  onOpenCharacter,
  onOpenMaps,
  onOpenSoundboard,
  onAddNewToken,
  onToggleMobileDrawer,
}) => {
  const [copied, setCopied] = useState(false);

  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <header
      className="floating-hud glass-panel"
      style={{
        top: '0.75rem',
        left: '0.75rem',
        right: '0.75rem',
        padding: '0.5rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
      }}
    >
      {/* Brand & Map Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '14px',
              color: 'white',
              boxShadow: '0 0 10px var(--accent-glow)',
            }}
          >
            🐻
          </div>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '1.1rem',
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #ffffff, #94a3b8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            OldBearRodeo
          </span>
        </div>

        <div style={{ width: '1px', height: '20px', background: 'var(--border-subtle)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Map:</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{activeMapName}</span>
        </div>
      </div>

      {/* Center Online Player Indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        {players.map((p) => (
          <div
            key={p.id}
            title={`${p.name} (${p.role.toUpperCase()})`}
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: p.color,
              border: '2px solid white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 'bold',
              color: 'white',
            }}
          >
            {p.name[0]?.toUpperCase() || '?'}
          </div>
        ))}
      </div>

      {/* Quick Launch Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        {/* Invite Link Button */}
        <button
          className="btn btn-secondary"
          style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
          onClick={copyInviteLink}
        >
          {copied ? <Check size={14} color="#10b981" /> : <Share2 size={14} />}
          <span>{copied ? 'Link Copied!' : 'Invite'}</span>
        </button>

        {/* Dice Roller Toggle */}
        <button className="btn-icon" onClick={onOpenDice} title="Dice Roller">
          <Dices size={18} />
        </button>

        {/* Initiative Tracker Toggle */}
        <button className="btn-icon" onClick={onOpenInitiative} title="Initiative Tracker">
          <Swords size={18} />
        </button>

        {/* Character Sheet Toggle */}
        <button className="btn-icon" onClick={onOpenCharacter} title="Character Sheet">
          <User size={18} />
        </button>

        {/* GM Features */}
        {isGm && (
          <>
            <button className="btn-icon" onClick={onOpenMaps} title="Manage Maps & Scenes">
              <Map size={18} />
            </button>
            <button className="btn-icon" onClick={onAddNewToken} title="Create / Deploy New Token">
              <Plus size={18} />
            </button>
          </>
        )}

        {/* Soundboard Toggle */}
        <button className="btn-icon" onClick={onOpenSoundboard} title="Soundboard & Audio">
          <Volume2 size={18} />
        </button>

        {/* Mobile Hamburger Menu */}
        <button className="btn-icon" onClick={onToggleMobileDrawer} title="Menu">
          <Menu size={18} />
        </button>
      </div>
    </header>
  );
};
