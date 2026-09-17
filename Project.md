# Implementation Plan - OldBearRodeo Virtual Tabletop (VTT)

OldBearRodeo is a lightweight, mobile-friendly, easy-to-host Virtual Tabletop (VTT) designed for quick game sessions without mandatory sign-ins. It features browser-local asset storage, peer-to-peer (WebRTC) networking with server relay fallback, a multi-layer canvas engine (maps, tokens, fog of war, dynamic pointers), HP and speed tracking, initiative management, dice rolling with advantage/disadvantage, and D&D Beyond character synchronization.

## User Review Required

> [!IMPORTANT]
> **Git Workflow**: All implementation commits and feature branches will be merged directly into the `develop` branch. No changes will be merged into `main` (reserved for your code review and release).
>
> **Docker Status**: Docker is currently unavailable on your machine. Development and verification will run natively using Node.js v26 and npm. All `Dockerfile` and `docker-compose.yml` configurations with nginx reverse proxy will be scaffolded and verified syntactically for future deployment.
>
> **D&D Beyond Integration**: D&D Beyond's character JSON endpoint requires characters to have their character privacy set to "Public". Our Node backend will include a proxy endpoint to bypass CORS and parse character attributes (HP, speed, spells, ability scores).

## Open Questions

1. **Canvas Engine**: We recommend a specialized custom 2D Canvas engine (optimized for pinch-zoom, multi-touch panning, offscreen fog-of-war composition, and lightweight state transfer) over PixiJS to avoid heavy external dependencies and ensure seamless mobile performance. Would you like us to proceed with this custom 2D Canvas engine?
2. **Database Fallback for Local Dev**: For production, we will provide PostgreSQL schemas and Docker Compose services. For local development while Docker is offline, would you like the backend to use an automatic in-memory / SQLite fallback so you can run the full stack locally with just `npm run dev`?

---

## Proposed Architecture & Directory Structure

```
OldBearRodeo/
├── packages/
│   ├── shared/                # Shared TypeScript models, networking contracts, D&D types
│   │   ├── package.json
│   │   └── src/
│   │       ├── types/         # Session, Token, Map, Fog, Ping, Dice, Character types
│   │       └── protocol.ts    # WebRTC/WebSocket message payloads & validation
│   ├── client/                # Vite + React + TypeScript frontend
│   │   ├── package.json
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── components/    # UI Overlays, Flyouts, Hamburger menus, Drawers
│   │       ├── engine/        # Canvas 2D viewport, layers, gesture controller, renderer
│   │       ├── hooks/         # P2P/WebRTC, WebSocket fallback, touch gestures
│   │       ├── storage/       # IndexedDB asset store (maps, tokens, audio)
│   │       └── store/         # Zustand session & local state
│   └── server/                # Node.js + TypeScript backend
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── signaling.ts   # WebRTC signaling (SDP/ICE exchange)
│           ├── relay.ts       # WebSocket relay fallback for NAT/firewalled clients
│           ├── dndbeyond.ts   # D&D Beyond character proxy & parser
│           ├── session.ts     # Room state manager (in-memory + optional DB persistence)
│           └── index.ts       # Server entry point
├── docker/
│   ├── Dockerfile.client
│   ├── Dockerfile.server
│   └── nginx.conf             # Nginx reverse proxy configuration
├── docker-compose.yml
└── package.json               # Root npm workspace configuration
```

---

## Phased Implementation Plan

### Phase 1: Git Setup & Monorepo Foundation
- Create and switch to `develop` branch from `main`.
- Commit the modified `README.md` and initialize `.gitignore` for Node, Vite, and environment files.
- Configure npm workspaces (`packages/shared`, `packages/client`, `packages/server`).
- Set up TypeScript configurations and shared build pipelines.

#### [NEW] [package.json](file:///Users/tom/Projects/OldBearRodeo/package.json)
#### [NEW] [.gitignore](file:///Users/tom/Projects/OldBearRodeo/.gitignore)
#### [NEW] [packages/shared/package.json](file:///Users/tom/Projects/OldBearRodeo/packages/shared/package.json)
#### [NEW] [packages/shared/src/index.ts](file:///Users/tom/Projects/OldBearRodeo/packages/shared/src/index.ts)

---

### Phase 2: Backend Signaling, Relay & Session Server
- Implement Node.js HTTP + WebSocket server using native `ws`.
- Session creation:
  - Generate unique room IDs (e.g. `daring-owlbear-42`) with GM key generated and returned to creator.
  - Generate shareable invite URLs (`/room/:roomId`).
- WebRTC Signaling & NAT Traversal:
  - Offer / Answer / ICE candidate routing.
  - STUN servers configured (Google public STUN) + WebSocket relay fallback when WebRTC data channels fail behind symmetric NAT.
- D&D Beyond proxy endpoint (`/api/dndbeyond/:characterId`) to fetch and normalize public character stats.
- PostgreSQL database client with local in-memory store adapter for seamless execution without Docker.

