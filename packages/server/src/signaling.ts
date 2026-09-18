import { WebSocket, WebSocketServer } from 'ws';
import crypto from 'node:crypto';
import {
  ClientToServerMessage,
  ServerToClientMessage,
  Player,
  generateRandomName,
} from '@oldbear/shared';
import {
  getSession,
  getSessionGmKey,
  createSession,
  updateSession,
} from './session.js';

interface ClientSocket extends WebSocket {
  roomId?: string;
  playerId?: string;
  isGm?: boolean;
}

const rooms = new Map<string, Set<ClientSocket>>();

export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws: ClientSocket) => {
    ws.on('message', (data: string) => {
      try {
        const msg = JSON.parse(data.toString()) as ClientToServerMessage;
        handleMessage(ws, msg);
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    });

    ws.on('close', () => {
      handleDisconnect(ws);
    });

    ws.on('error', (err) => {
      console.error('[WS] Socket error:', err);
    });
  });
}

function broadcastToRoom(roomId: string, message: ServerToClientMessage, excludeWs?: ClientSocket) {
  const clients = rooms.get(roomId);
  if (!clients) return;

  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function sendToPeer(roomId: string, targetPeerId: string, message: ServerToClientMessage) {
  const clients = rooms.get(roomId);
  if (!clients) return;

  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client.playerId === targetPeerId && client.readyState === WebSocket.OPEN) {
      client.send(payload);
      break;
    }
  }
}

