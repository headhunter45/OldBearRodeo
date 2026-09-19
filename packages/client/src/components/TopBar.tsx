import React, { useState } from 'react';
import {
  Share2,
  Menu,
  Check,
  MessageSquareHeart,
} from 'lucide-react';
import { Player, GameMap } from '@oldbear/shared';
import { VoiceState } from '../network/VoiceManager.js';
import { FULL_VERSION_STRING } from '../config/version.js';

interface TopBarProps {
  roomName: string;
  activeMapName: string;
  isGm: boolean;
  players: Player[];
  localPlayer: Player | null;
  voiceState?: VoiceState;
  onToggleMute?: () => void;
  onToggleDeafen?: () => void;
  onOpenVoiceSettings?: () => void;
  onToggleChat?: () => void;
  isChatOpen?: boolean;
  unreadChatCount?: number;
  onOpenDice: () => void;
  onOpenInitiative: () => void;
  onOpenCharacter: () => void;
  onOpenMaps: () => void;
  onOpenSoundboard: () => void;
  onOpenBackup?: () => void;
  onAddNewToken: () => void;
  onToggleMobileDrawer: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  roomName,
  activeMapName,
  isGm,
  players,
  localPlayer,
  voiceState,
  onToggleMute,
  onToggleDeafen,
  onOpenVoiceSettings,
  onToggleChat,
  isChatOpen,
  unreadChatCount,
  onOpenDice,
  onOpenInitiative,
  onOpenCharacter,
  onOpenMaps,
  onOpenSoundboard,
  onOpenBackup,
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
        {/* Hamburger Menu (Far Left) */}
        <button
          className="btn-icon"
          onClick={onToggleMobileDrawer}
          title="Menu"
          style={{ backgroundColor: 'var(--accent-primary)', color: '#ffffff', flexShrink: 0 }}
        >
          <Menu size={18} />
        </button>

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
          <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', justifyContent: 'center' }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '1.1rem',
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #ffffff, #94a3b8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.1,
              }}
            >
              Old Bear Rodeo
            </span>
            <span
              style={{
                position: 'absolute',
                top: '100%',
                left: '1px',
                marginTop: '1px',
                fontSize: '0.58rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: 'var(--text-muted)',
                lineHeight: 1,
                pointerEvents: 'none',
                opacity: 0.8,
              }}
            >
              {FULL_VERSION_STRING}
            </span>
          </div>
        </div>

        <div className="topbar-map-label" style={{ width: '1px', height: '20px', background: 'var(--border-subtle)' }} />

        <div className="topbar-map-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Map:</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{activeMapName}</span>
        </div>

        {voiceState?.isAudioStreaming && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.75rem',
              color: 'var(--accent-emerald)',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              padding: '0.15rem 0.5rem',
              borderRadius: 'var(--radius-full)',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-emerald)',
                boxShadow: '0 0 6px var(--accent-emerald)',
              }}
            />
            Stream Active
          </div>
        )}
      </div>

      {/* Center Online Player Indicators */}
      <div className="topbar-players-list" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
        {players.filter((p) => p.connected !== false).map((p) => {
          const isSelf = p.id === localPlayer?.id;
          const currentPlayer = isSelf && localPlayer ? localPlayer : p;
          const isSpeaking = isSelf ? (voiceState?.isSpeaking || false) : (currentPlayer.isSpeaking || false);
          const isMuted = isSelf ? (voiceState?.isMuted || voiceState?.isForceMuted) : (currentPlayer.isMuted || currentPlayer.isForceMuted);

          return (
            <div
              key={currentPlayer.id}
              title={`${currentPlayer.name} (${currentPlayer.role.toUpperCase()})${isSpeaking ? ' - Speaking' : ''}${currentPlayer.isForceMuted ? ' - Force Muted by GM' : isMuted ? ' - Muted' : ''}`}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: currentPlayer.color,
                border: isSpeaking ? '2.5px solid #10b981' : '2px solid rgba(255, 255, 255, 0.65)',
                boxShadow: isSpeaking ? '0 0 12px #10b981, inset 0 0 4px #10b981' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 'bold',
                color: 'white',
                position: 'relative',
                transition: 'all 0.15s ease',
              }}
            >
              {currentPlayer.name[0]?.toUpperCase() || '?'}
              {isMuted && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-2px',
                    width: '9px',
                    height: '9px',
                    borderRadius: '50%',
                    backgroundColor: p.isForceMuted || voiceState?.isForceMuted ? 'var(--accent-rose)' : '#94a3b8',
                    border: '1.5px solid var(--bg-surface)',
                  }}
                  title={p.isForceMuted ? 'Force Muted' : 'Muted'}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Launch Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        {/* Feedback Form Link (Task #125) */}
        <a
          href="https://forms.gle/zD9Rmqj4c3Dffpw39"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary"
          style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          title="Send Feedback & Suggestions"
        >
          <MessageSquareHeart size={14} color="#f43f5e" />
          <span className="topbar-map-label">Feedback</span>
        </a>

        {/* GitHub Repository Link (Task #125) */}
        <a
          href="https://github.com/headhunter45/OldBearRodeo"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary"
          style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          title="GitHub Repository"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          <span className="topbar-map-label">GitHub</span>
        </a>

        {/* Invite Link Button */}
        <button
          className="btn btn-secondary"
          style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
          onClick={copyInviteLink}
        >
          {copied ? <Check size={14} color="#10b981" /> : <Share2 size={14} />}
          <span className="topbar-map-label">{copied ? 'Link Copied!' : 'Invite'}</span>
        </button>
      </div>
    </header>
  );
};
