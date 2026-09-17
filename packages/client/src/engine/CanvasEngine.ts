import {
  GameMap,
  GameSession,
  Player,
  ScreenMarker,
  Token,
  FogShape,
} from '@oldbear/shared';
import { Viewport, Point } from './Viewport.js';
import { renderGrid, snapToGrid } from './GridRenderer.js';
import { renderToken, getCachedImage } from './TokenRenderer.js';
import { FogRenderer } from './FogRenderer.js';
import { renderMarkers } from './PointerSystem.js';
import { drawRuler, measureDistance, RulerMeasurement } from './Ruler.js';

export type ActiveTool =
  | 'select'
  | 'pan'
  | 'laser'
  | 'arrow'
  | 'crosshair'
  | 'circle'
  | 'rectangle'
  | 'fog-reveal'
  | 'fog-hide';

export interface CanvasEngineCallbacks {
  onTokenMove?: (id: string, x: number, y: number) => void;
  onTokenSelect?: (token: Token | null) => void;
  onMarkerAdd?: (marker: ScreenMarker) => void;
  onFogUpdate?: (shape: FogShape) => void;
}

export class CanvasEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animId: number = 0;

  viewport: Viewport;
  private fogRenderer: FogRenderer;

  // State
  session: GameSession | null = null;
  localPlayer: Player | null = null;
  currentMapId: string = '';
  activeTool: ActiveTool = 'select';
  snapEnabled: boolean = true;

  selectedTokenId: string | null = null;
  draggingToken: Token | null = null;
  dragStartPos: Point | null = null;
  dragCurrentPos: Point | null = null;
  activeRuler: RulerMeasurement | null = null;

  // Shape drawing state (for markers & fog)
  isDrawing: boolean = false;
  drawStart: Point | null = null;
  drawCurrent: Point | null = null;
  laserPoints: Point[] = [];

  // Multi-touch gestures
  private activePointers = new Map<number, Point>();
  private initialPinchDist: number = 0;
  private initialScale: number = 1;

  callbacks: CanvasEngineCallbacks = {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.viewport = new Viewport(100, 100, 1.0);
    this.fogRenderer = new FogRenderer();

    this.bindEvents();
    this.startRenderLoop();
  }

  setSession(session: GameSession) {
    this.session = session;
    if (!this.currentMapId) {
      this.currentMapId = session.activeMapId;
    }
  }

  setLocalPlayer(player: Player) {
    this.localPlayer = player;
  }

  setActiveMap(mapId: string) {
    this.currentMapId = mapId;
  }

  selectToken(id: string | null) {
    this.selectedTokenId = id;
  }

  destroy() {
    cancelAnimationFrame(this.animId);
    this.unbindEvents();
  }

  private startRenderLoop() {
    const loop = () => {
      this.render();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  private render() {
    const { width, height } = this.canvas;
    const ctx = this.ctx;
    const now = Date.now();

    // 1. Clear background
    const activeMap = this.session
      ? this.session.maps.find((m) => m.id === this.currentMapId) || this.session.maps[0]
      : null;
    ctx.fillStyle = activeMap?.backgroundColor || '#090d16';
    ctx.fillRect(0, 0, width, height);

    if (!this.session) return;

    const currentMap = activeMap;
    if (!currentMap) return;

    const isGm = this.localPlayer?.role === 'gm';

    ctx.save();
    // Apply Viewport transform (Pan & Zoom)
    ctx.translate(this.viewport.x, this.viewport.y);
    ctx.scale(this.viewport.scale, this.viewport.scale);

    // 2. Render Map Layer
    this.renderMap(ctx, currentMap);

    // 3. Render Grid Layer
    renderGrid(ctx, currentMap, this.viewport, width, height);

    // 4. Render Tokens and Props
    const tokens = Object.values(this.session.tokens).filter(
      (t) => t.mapId === currentMap.id
    );

    // Render props first, then tokens
    const props = tokens.filter((t) => t.isProp);
    const characters = tokens.filter((t) => !t.isProp);

    for (const prop of props) {
      const isSelected = prop.id === this.selectedTokenId;
      const canControl = isGm || (prop.ownerId === this.localPlayer?.id);
      renderToken(ctx, prop, currentMap.gridSize, isSelected, canControl, isGm);
    }

    for (const tok of characters) {
      const isSelected = tok.id === this.selectedTokenId;
      const canControl = isGm || (tok.ownerId === this.localPlayer?.id);
      renderToken(ctx, tok, currentMap.gridSize, isSelected, canControl, isGm);
    }

    // 5. Render Fog of War Layer
    const fog = this.session.fog[currentMap.id];
    if (fog) {
      this.fogRenderer.render(
        ctx,
        fog,
        currentMap.width,
        currentMap.height,
        isGm
      );
    }

    // 6. Render Active Movement Ruler
    if (this.activeRuler) {
      drawRuler(ctx, this.activeRuler);
    }

    // 7. Render Ephemeral Screen Markers
    if (this.session.markers && this.session.markers.length > 0) {
      this.session.markers = renderMarkers(
        ctx,
        this.session.markers,
        now,
        currentMap.gridSize,
        currentMap.scaleFtPerCell
      );
    }

    // 8. Render Current Drawing In-Progress (markers/fog preview)
    this.renderDrawingPreview(ctx, currentMap);

    ctx.restore();
  }

  private renderMap(ctx: CanvasRenderingContext2D, map: GameMap) {
    const img = getCachedImage(map.imageUrl);
    if (img) {
      ctx.drawImage(img, 0, 0, map.width, map.height);
    } else {
      // Procedural fallback dungeon floor
      ctx.fillStyle = map.backgroundColor || '#1e293b';
      ctx.fillRect(0, 0, map.width, map.height);

      // Subtle dungeon flagstone pattern
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, map.width, map.height);
    }
  }

  private renderDrawingPreview(ctx: CanvasRenderingContext2D, map: GameMap) {
    if (!this.isDrawing || !this.drawStart || !this.drawCurrent) return;

    const color = this.localPlayer?.color || '#6366f1';
    const { x: x1, y: y1 } = this.drawStart;
    const { x: x2, y: y2 } = this.drawCurrent;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;

    if (this.activeTool === 'laser' && this.laserPoints.length > 1) {
      ctx.beginPath();
      ctx.moveTo(this.laserPoints[0].x, this.laserPoints[0].y);
      for (let i = 1; i < this.laserPoints.length; i++) {
        ctx.lineTo(this.laserPoints[i].x, this.laserPoints[i].y);
      }
      ctx.stroke();
    } else if (this.activeTool === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (this.activeTool === 'circle') {
      const radius = Math.hypot(x2 - x1, y2 - y1);
      ctx.beginPath();
      ctx.arc(x1, y1, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
      ctx.fill();
      ctx.stroke();
    } else if (this.activeTool === 'rectangle' || this.activeTool.startsWith('fog')) {
      ctx.fillStyle = this.activeTool === 'fog-reveal'
        ? 'rgba(255, 255, 255, 0.2)'
        : 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    }

    ctx.restore();
  }

  // --- Pointer & Touch Interaction ---

  private onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);

    const screenPos: Point = { x: e.clientX, y: e.clientY };
    this.activePointers.set(e.pointerId, screenPos);

    if (this.activePointers.size === 2) {
      // Two finger pinch initiation
      const pts = Array.from(this.activePointers.values());
      this.initialPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.initialScale = this.viewport.scale;
      return;
    }

    if (this.activePointers.size > 2) return;

    const worldPos = this.viewport.screenToWorld(e.clientX, e.clientY);

    // Pan mode (middle click, space, or pan tool)
    if (e.button === 1 || e.button === 2 || this.activeTool === 'pan' || e.shiftKey) {
      return;
    }

    if (this.activeTool === 'select') {
      this.handleSelectPointerDown(worldPos);
    } else if (this.activeTool === 'crosshair') {
      this.broadcastMarker({
        id: crypto.randomUUID(),
        type: 'crosshair',
        userId: this.localPlayer?.id || '',
        userName: this.localPlayer?.name || 'Player',
        color: this.localPlayer?.color || '#3b82f6',
        x: worldPos.x,
        y: worldPos.y,
        durationMs: 4000,
        createdAt: Date.now(),
      });
    } else {
      // Marker drawing or fog drawing
      this.isDrawing = true;
      this.drawStart = worldPos;
      this.drawCurrent = worldPos;
      if (this.activeTool === 'laser') {
        this.laserPoints = [worldPos];
      }
    }
  };

  private handleSelectPointerDown(worldPos: Point) {
    if (!this.session) return;
    const currentMap =
      this.session.maps.find((m) => m.id === this.currentMapId) ||
      this.session.maps[0];
    if (!currentMap) return;

    const tokens = Object.values(this.session.tokens).filter(
      (t) => t.mapId === currentMap.id
    );

    const isGm = this.localPlayer?.role === 'gm';
    const localId = this.localPlayer?.id;

    // Find all clicked tokens under coordinate
    const matchingTokens: Token[] = [];
    for (let i = tokens.length - 1; i >= 0; i--) {
      const tok = tokens[i];
      const tokDiameter = tok.size * currentMap.gridSize;
      const radius = tokDiameter / 2;
      const cx = tok.x + radius;
      const cy = tok.y + radius;
      if (Math.hypot(worldPos.x - cx, worldPos.y - cy) <= radius) {
        matchingTokens.push(tok);
      }
    }

    let clickedToken: Token | null = null;
    if (matchingTokens.length > 0) {
      // Prioritize tokens the player can control first
      const isControllable = (t: Token) =>
        isGm || t.ownerId === localId || Boolean(this.localPlayer?.assignedTokenIds?.includes(t.id));
      const controllableTokens = matchingTokens.filter(isControllable);
      const candidates = controllableTokens.length > 0 ? controllableTokens : matchingTokens;

      // If a candidate token is already selected, cycle to the next one
      const currentIndex = candidates.findIndex((t) => t.id === this.selectedTokenId);
      if (currentIndex !== -1) {
        clickedToken = candidates[(currentIndex + 1) % candidates.length];
      } else {
        clickedToken = candidates[0];
      }
    }

    this.selectedTokenId = clickedToken ? clickedToken.id : null;
    this.callbacks.onTokenSelect?.(clickedToken);

    if (clickedToken) {
      const isControllable =
        isGm || clickedToken.ownerId === localId || Boolean(this.localPlayer?.assignedTokenIds?.includes(clickedToken.id));

      // Player permissions check: Players can only move their own tokens
      if (isControllable) {
        this.draggingToken = clickedToken;
        this.dragStartPos = { x: clickedToken.x, y: clickedToken.y };
        this.dragCurrentPos = worldPos;
      }
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.activePointers.has(e.pointerId)) return;
    const prevScreen = this.activePointers.get(e.pointerId)!;
    const currentScreen: Point = { x: e.clientX, y: e.clientY };
    this.activePointers.set(e.pointerId, currentScreen);

    // Multi-touch pinch zoom & two finger pan
    if (this.activePointers.size === 2) {
      const pts = Array.from(this.activePointers.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this.initialPinchDist > 0) {
        const factor = currentDist / this.initialPinchDist;
        const centerX = (pts[0].x + pts[1].x) / 2;
        const centerY = (pts[0].y + pts[1].y) / 2;
        this.viewport.zoomAt(centerX, centerY, factor);
        this.initialPinchDist = currentDist;
      }
      return;
    }

    const worldPos = this.viewport.screenToWorld(e.clientX, e.clientY);

    // Pan with mouse drag or pan tool
    if (e.buttons === 4 || e.buttons === 2 || this.activeTool === 'pan' || (e.buttons === 1 && !this.draggingToken && !this.isDrawing)) {
      this.viewport.pan(currentScreen.x - prevScreen.x, currentScreen.y - prevScreen.y);
      return;
    }

    // Token Dragging with dynamic movement ruler
    if (this.draggingToken && this.dragStartPos && this.session) {
      const currentMap =
        this.session.maps.find((m) => m.id === this.currentMapId) ||
        this.session.maps[0];
      const tokDiameter = this.draggingToken.size * currentMap.gridSize;
      const radius = tokDiameter / 2;

      // Offset token center to follow cursor
      let newX = worldPos.x - radius;
      let newY = worldPos.y - radius;

      if (this.snapEnabled) {
        const snapped = snapToGrid(newX, newY, currentMap.gridSize, this.draggingToken.size);
        newX = snapped.x;
        newY = snapped.y;
      }

      this.draggingToken.x = newX;
      this.draggingToken.y = newY;

      // Active ruler
      const startCenter: Point = {
        x: this.dragStartPos.x + radius,
        y: this.dragStartPos.y + radius,
      };
      const endCenter: Point = {
        x: newX + radius,
        y: newY + radius,
      };

      this.activeRuler = measureDistance(
        startCenter,
        endCenter,
        currentMap.gridSize,
        this.draggingToken.speed || 30,
        currentMap.scaleFtPerCell || 5
      );
      return;
    }

    // Drawing in-progress
    if (this.isDrawing && this.drawStart) {
      this.drawCurrent = worldPos;
      if (this.activeTool === 'laser') {
        this.laserPoints.push(worldPos);
        // keep laser points within reasonable length
        if (this.laserPoints.length > 25) this.laserPoints.shift();
      }
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    this.activePointers.delete(e.pointerId);

    // Finish Token Drag
    if (this.draggingToken && this.dragStartPos) {
      const token = this.draggingToken;
      this.callbacks.onTokenMove?.(token.id, token.x, token.y);
      this.draggingToken = null;
      this.dragStartPos = null;
      this.activeRuler = null;
    }

    // Finish Marker or Fog drawing
    if (this.isDrawing && this.drawStart && this.drawCurrent) {
      this.finishDrawing();
    }

    this.isDrawing = false;
    this.drawStart = null;
    this.drawCurrent = null;
    this.laserPoints = [];
  };

  private finishDrawing() {
    if (!this.drawStart || !this.drawCurrent || !this.localPlayer) return;

    const { x: x1, y: y1 } = this.drawStart;
    const { x: x2, y: y2 } = this.drawCurrent;

    if (this.activeTool === 'laser') {
      this.broadcastMarker({
        id: crypto.randomUUID(),
        type: 'laser',
        userId: this.localPlayer.id,
        userName: this.localPlayer.name,
        color: this.localPlayer.color,
        x: x2,
        y: y2,
        points: [...this.laserPoints],
        durationMs: 2000,
        createdAt: Date.now(),
      });
    } else if (this.activeTool === 'arrow') {
      this.broadcastMarker({
        id: crypto.randomUUID(),
        type: 'arrow',
        userId: this.localPlayer.id,
        userName: this.localPlayer.name,
        color: this.localPlayer.color,
        x: x1,
        y: y1,
        targetX: x2,
        targetY: y2,
        durationMs: 5000,
        createdAt: Date.now(),
      });
    } else if (this.activeTool === 'circle') {
      const radius = Math.hypot(x2 - x1, y2 - y1);
      this.broadcastMarker({
        id: crypto.randomUUID(),
        type: 'circle',
        userId: this.localPlayer.id,
        userName: this.localPlayer.name,
        color: this.localPlayer.color,
        x: x1,
        y: y1,
        radius,
        durationMs: 6000,
        createdAt: Date.now(),
      });
    } else if (this.activeTool === 'rectangle') {
      this.broadcastMarker({
        id: crypto.randomUUID(),
        type: 'rectangle',
        userId: this.localPlayer.id,
        userName: this.localPlayer.name,
        color: this.localPlayer.color,
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
        durationMs: 6000,
        createdAt: Date.now(),
      });
    } else if (this.activeTool.startsWith('fog')) {
      const mode = this.activeTool === 'fog-reveal' ? 'reveal' : 'hide';
      const shape: FogShape = {
        id: crypto.randomUUID(),
        mode,
        type: 'rect',
        points: [
          { x: Math.min(x1, x2), y: Math.min(y1, y2) },
          { x: Math.max(x1, x2), y: Math.min(y1, y2) },
          { x: Math.max(x1, x2), y: Math.max(y1, y2) },
          { x: Math.min(x1, x2), y: Math.max(y1, y2) },
        ],
      };
      this.callbacks.onFogUpdate?.(shape);
    }
  }

  private broadcastMarker(marker: ScreenMarker) {
    if (this.session) {
      this.session.markers.push(marker);
    }
    this.callbacks.onMarkerAdd?.(marker);
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    this.viewport.zoomAt(e.clientX, e.clientY, zoomFactor);
  };

  private bindEvents() {
    const c = this.canvas;
    c.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    c.addEventListener('wheel', this.onWheel, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private unbindEvents() {
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    c.removeEventListener('wheel', this.onWheel);
  }
}
