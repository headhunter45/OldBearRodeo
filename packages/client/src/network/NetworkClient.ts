import {
  ClientToServerMessage,
  ServerToClientMessage,
  GameSession,
  Player,
} from '@oldbear/shared';
import { VoiceManager } from './VoiceManager.js';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export class NetworkClient {
  private ws: WebSocket | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  voiceManager: VoiceManager | null = null;

  session: GameSession | null = null;
  localPlayer: Player | null = null;
  isGm: boolean = false;
  gmKey?: string;

  onMessageCallbacks: ((msg: ServerToClientMessage) => void)[] = [];

  setVoiceManager(vm: VoiceManager) {
    this.voiceManager = vm;
    vm.onTrackChange((newTrack) => {
      for (const pc of this.peerConnections.values()) {
        const senders = pc.getSenders();
        const audioSender = senders.find(
          (s) => s.track?.kind === 'audio' || (s as any).kind === 'audio'
        );
        if (audioSender && newTrack) {
          audioSender.replaceTrack(newTrack).catch((err) => {
            console.warn('[WebRTC] replaceTrack error:', err);
          });
        }
      }
    });
  }

  connect(roomId: string, playerName: string, playerColor: string, gmKey?: string) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '3000' ? `${window.location.hostname}:3001` : window.location.host;
    const wsUrl = `${protocol}//${host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[Network] Connected to signaling server');
      const joinMsg: ClientToServerMessage = {
        type: 'join',
        roomId,
        playerName,
        playerColor,
        gmKey,
      };
      this.sendWs(joinMsg);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerToClientMessage;
        this.handleServerMessage(msg);
      } catch (err) {
        console.error('[Network] Parse error:', err);
      }
    };

    this.ws.onclose = () => {
      console.log('[Network] Disconnected from server');
    };
  }

  onMessage(cb: (msg: ServerToClientMessage) => void) {
    this.onMessageCallbacks.push(cb);
    return () => {
      this.onMessageCallbacks = this.onMessageCallbacks.filter((c) => c !== cb);
    };
  }

  send(msg: ClientToServerMessage) {
    // Send over WebRTC data channels to all connected peers if open
    let sentP2P = false;
    const payload = JSON.stringify(msg);

    for (const channel of this.dataChannels.values()) {
      if (channel.readyState === 'open') {
        try {
          channel.send(payload);
          sentP2P = true;
        } catch (e) {
          console.warn('[WebRTC] Send failed, falling back to WS:', e);
        }
      }
    }

    // Always send over WebSocket relay to ensure state synchronization on server
    this.sendWs(msg);
  }

  private sendWs(msg: ClientToServerMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleServerMessage(msg: ServerToClientMessage) {
    if (msg.type === 'join-ack') {
      this.localPlayer = msg.player;
      this.session = msg.session;
      this.isGm = msg.isGm;
      this.gmKey = msg.gmKey;
    } else if (msg.type === 'peer-joined') {
      // Any existing peer in the room connects to newcomer for full mesh
      this.initiateRtcConnection(msg.peerId);
    } else if (msg.type === 'peer-left') {
      this.peerConnections.get(msg.peerId)?.close();
      this.peerConnections.delete(msg.peerId);
      this.dataChannels.delete(msg.peerId);
      this.voiceManager?.removeRemotePeer(msg.peerId);
    } else if (msg.type === 'voice-force-mute') {
      if (this.localPlayer && msg.targetPlayerId === this.localPlayer.id) {
        this.voiceManager?.handleForceMuted();
      }
    } else if (msg.type === 'rtc-offer') {
      this.handleRtcOffer(msg.fromPeerId, msg.sdp);
    } else if (msg.type === 'rtc-answer') {
      this.handleRtcAnswer(msg.fromPeerId, msg.sdp);
    } else if (msg.type === 'rtc-ice') {
      this.handleRtcIce(msg.fromPeerId, msg.candidate);
    }

    for (const cb of this.onMessageCallbacks) {
      cb(msg);
    }
  }

  // WebRTC P2P Signaling
  private async initiateRtcConnection(peerId: string) {
    try {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      this.peerConnections.set(peerId, pc);

      const dc = pc.createDataChannel('vtt-data');
      this.setupDataChannel(peerId, dc);

      // Attach mixed audio track if available, or request audio transceiver
      const track = this.voiceManager?.getMixedAudioTrack();
      const stream = this.voiceManager?.getMixedStream();
      if (track && stream) {
        pc.addTrack(track, stream);
      } else {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
      }

      pc.ontrack = (event) => {
        console.log('[WebRTC] Received audio track from peer:', peerId);
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        this.voiceManager?.handleRemoteTrack(peerId, event.track, remoteStream);
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          this.sendWs({
            type: 'rtc-ice',
            toPeerId: peerId,
            candidate: e.candidate,
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.sendWs({
        type: 'rtc-offer',
        toPeerId: peerId,
        sdp: offer,
      });
    } catch (err) {
      console.warn('[WebRTC] Failed to initiate connection with peer:', peerId, err);
    }
  }

  private async handleRtcOffer(fromPeerId: string, sdp: RTCSessionDescriptionInit) {
    try {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      this.peerConnections.set(fromPeerId, pc);

      pc.ondatachannel = (e) => {
        this.setupDataChannel(fromPeerId, e.channel);
      };

      // Attach audio track or transceiver
      const track = this.voiceManager?.getMixedAudioTrack();
      const stream = this.voiceManager?.getMixedStream();
      if (track && stream) {
        pc.addTrack(track, stream);
      } else {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
      }

      pc.ontrack = (event) => {
        console.log('[WebRTC] Received audio track from peer:', fromPeerId);
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        this.voiceManager?.handleRemoteTrack(fromPeerId, event.track, remoteStream);
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          this.sendWs({
            type: 'rtc-ice',
            toPeerId: fromPeerId,
            candidate: e.candidate,
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.sendWs({
        type: 'rtc-answer',
        toPeerId: fromPeerId,
        sdp: answer,
      });
    } catch (err) {
      console.warn('[WebRTC] Failed to handle offer from peer:', fromPeerId, err);
    }
  }

  private async handleRtcAnswer(fromPeerId: string, sdp: RTCSessionDescriptionInit) {
    const pc = this.peerConnections.get(fromPeerId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  }

  private async handleRtcIce(fromPeerId: string, candidate: RTCIceCandidateInit) {
    const pc = this.peerConnections.get(fromPeerId);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private setupDataChannel(peerId: string, dc: RTCDataChannel) {
    dc.onopen = () => {
      console.log('[WebRTC] DataChannel connected with peer:', peerId);
      this.dataChannels.set(peerId, dc);
    };

    dc.onclose = () => {
      console.log('[WebRTC] DataChannel closed with peer:', peerId);
      this.dataChannels.delete(peerId);
    };

    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        // Dispatch to callbacks
        for (const cb of this.onMessageCallbacks) {
          cb(msg);
        }
      } catch (err) {
        console.error('[WebRTC] DataChannel parse error:', err);
      }
    };
  }

  disconnect() {
    this.ws?.close();
    for (const pc of this.peerConnections.values()) {
      pc.close();
    }
    this.peerConnections.clear();
    this.dataChannels.clear();
  }
}