#### [NEW] [packages/server/package.json](file:///Users/tom/Projects/OldBearRodeo/packages/server/package.json)
#### [NEW] [packages/server/src/index.ts](file:///Users/tom/Projects/OldBearRodeo/packages/server/src/index.ts)
#### [NEW] [packages/server/src/session.ts](file:///Users/tom/Projects/OldBearRodeo/packages/server/src/session.ts)
#### [NEW] [packages/server/src/signaling.ts](file:///Users/tom/Projects/OldBearRodeo/packages/server/src/signaling.ts)
#### [NEW] [packages/server/src/dndbeyond.ts](file:///Users/tom/Projects/OldBearRodeo/packages/server/src/dndbeyond.ts)

---

### Phase 3: Client Canvas Engine & Touch Gesture System
- Vite + React + TypeScript setup with Lucide icons and dark-mode VTT design system.
- Canvas viewport with hardware-accelerated 2D context:
  - Multi-touch gesture engine: pinch-to-zoom (with smooth focal point anchoring), two-finger panning, inertia, and mouse wheel/middle-click controls.
  - Square & Hexagonal grid overlay with customizable grid size, opacity, and snap-to-grid toggle.
  - Multi-layer architecture:
    1. **Map Layer**: High-resolution image rendering, multi-map manager (GM can prepare Map B while players see Map A).
    2. **Grid Layer**: Grid rendering and coordinate calculations.
    3. **Token & Prop Layer**: Sorting by z-index, selection, drag-and-drop.
    4. **Fog of War Layer**: Destination-out mask rendering; GM sees translucent fog mask, players see fully obscured darkness.
    5. **Pointers & Measurement Layer**: Laser trails, pings, area circles/rectangles, and movement rulers.
- IndexedDB local storage integration for offline asset caching (maps, tokens, audio).

#### [NEW] [packages/client/src/engine/Viewport.ts](file:///Users/tom/Projects/OldBearRodeo/packages/client/src/engine/Viewport.ts)
#### [NEW] [packages/client/src/engine/CanvasEngine.ts](file:///Users/tom/Projects/OldBearRodeo/packages/client/src/engine/CanvasEngine.ts)
#### [NEW] [packages/client/src/engine/layers/MapLayer.ts](file:///Users/tom/Projects/OldBearRodeo/packages/client/src/engine/layers/MapLayer.ts)
#### [NEW] [packages/client/src/engine/layers/FogLayer.ts](file:///Users/tom/Projects/OldBearRodeo/packages/client/src/engine/layers/FogLayer.ts)
#### [NEW] [packages/client/src/engine/layers/TokenLayer.ts](file:///Users/tom/Projects/OldBearRodeo/packages/client/src/engine/layers/TokenLayer.ts)
#### [NEW] [packages/client/src/engine/layers/OverlayLayer.ts](file:///Users/tom/Projects/OldBearRodeo/packages/client/src/engine/layers/OverlayLayer.ts)
#### [NEW] [packages/client/src/storage/db.ts](file:///Users/tom/Projects/OldBearRodeo/packages/client/src/storage/db.ts)

---

### Phase 4: Token Generator, Health Bars & Movement Ruler
- Token Customizer:
  - Upload image with automatic circular clipping.
  - Customizable border ring color and solid background fill for non-square or transparent images.
- Token Permissions & Stats:
  - GM can edit all token properties and assign token ownership to players.
  - Players can only move tokens assigned to them.
  - Visual Health Bar: Rendered above the token; shows current/max HP ratio visually without displaying the numeric HP to players (GM sees full numeric values).
  - Players can edit their own assigned token's HP.
  - Status condition badges (Stunned, Poisoned, Concentrating, Advantage, etc.).
- Speed Tracking & Movement Ruler:
  - Configurable movement speed per token (e.g. 30ft = 6 squares).
  - Real-time distance measurement during token dragging.
  - Visual warning indicator (ruler line color transition) when dragging exceeds token speed.

#### [NEW] [packages/client/src/components/TokenEditorModal.tsx](file:///Users/tom/Projects/OldBearRodeo/packages/client/src/components/TokenEditorModal.tsx)
#### [NEW] [packages/client/src/components/TokenControls.tsx](file:///Users/tom/Projects/OldBearRodeo/packages/client/src/components/TokenControls.tsx)
#### [NEW] [packages/client/src/engine/Ruler.ts](file:///Users/tom/Projects/OldBearRodeo/packages/client/src/engine/Ruler.ts)

---

### Phase 5: Dynamic On-Screen Pointers & Ephemeral Markers
- Laser Pointer:
  - Broadcasts pointer position in real time with smooth fading trailing effect in user's chosen accent color.
- Ephemeral Screen Markers:
  - Arrow ping pointing to a location.
  - Crosshair ping with pulse animation.
  - Circle radius area (click center, drag outward to measure spell/blast radius).
  - Rectangle zone marker.
