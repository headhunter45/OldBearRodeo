import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Upload,
  X,
  Radio,
  Trash2,
  Music,
  Plus,
} from 'lucide-react';
import { saveAsset, getAssetsByType, deleteAsset } from '../storage/db.js';

interface SoundboardModalProps {
  isGm: boolean;
  onClose: () => void;
  onBroadcastAudioAction?: (trackId: string, action: 'play' | 'pause' | 'stop', volume?: number) => void;
}

export interface CustomSoundTrack {
  id: string;
  name: string;
  dataUrl: string;
  category: 'sfx' | 'ambience';
  volume: number;
  isLooping: boolean;
  isPlaying?: boolean;
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

export const SoundboardModal: React.FC<SoundboardModalProps> = ({
  isGm,
  onClose,
  onBroadcastAudioAction,
}) => {
  const [ambientVolume, setAmbientVolume] = useState(0.5);
  const [sfxVolume, setSfxVolume] = useState(0.7);
  const [broadcastToPlayers, setBroadcastToPlayers] = useState(true);
  const [customTracks, setCustomTracks] = useState<CustomSoundTrack[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioPlayersRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Load custom tracks from IndexedDB
  useEffect(() => {
    let mounted = true;
    getAssetsByType('audio').then((assets) => {
      if (!mounted) return;
      const tracks: CustomSoundTrack[] = assets.map((a) => ({
        id: a.id,
        name: a.name,
        dataUrl: a.dataUrl,
        category: a.width === 1 ? 'ambience' : 'sfx',
        volume: 0.8,
        isLooping: a.width === 1,
        isPlaying: false,
      }));
      setCustomTracks(tracks);
    });

    return () => {
      mounted = false;
      // Stop all playing audio elements on unmount
      audioPlayersRef.current.forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
      audioPlayersRef.current.clear();
    };
  }, []);

  const handleProcessAudioFiles = async (files: FileList | File[]) => {
    const newTracks: CustomSoundTrack[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)) {
        continue;
      }

      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          const trackId = `audio-${crypto.randomUUID()}`;
          const cleanName = file.name.replace(/\.[^/.]+$/, '');
          const isAmbience = cleanName.toLowerCase().includes('ambien') || cleanName.toLowerCase().includes('music') || cleanName.toLowerCase().includes('bg');

          const track: CustomSoundTrack = {
            id: trackId,
            name: cleanName,
            dataUrl,
            category: isAmbience ? 'ambience' : 'sfx',
            volume: 0.8,
            isLooping: isAmbience,
            isPlaying: false,
          };

          await saveAsset({
            id: trackId,
            name: cleanName,
            type: 'audio',
            dataUrl,
            width: isAmbience ? 1 : 0, // encode category in width flag
            createdAt: Date.now(),
          });

          newTracks.push(track);
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }

    if (newTracks.length > 0) {
      setCustomTracks((prev) => [...prev, ...newTracks]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessAudioFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleTogglePlay = (track: CustomSoundTrack) => {
    const existingAudio = audioPlayersRef.current.get(track.id);

    if (track.isPlaying) {
      // Pause
      if (existingAudio) {
        existingAudio.pause();
      }
      setCustomTracks((prev) =>
        prev.map((t) => (t.id === track.id ? { ...t, isPlaying: false } : t))
      );
      if (broadcastToPlayers && onBroadcastAudioAction) {
        onBroadcastAudioAction(track.id, 'pause');
      }
    } else {
      // Play
      let audio = existingAudio;
      if (!audio) {
        audio = new Audio(track.dataUrl);
        audioPlayersRef.current.set(track.id, audio);
      }

      audio.loop = track.isLooping;
      const baseMasterVol = track.category === 'ambience' ? ambientVolume : sfxVolume;
      audio.volume = Math.max(0, Math.min(1, baseMasterVol * track.volume));

      audio.onended = () => {
        setCustomTracks((prev) =>
          prev.map((t) => (t.id === track.id ? { ...t, isPlaying: false } : t))
        );
      };

      audio.play().catch((err) => console.warn('Audio play prevented:', err));

      setCustomTracks((prev) =>
        prev.map((t) => (t.id === track.id ? { ...t, isPlaying: true } : t))
      );
      if (broadcastToPlayers && onBroadcastAudioAction) {
        onBroadcastAudioAction(track.id, 'play', audio.volume);
      }
    }
  };

  const handleToggleLoop = (trackId: string) => {
    setCustomTracks((prev) =>
      prev.map((t) => {
        if (t.id === trackId) {
          const nextLoop = !t.isLooping;
          const audio = audioPlayersRef.current.get(trackId);
          if (audio) audio.loop = nextLoop;
          return { ...t, isLooping: nextLoop };
        }
        return t;
      })
    );
  };

  const handleTrackVolumeChange = (trackId: string, vol: number) => {
    setCustomTracks((prev) =>
      prev.map((t) => {
        if (t.id === trackId) {
          const audio = audioPlayersRef.current.get(trackId);
          if (audio) {
            const masterVol = t.category === 'ambience' ? ambientVolume : sfxVolume;
            audio.volume = Math.max(0, Math.min(1, masterVol * vol));
          }
          return { ...t, volume: vol };
        }
        return t;
      })
    );
  };

  const handleDeleteTrack = async (trackId: string) => {
    const audio = audioPlayersRef.current.get(trackId);
    if (audio) {
      audio.pause();
      audio.src = '';
      audioPlayersRef.current.delete(trackId);
    }
    await deleteAsset(trackId);
    setCustomTracks((prev) => prev.filter((t) => t.id !== trackId));
  };

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
          maxWidth: '540px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem',
          overflow: 'hidden',
          border: isDraggingOver ? '2px dashed var(--accent-primary)' : '1px solid var(--border-strong)',
        }}
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleProcessAudioFiles(e.dataTransfer.files);
          }
        }}
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

        {/* Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.25rem' }}>
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
                style={{ accentColor: 'var(--accent-emerald)', cursor: 'pointer' }}
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

          {/* Custom Uploaded Sounds (Item 15) */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                CUSTOM SOUND TRACKS ({customTracks.length})
              </div>
              {isGm && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  <button
                    className="btn btn-primary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus size={14} /> Add Sounds (Multi)
                  </button>
                </div>
              )}
            </div>

            {customTracks.length === 0 ? (
              <div
                style={{
                  padding: '1.25rem',
                  border: '1px dashed var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                }}
              >
                {isGm
                  ? 'No custom audio tracks yet. Click "Add Sounds" or drag and drop audio files here!'
                  : 'No custom audio tracks added by GM.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {customTracks.map((track) => (
                  <div
                    key={track.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.6rem 0.8rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: track.isPlaying ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                      <button
                        className="btn-icon"
                        style={{
                          width: '32px',
                          height: '32px',
                          color: track.isPlaying ? 'var(--accent-emerald)' : 'white',
                          backgroundColor: track.isPlaying ? 'rgba(16, 185, 129, 0.2)' : undefined,
                        }}
                        onClick={() => handleTogglePlay(track)}
                        title={track.isPlaying ? 'Pause' : 'Play'}
                      >
                        {track.isPlaying ? <Pause size={16} /> : <Play size={16} />}
                      </button>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {track.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {track.category.toUpperCase()} • {Math.round(track.volume * 100)}% vol
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        className={`btn-icon ${track.isLooping ? 'active' : ''}`}
                        style={{
                          width: '28px',
                          height: '28px',
                          color: track.isLooping ? 'var(--accent-primary)' : 'var(--text-muted)',
                        }}
                        onClick={() => handleToggleLoop(track.id)}
                        title={track.isLooping ? 'Loop: ON' : 'Loop: OFF'}
                      >
                        <RotateCcw size={14} />
                      </button>

                      {isGm && (
                        <button
                          className="btn-icon"
                          style={{ width: '28px', height: '28px', color: 'var(--accent-rose)' }}
                          onClick={() => handleDeleteTrack(track.id)}
                          title="Delete Track"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick SFX Soundboard Buttons */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
              BUILT-IN SFX (SYNTHESIZED)
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
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
