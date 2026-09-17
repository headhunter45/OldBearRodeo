import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  Volume2,
  VolumeX,
  Radio,
  Sliders,
  MonitorUp,
  ShieldAlert,
  Key,
  X,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Player } from '@oldbear/shared';
import { VoiceManager, VoiceState } from '../network/VoiceManager.js';

interface VoiceSettingsModalProps {
  voiceManager: VoiceManager;
  voiceState: VoiceState;
  players: Player[];
  localPlayer: Player | null;
  isGm: boolean;
  onForceMutePlayer?: (targetPlayerId: string) => void;
  onClose: () => void;
}

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  voiceManager,
  voiceState,
  players,
  localPlayer,
  isGm,
  onForceMutePlayer,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'devices' | 'transmission' | 'participants' | 'stream'>('devices');
  const [isRecordingKey, setIsRecordingKey] = useState(false);
  const [peerVolumes, setPeerVolumes] = useState<{ [peerId: string]: number }>({});
  const [isStreaming, setIsStreaming] = useState(voiceState.isAudioStreaming);

  // Initialize peer volumes
  useEffect(() => {
    const vols: { [peerId: string]: number } = {};
    for (const p of players) {
      if (p.id !== localPlayer?.id) {
        vols[p.id] = voiceManager.getPeerVolume(p.id);
      }
    }
    setPeerVolumes(vols);
  }, [players, localPlayer]);

  // Key recording listener for Push-to-Talk
  useEffect(() => {
    if (!isRecordingKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      voiceManager.setPttKey(e.code, e.key.toUpperCase());
      setIsRecordingKey(false);
    };

    window.addEventListener('keydown', handleKeyDown, { once: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRecordingKey, voiceManager]);

  const handlePeerVolumeChange = (peerId: string, vol: number) => {
    setPeerVolumes((prev) => ({ ...prev, [peerId]: vol }));
    voiceManager.setPeerVolume(peerId, vol);
  };

  const handleToggleStreaming = async () => {
    if (voiceState.isAudioStreaming) {
      voiceManager.stopDesktopAudio();
      setIsStreaming(false);
    } else {
      const success = await voiceManager.startDesktopAudio();
      setIsStreaming(success);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        zIndex: 60,
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
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-primary), #818cf8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px var(--accent-glow)',
              }}
            >
              <Radio size={20} color="white" />
            </div>
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                }}
              >
                Voice & Audio Settings
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Real-time WebRTC voice chat and sound controls
              </p>
            </div>
          </div>

          <button className="btn-icon" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderBottom: '1px solid var(--border-subtle)',
            overflowX: 'auto',
          }}
        >
          <button
            className={`btn ${activeTab === 'devices' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
            onClick={() => setActiveTab('devices')}
          >
            <Mic size={14} /> Devices & Mic
          </button>

          <button
            className={`btn ${activeTab === 'transmission' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
            onClick={() => setActiveTab('transmission')}
          >
            <Sliders size={14} /> Transmission Mode
          </button>

          <button
            className={`btn ${activeTab === 'participants' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
            onClick={() => setActiveTab('participants')}
          >
            <Volume2 size={14} /> Players & Volumes ({players.length})
          </button>

          {isGm && (
            <button
              className={`btn ${activeTab === 'stream' ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                fontSize: '0.8rem',
                padding: '0.4rem 0.8rem',
                backgroundColor: activeTab === 'stream' ? 'var(--accent-emerald)' : undefined,
                color: activeTab === 'stream' ? '#ffffff' : undefined,
              }}
              onClick={() => setActiveTab('stream')}
            >
              <MonitorUp size={14} /> Stream Audio {voiceState.isAudioStreaming && '●'}
            </button>
          )}
        </div>

        {/* Tab Contents */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* TAB 1: DEVICES & TEST */}
          {activeTab === 'devices' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Input Device Selection */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    INPUT DEVICE (MICROPHONE)
                  </label>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', gap: '0.25rem' }}
                    onClick={() => voiceManager.refreshDevices()}
                  >
                    <RefreshCw size={12} /> Refresh
                  </button>
                </div>

                <select
                  value={voiceState.selectedInputId}
                  onChange={(e) => voiceManager.setInputDevice(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    color: 'white',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.9rem',
                  }}
                >
                  <option value="default">System Default Microphone</option>
                  {voiceManager.availableInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Output Device Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  OUTPUT DEVICE (HEADPHONES / SPEAKERS)
                </label>
                <select
                  value={voiceState.selectedOutputId}
                  onChange={(e) => voiceManager.setOutputDevice(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    color: 'white',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.9rem',
                  }}
                >
                  <option value="default">System Default Audio Output</option>
                  {voiceManager.availableOutputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mic Input Volume Slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  <span>Microphone Gain</span>
                  <span>{Math.round(voiceState.micVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={voiceState.micVolume}
                  onChange={(e) => voiceManager.setMicVolume(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
              </div>

              {/* Live VU Meter / Mic Test */}
              <div
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    MICROPHONE TEST & LEVEL
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: voiceState.isSpeaking ? 'var(--accent-emerald)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: voiceState.isSpeaking ? 'var(--accent-emerald)' : 'var(--text-muted)',
                        boxShadow: voiceState.isSpeaking ? '0 0 8px var(--accent-emerald)' : 'none',
                      }}
                    />
                    {voiceState.isSpeaking ? 'Speaking' : 'Silent'}
                  </span>
                </div>

                {/* Level Bar */}
                <div
                  style={{
                    width: '100%',
                    height: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(voiceState.localLevel * 100, 100)}%`,
                      height: '100%',
                      background:
                        voiceState.localLevel > 0.8
                          ? 'linear-gradient(90deg, #10b981, #f59e0b, #ef4444)'
                          : voiceState.localLevel > 0.5
                          ? 'linear-gradient(90deg, #10b981, #f59e0b)'
                          : '#10b981',
                      transition: 'width 0.05s ease-out',
                      borderRadius: '6px',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRANSMISSION MODE */}
          {activeTab === 'transmission' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
                  TRANSMISSION METHOD
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {/* Option 1: Open Mic / Constant */}
                  <div
                    onClick={() => voiceManager.setTransmissionMode('open')}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor:
                        voiceState.transmissionMode === 'open'
                          ? 'rgba(99, 102, 241, 0.15)'
                          : 'var(--bg-surface-elevated)',
                      border:
                        voiceState.transmissionMode === 'open'
                          ? '2px solid var(--accent-primary)'
                          : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <Mic size={18} color="var(--accent-primary)" />
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Constant (Open Mic)</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                      Microphone transmits automatically whenever you speak. You can toggle manual mute anytime.
                    </p>
                  </div>

                  {/* Option 2: Push-to-Talk */}
                  <div
                    onClick={() => voiceManager.setTransmissionMode('ptt')}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor:
                        voiceState.transmissionMode === 'ptt'
                          ? 'rgba(99, 102, 241, 0.15)'
                          : 'var(--bg-surface-elevated)',
                      border:
                        voiceState.transmissionMode === 'ptt'
                          ? '2px solid var(--accent-primary)'
                          : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <Radio size={18} color="var(--accent-gold)" />
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Push-to-Talk (PTT)</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                      Hold a designated hotkey or on-screen button to transmit audio.
                    </p>
                  </div>
                </div>
              </div>

              {/* Push-to-Talk Keybinder Config */}
              {voiceState.transmissionMode === 'ptt' && (
                <div
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    PUSH-TO-TALK SHORTCUT KEY
                  </label>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setIsRecordingKey(true)}
                      style={{
                        padding: '0.6rem 1.25rem',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        backgroundColor: isRecordingKey ? 'var(--accent-gold)' : 'var(--bg-surface-elevated)',
                        color: isRecordingKey ? '#000000' : '#ffffff',
                        border: isRecordingKey ? '2px solid #ffffff' : '1px solid var(--border-strong)',
                        minWidth: '140px',
                      }}
                    >
                      <Key size={16} />
                      {isRecordingKey ? 'Press Any Key...' : `Key: [ ${voiceState.pttKeyDisplay} ]`}
                    </button>

                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Click the button and press any key on your keyboard to bind.
                    </span>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    💡 Tip: On mobile or touch devices, an on-screen Push-to-Talk button will automatically appear.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PARTICIPANTS & VOLUMES & GM FORCE MUTE */}
          {activeTab === 'participants' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Adjust individual volumes to balance quiet or loud players. Volume changes are saved locally.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {players.map((p) => {
                  const isSelf = p.id === localPlayer?.id;
                  const vol = isSelf ? 1.0 : (peerVolumes[p.id] ?? 1.0);

                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {/* Avatar & Name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: '130px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: p.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: 'white',
                            border: p.isSpeaking ? '2px solid var(--accent-emerald)' : '2px solid transparent',
                            boxShadow: p.isSpeaking ? '0 0 10px var(--accent-emerald)' : 'none',
                            transition: 'all var(--transition-fast)',
                          }}
                        >
                          {p.name[0]?.toUpperCase() || '?'}
                        </div>

                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {p.name} {isSelf && '(You)'}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {p.role.toUpperCase()}
                            {p.isForceMuted && (
                              <span style={{ color: 'var(--accent-rose)', marginLeft: '0.3rem', fontWeight: 600 }}>
                                [Force Muted]
                              </span>
                            )}
                            {p.isMuted && !p.isForceMuted && (
                              <span style={{ color: 'var(--text-muted)', marginLeft: '0.3rem' }}>[Muted]</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Volume Slider for Remote Peers */}
                      {!isSelf ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, maxWidth: '200px' }}>
                          {vol === 0 ? <VolumeX size={16} color="var(--accent-rose)" /> : <Volume2 size={16} />}
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.05"
                            value={vol}
                            onChange={(e) => handlePeerVolumeChange(p.id, parseFloat(e.target.value))}
                            style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
                          />
                          <span style={{ fontSize: '0.75rem', minWidth: '35px', textAlign: 'right', color: 'var(--text-muted)' }}>
                            {Math.round(vol * 100)}%
                          </span>
                        </div>
                      ) : (
                        <div style={{ flex: 1 }} />
                      )}

                      {/* GM Force Mute Button */}
                      {isGm && !isSelf && (
                        <button
                          className="btn btn-secondary"
                          style={{
                            padding: '0.35rem 0.6rem',
                            fontSize: '0.75rem',
                            borderColor: p.isForceMuted ? 'var(--accent-rose)' : undefined,
                            color: p.isForceMuted ? 'var(--accent-rose)' : undefined,
                          }}
                          onClick={() => onForceMutePlayer?.(p.id)}
                          title="Force Mute this player for everyone in the room"
                        >
                          <ShieldAlert size={14} />
                          {p.isForceMuted ? 'Force Muted' : 'Force Mute'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: GM COMPUTER / DESKTOP AUDIO STREAMING */}
          {activeTab === 'stream' && isGm && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: voiceState.isAudioStreaming ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0,0,0,0.3)',
                  border: voiceState.isAudioStreaming
                    ? '1px solid var(--accent-emerald)'
                    : '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <Sparkles size={18} color="var(--accent-emerald)" />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      {voiceState.isAudioStreaming ? 'Audio Stream is Active' : 'System Audio Streaming'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '320px' }}>
                    Stream browser tabs (YouTube, Spotify, Syrinscape) or your system audio directly to all players in the room.
                  </p>
                </div>

                <button
                  className={voiceState.isAudioStreaming ? 'btn btn-secondary' : 'btn btn-primary'}
                  style={{
                    backgroundColor: voiceState.isAudioStreaming ? '#ef4444' : 'var(--accent-emerald)',
                    borderColor: voiceState.isAudioStreaming ? '#ef4444' : 'var(--accent-emerald)',
                    color: 'white',
                    padding: '0.5rem 1rem',
                  }}
                  onClick={handleToggleStreaming}
                >
                  <MonitorUp size={16} />
                  {voiceState.isAudioStreaming ? 'Stop Streaming' : 'Start Stream'}
                </button>
              </div>

              {voiceState.isAudioStreaming && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    <span>Stream Broadcast Volume</span>
                    <span>{Math.round(voiceState.desktopVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={voiceState.desktopVolume}
                    onChange={(e) => voiceManager.setDesktopVolume(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent-emerald)' }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button className="btn btn-primary" onClick={onClose} style={{ padding: '0.45rem 1.5rem' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
