import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Dices,
  Swords,
  Map,
  Volume2,
  Settings,
  Share2,
  Check,
  Mic,
  MicOff,
  Headphones,
  Radio,
  Database,
  MessageSquare,
  Plus,
} from 'lucide-react';
import { Player } from '@oldbear/shared';
import { VoiceState } from '../network/VoiceManager.js';

import { COLOR_VALUES } from '../config/colors.js';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  localPlayer: Player | null;
  players?: Player[];
  onUpdatePlayerName: (name: string, color: string) => void;
  onAddNewToken?: () => void;
  onOpenDice: () => void;
  onOpenInitiative: () => void;
  onOpenCharacter: () => void;
  onOpenMaps: () => void;
  onOpenSoundboard: () => void;
  onOpenBackup?: () => void;
  onToggleChat?: () => void;
  isChatOpen?: boolean;
  unreadChatCount?: number;
  voiceState?: VoiceState;
  onToggleMute?: () => void;
  onToggleDeafen?: () => void;
  onOpenVoiceSettings?: () => void;
  isGm: boolean;
}

const PLAYER_COLORS = COLOR_VALUES;

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  localPlayer,
  players,
  onUpdatePlayerName,
  onAddNewToken,
  onOpenDice,
  onOpenInitiative,
  onOpenCharacter,
  onOpenMaps,
  onOpenSoundboard,
  onOpenBackup,
  onToggleChat,
  isChatOpen,
  unreadChatCount,
  voiceState,
  onToggleMute,
  onToggleDeafen,
  onOpenVoiceSettings,
  isGm,
}) => {
  const [name, setName] = useState(
    localPlayer?.name || localStorage.getItem('oldbear_player_name') || (isGm ? 'GM' : 'Player')
  );
  const [color, setColor] = useState(
    localPlayer?.color || localStorage.getItem('oldbear_player_color') || '#6366f1'
  );
  const [copied, setCopied] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (localPlayer) {
      setName(localPlayer.name);
      setColor(localPlayer.color);
    } else {
      const savedName = localStorage.getItem('oldbear_player_name');
      if (savedName) setName(savedName);
      const savedColor = localStorage.getItem('oldbear_player_color');
      if (savedColor) setColor(savedColor);
    }
  }, [localPlayer, isOpen]);

  if (!isOpen && !isClosing) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 240);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePlayerName(name, color);
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSendingAudio =
    !voiceState?.isMuted &&
    !voiceState?.isForceMuted &&
    Boolean(voiceState?.isSpeaking || voiceState?.isPttActive);

  return (
    <div
      className={isClosing ? 'animate-fade-out' : 'animate-fade-in'}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'flex-start',
      }}
      onClick={handleClose}
    >
      <div
        className={`glass-panel ${isClosing ? 'animate-slide-left-out' : 'animate-slide-left'}`}
        style={{
          width: '85%',
          maxWidth: '360px',
          height: '100%',
          borderRadius: 0,
          borderLeft: 'none',
          borderTop: 'none',
          borderBottom: 'none',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.25rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🐻</span>
            <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em' }}>
              Old Bear Rodeo
            </span>
          </div>
          <button className="btn-icon" onClick={handleClose} style={{ width: '32px', height: '32px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Voice Controls Section */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.6rem 0.75rem',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: voiceState?.isSpeaking ? 'var(--accent-emerald)' : 'var(--text-muted)',
                boxShadow: voiceState?.isSpeaking ? '0 0 8px var(--accent-emerald)' : 'none',
              }}
            />
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
              {voiceState?.isForceMuted ? 'Muted by GM' : voiceState?.isMuted ? 'Mic Muted' : isSendingAudio ? 'Transmitting...' : 'Voice Active'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              className={`btn-icon ${isSendingAudio ? 'anim-sending-audio' : ''}`}
              style={{
                width: '32px',
                height: '32px',
                color: voiceState?.isMuted || voiceState?.isForceMuted ? 'var(--accent-rose)' : isSendingAudio ? 'var(--accent-emerald)' : undefined,
              }}
              onClick={onToggleMute}
              title="Toggle Microphone"
            >
              {voiceState?.isMuted || voiceState?.isForceMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>

            <button
              className="btn-icon"
              style={{
                width: '32px',
                height: '32px',
                color: voiceState?.isDeafened ? 'var(--accent-rose)' : undefined,
              }}
              onClick={onToggleDeafen}
              title="Toggle Deafen"
            >
              <Headphones size={16} />
            </button>

            <button
              className="btn-icon"
              style={{ width: '32px', height: '32px' }}
              onClick={() => {
                onClose();
                onOpenVoiceSettings?.();
              }}
              title="Voice Settings"
            >
              <Radio size={16} />
            </button>
          </div>
        </div>

        {/* Profile Customization Section */}
        <form
          onSubmit={handleSaveProfile}
          style={{
            background: 'var(--bg-surface-elevated)',
            padding: '0.85rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '1rem',
          }}
        >
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            CUSTOMIZE YOUR NICKNAME
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                flex: 1,
                padding: '0.4rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'white',
                fontSize: '0.85rem',
              }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.4rem 0.75rem' }}>
              Save
            </button>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Pointer & Token Color</label>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}>
              {PLAYER_COLORS.map((c) => (
                <div
                  key={c}
                  onClick={() => {
                    setColor(c);
                    onUpdatePlayerName(name, c);
                  }}
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: c,
                    cursor: 'pointer',
                    border: color === c ? '2px solid white' : 'none',
                    transform: color === c ? 'scale(1.15)' : 'none',
                  }}
                />
              ))}
            </div>
          </div>
        </form>

        {/* Quick Drawer Navigation Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1 }}>
          <button
            className="btn btn-secondary"
            style={{ justifyContent: 'flex-start', padding: '0.65rem' }}
            onClick={() => {
              onClose();
              onOpenVoiceSettings?.();
            }}
          >
            <Radio size={18} color="var(--accent-primary)" /> Voice & Audio Settings
          </button>

          <button
            className="btn btn-secondary"
            style={{ justifyContent: 'flex-start', padding: '0.65rem' }}
            onClick={() => {
              onClose();
              onOpenCharacter();
            }}
          >
            <User size={18} color="var(--accent-primary)" /> Character Sheet & Spells
          </button>

          {onToggleChat && (
            <button
              className={`btn btn-secondary ${isChatOpen ? 'active' : ''}`}
              style={{
                justifyContent: 'flex-start',
                padding: '0.65rem',
                position: 'relative',
                backgroundColor: isChatOpen ? 'rgba(99, 102, 241, 0.2)' : undefined,
                borderColor: isChatOpen ? 'var(--accent-primary)' : undefined,
              }}
              onClick={() => {
                onClose();
                onToggleChat();
              }}
            >
              <MessageSquare size={18} color="var(--accent-primary)" />
              <span style={{ flex: 1, textAlign: 'left' }}>
                {isChatOpen ? 'Close Chat Window' : 'Chat & Dice Commands'}
              </span>
              {unreadChatCount && unreadChatCount > 0 ? (
                <span
                  style={{
                    backgroundColor: 'var(--accent-rose)',
                    color: '#fff',
                    borderRadius: '10px',
                    fontSize: '0.7rem',
                    padding: '2px 7px',
                    fontWeight: 800,
                  }}
                >
                  {unreadChatCount} new
                </span>
              ) : null}
            </button>
          )}

          <button
            className="btn btn-secondary"
            style={{ justifyContent: 'flex-start', padding: '0.65rem' }}
            onClick={() => {
              onClose();
              onOpenDice();
            }}
          >
            <Dices size={18} color="var(--accent-primary)" /> Dice Roller
          </button>

          <button
            className="btn btn-secondary"
            style={{ justifyContent: 'flex-start', padding: '0.65rem' }}
            onClick={() => {
              onClose();
              onOpenInitiative();
            }}
          >
            <Swords size={18} color="var(--accent-gold)" /> Initiative Tracker
          </button>

          <button
            className="btn btn-secondary"
            style={{ justifyContent: 'flex-start', padding: '0.65rem' }}
            onClick={() => {
              onClose();
              onOpenSoundboard();
            }}
          >
            <Volume2 size={18} color="var(--accent-emerald)" /> Soundboard
          </button>

          {onOpenBackup && (
            <button
              className="btn btn-secondary"
              style={{ justifyContent: 'flex-start', padding: '0.65rem' }}
              onClick={() => {
                onClose();
                onOpenBackup();
              }}
            >
              <Database size={18} color="var(--accent-primary)" /> Backup & Transfer Data
            </button>
          )}

          {isGm && (
            <>
              <button
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '0.65rem' }}
                onClick={() => {
                  onClose();
                  onOpenMaps();
                }}
              >
                <Map size={18} color="#38bdf8" /> Maps & Scenes Manager
              </button>

              {onAddNewToken && (
                <button
                  className="btn btn-secondary"
                  style={{ justifyContent: 'flex-start', padding: '0.65rem' }}
                  onClick={() => {
                    onClose();
                    onAddNewToken();
                  }}
                >
                  <Plus size={18} color="#10b981" /> Create / Deploy New Token
                </button>
              )}
            </>
          )}
        </div>

        {/* Online Players in Drawer */}
        {(() => {
          const onlinePlayers = (players || []).filter((p) => p.connected !== false);
          if (onlinePlayers.length === 0) return null;
          return (
            <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem', padding: '0.6rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
                ONLINE PLAYERS ({onlinePlayers.length})
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {onlinePlayers.map((p) => {
                  const isSelf = p.id === localPlayer?.id;
                  const effectivePlayer = isSelf && localPlayer ? localPlayer : p;
                  return (
                    <div
                      key={effectivePlayer.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--bg-surface)',
                      border: `1px solid ${effectivePlayer.color}44`,
                      fontSize: '0.75rem',
                    }}
                  >
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: effectivePlayer.color,
                      }}
                    />
                    <span style={{ color: 'white', fontWeight: 600 }}>{effectivePlayer.name}</span>
                    {effectivePlayer.role === 'gm' && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--accent-gold)' }}>GM</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

        {/* Footer: Share invite */}
        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={copyInvite}>
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            {copied ? 'Invite Link Copied!' : 'Copy Session Invite Link'}
          </button>
        </div>
      </div>
    </div>
  );
};
