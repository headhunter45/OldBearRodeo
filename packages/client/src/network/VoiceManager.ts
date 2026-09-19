import { Player } from '@oldbear/shared';

export interface VoiceState {
  isInitialized: boolean;
  isMuted: boolean;
  isForceMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  isPttActive: boolean;
  transmissionMode: 'open' | 'ptt';
  pttKey: string;
  pttKeyDisplay: string;
  selectedInputId: string;
  selectedOutputId: string;
  isAudioStreaming: boolean;
  micVolume: number;
  desktopVolume: number;
  localLevel: number;
}

export interface PeerAudioState {
  peerId: string;
  volume: number; // 0 to 2 (0% to 200%)
  isSpeaking: boolean;
  level: number;
}

export interface AudioDeviceOption {
  deviceId: string;
  label: string;
}

export class VoiceManager {
  private audioCtx: AudioContext | null = null;
  private localMicStream: MediaStream | null = null;
  private desktopMediaStream: MediaStream | null = null;

  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private micGainNode: GainNode | null = null;
  private desktopSourceNode: MediaStreamAudioSourceNode | null = null;
  private desktopGainNode: GainNode | null = null;
  private mixedDestination: MediaStreamAudioDestinationNode | null = null;
  private localAnalyser: AnalyserNode | null = null;

  // Remote peer audio elements & nodes
  private remotePeers = new Map<
    string,
    {
      stream: MediaStream;
      audioEl: HTMLAudioElement;
      sourceNode: MediaStreamAudioSourceNode;
      gainNode: GainNode;
      analyserNode: AnalyserNode;
      volume: number;
      isSpeaking: boolean;
      lastSpokeTime: number;
    }
  >();

  // State
  public state: VoiceState = {
    isInitialized: false,
    isMuted: true,
    isForceMuted: false,
    isDeafened: false,
    isSpeaking: false,
    isPttActive: false,
    transmissionMode: (localStorage.getItem('oldbear_audio_trans_mode') as 'open' | 'ptt') || 'open',
    pttKey: localStorage.getItem('oldbear_audio_ptt_key') || 'KeyV',
    pttKeyDisplay: localStorage.getItem('oldbear_audio_ptt_key_display') || 'V',
    selectedInputId: localStorage.getItem('oldbear_audio_input_device') || 'default',
    selectedOutputId: localStorage.getItem('oldbear_audio_output_device') || 'default',
    isAudioStreaming: false,
    micVolume: 1.0,
    desktopVolume: 0.8,
    localLevel: 0,
  };

  public availableInputs: AudioDeviceOption[] = [];
  public availableOutputs: AudioDeviceOption[] = [];

  // Callbacks
  private onStateChangeCallbacks: ((state: VoiceState) => void)[] = [];
  private onTrackChangeCallbacks: ((track: MediaStreamTrack | null) => void)[] = [];
  private onPeerSpeakingCallbacks: ((peerId: string, isSpeaking: boolean) => void)[] = [];
  private onDevicesChangeCallbacks: (() => void)[] = [];

  private vadInterval: number | null = null;
  private silenceTimer: number | null = null;