- Synchronized automatic fade-out timers per effect broadcasted across peers.

#### [NEW] [packages/client/src/engine/PointerSystem.ts](file:///Users/tom/Projects/OldBearRodeo/packages/client/src/engine/PointerSystem.ts)
#### [NEW] [packages/client/src/components/ToolBar.tsx](file:///Users/tom/Projects/OldBearRodeo/packages/client/src/components/ToolBar.tsx)

---

### Phase 6: Dice Roller & Initiative Tracker
- Dice Roller:
  - Die icons for d4, d6, d8, d10, d12, d20, d100.
  - Dedicated buttons for d20 with Advantage and Disadvantage.
  - Roll broadcast message: `"$name rolled $x ($details)"`.
  - Dice roll history drawer.
- Initiative Tracker:
  - Add tokens or custom NPCs/monsters.
  - Sortable turn order, current turn indicator, and round counter.
  - Map focus: clicking on a combatant pans/highlights their token on the active map.

#### [NEW] [packages/client/src/components/DiceRoller.tsx](file:///Users/tom/Projects/OldBearRodeo/packages/client/src/components/DiceRoller.tsx)
#### [NEW] [packages/client/src/components/InitiativeTracker.tsx](file:///Users/tom/Projects/OldBearRodeo/packages/client/src/components/InitiativeTracker.tsx)

---

### Phase 7: D&D Beyond Integration & Mobile Flyout UX
- D&D Beyond Character Sheet Flyout:
  - Input character ID or share link.
  - Fetch character profile, current/max HP, speed, and active spells via backend proxy.
  - Slide-out drawer displaying condensed character stats, spell descriptions, and direct links to D&D Beyond.
  - Automatic two-way link to player's assigned token.
- Mobile-First Flyout & Navigation System:
  - Responsive hamburger menus and bottom sheet drawers.
  - Frictionless switching between chat, character sheet, dice roller, and map view.

#### [NEW] [packages/client/src/components/CharacterFlyout.tsx](file:///Users/tom/Projects/OldBearRodeo/packages/client/src/components/CharacterFlyout.tsx)
#### [NEW] [packages/client/src/components/MobileDrawer.tsx](file:///Users/tom/Projects/OldBearRodeo/packages/client/src/components/MobileDrawer.tsx)

---

### Phase 8: Soundboard & Audio Foundation (Future Roadmap)
- Soundboard audio manager:
  - Upload audio tracks/sound effects to local storage.
  - Looping ambient background vs one-off sound effects.
  - Relative volume sliders.
  - GM broadcast toggle (mute audio to players vs play locally).

#### [NEW] [packages/client/src/engine/AudioManager.ts](file:///Users/tom/Projects/OldBearRodeo/packages/client/src/engine/AudioManager.ts)
#### [NEW] [packages/client/src/components/Soundboard.tsx](file:///Users/tom/Projects/OldBearRodeo/packages/client/src/components/Soundboard.tsx)

---

### Phase 9: Docker & Production Deployment Ready
- Dockerfiles for client and server.
- Docker Compose configuration with PostgreSQL and Nginx reverse proxy with WebSocket/WebRTC proxying support.

#### [NEW] [docker/Dockerfile.client](file:///Users/tom/Projects/OldBearRodeo/docker/Dockerfile.client)
#### [NEW] [docker/Dockerfile.server](file:///Users/tom/Projects/OldBearRodeo/docker/Dockerfile.server)
#### [NEW] [docker/nginx.conf](file:///Users/tom/Projects/OldBearRodeo/docker/nginx.conf)
#### [NEW] [docker-compose.yml](file:///Users/tom/Projects/OldBearRodeo/docker-compose.yml)

---

## Verification Plan

### Automated Tests
- Workspace build verification:
  ```bash
  npm run build --workspaces
  ```
- Backend unit and integration tests (session creation, signaling, D&D Beyond parser):
  ```bash
  npm test --workspace=@oldbear/server
  ```
- Client unit tests for math/grid/ruler calculations:
  ```bash
  npm test --workspace=@oldbear/client
  ```

### Manual Verification
- **Multi-Client Real-Time Sync**: Open GM session in one browser tab and Player invite link in an incognito window/secondary browser:
  - Verify token movement syncs instantly.
  - Verify player can only move their own token.
  - Verify health bar shows visually to player without revealing exact HP numbers.
  - Verify GM can edit all tokens and switch maps independently.
  - Verify laser pointer and shape markers render with appropriate fade timers.
- **Mobile Touch & Responsive Testing**:
  - Test pinch-to-zoom and two-finger pan with browser touch emulation.
  - Test flyout drawer behavior and hamburger menu toggling.
- **Git Branch Integrity**:
  - Confirm `git status` and `git branch` verify that all changes are merged into `develop` and that `main` remains untouched.
