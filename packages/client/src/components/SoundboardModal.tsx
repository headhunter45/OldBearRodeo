import React, { useState } from 'react';
import { Volume2, VolumeX, Play, Pause, RotateCcw, Upload, X, Radio } from 'lucide-react';
import { SoundTrack } from '@oldbear/shared';

interface SoundboardModalProps {
  isGm: boolean;
  onClose: () => void;
}

// Synthesized audio generator using Web Audio API so sound effects work out of the box!
class SynthAudio {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playSwordSlash(volume = 0.5) {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(volume * 0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  playSpellCast(volume = 0.5) {
    const ctx = this.getContext();
    const now = ctx.currentTime;
    [440, 554.37, 659.25, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.05);
      gain.gain.linearRampToValueAtTime(volume * 0.2, now + i * 0.05 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.6);
    });
  }

  playDiceRattle(volume = 0.5) {
    const ctx = this.getContext();
    const now = ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 120 + Math.random() * 200;
      const t = now + i * 0.04;
      gain.gain.setValueAtTime(volume * 0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.06);
    }
  }

  playVictoryFanfare(volume = 0.5) {
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      const t = now + idx * 0.12;
      gain.gain.setValueAtTime(volume * 0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (idx === 3 ? 0.6 : 0.2));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + (idx === 3 ? 0.6 : 0.2));
    });
  }
}

const synth = new SynthAudio();

export const SoundboardModal: React.FC<SoundboardModalProps> = ({ isGm, onClose }) => {
  const [ambientVolume, setAmbientVolume] = useState(0.5);
  const [sfxVolume, setSfxVolume] = useState(0.7);
  const [broadcastToPlayers, setBroadcastToPlayers] = useState(true);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel-elevated animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: '1.5rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Volume2 size={22} color="var(--accent-primary)" />
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem' }}>
              Soundboard & Audio
            </h2>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* GM Broadcast Toggle */}
        {isGm && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-surface-elevated)',
              marginBottom: '1.25rem',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Radio size={16} color={broadcastToPlayers ? '#10b981' : 'var(--text-muted)'} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                Broadcast Sounds to Players
              </span>
            </div>
            <input
              type="checkbox"
              checked={broadcastToPlayers}
              onChange={(e) => setBroadcastToPlayers(e.target.checked)}
            />
          </div>
        )}

        {/* Volume Sliders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Sound Effects Volume</span>
              <span>{Math.round(sfxVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={sfxVolume}
              onChange={(e) => setSfxVolume(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Background Ambience Volume</span>
              <span>{Math.round(ambientVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={ambientVolume}
              onChange={(e) => setAmbientVolume(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
            />
          </div>
        </div>

        {/* Quick SFX Soundboard Buttons */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
            ONE-SHOT SOUND EFFECTS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <button
              className="btn btn-secondary"
              style={{ padding: '0.6rem', fontSize: '0.85rem' }}
              onClick={() => synth.playSwordSlash(sfxVolume)}
            >
              🗡️ Weapon Slash
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: '0.6rem', fontSize: '0.85rem' }}
              onClick={() => synth.playSpellCast(sfxVolume)}
            >
              ✨ Arcane Spell
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: '0.6rem', fontSize: '0.85rem' }}
              onClick={() => synth.playDiceRattle(sfxVolume)}
            >
              🎲 Dice Clatter
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: '0.6rem', fontSize: '0.85rem' }}
              onClick={() => synth.playVictoryFanfare(sfxVolume)}
            >
              🎺 Victory Fanfare
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