  constructor() {
    this.setupPttListeners();
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', () => {
        this.refreshDevices();
      });
    }
  }

  // Subscribe to voice state updates
  onStateChange(cb: (state: VoiceState) => void) {
    this.onStateChangeCallbacks.push(cb);
    cb({ ...this.state });
    return () => {
      this.onStateChangeCallbacks = this.onStateChangeCallbacks.filter((c) => c !== cb);
    };
  }

  // Subscribe to mixed audio track changes for WebRTC peer connections
  onTrackChange(cb: (track: MediaStreamTrack | null) => void) {
    this.onTrackChangeCallbacks.push(cb);
    return () => {
      this.onTrackChangeCallbacks = this.onTrackChangeCallbacks.filter((c) => c !== cb);
    };
  }

  // Subscribe to peer speaking indicators
  onPeerSpeaking(cb: (peerId: string, isSpeaking: boolean) => void) {
    this.onPeerSpeakingCallbacks.push(cb);
    return () => {
      this.onPeerSpeakingCallbacks = this.onPeerSpeakingCallbacks.filter((c) => c !== cb);
    };
  }

  onDevicesChange(cb: () => void) {
    this.onDevicesChangeCallbacks.push(cb);
    return () => {
      this.onDevicesChangeCallbacks = this.onDevicesChangeCallbacks.filter((c) => c !== cb);
    };
  }

  private notifyState() {
    const copy = { ...this.state };
    for (const cb of this.onStateChangeCallbacks) {
      cb(copy);
    }
  }

  // Initialize Web Audio graph and enumerate devices
  async init() {
    if (this.state.isInitialized) return;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }

      await this.refreshDevices();

      // Only acquire microphone if user has unmuted (default is muted to avoid prompting on page load)
      if (!this.state.isMuted) {
        await this.acquireMicrophone(this.state.selectedInputId);
      }

      this.state.isInitialized = true;
      this.startVadLoop();
      this.notifyState();
    } catch (err) {
      console.warn('[VoiceManager] Initial setup failed or permission denied:', err);
      // Still refresh devices list if allowed
      await this.refreshDevices();
      this.notifyState();
    }
  }

  private ensureAudioContext(): AudioContext | null {
    if (!this.audioCtx) {
      const AudioCtxClass =
        typeof window !== 'undefined'
          ? (window as any).AudioContext || (window as any).webkitAudioContext
          : null;
      if (typeof AudioCtxClass === 'function') {
        try {
          this.audioCtx = new AudioCtxClass();
        } catch {
          this.audioCtx = null;
        }
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        this.audioCtx.resume();
      } catch {
        // Ignore in headless/mock environments
      }
    }
    return this.audioCtx;
  }

  async refreshDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs: AudioDeviceOption[] = [];
      const outputs: AudioDeviceOption[] = [];

      for (const d of devices) {
        if (d.kind === 'audioinput') {
          inputs.push({
            deviceId: d.deviceId,
            label: d.label || `Microphone ${inputs.length + 1}`,
          });
        } else if (d.kind === 'audiooutput') {
          outputs.push({
            deviceId: d.deviceId,
            label: d.label || `Speaker ${outputs.length + 1}`,
          });
        }
      }

      this.availableInputs = inputs;
      this.availableOutputs = outputs;

      for (const cb of this.onDevicesChangeCallbacks) {
        cb();
      }
    } catch (e) {
      console.warn('[VoiceManager] Error enumerating devices:', e);
    }
  }

  private async acquireMicrophone(deviceId: string) {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return;
    }

    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    // Close existing mic tracks
    if (this.localMicStream) {
      this.localMicStream.getTracks().forEach((t) => t.stop());
      this.localMicStream = null;
    }

    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: deviceId && deviceId !== 'default' ? { exact: deviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localMicStream = stream;

      // Re-setup Web Audio pipeline
      if (!this.mixedDestination) {
        this.mixedDestination = ctx.createMediaStreamDestination();
      }

      if (this.micSourceNode) {
        this.micSourceNode.disconnect();
      }
      this.micSourceNode = ctx.createMediaStreamSource(stream);

      if (!this.micGainNode) {
        this.micGainNode = ctx.createGain();
      }

      if (!this.localAnalyser) {
        this.localAnalyser = ctx.createAnalyser();
        this.localAnalyser.fftSize = 256;
      }

      this.micSourceNode.connect(this.micGainNode);
      this.micGainNode.connect(this.localAnalyser);
      this.micGainNode.connect(this.mixedDestination);

      this.updateMicGainsAndTracks();

      // Emit new track to peer connections
      const mixedTrack = this.getMixedAudioTrack();
      if (mixedTrack) {
        for (const cb of this.onTrackChangeCallbacks) {
          cb(mixedTrack);
        }
      }

      // Re-enumerate devices now that label permission is granted
      await this.refreshDevices();
    } catch (err) {
      console.warn('[VoiceManager] Could not acquire microphone stream:', err);
    }
  }

  // Returns the single mixed audio track (mic + desktop audio) sent to peers
  getMixedAudioTrack(): MediaStreamTrack | null {
    if (this.mixedDestination && this.mixedDestination.stream.getAudioTracks().length > 0) {
      return this.mixedDestination.stream.getAudioTracks()[0];
    }
    if (this.localMicStream && this.localMicStream.getAudioTracks().length > 0) {
      return this.localMicStream.getAudioTracks()[0];
    }
    return null;
  }

  getMixedStream(): MediaStream | null {
    if (this.mixedDestination) {
      return this.mixedDestination.stream;
    }
    return this.localMicStream;
  }

  private shouldTransmit(): boolean {
    if (this.state.isDeafened || this.state.isMuted || this.state.isForceMuted) {
      return false;
    }
    if (this.state.transmissionMode === 'ptt') {
      return this.state.isPttActive;
    }
    return true; // 'open'
  }

  private updateMicGainsAndTracks() {
    const active = this.shouldTransmit();
    const effectiveGain = active ? this.state.micVolume : 0;

    if (this.micGainNode && this.audioCtx) {
      this.micGainNode.gain.setValueAtTime(effectiveGain, this.audioCtx.currentTime);
    }

    if (this.localMicStream) {
      this.localMicStream.getAudioTracks().forEach((track) => {
        track.enabled = active;
      });
    }

    if (!active && this.state.isSpeaking) {
      this.state.isSpeaking = false;
      this.notifyState();
    }
  }

  // --- Voice Controls ---

  toggleMute(): boolean {
    if (this.state.isForceMuted) {
      // Force mute cannot be simply unmuted without GM action, but user can acknowledge
      return this.state.isMuted;
    }
    this.state.isMuted = !this.state.isMuted;
    if (!this.state.isMuted) {
      if (!this.localMicStream) {
        // Request mic permission and acquire stream now that user unmuted
        this.acquireMicrophone(this.state.selectedInputId);
      } else {
        this.updateMicGainsAndTracks();
      }
    } else {
      // User muted: stop tracks so browser/OS recording indicator turns OFF
      if (this.localMicStream) {
        this.localMicStream.getTracks().forEach((t) => t.stop());
        this.localMicStream = null;
      }
      this.updateMicGainsAndTracks();
      for (const cb of this.onTrackChangeCallbacks) {
        cb(null);
      }
    }
    this.notifyState();
    return this.state.isMuted;
  }

  setMuted(muted: boolean) {
    this.state.isMuted = muted;
    if (!muted) {
      if (!this.localMicStream) {
        this.acquireMicrophone(this.state.selectedInputId);
      } else {
        this.updateMicGainsAndTracks();
      }
    } else {
      if (this.localMicStream) {
        this.localMicStream.getTracks().forEach((t) => t.stop());
        this.localMicStream = null;
      }
      this.updateMicGainsAndTracks();
      for (const cb of this.onTrackChangeCallbacks) {
        cb(null);
      }
    }
    this.notifyState();
  }

  toggleDeafen(): boolean {
    this.state.isDeafened = !this.state.isDeafened;
    // Deafen also mutes remote peers locally
    for (const peer of this.remotePeers.values()) {
      peer.audioEl.muted = this.state.isDeafened;
    }
    this.updateMicGainsAndTracks();
    this.notifyState();
    return this.state.isDeafened;
  }

  handleForceMuted() {
    this.state.isForceMuted = true;
    this.state.isMuted = true;
    if (this.localMicStream) {
      this.localMicStream.getTracks().forEach((t) => t.stop());
      this.localMicStream = null;
    }
    this.updateMicGainsAndTracks();
    for (const cb of this.onTrackChangeCallbacks) {
      cb(null);
    }
    this.notifyState();
  }

  clearForceMute() {
    this.state.isForceMuted = false;
    this.notifyState();
  }

  setTransmissionMode(mode: 'open' | 'ptt') {
    this.state.transmissionMode = mode;
    localStorage.setItem('oldbear_audio_trans_mode', mode);
    this.updateMicGainsAndTracks();
    this.notifyState();
  }

  setPttKey(code: string, display: string) {
    this.state.pttKey = code;
    this.state.pttKeyDisplay = display;
    localStorage.setItem('oldbear_audio_ptt_key', code);
    localStorage.setItem('oldbear_audio_ptt_key_display', display);
    this.notifyState();
  }

  setPttActive(active: boolean) {
    if (this.state.isPttActive === active) return;
    this.state.isPttActive = active;
    this.updateMicGainsAndTracks();
    this.notifyState();
  }

  async setInputDevice(deviceId: string) {
    this.state.selectedInputId = deviceId;
    localStorage.setItem('oldbear_audio_input_device', deviceId);
    if (!this.state.isMuted || this.localMicStream) {
      await this.acquireMicrophone(deviceId);
    }
    this.notifyState();
  }

  async setOutputDevice(deviceId: string) {
    this.state.selectedOutputId = deviceId;
    localStorage.setItem('oldbear_audio_output_device', deviceId);

    for (const peer of this.remotePeers.values()) {
      if (typeof (peer.audioEl as any).setSinkId === 'function') {
        try {
          await (peer.audioEl as any).setSinkId(deviceId === 'default' ? '' : deviceId);
        } catch (err) {
          console.warn('[VoiceManager] Failed to set sinkId on audio element:', err);
        }
      }
    }
    this.notifyState();
  }

  setMicVolume(volume: number) {
    this.state.micVolume = Math.max(0, Math.min(volume, 2.0));
    this.updateMicGainsAndTracks();
    this.notifyState();
  }

  // --- GM Desktop / Computer Audio Streaming ---

  async startDesktopAudio(): Promise<boolean> {
    const ctx = this.ensureAudioContext();
    if (!ctx) return false;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true, // required by browsers to prompt for tab/screen audio
      });

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        // Stop video tracks immediately if no audio was selected
        stream.getTracks().forEach((t) => t.stop());
        alert('No system audio was shared. Please check "Share audio" when choosing the tab or screen.');
        return false;
      }

      this.desktopMediaStream = stream;

      // Handle user stopping stream via browser HUD
      audioTrack.onended = () => {
        this.stopDesktopAudio();
      };

      if (!this.mixedDestination) {
        this.mixedDestination = ctx.createMediaStreamDestination();
      }

      this.desktopSourceNode = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
      this.desktopGainNode = ctx.createGain();
      this.desktopGainNode.gain.setValueAtTime(this.state.desktopVolume, ctx.currentTime);

      this.desktopSourceNode.connect(this.desktopGainNode);
      this.desktopGainNode.connect(this.mixedDestination);

      this.state.isAudioStreaming = true;
      this.notifyState();

      // Emit new mixed track to peers
      const mixedTrack = this.getMixedAudioTrack();
      if (mixedTrack) {
        for (const cb of this.onTrackChangeCallbacks) {
          cb(mixedTrack);
        }
      }

      return true;
    } catch (err) {
      console.warn('[VoiceManager] System audio stream cancelled or failed:', err);
      return false;
    }
  }

  stopDesktopAudio() {
    if (this.desktopMediaStream) {
      this.desktopMediaStream.getTracks().forEach((t) => t.stop());
      this.desktopMediaStream = null;
    }
    if (this.desktopSourceNode) {
      this.desktopSourceNode.disconnect();
      this.desktopSourceNode = null;
    }
    if (this.desktopGainNode) {
      this.desktopGainNode.disconnect();
      this.desktopGainNode = null;
    }
    this.state.isAudioStreaming = false;
    this.notifyState();

    const mixedTrack = this.getMixedAudioTrack();
    if (mixedTrack) {
      for (const cb of this.onTrackChangeCallbacks) {
        cb(mixedTrack);
      }
    }
  }

  setDesktopVolume(volume: number) {
    this.state.desktopVolume = Math.max(0, Math.min(volume, 2.0));
    if (this.desktopGainNode && this.audioCtx) {
      this.desktopGainNode.gain.setValueAtTime(this.state.desktopVolume, this.audioCtx.currentTime);
    }
    this.notifyState();
  }

  // --- Remote Peer Audio & Relative Volumes ---

  handleRemoteTrack(peerId: string, track: MediaStreamTrack, stream: MediaStream) {
    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    // Clean up any old peer resources
    this.removeRemotePeer(peerId);

    const peerStream = stream || new MediaStream([track]);
    const audioEl = new Audio();
    audioEl.srcObject = peerStream;
    audioEl.autoplay = true;
    audioEl.muted = this.state.isDeafened;

    // Apply output device sinkId if supported
    if (this.state.selectedOutputId && typeof (audioEl as any).setSinkId === 'function') {
      (audioEl as any).setSinkId(this.state.selectedOutputId === 'default' ? '' : this.state.selectedOutputId).catch(() => {});
    }

    audioEl.play().catch((err) => {
      console.warn('[VoiceManager] Autoplay blocked, will resume on interaction:', err);
    });

    const sourceNode = ctx.createMediaStreamSource(peerStream);
    const gainNode = ctx.createGain();
    const analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 256;

    const savedVolume = parseFloat(localStorage.getItem(`oldbear_vol_${peerId}`) || '1.0');
    gainNode.gain.setValueAtTime(savedVolume, ctx.currentTime);

    sourceNode.connect(gainNode);
    gainNode.connect(analyserNode);
    // Connect to destination so Web Audio gain applies to speaker output
    gainNode.connect(ctx.destination);

    // Mute HTML audio element direct output so we don't get duplicate audio through both Web Audio & Element
    audioEl.volume = 0;

    this.remotePeers.set(peerId, {
      stream: peerStream,
      audioEl,
      sourceNode,
      gainNode,
      analyserNode,
      volume: savedVolume,
      isSpeaking: false,
      lastSpokeTime: 0,
    });
  }

  removeRemotePeer(peerId: string) {
    const peer = this.remotePeers.get(peerId);
    if (!peer) return;
    try {
      peer.audioEl.pause();
      peer.audioEl.srcObject = null;
      peer.sourceNode.disconnect();
      peer.gainNode.disconnect();
      peer.analyserNode.disconnect();
    } catch (e) {
      // ignore
    }
    this.remotePeers.delete(peerId);
    for (const cb of this.onPeerSpeakingCallbacks) {
      cb(peerId, false);
    }
  }

  setPeerVolume(peerId: string, volume: number) {
    const peer = this.remotePeers.get(peerId);
    const clamped = Math.max(0, Math.min(volume, 2.0));
    localStorage.setItem(`oldbear_vol_${peerId}`, clamped.toString());

    if (peer && this.audioCtx) {
      peer.volume = clamped;
      peer.gainNode.gain.setValueAtTime(clamped, this.audioCtx.currentTime);
    }
  }

  getPeerVolume(peerId: string): number {
    const peer = this.remotePeers.get(peerId);
    if (peer) return peer.volume;
    return parseFloat(localStorage.getItem(`oldbear_vol_${peerId}`) || '1.0');
  }

  // --- Voice Activity Detection (VAD) & VU Meter ---

  private startVadLoop() {
    if (this.vadInterval) return;

    const buffer = new Uint8Array(128);

    this.vadInterval = window.setInterval(() => {
      // 1. Local Voice Activity
      if (this.localAnalyser && this.shouldTransmit()) {
        this.localAnalyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        const normalized = Math.min(avg / 128, 1.0);
        this.state.localLevel = normalized;

        const isSpeakingNow = normalized > 0.08;
        if (isSpeakingNow) {
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
          if (!this.state.isSpeaking) {
            this.state.isSpeaking = true;
            this.notifyState();
          }
        } else if (this.state.isSpeaking && !this.silenceTimer) {
          // Add 350ms buffer before declaring silence
          this.silenceTimer = window.setTimeout(() => {
            this.state.isSpeaking = false;
            this.silenceTimer = null;
            this.notifyState();
          }, 350);
        }
      } else {
        if (this.state.localLevel > 0) {
          this.state.localLevel = 0;
        }
        if (this.state.isSpeaking) {
          this.state.isSpeaking = false;
          this.notifyState();
        }
      }

      // 2. Remote Peers Voice Activity
      const now = Date.now();
      for (const [peerId, peer] of this.remotePeers.entries()) {
        peer.analyserNode.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        const normalized = avg / 128;
        const speaking = normalized > 0.08 && !this.state.isDeafened;

        if (speaking) {
          peer.lastSpokeTime = now;
          if (!peer.isSpeaking) {
            peer.isSpeaking = true;
            for (const cb of this.onPeerSpeakingCallbacks) {
              cb(peerId, true);
            }
          }
        } else if (peer.isSpeaking && now - peer.lastSpokeTime > 350) {
          peer.isSpeaking = false;
          for (const cb of this.onPeerSpeakingCallbacks) {
            cb(peerId, false);
          }
        }
      }
    }, 50);
  }

  // --- Push-to-Talk Event Listeners ---

  private setupPttListeners() {
    window.addEventListener('keydown', (e) => {
      if (this.state.transmissionMode !== 'ptt') return;
      if (e.code === this.state.pttKey) {
        // Ignore if user is typing into input/textarea
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) {
          return;
        }
        if (!this.state.isPttActive) {
          this.setPttActive(true);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.state.transmissionMode !== 'ptt') return;
      if (e.code === this.state.pttKey) {
        if (this.state.isPttActive) {
          this.setPttActive(false);
        }
      }
    });

    // Fallback: if window loses focus while holding PTT, release it
    window.addEventListener('blur', () => {
      if (this.state.isPttActive) {
        this.setPttActive(false);
      }
    });
  }

  destroy() {
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
    }
    if (this.localMicStream) {
      this.localMicStream.getTracks().forEach((t) => t.stop());
    }
    if (this.desktopMediaStream) {
      this.desktopMediaStream.getTracks().forEach((t) => t.stop());
    }
    for (const peerId of Array.from(this.remotePeers.keys())) {
      this.removeRemotePeer(peerId);
    }
    if (this.audioCtx) {
      this.audioCtx.close();
    }
  }
}
