# 🐻 Old Bear Rodeo - Features Documentation

Welcome to the comprehensive feature guide for **Old Bear Rodeo**, a modern, lightweight, mobile-friendly, zero-install Virtual Tabletop (VTT) and tactical battlemap platform.

---

## Table of Contents
1. [Canvas Engine & Tactical Battlemap](#1-canvas-engine--tactical-battlemap)
2. [Fog of War & Vision](#2-fog-of-war--vision)
3. [Drawing Tools, Spell Templates & Markers](#3-drawing-tools-spell-templates--markers)
4. [Tokens & Props Management](#4-tokens--props-management)
5. [Floating Asset Manager & Library](#5-floating-asset-manager--library)
6. [D&D Beyond Character Integration](#6-dd-beyond-character-integration)
7. [TetraCube Monster & NPC Import](#7-tetracube-monster--npc-import)
8. [Chat System & Slash Commands](#8-chat-system--slash-commands)
9. [Initiative Tracker](#9-initiative-tracker)
10. [Dice Roller & Roll History](#10-dice-roller--roll-history)
11. [WebRTC Voice Chat & Communications](#11-webrtc-voice-chat--communications)
12. [Soundboard & Custom Audio](#12-soundboard--custom-audio)
13. [Discord Webhook Sync](#13-discord-webhook-sync)
14. [Terminal / CLI Client (`oldbearchat`)](#14-terminal--cli-client-oldbearchat)
15. [Data Backup, Export & Migration](#15-data-backup-export--migration)
16. [User Interface, Navigation & Hotkeys](#16-user-interface-navigation--hotkeys)
17. [DevOps, Docker & Deployment](#17-devops-docker--deployment)

---

## 1. Canvas Engine & Tactical Battlemap

- **High-Performance 2D Canvas**: Smooth 60 FPS HTML5 Canvas engine optimized for desktop and touch-screen devices without heavy engine overhead.
- **Smart Touch & Trackpad Gestures**:
  - *Standard two-finger trackpad swipe*: Smooth battlemap panning via `this.viewport.pan(-deltaX, -deltaY)`.
  - *Trackpad pinch-to-zoom (`Ctrl`/`Cmd` + scroll)*: Smooth exponential zoom anchored directly at the mouse cursor.
  - *Tuning Constants*: Top-level sensitivity constants in `CanvasEngine.ts`:
    - `TRACKPAD_PAN_SENSITIVITY = 1.0`
    - `TRACKPAD_ZOOM_SENSITIVITY = 0.01`
    - `MOUSE_WHEEL_ZOOM_SENSITIVITY = 0.0015`
- **Multi-Grid System**:
  - **Square & Hexagonal Grids**: Full support for both square grids and pointy-topped hexagonal grids.
  - **Exact Snapping**: Mathematical grid snapping accounts for grid type, custom tile sizes, and fractional pixel offsets.
  - **Grid Alignment Controls**: Configure grid tile counts ($X \times Y$), tile size in pixels, grid line opacity, custom grid color, and pixel offsets ($X, Y$).
  - **Grid Layer Rendering**: Toggleable grid overlay rendered on top of the battlemap artwork, but beneath tokens and props.
  - **Custom Background Color**: Set background fill colors for imageless grid maps or letterboxing margins outside map boundaries.
- **Distance Measurement**:
  - **Dynamic Movement Ruler**: Real-time distance measurement during token dragging with cell counting and speed limit warnings (turns red when exceeding token speed).
  - **Measuring Tape Tool (`M`)**: Dedicated infinite-range distance measurement tape to inspect ranges between any two points without speed restrictions.

---

## 2. Fog of War & Vision

- **Multi-Layer Fog Rendering**:
  - Players see completely opaque fog covering unrevealed areas.
  - GM view displays fog with semi-transparent shading to see what lies ahead.
- **Fog Drawing Tools**:
  - **Fog Hide (`F`)**: Draw rectangular regions to conceal map areas.
  - **Fog Reveal (`R`)**: Draw rectangular regions to reveal concealed areas.
  - **Cover All / Clear All**: Quick GM actions to instantly mask or unmask the entire map.
  - **Automatic Timed Notifications**: Brief, non-intrusive status toasts when covering or clearing fog.

---

## 3. Drawing Tools, Spell Templates & Markers

Accessible via the Drawing Tools sub-menu in the left HUD or number keys (`1` - `6`):

| Key | Tool | Icon | Description |
|:---:|:---|:---:|:---|
| **1** | **Laser Pointer** | `Sparkles` | Ephemeral glowing trail that follows cursor movement and smoothly fades out. |
| **2** | **Arrow Marker** | `ArrowUpRight` | Vector pointer with real-time distance badge in feet (`${lengthFt} ft`). |
| **3** | **Target / Crosshair** | `Crosshair` | Draggable target ping with concentric reticle and distance badge; clicking/tapping defaults to minimum 18px size. |
| **4** | **Circle Radius** | `Circle` | Circular spell template with live radius badge in feet (`${radiusFt} ft radius`). |
| **5** | **Rectangle Zone** | `Square` | Rectangular area with live width × height dimensions (`${wFt} ft × ${hFt} ft`). |
| **6** | **Cone / Arc Template** | `Triangle` | Directional spell cone (Burning Hands, Cone of Cold) with dual cone/triangle visualization. |

### Dual Cone / Triangle Visualization (Task #118)
- **Circular Arc**: Rendered in the player's primary highlight color with semi-transparent fill and dashed outline.
- **Flat-Ended Triangle Difference**: The outer corners where a flat-ended triangle cone covers but a circular arc does not are rendered in a distinct, contrasting accent color (`getContrastingAccentColor`).
- **Interactive Spread Handles**: Drag handle dots on the cone's edge to freely adjust the spread angle, plus quick toolbar presets (`53°`, `60°`, `90°`, `120°`, `180°`).

### Persistence System (`📌 Persist` vs. `⚡ Quick Ping`)
- **Quick Ping Mode (`⚡`)**: Drawings and pings automatically fade away after a short duration (2–6 seconds).
- **Persistent Mode (`📌`)**: Drawings remain on the map as durable spell templates, zones, or tactical markers.
- **Shift Inversion**: Holding `Shift` while drawing temporarily inverts the active persistence mode.
- **Drawing Layer Placement**: Persistent markers live on a dedicated drawing layer beneath character tokens and props, preventing tokens from blocking selection.
- **Shape Controls**: Selected persistent shapes display controls for lock/unlock (`🔒`), deletion (`🗑️` / `Delete` / `Backspace`), and rotation/spread presets.

---

## 4. Tokens & Props Management

### Token Management
- **Custom Shapes & Framing**: Clip tokens to circle, square, rounded square, hexagon, or octagon with custom ring color, border width, and integrated pan/zoom cropping controls.
- **Stacking Prevention**: Newly added tokens automatically detect existing tokens and offset slightly to avoid stacking.
- **Overlapping Token Cycle**: Clicking stacked tokens repeatedly cycles selection through each token beneath the cursor.
- **Box Select Tool (`B`)**: Enclose multiple tokens in a drag-box to select, move, assign, or duplicate them as a group. Automatically switches back to Arrow select (`S`) once tokens are chosen.
- **Token Duplication**: Duplicate selected tokens via button or keyboard shortcut (`D` / `Ctrl+D` / `Cmd+D`).
- **Movement Lock (`🔒`)**: Lock tokens or props to prevent accidental dragging during gameplay.
- **Multi-Token Assignment**: GMs can assign control of any token to specific players or assign multiple tokens to one player.
- **Combat Stats**: Inline tracking for Current HP, Max HP, Temporary HP, Armor Class (AC), Speed, and standard 5e Condition Badges (Blinded, Charmed, Concentrating, etc.).

### Props System (Tasks #107, #113, #114, #115)
- **Props as Environmental Objects**: Treat props as furniture, doors, walls, trees, or unkillable NPCs.
- **Fractional Tile Dimensions**: Props support precise decimal tile dimensions (e.g., `1.5 × 3.24` tiles) configurable in the Asset Manager and Settings.
- **Compass Rotation**: Rotate props and tokens using an interactive compass dial or numeric degree input from both asset settings and the bottom toolbar.
- **Streamlined Toolbar**: Cleaned up prop toolbar by omitting HP, temp HP, conditions, and assignment dropdowns.

---

## 5. Floating Asset Manager & Library

- **Floating Non-Modal Window (Task #112)**: Draggable, non-modal window without a backdrop overlay, allowing the map and tokens to stay interactive underneath.
- **Organized Asset Tabs**:
  - **Maps**: Uploaded battlemaps with grid configurations and quick "Create Scene from Map" actions.
  - **Tokens**: Player and NPC character tokens with art cropping.
  - **Props**: Environmental objects, furniture, and decimal-sized markers.
  - **Monsters**: Imported statblocks and creature tokens.
  - **Characters**: Public character sheets and player tokens.
  - **Scenes**: Saved encounters with active map bindings and fog state.
- **Direct Canvas Drag-and-Drop**: Drag any asset card directly out of the Asset Manager and drop it onto the battlemap to spawn it at the cursor position.
- **"Deploy to Map" Button**: Instant one-click deployment near the viewport center.
- **Batch Drag-and-Drop Import (Task #74)**: Drop multiple images simultaneously to open a batch classifier with bulk actions ("Set all to Tokens", "Set all to Maps", "Set all to Props").
- **Deduplication**: Automatic hashing and file size comparison to prevent redundant asset uploads.

---

## 6. D&D Beyond Character Integration

- **URL or ID Import**: Paste any public D&D Beyond character URL (e.g., `https://www.dndbeyond.com/characters/47804290`) or character ID to import full statblocks.
- **Parsed Character Attributes**:
  - Character name, race, class, level, and avatar (automatically cached offline as Base64).
  - Ability scores formatted with **Modifier Large / Score Small**.
  - Proficiency bonus, Armor Class, Maximum/Current HP, and Walking Speed.
  - Saving throws, Passive Perception, Passive Investigation, Passive Insight, and Currencies (PP, GP, EP, SP, CP).
  - Complete Skills table highlighting **Proficiency (●)** and **Expertise (★)**.
  - Weapon attacks, spells, and actions with reach, range, to-hit bonuses, and damage dice.
- **Action Economy Highlights (Task #71)**: Spells and actions are visually tagged with badges for **Action**, **Bonus Action**, and **Reaction**.
- **Two-Way Local Sync**: Imported characters are saved locally for both the player and GM.
- **Live `/sync` Command**: Sync characters and tokens directly from chat using `/sync <url|id> [index]`.

---

## 7. TetraCube Monster & NPC Import

- **Native `.monster` Parser (Task #73)**: Import exported monster JSON files from TetraCube.
- **Full Statblock Extraction**: Parses creature name, size, type, alignment, AC, HP, speeds, ability scores, saving throws, damage vulnerabilities/resistances/immunities, senses, languages, CR, traits, actions, and reactions.
- **Dual-Drop Workflow**:
  - *Drop onto Battlemap*: Saves to library and immediately spawns a ready-to-fight token at the cursor.
  - *Drop into Asset Manager*: Saves to library for pre-session encounter planning.
- **Automatic Multi-Token Numbering**: Spawns multiple copies of the same creature with auto-incrementing numbers (e.g., *Goblin 1*, *Goblin 2*, *Goblin 3*).

---

## 8. Chat System & Slash Commands

- **Draggable & Collapsible Chat Window**: Movable chat panel with minimize chevron button that collapses to the title bar.
- **Full Slash Command Suite**:
  - `/roll <expression> [adv|dis]`: Roll dice using standard notation (e.g., `/roll 1d20+5`, `/roll 2d6+3 adv`, `/roll 4d6k3`).
  - `/attack [name|index] [adv|dis]`: Roll a weapon or attack action from the active token's character sheet. Omitting arguments lists numbered options ephemerally.
  - `/spell [name|index] [adv|dis]`: Cast a spell with spell attack rolls or save DCs. Omitting arguments lists numbered spells ephemerally.
  - `/skill [name|index] [adv|dis]`: Roll skill checks using character modifiers. Omitting arguments lists numbered skills ephemerally.
  - `/tokens`: List all controllable tokens with their corresponding 1-based index numbers.
  - `/sync <url|id> [index]`: Synchronize token with D&D Beyond stats.
  - `/discord webhook <url>`: Configure one-way Discord webhook relay (GM only).
  - `/discord webhook none`: Disable Discord webhook relay (GM only).
  - `/help`: Display in-game command reference (whispered ephemerally to the caller).
- **Ephemeral Whispers**: Command help, error messages, and numbered selection lists are rendered ephemerally so only the calling player sees them.
- **Roll Announcement Banners**: Dynamic on-screen animated banners announce rolls across the room with name, dice expression, breakdown, and total.

---

## 9. Initiative Tracker

- **Draggable & Collapsible Panel**: Non-modal window with smooth minimize animation.
- **Inline Editing (Tasks #103, #104)**: Edit initiative scores directly on each row with live save buttons and score badges.
- **Drag-and-Drop Reordering**: Drag tracker rows to re-order turn priority with automatic score adjustment.
- **Click-to-Focus**: Clicking an entry in the initiative tracker selects the token and pans the battlemap directly to it.
- **Turn Advancement Alerts**: Next-turn notifications broadcast to chat and display announcement banners for the active player.
- **Initiative Roll Broadcast**: Rolling initiative from the tracker broadcasts the roll breakdown (`1d20 + bonus = total`) to chat and the dice history tool.

---

## 10. Dice Roller & Roll History

- **Interactive 3D / Virtual Dice**: Clickable polyhedral dice (`d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`).
- **Modifiers & Advantage**: Quick toggles for Advantage, Disadvantage, and custom numeric modifiers.
- **Per-User Roll History (Tasks #68, #83)**: Scrollable, persistent roll history log capturing rolls made via the dice tool, chat commands, and the initiative tracker.

---

## 11. WebRTC Voice Chat & Communications

- **Peer-to-Peer Voice Mesh**: Low-latency encrypted audio streaming between connected peers.
- **Transmission Modes**:
  - *Open Mic* with adjustable microphone gain.
  - *Push-to-Talk (PTT)* with customizable hotkey and floating mobile on-screen PTT button.
- **Default Muted on Join**: Microphones start muted by default to ensure privacy and eliminate unexpected hot-mics.
- **Animated Audio Indicators (Task #22)**: Microphone and headphone icons in the TopBar animate dynamically to indicate outgoing voice activity and incoming audio reception.
- **GM Controls**: GM force-mute allows room managers to mute players if needed.

---

## 12. Soundboard & Custom Audio

- **Synthesized Sound Effects**: Built-in sound triggers (Sword Clang, Fireball, Arrow Whistle, Dice Roll, Bell, Thunder, Victory Horn).
- **Custom Audio Uploads**: GMs can upload custom `.mp3`, `.wav`, or `.ogg` sound effects and ambient loops.
- **Audio Controls**: Individual volume sliders, loop toggles, and instant room-wide broadcast.
- **Sound Status Bar**: Persistent status indicator in the hamburger menu displaying active tracks.

---

## 13. Discord Webhook Sync (Task #105)

- **One-Way Channel Mirroring**: Real-time outbound sync from Old Bear Rodeo into any Discord text channel using standard Discord Webhooks.
- **Synchronized Events**:
  - Public player chat messages.
  - Dice rolls with roll expressions, modifiers, and totals.
  - Attack, spell, and skill roll results.
- **Secure Configuration**: Configured in-game via `/discord webhook <url>` (restricted strictly to GMs; all configuration feedback is whispered ephemerally).

---

## 14. Terminal / CLI Client (`oldbearchat`) (Task #106)

- **Lightweight Terminal Companion**: Standalone Python CLI client located at `bin/oldbearchat`.
- **WebSocket Protocol Integration**: Connects directly to the game server (`/ws`) to join game rooms without a browser.
- **Features**:
  - Connect via invite URL: `oldbearchat <invite_url>` or launch and run `/join <invite_url>`.
  - ANSI-colored chat stream with user color tags.
  - Local command history (navigate past messages and rolls with Up/Down arrow keys).
  - Execute `/roll`, chat messages, and bot interactions directly from the terminal or macro pads (Stream Deck).

---

## 15. Data Backup, Export & Migration (Task #11)

- **Comprehensive JSON Export**: One-click export of all campaign data into a single `.json` backup file.
- **Exported Entities**:
  - All maps, grid alignment parameters, and background colors.
  - All scenes and fog-of-war states.
  - All tokens, custom crops, conditions, and HP stats.
  - All environmental props and decimal dimensions.
  - All imported D&D Beyond characters and TetraCube monsters.
  - Custom audio tracks and soundboard sound assets.
- **Cross-Browser & Cross-Device Migration**: Import backup files onto any computer or browser to resume games instantly.

---

## 16. User Interface, Navigation & Hotkeys

- **Glassmorphism HUD**: Translucent dark aesthetic with subtle borders, dynamic shadows, and high contrast typography (`Inter`).
- **Reorganized 8-Item Main Menu (Task #108)**:
  1. *Sound status*
  2. *Chat*
  3. *Characters* (Sheets & Spells)
  4. *Initiative Tracker*
  5. *Add Token* (Character, Monster, Prop, or Custom)
  6. *Soundboard*
  7. *Asset Manager* (Includes Scene Manager)
  8. *Voice & Audio settings*
- **TopBar Layout (Task #116)**: Baseline-aligned top bar featuring room controls, player avatars, audio indicators, and version badge (`v0.1.0`).
- **Random Name Generator**: Fantasy name generator assigns incoming players thematic names with distinct GM labeling.
- **Keyboard Shortcuts**:

| Key | Action |
|:---:|:---|
| `S` | Select Tool (Arrow) |
| `B` | Box Select Tool |
| `G` | Grab / Pan Tool |
| `M` | Measuring Tape Tool |
| `1` | Laser Pointer |
| `2` | Arrow Marker |
| `3` | Target / Crosshair Ping |
| `4` | Circle Radius Area |
| `5` | Rectangle Zone |
| `6` | Cone / Arc Template |
| `F` | Fog Hide (GM only) |
| `R` | Fog Reveal (GM only) |
| `D` / `Ctrl+D` / `Cmd+D` | Duplicate Selected Token |
| `Delete` / `Backspace` | Delete Selected Token or Shape |
| `Escape` | Deselect Active Token / Shape |

---

## 17. DevOps, Docker & Deployment

- **Containerized Stack**: Multi-container architecture managed via `compose.yaml` (development) and `compose.prod.yaml` (production):
  - `client`: Vite frontend served via Nginx.
  - `server`: Node.js signaling and API backend.
  - `nginx`: Reverse proxy routing WebSocket (`/ws`), API proxy (`/api`), and frontend assets.
  - `db`: Optional PostgreSQL service with automatic in-memory fallback.
- **Environment Configuration**: Centralized `.env` and `.env.example` managing `PORT_CLIENT`, `PORT_SERVER`, `PORT_NGINX`, and session parameters.
- **Automated CI / Build Script (`scripts/build-and-push.sh`)**: Script to build, tag, and publish multi-arch container images to remote registries.
