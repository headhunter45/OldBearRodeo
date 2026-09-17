# 🐻 Old Bear Rodeo

A lightweight, zero-install, mobile-friendly virtual tabletop (VTT) and tactical battlemap system designed for seamless tabletop roleplaying sessions. Built with modern TypeScript, WebRTC voice communication, HTML5 Canvas, and deep D&D Beyond character synchronization.

---

## Table of Contents
1. [Key Features](#key-features)
2. [Quickstart with Docker (Recommended)](#quickstart-with-docker-recommended)
3. [Native Local Development](#native-local-development)
4. [User Manual & App Guide](#user-manual--app-guide)
   - [Starting a Game & Inviting Players](#starting-a-game--inviting-players)
   - [Map Management & Grid Alignment](#map-management--grid-alignment)
   - [Tokens & Combat Management](#tokens--combat-management)
   - [D&D Beyond Character Integration](#dd-beyond-character-integration)
   - [Voice Chat & Audio Streaming](#voice-chat--audio-streaming)
   - [Soundboard & Custom Audio](#soundboard--custom-audio)
   - [Dice Roller & Initiative Tracker](#dice-roller--initiative-tracker)
   - [Full Data Backup & Browser Migration](#full-data-backup--browser-migration)
   - [Global Drag and Drop](#global-drag-and-drop)
5. [Configuring Available Colors](#configuring-available-colors)
6. [Architecture & Technology Stack](#architecture--technology-stack)

---

## Key Features

- **Blazing-Fast HTML5 Canvas Engine**: Smooth 60 FPS rendering with pan, zoom, multi-touch pinch-to-zoom, grid snapping, and distance measurement.
- **Zero-Install Networking**: Instant WebSocket room synchronization with peer-to-peer WebRTC voice mesh.
- **Map Alignment & Grid Overlay**: Configure grid tile counts (X/Y), pixel tile size, and grid offsets (X/Y). Toggle grid overlay rendering on top of the map but underneath tokens.
- **Advanced Token Controls**: Duplicate tokens with `Ctrl+D` / `Cmd+D`, assign control of multiple tokens per player, cycle-click through overlapping tokens, and prevent token stacking on placement.
- **Full D&D Beyond Integration**: Import any public character sheet by URL or ID. Includes offline base64 avatar conversion, 5e standard ability score layout (modifier large, score small), proficiency bonus, and interactive trained & expertise skills list.
- **Low-Latency Voice Chat**: WebRTC mesh voice chat with Open Mic and Push-to-Talk (keyboard hotkey + on-screen mobile button), audio device selection, GM force-mute, and animated mic/headphone indicators for active transmission.
- **Soundboard & Custom Audio**: Synthesized one-shot sound effects and custom audio track uploads for GMs with looping, individual volume controls, and room broadcast.
- **Full Data Backup & Export**: One-click export of all maps, tokens, custom audio, character sheets, and session state into a portable `.json` backup file for moving between devices and browsers.

---

## Quickstart with Docker (Recommended)

Old Bear Rodeo provides a complete multi-container setup via Docker Compose, including the client application, signaling/API server, PostgreSQL database, and an Nginx reverse proxy.

### Prerequisites
- [Docker Engine](https://docs.docker.com/engine/install/) (v24.0+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)

### Running the Stack
1. Clone the repository and navigate to the project root:
   ```bash
   git clone https://github.com/your-org/OldBearRodeo.git
   cd OldBearRodeo
   ```

2. Start all containers in the background:
   ```bash
   docker compose up --build -d
   ```

3. Open your browser:
   - **Application URL**: [http://localhost](http://localhost) (Port 80 via Nginx)
   - **Direct Server API**: [http://localhost:3001](http://localhost:3001)

### Docker Service Topology
| Container Name | Service | Internal Port | Exposed Port | Description |
|---|---|---|---|---|
| `oldbear_nginx` | Reverse Proxy | `80` | `80:80` | Unified gateway routing web traffic and WebSocket signaling |
| `oldbear_client` | Frontend SPA | `80` | — | Nginx serving production Vite build |
| `oldbear_server` | Backend API | `3001` | `3001:3001` | Node.js WebSocket signaling and D&D Beyond proxy |
| `oldbear_postgres` | Database | `5432` | `5432:5432` | Persistent campaign storage |

### Useful Docker Commands
- **View live logs**:
  ```bash
  docker compose logs -f
  ```
- **Stop all containers**:
  ```bash
  docker compose down
  ```
- **Reset database and volumes**:
  ```bash
  docker compose down -v
  ```

---

## Native Local Development

If running natively without Docker on macOS, Linux, or Windows:

### Prerequisites
- **Node.js**: v20.0.0 or higher
- **npm**: v10.0.0 or higher

### 1. Installation
Install all workspace dependencies from the repository root:
```bash
npm install
```

### 2. Build Packages
Build the shared protocol package, backend server, and frontend client:
```bash
npm run build
```

### 3. Run Automated Tests
Run unit tests across all workspaces:
```bash
npm test
```

### 4. Start Development Servers
Start both the client and backend server concurrently:
```bash
# Terminal 1: Backend Server
npm run dev -w @oldbear/server

# Terminal 2: Frontend Client
npm run dev -w @oldbear/client
```
- The frontend client runs on `http://localhost:3000` (or `http://localhost:5173`).
- The backend server runs on `http://localhost:3001`.

---

## User Manual & App Guide

### Starting a Game & Inviting Players
1. **Host as GM**: When you open the application without any query parameters, you are automatically assigned the **Game Master (GM)** role.
2. **Invite Players**: Click the **Share** button (invite link) in the top navigation bar. This copies a player join URL (e.g. `http://localhost:3000/?room=daring-dragon-42`).
3. **Player Access**: When players open the invite URL, they enter as players and have access only to their assigned tokens and visible map regions.

---

### Map Management & Grid Alignment
1. **Upload Maps**: Click the **Map** icon in the top bar to open the **Maps & Scenes Manager**.
   - You can upload single or **multiple map images** simultaneously (`.png`, `.jpg`, `.webp`).
   - You can also **drag and drop map files** anywhere onto the window.
2. **Grid Alignment (Tiles & Offsets)**:
   - Select any map and click the **Settings** icon to open the inline Map Settings editor.
   - **Tiles X / Tiles Y**: Specify the exact dimensions of your map in grid cells (e.g. 30 × 20).
   - **Tile Size (px)**: Fine-tune the cell size in pixels.
   - **Grid Offset X / Y**: Shift the grid overlay horizontally or vertically in pixels to align perfectly with pre-drawn map grids.
3. **Grid Overlay Toggle**:
   - In the left toolbar, click the **Grid Overlay (#)** button to instantly toggle grid visibility on or off.
   - The grid renders on top of the battlemap image but beneath all creature tokens and spell markers.

---

### Tokens & Combat Management
1. **Adding Tokens**: Click the **`+`** icon in the top bar or drag image files onto the board.
   - The engine automatically calculates the first free adjacent square to avoid stacking tokens on top of each other.
2. **Selecting & Overlapping Tokens**:
   - Click a token to select it.
   - If multiple tokens occupy the same cell, **click repeatedly to cycle through all tokens** in that position.
   - Controllable tokens are prioritized over non-controllable tokens.
3. **Duplicating Tokens**:
   - Select any token and press **`Ctrl + D`** (or **`Cmd + D`** on macOS) or click the **Duplicate** icon in the bottom floating token bar.
   - A copy will appear in the nearest unoccupied cell with identical stats, HP, and settings.
4. **Multi-Token Player Control**:
   - As GM, open the bottom token bar or click the edit pencil.
   - Under **Player Control**, select which player controls the token, or assign multiple tokens to a single player.

---

### D&D Beyond Character Integration
1. **Importing a Character**:
   - Open the **Character Sheet** (User icon in top bar).
   - Enter a D&D Beyond character URL or ID (e.g., `https://www.dndbeyond.com/characters/49074997` or `49074997`), or type `'demo'` for a sample character.
   - Click **Sync**.
2. **Token Avatar Synchronization**:
   - When synced, the character's name, HP, speed, and avatar image are automatically applied to the active token.
   - Avatars are downloaded and converted to self-contained Base64 Data URLs by the server, bypassing cross-origin (CORS) restrictions.
3. **5e Character Sheet Layout**:
   - **Ability Scores**: Displays the ability modifier **large and bold** (e.g. `+4`) and the base score **small** (e.g. `18`).
   - **Proficiency Bonus**: Displays level-based proficiency bonus in the vitals bar.
   - **Skills List**: Displays all 18 skills with indicators for untrained (`○`), proficient (`● PROF`), and expertise (`★ EXP`), with a "Trained Only" filter toggle.
4. **Saved Characters Storage**:
   - All imported characters are cached in both the player's and the GM's local storage.
   - Use the **Load Saved Character** dropdown to instantly switch characters without re-fetching from the internet.

---

### Voice Chat & Audio Streaming
1. **Quick Controls & Activity Indicators**:
   - The microphone icon pulses with a vibrant green wave when transmitting audio.
   - The headphone icon pulses with a sky-blue wave when receiving audio from other players.
2. **Voice Modes**:
   - **Open Microphone**: Transmits automatically based on microphone volume threshold.
   - **Push-to-Talk (PTT)**: Transmits only while holding the PTT key (default `V`, configurable in Voice Settings) or holding the on-screen mobile PTT button.
3. **GM Moderation**:
   - GMs can click the mute icon next to any player in the voice settings modal to force-mute them across the room.
   - Each player can adjust relative volume levels for every other participant.

---

### Soundboard & Custom Audio
1. **Built-in SFX**: Instant synthesized sound effects for weapon slashes, arcane spells, dice rattles, and victory fanfares that work out of the box.
2. **Adding Custom Sounds (GM)**:
   - Click the **Volume** icon in the top bar to open the Soundboard.
   - Click **`+ Add Sounds (Multi)`** or **drag and drop audio files** (`.mp3`, `.wav`, `.ogg`, `.m4a`) onto the window.
   - Tracks are stored in browser IndexedDB.
   - Each track features individual Play/Pause, Loop toggle, Volume slider, and Delete options.
   - Enable **Broadcast Sounds to Players** to play audio for everyone in the room.

---

### Dice Roller & Initiative Tracker
- **Dice Roller**: Roll polyhedral dice (`d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`) with modifiers and advantage/disadvantage. Rolls are broadcast to all players in the room with roll history.
- **Initiative Tracker**: Add characters and monsters with automated or manual initiative rolls, cycle through rounds, and highlight the active turn.

---

### Full Data Backup & Browser Migration
To switch computers or browsers without losing maps, audio, tokens, or characters:
1. Click the **Database** icon in the top bar (or "Backup & Transfer Data" in the mobile drawer).
2. Click **Export to File** to download `oldbear-rodeo-backup-YYYY-MM-DD.json`.
3. On your new computer or browser, open Old Bear Rodeo, click **Import from File**, and select your `.json` backup file (or simply drag and drop the backup `.json` file onto the window).
4. All maps, tokens, custom sound tracks, characters, and session state are instantly restored into IndexedDB and LocalStorage!

---

### Global Drag and Drop
You can drag and drop files from your desktop directly onto the Old Bear Rodeo window at any time:
- **Images (`.png`, `.jpg`, `.webp`)**: GMs are prompted to add them either as Creature Tokens or as Battlemaps; players have them added as Tokens at the drop position.
- **Audio (`.mp3`, `.wav`, `.ogg`)**: Added directly to the Soundboard library.
- **JSON (`.json`)**: Recognized as an Old Bear Rodeo backup and restored immediately.

---

## Configuring Available Colors

To customize the colors available for player pointers, token borders, and drawing markers, edit the color definitions in:

```typescript
// File: packages/client/src/config/colors.ts (and packages/shared/src/constants.ts)

export const AVAILABLE_COLORS: ColorOption[] = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Rose Red', value: '#ef4444' },
  { name: 'Emerald Green', value: '#10b981' },
  { name: 'Amber Gold', value: '#f59e0b' },
  { name: 'Sky Blue', value: '#0ea5e9' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Violet', value: '#a855f7' },
  { name: 'Crisp White', value: '#ffffff' },
];
```

---

## Architecture & Technology Stack

- **Frontend**: React 18, TypeScript, Vite, HTML5 Canvas 2D Engine, Lucide Icons, Vanilla CSS Design System.
- **Client Storage**: IndexedDB (via `idb`) for high-resolution map and audio assets, LocalStorage for character caching and client preferences.
- **Real-Time Signaling**: Node.js, `ws` (WebSocket), TypeScript.
- **Audio & Voice**: WebRTC Mesh Audio (`RTCPeerConnection`), Web Audio API (`AudioContext`) for synthesized effects and audio metering.
- **Backend Proxy**: Express / Node.js native `fetch` with browser User-Agent headers for D&D Beyond API compatibility.
- **Containerization**: Multi-stage Docker builds (`node:22-alpine`, `nginx:alpine`) with Docker Compose.