function handleMessage(ws: ClientSocket, msg: ClientToServerMessage) {
  switch (msg.type) {
    case 'join': {
      const { roomId, playerName, playerColor, gmKey, playerId: requestedPlayerId } = msg;
      let session = getSession(roomId);
      let sessionGmKey = getSessionGmKey(roomId);

      const isNewRoom = !session;
      // If room doesn't exist, create it with this exact roomId
      if (!session) {
        const created = createSession(`Session ${roomId}`, roomId);
        session = created.session;
        sessionGmKey = created.gmKey;
      }

      const playerId =
        requestedPlayerId && typeof requestedPlayerId === 'string' && requestedPlayerId.trim() !== ''
          ? requestedPlayerId.trim()
          : crypto.randomUUID();

      // Only room creator or clients with matching secret gmKey are GM
      const isGm = isNewRoom || Boolean(gmKey && sessionGmKey && gmKey === sessionGmKey);

      if (isGm && !session.gmId) {
        session.gmId = playerId;
      }

      ws.roomId = roomId;
      ws.playerId = playerId;
      ws.isGm = isGm;

      // Add to room client set, closing any prior socket for the same player (e.g. from page refresh)
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }
      const roomClients = rooms.get(roomId)!;
      for (const client of roomClients) {
        if (client !== ws && client.playerId === playerId) {
          try {
            client.close();
          } catch {
            // ignore
          }
          roomClients.delete(client);
        }
      }
      roomClients.add(ws);

      let player: Player;
      if (session.players[playerId]) {
        player = session.players[playerId];
        player.connected = true;
        if (playerName && playerName !== 'Adventurer' && playerName !== 'Game Master') {
          player.name = playerName;
        }
        if (playerColor) {
          player.color = playerColor;
        }
        if (isGm) {
          player.role = 'gm';
        }
      } else {
        player = {
          id: playerId,
          name:
            playerName && playerName !== 'Adventurer' && playerName !== 'Game Master'
              ? playerName
              : isGm
              ? 'GM'
              : generateRandomName(),
          role: isGm ? 'gm' : 'player',
          color: playerColor || '#3b82f6',
          connected: true,
          assignedTokenIds: [],
        };
        session.players[playerId] = player;
      }

      // Ack join to sender
      const ackMsg: ServerToClientMessage = {
        type: 'join-ack',
        player,
        session,
        isGm,
        gmKey: isGm ? (sessionGmKey || undefined) : undefined,
      };
      ws.send(JSON.stringify(ackMsg));

      // Notify others in room
      broadcastToRoom(
        roomId,
        {
          type: 'peer-joined',
          peerId: playerId,
          player,
        },
        ws
      );
      break;
    }

    case 'rtc-offer': {
      if (!ws.roomId || !ws.playerId) return;
      sendToPeer(ws.roomId, msg.toPeerId, {
        type: 'rtc-offer',
        fromPeerId: ws.playerId,
        sdp: msg.sdp,
      });
      break;
    }

    case 'rtc-answer': {
      if (!ws.roomId || !ws.playerId) return;
      sendToPeer(ws.roomId, msg.toPeerId, {
        type: 'rtc-answer',
        fromPeerId: ws.playerId,
        sdp: msg.sdp,
      });
      break;
    }

    case 'rtc-ice': {
      if (!ws.roomId || !ws.playerId) return;
      sendToPeer(ws.roomId, msg.toPeerId, {
        type: 'rtc-ice',
        fromPeerId: ws.playerId,
        candidate: msg.candidate,
      });
      break;
    }

    case 'token-move': {
      if (!ws.roomId) return;
      const session = getSession(ws.roomId);
      if (session && session.tokens[msg.id]) {
        session.tokens[msg.id].x = msg.x;
        session.tokens[msg.id].y = msg.y;
        if (msg.mapId) session.tokens[msg.id].mapId = msg.mapId;
      }
      broadcastToRoom(
        ws.roomId,
        {
          type: 'token-moved',
          id: msg.id,
          x: msg.x,
          y: msg.y,
          mapId: msg.mapId,
        },
        ws
      );
      break;
    }

    case 'token-update': {
      if (!ws.roomId) return;
      const session = getSession(ws.roomId);
      if (session && session.tokens[msg.id]) {
        Object.assign(session.tokens[msg.id], msg.updates);
      }
      broadcastToRoom(
        ws.roomId,
        {
          type: 'token-updated',
          id: msg.id,
          updates: msg.updates,
        },
        ws
      );
      break;
    }

    case 'token-add': {
      if (!ws.roomId) return;
      const session = getSession(ws.roomId);
      if (session) {
        session.tokens[msg.token.id] = msg.token;
      }
      broadcastToRoom(ws.roomId, { type: 'token-added', token: msg.token }, ws);
      break;
    }

    case 'token-delete': {
      if (!ws.roomId) return;
      const session = getSession(ws.roomId);
      if (session) {
        delete session.tokens[msg.id];
      }
      broadcastToRoom(ws.roomId, { type: 'token-deleted', id: msg.id }, ws);
      break;
    }

    case 'token-transfer': {
      if (!ws.roomId) return;
      const session = getSession(ws.roomId);
      if (session && session.tokens[msg.id]) {
        session.tokens[msg.id].mapId = msg.toMapId;
        session.tokens[msg.id].x = msg.x;
        session.tokens[msg.id].y = msg.y;
      }
      broadcastToRoom(
        ws.roomId,
        {
          type: 'token-transferred',
          id: msg.id,
          toMapId: msg.toMapId,
          x: msg.x,
          y: msg.y,
        },
        ws
      );
      break;
    }

    case 'map-add': {
      if (!ws.roomId) return;
      const session = getSession(ws.roomId);
      if (session) {
        session.maps.push(msg.map);
        if (!session.fog[msg.map.id]) {
          session.fog[msg.map.id] = {
            mapId: msg.map.id,
            globalCovered: false,
            shapes: [],
          };
        }
        updateSession(ws.roomId, { maps: session.maps, fog: session.fog });
      }
      broadcastToRoom(ws.roomId, { type: 'map-added', map: msg.map });
      break;
    }

    case 'map-update': {
      if (!ws.roomId) return;
      const session = getSession(ws.roomId);
      if (session) {
        const map = session.maps.find((m) => m.id === msg.id);
        if (map) {
          Object.assign(map, msg.updates);
          updateSession(ws.roomId, { maps: session.maps });
        }
      }
      broadcastToRoom(
        ws.roomId,
        {
          type: 'map-updated',
          id: msg.id,
          updates: msg.updates,
        }
      );
      break;
    }

    case 'map-delete': {
      if (!ws.roomId) return;
      const session = getSession(ws.roomId);
      if (session) {
        session.maps = session.maps.filter((m) => m.id !== msg.mapId);
        delete session.fog[msg.mapId];
        if (session.activeMapId === msg.mapId && session.maps.length > 0) {
          session.activeMapId = session.maps[0].id;
        }
        updateSession(ws.roomId, {
          maps: session.maps,
          fog: session.fog,
          activeMapId: session.activeMapId,
        });
        broadcastToRoom(ws.roomId, {
          type: 'map-deleted',
          mapId: msg.mapId,
          activeMapId: session.activeMapId,
        });
      }
      break;
    }

    case 'map-switch': {
      if (!ws.roomId) return;
      updateSession(ws.roomId, { activeMapId: msg.mapId });
      broadcastToRoom(ws.roomId, { type: 'map-switched', mapId: msg.mapId });
      break;
    }

    case 'fog-update': {
      if (!ws.roomId) return;
      const session = getSession(ws.roomId);
      if (session) {
        if (!session.fog[msg.mapId]) {
          session.fog[msg.mapId] = {
            mapId: msg.mapId,
            globalCovered: false,
            shapes: [],
          };
        }
        const fog = session.fog[msg.mapId];
        if (msg.globalCovered !== undefined) {
          fog.globalCovered = msg.globalCovered;
        }
        if (msg.clearShapes) {
          fog.shapes = [];
        }
        if (msg.newShape) {
          fog.shapes.push(msg.newShape);
        }
        updateSession(ws.roomId, { fog: session.fog });
      }
      broadcastToRoom(ws.roomId, {
        type: 'fog-updated',
        mapId: msg.mapId,
        globalCovered: msg.globalCovered,
        newShape: msg.newShape,
        clearShapes: msg.clearShapes,
      });
      break;
    }

    case 'marker-add': {
      if (!ws.roomId) return;
      const session = getSession(ws.roomId);
      if (session) {
        session.markers.push(msg.marker);
        // keep maximum 50 markers
        if (session.markers.length > 50) session.markers.shift();
      }
      broadcastToRoom(ws.roomId, { type: 'marker-added', marker: msg.marker }, ws);
      break;
    }

    case 'dice-roll': {
      if (!ws.roomId) return;
      const session = getSession(ws.roomId);
      if (session) {
        session.diceHistory.push(msg.roll);
        if (session.diceHistory.length > 50) session.diceHistory.shift();
      }
      broadcastToRoom(ws.roomId, { type: 'dice-rolled', roll: msg.roll });
      break;
    }

    case 'chat-send': {
      if (!ws.roomId) return;
      const session = getSession(ws.roomId);
      if (session && msg.message.roll) {
        session.diceHistory.push(msg.message.roll);
        if (session.diceHistory.length > 50) session.diceHistory.shift();
      }
      if (msg.message.recipientId) {
        sendToPeer(ws.roomId, msg.message.recipientId, {
          type: 'chat-message',
          message: msg.message,
        });
      } else if (!msg.message.isEphemeral) {
        broadcastToRoom(ws.roomId, {
          type: 'chat-message',
          message: msg.message,
        });
      }
      break;
    }

    case 'initiative-update': {
      if (!ws.roomId) return;
      const session = getSession(ws.roomId);
      if (session) {
        session.initiative = msg.initiative;
      }
      broadcastToRoom(
        ws.roomId,
        {
          type: 'initiative-updated',
          initiative: msg.initiative,
        },
        ws
      );
      break;
    }

    case 'player-update': {
      if (!ws.roomId || !ws.playerId) return;
      const session = getSession(ws.roomId);
      if (session && session.players[ws.playerId]) {
        Object.assign(session.players[ws.playerId], msg.updates);
      }
      broadcastToRoom(
        ws.roomId,
        {
          type: 'player-updated',
          playerId: ws.playerId,
          updates: msg.updates,
        },
        ws
      );
      break;
    }

    case 'audio-action': {
      if (!ws.roomId) return;
      broadcastToRoom(ws.roomId, {
        type: 'audio-action',
        trackId: msg.trackId,
        action: msg.action,
        volume: msg.volume,
        isLooping: msg.isLooping,
      });
      break;
    }

    case 'voice-force-mute': {
      if (!ws.roomId || !ws.isGm) return;
      const session = getSession(ws.roomId);
      if (session && session.players[msg.targetPlayerId]) {
        session.players[msg.targetPlayerId].isMuted = true;
        session.players[msg.targetPlayerId].isForceMuted = true;
      }
      broadcastToRoom(ws.roomId, {
        type: 'voice-force-mute',
        targetPlayerId: msg.targetPlayerId,
      });
      break;
    }
  }
}

function handleDisconnect(ws: ClientSocket) {
  if (!ws.roomId || !ws.playerId) return;

  const roomClients = rooms.get(ws.roomId);
  if (roomClients) {
    roomClients.delete(ws);
    if (roomClients.size === 0) {
      rooms.delete(ws.roomId);
    }
  }

  const session = getSession(ws.roomId);
  if (session && session.players[ws.playerId]) {
    session.players[ws.playerId].connected = false;
  }

  broadcastToRoom(ws.roomId, {
    type: 'peer-left',
    peerId: ws.playerId,
  });
}
