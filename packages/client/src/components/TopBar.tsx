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
  Mic,
  MicOff,
  Headphones,
  Radio,
  Database,
  MessageSquare,
} from 'lucide-react';
import { Player, GameMap } from '@oldbear/shared';
import { VoiceState } from '../network/VoiceManager.js';

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

  const isSendingAudio =
    !voiceState?.isMuted &&
    !voiceState?.isForceMuted &&
    Boolean(voiceState?.isSpeaking || voiceState?.isPttActive);

  const isReceivingAudio =
    !voiceState?.isDeafened &&
    (players.some((p) => p.id !== localPlayer?.id && p.isSpeaking) || Boolean(voiceState?.isAudioStreaming));

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
        {players.map((p) => {
          const isSelf = p.id === localPlayer?.id;
          const isSpeaking = isSelf ? (voiceState?.isSpeaking || false) : (p.isSpeaking || false);
          const isMuted = isSelf ? (voiceState?.isMuted || voiceState?.isForceMuted) : (p.isMuted || p.isForceMuted);

          return (
            <div
              key={p.id}
              title={`${p.name} (${p.role.toUpperCase()})${isSpeaking ? ' - Speaking' : ''}${p.isForceMuted ? ' - Force Muted by GM' : isMuted ? ' - Muted' : ''}`}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: p.color,
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
              {p.name[0]?.toUpperCase() || '?'}
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
        {/* Invite Link Button */}
        <button
          className="btn btn-secondary topbar-desktop-only"
          style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
          onClick={copyInviteLink}
        >
          {copied ? <Check size={14} color="#10b981" /> : <Share2 size={14} />}
          <span className="topbar-map-label">{copied ? 'Link Copied!' : 'Invite'}</span>
        </button>

        {/* Quick Voice Controls */}
        <button
          className={`btn-icon topbar-desktop-only ${isSendingAudio ? 'anim-sending-audio' : ''}`}
          onClick={onToggleMute}
          title={
            voiceState?.isForceMuted
              ? 'Muted by GM'
              : voiceState?.isMuted
              ? 'Unmute Microphone'
              : isSendingAudio
              ? 'Transmitting Voice Audio'
              : 'Mute Microphone'
          }
          style={{
            color:
              voiceState?.isForceMuted || voiceState?.isMuted
                ? 'var(--accent-rose)'
                : isSendingAudio
                ? 'var(--accent-emerald)'
                : '#ffffff',
            backgroundColor:
              voiceState?.isForceMuted || voiceState?.isMuted
                ? 'rgba(244, 63, 94, 0.15)'
                : isSendingAudio
                ? 'rgba(16, 185, 129, 0.25)'
                : undefined,
          }}
        >
          {voiceState?.isForceMuted || voiceState?.isMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        <button
          className={`btn-icon topbar-desktop-only ${isReceivingAudio ? 'anim-receiving-audio' : ''}`}
          onClick={onToggleDeafen}
          title={
            voiceState?.isDeafened
              ? 'Undeafen'
              : isReceivingAudio
              ? 'Receiving Audio Stream / Voice'
              : 'Deafen (Mute incoming sound & mic)'
          }
          style={{
            color:
              voiceState?.isDeafened
                ? 'var(--accent-rose)'
                : isReceivingAudio
                ? '#38bdf8'
                : '#ffffff',
            backgroundColor:
              voiceState?.isDeafened
                ? 'rgba(244, 63, 94, 0.15)'
                : isReceivingAudio
                ? 'rgba(56, 189, 248, 0.25)'
                : undefined,
          }}
        >
          <Headphones size={18} />
        </button>

        <button
          className="btn-icon topbar-desktop-only"
          onClick={onOpenVoiceSettings}
          title="Voice & Audio Settings"
        >
          <Radio size={18} />
        </button>

        {/* Chat & Dice Commands Toggle (Bug #45) */}
        {onToggleChat && (
          <button
            className="btn-icon topbar-desktop-only"
            onClick={onToggleChat}
            title="Chat & Dice Commands (/roll, /attack, /skill)"
            style={{
              position: 'relative',
              backgroundColor: isChatOpen ? 'var(--accent-primary)' : undefined,
              color: isChatOpen ? '#ffffff' : undefined,
            }}
          >
            <MessageSquare size={18} />
            {unreadChatCount && unreadChatCount > 0 ? (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: 'var(--accent-rose)',
                  color: '#fff',
                  borderRadius: '10px',
                  fontSize: '0.65rem',
                  padding: '1px 5px',
                  fontWeight: 800,
                  lineHeight: '1',
                }}
              >
                {unreadChatCount}
              </span>
            ) : null}
          </button>
        )}

        {/* Dice Roller Toggle */}
        <button className="btn-icon topbar-desktop-only" onClick={onOpenDice} title="Dice Roller">
          <Dices size={18} />
        </button>

        {/* Initiative Tracker Toggle */}
        <button className="btn-icon topbar-desktop-only" onClick={onOpenInitiative} title="Initiative Tracker">
          <Swords size={18} />
        </button>

        {/* Character Sheet Toggle */}
        <button className="btn-icon topbar-desktop-only" onClick={onOpenCharacter} title="Character Sheet">
          <User size={18} />
        </button>

        {/* GM Features */}
        {isGm && (
          <>
            <button className="btn-icon topbar-desktop-only" onClick={onOpenMaps} title="Manage Maps & Scenes">
              <Map size={18} />
            </button>
            <button className="btn-icon topbar-desktop-only" onClick={onAddNewToken} title="Create / Deploy New Token">
              <Plus size={18} />
            </button>
          </>
        )}

        {/* Soundboard Toggle */}
        <button className="btn-icon topbar-desktop-only" onClick={onOpenSoundboard} title="Soundboard & Audio">
          <Volume2 size={18} />
        </button>

        {/* Backup & Transfer Data Toggle */}
        {onOpenBackup && (
          <button
            className="btn-icon topbar-desktop-only"
            onClick={onOpenBackup}
            title="Backup & Transfer Data (Export/Import)"
          >
            <Database size={18} />
          </button>
        )}
      </div>
    </header>
  );
};
