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
import { renderMarkers, hexToRgba, getContrastingAccentColor } from './PointerSystem.js';
import { drawRuler, measureDistance, RulerMeasurement } from './Ruler.js';

/**
 * -----------------------------------------------------------------------------------------
 * VIEWPORT INTERACTION TUNING CONSTANTS (Task #117)
 * Adjust these values to tweak the trackpad pan sensitivity and zooming response strength:
 * - TRACKPAD_PAN_SENSITIVITY: Multiplier applied to two-finger trackpad panning (default: 1.0)
 * - TRACKPAD_ZOOM_SENSITIVITY: Multiplier applied to trackpad pinch-to-zoom gesture (default: 0.01)
 * - MOUSE_WHEEL_ZOOM_SENSITIVITY: Multiplier applied to desktop mouse wheel zooming (default: 0.0015)
 * -----------------------------------------------------------------------------------------
 */
export const TRACKPAD_PAN_SENSITIVITY = 1.0;
export const TRACKPAD_ZOOM_SENSITIVITY = 0.01;
export const MOUSE_WHEEL_ZOOM_SENSITIVITY = 0.0015;

export type ActiveTool =
  | 'select'
  | 'pan'
  | 'box-select'
  | 'laser'
  | 'arrow'
  | 'crosshair'
  | 'circle'
  | 'rectangle'
  | 'cone'
  | 'measure'
  | 'fog-reveal'
  | 'fog-hide';

export interface CanvasEngineCallbacks {
  onTokenMove?: (id: string, x: number, y: number) => void;
  onTokenSelect?: (token: Token | null) => void;
  onTokensSelect?: (tokens: Token[]) => void;
  onMarkerAdd?: (marker: ScreenMarker) => void;
  onMarkerDelete?: (id: string) => void;
  onMarkerUpdate?: (id: string, updates: Partial<ScreenMarker>) => void;
  onMarkerSelect?: (marker: ScreenMarker | null) => void;
  onFogUpdate?: (shape: FogShape) => void;
  onToolChange?: (tool: ActiveTool) => void;
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
  selectedTokenIds: string[] = [];
  dragGroupInitialPositions: Map<string, Point> = new Map();
  draggingToken: Token | null = null;
  dragStartPos: Point | null = null;
  dragCurrentPos: Point | null = null;
  activeRuler: RulerMeasurement | null = null;
  measuringTape: RulerMeasurement | null = null;

  // Persistent marker state
  persistMarkersMode: boolean = false;
  selectedMarkerId: string | null = null;
  draggingMarker: ScreenMarker | null = null;
  draggingMarkerHandle: { marker: ScreenMarker; handle: 'spread' } | null = null;

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
    this.selectedTokenIds = id ? [id] : [];
  }

  selectTokens(ids: string[]) {
    this.selectedTokenIds = ids;
    this.selectedTokenId = ids[0] || null;
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

    // 3.5. Render Persistent Screen Markers (Drawing Layer on top of grid, beneath props and character tokens)
    const persistentMarkers = (this.session.markers || []).filter(
      (m) => m.persist && (!m.mapId || m.mapId === currentMap.id)
    );
    if (persistentMarkers.length > 0) {
      renderMarkers(
        ctx,
        persistentMarkers,
        now,
        currentMap.gridSize,
        currentMap.scaleFtPerCell,
        this.selectedMarkerId
      );
    }

    // 4. Render Tokens and Props
    const tokens = Object.values(this.session.tokens).filter(
      (t) => t.mapId === currentMap.id
    );

    // Render props first, then tokens
    const props = tokens.filter((t) => t.isProp);
    const characters = tokens.filter((t) => !t.isProp);

    for (const prop of props) {
      const isSelected = this.selectedTokenIds.includes(prop.id) || prop.id === this.selectedTokenId;
      const canControl = isGm || (prop.ownerId === this.localPlayer?.id);
      renderToken(ctx, prop, currentMap.gridSize, isSelected, canControl, isGm);
    }

    for (const tok of characters) {
      const isSelected = this.selectedTokenIds.includes(tok.id) || tok.id === this.selectedTokenId;
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

    // 6. Render Active Movement Ruler & Measuring Tape
    if (this.activeRuler) {
      drawRuler(ctx, this.activeRuler);
    }
    if (this.measuringTape) {
      drawRuler(ctx, this.measuringTape);
    }

    // 7. Render Ephemeral Screen Markers (Pings, lasers above tokens)
    const ephemeralMarkers = (this.session.markers || []).filter((m) => !m.persist);
    if (ephemeralMarkers.length > 0) {
      const activeEphemeral = renderMarkers(
        ctx,
        ephemeralMarkers,
        now,
        currentMap.gridSize,
        currentMap.scaleFtPerCell
      );
      this.session.markers = [
        ...this.session.markers.filter((m) => m.persist),
        ...activeEphemeral,
      ];
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

  private drawMeasurementBadge(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    borderColor: string = '#6366f1'
  ) {
    ctx.save();
    ctx.font = 'bold 12px Inter, sans-serif';
    const metrics = ctx.measureText(text);
    const paddingX = 8;
    const paddingY = 4;
    const width = metrics.width + paddingX * 2;
    const height = 22;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.roundRect(x - width / 2, y - height / 2, width, height, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  private renderDrawingPreview(ctx: CanvasRenderingContext2D, map: GameMap) {
    if (!this.isDrawing || !this.drawStart || !this.drawCurrent) return;

    const color = this.localPlayer?.color || '#6366f1';
    const { x: x1, y: y1 } = this.drawStart;
    const { x: x2, y: y2 } = this.drawCurrent;
    const gridSize = map.gridSize || 50;
    const scaleFtPerCell = map.scaleFtPerCell || 5;

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

      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLen = 16;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - headLen * Math.cos(angle - Math.PI / 6),
        y2 - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        x2 - headLen * Math.cos(angle + Math.PI / 6),
        y2 - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Show live arrow length badge
      const distPx = Math.hypot(x2 - x1, y2 - y1);
      const lengthFt = Math.round((distPx / gridSize) * scaleFtPerCell);
      this.drawMeasurementBadge(ctx, `${lengthFt} ft`, (x1 + x2) / 2, (y1 + y2) / 2 - 14, color);
    } else if (this.activeTool === 'circle') {
      const radius = Math.hypot(x2 - x1, y2 - y1);
      ctx.beginPath();
      ctx.arc(x1, y1, radius, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(color, 0.2);
      ctx.fill();
      ctx.stroke();

      // Radius line from center to cursor
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();

      // Center point
      ctx.beginPath();
      ctx.arc(x1, y1, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Show live radius badge
      const radiusFt = Math.round((radius / gridSize) * scaleFtPerCell);
      this.drawMeasurementBadge(ctx, `${radiusFt} ft radius`, (x1 + x2) / 2, (y1 + y2) / 2 - 14, color);
    } else if (this.activeTool === 'cone') {
      const radius = Math.hypot(x2 - x1, y2 - y1);
      const angleDeg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
      const spreadAngle = 60;
      const thetaRad = (angleDeg * Math.PI) / 180;
      const alphaRad = ((spreadAngle / 2) * Math.PI) / 180;

      const a1x = x1 + radius * Math.cos(thetaRad - alphaRad);
      const a1y = y1 + radius * Math.sin(thetaRad - alphaRad);
      const a2x = x1 + radius * Math.cos(thetaRad + alphaRad);
      const a2y = y1 + radius * Math.sin(thetaRad + alphaRad);

      // Dual Cone: render triangle difference corners
      const cosAlpha = Math.cos(alphaRad);
      const rCorner = radius / cosAlpha;
      const p1x = x1 + rCorner * Math.cos(thetaRad - alphaRad);
      const p1y = y1 + rCorner * Math.sin(thetaRad - alphaRad);
      const p2x = x1 + rCorner * Math.cos(thetaRad + alphaRad);
      const p2y = y1 + rCorner * Math.sin(thetaRad + alphaRad);

      const accentColor = getContrastingAccentColor(color);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(a1x, a1y);
      ctx.lineTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.lineTo(a2x, a2y);
      ctx.arc(x1, y1, radius, thetaRad + alphaRad, thetaRad - alphaRad, true);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(accentColor, 0.22);
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();

      // Circular cone arc in primary highlight color
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(a1x, a1y);
      ctx.arc(x1, y1, radius, thetaRad - alphaRad, thetaRad + alphaRad, false);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(color, 0.22);
      ctx.fill();
      ctx.stroke();

      // Centerline guide
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();

      // Origin caster point
      ctx.beginPath();
      ctx.arc(x1, y1, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Live preview badge: `${radiusFt} ft cone`
      const radiusFt = Math.round((radius / gridSize) * scaleFtPerCell);
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2 - 14;
      this.drawMeasurementBadge(ctx, `${radiusFt} ft cone`, midX, midY, color);
    } else if (this.activeTool === 'crosshair') {
      const dist = Math.hypot(x2 - x1, y2 - y1);
      const minSize = 18;
      const size = Math.max(minSize, dist);
      const radiusFt = Math.round((size / gridSize) * scaleFtPerCell);

      // Semi-transparent target area
      if (size > minSize) {
        ctx.beginPath();
        ctx.arc(x1, y1, size, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(color, 0.15);
        ctx.fill();
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;

      // Crosshair lines
      ctx.beginPath();
      ctx.moveTo(x1 - size, y1);
      ctx.lineTo(x1 + size, y1);
      ctx.moveTo(x1, y1 - size);
      ctx.lineTo(x1, y1 + size);
      ctx.stroke();

      // Outer circle
      ctx.beginPath();
      ctx.arc(x1, y1, size + 4, 0, Math.PI * 2);
      ctx.stroke();

      // If dragged beyond minimum, draw radius guideline and measurement badge (Task #119)
      if (dist > 5) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();

        this.drawMeasurementBadge(ctx, `${radiusFt} ft target`, (x1 + x2) / 2, (y1 + y2) / 2 - 14, color);
      }
    } else if (this.activeTool === 'rectangle' || this.activeTool.startsWith('fog') || this.activeTool === 'box-select') {
      ctx.fillStyle = this.activeTool === 'fog-reveal'
        ? 'rgba(255, 255, 255, 0.2)'
        : this.activeTool === 'box-select'
        ? 'rgba(99, 102, 241, 0.15)'
        : this.activeTool === 'rectangle'
        ? hexToRgba(color, 0.2)
        : 'rgba(0, 0, 0, 0.4)';

      if (this.activeTool === 'box-select') {
        ctx.strokeStyle = '#6366f1';
        ctx.setLineDash([4, 4]);
      }
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      // Show live rectangle dimensions badge
      if (this.activeTool === 'rectangle') {
        const widthFt = Math.round((Math.abs(x2 - x1) / gridSize) * scaleFtPerCell);
        const heightFt = Math.round((Math.abs(y2 - y1) / gridSize) * scaleFtPerCell);
        const centerX = (x1 + x2) / 2;
        const topY = Math.min(y1, y2) - 14;
        this.drawMeasurementBadge(ctx, `${widthFt} ft × ${heightFt} ft`, centerX, topY, color);
      }
    }

    ctx.restore();
  }

  public screenToWorld(screenX: number, screenY: number): Point {
    return this.viewport.screenToWorld(screenX, screenY);
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

    // Pan mode (middle click, right click, or pan tool)
    if (e.button === 1 || e.button === 2 || this.activeTool === 'pan') {
      return;
    }

    if (this.activeTool === 'select') {
      this.handleSelectPointerDown(worldPos);
    } else if (this.activeTool === 'box-select') {
      const currentMap =
        this.session?.maps.find((m) => m.id === this.currentMapId) ||
        this.session?.maps[0];
      const matching = currentMap ? this.findMatchingTokens(worldPos, currentMap) : [];
      const alreadySelected = matching.find((t) => this.selectedTokenIds.includes(t.id));
      if (alreadySelected) {
        this.handleSelectPointerDown(worldPos);
      } else {
        this.isDrawing = true;
        this.drawStart = worldPos;
        this.drawCurrent = worldPos;
      }
    } else if (this.activeTool === 'measure') {
      const currentMap =
        this.session?.maps.find((m) => m.id === this.currentMapId) ||
        this.session?.maps[0];
      let startPoint = worldPos;
      if (currentMap) {
        const matching = this.findMatchingTokens(worldPos, currentMap);
        if (matching.length > 0) {
          const tok = matching[0];
          const radius = (tok.size * currentMap.gridSize) / 2;
          startPoint = { x: tok.x + radius, y: tok.y + radius };
        } else if (this.snapEnabled && !e.shiftKey) {
          const offX = currentMap.gridOffsetX || 0;
          const offY = currentMap.gridOffsetY || 0;
          const half = currentMap.gridSize / 2;
          startPoint = {
            x: Math.round((worldPos.x - offX - half) / currentMap.gridSize) * currentMap.gridSize + offX + half,
            y: Math.round((worldPos.y - offY - half) / currentMap.gridSize) * currentMap.gridSize + offY + half,
          };
        }
      }
      this.isDrawing = true;
      this.drawStart = startPoint;
      this.drawCurrent = startPoint;
      if (currentMap) {
        this.measuringTape = measureDistance(
          startPoint,
          startPoint,
          currentMap.gridSize,
          Infinity,
          currentMap.scaleFtPerCell || 5
        );
        this.measuringTape.color = this.localPlayer?.color || '#06b6d4';
      }
    } else {
      // Marker drawing or fog drawing (laser, arrow, circle, rectangle, cone, crosshair)
      this.isDrawing = true;
      this.drawStart = worldPos;
      this.drawCurrent = worldPos;
      if (this.activeTool === 'laser') {
        this.laserPoints = [worldPos];
      }
    }
  };

  private findMatchingTokens(worldPos: Point, currentMap: GameMap): Token[] {
    if (!this.session) return [];
    const tokens = Object.values(this.session.tokens).filter(
      (t) => t.mapId === currentMap.id
    );
    const matchingTokens: Token[] = [];
    for (let i = tokens.length - 1; i >= 0; i--) {
      const tok = tokens[i];
      const isProp = Boolean(tok.isProp);
      const propW = (isProp && tok.propWidth !== undefined ? tok.propWidth : tok.size) * currentMap.gridSize;
      const propH = (isProp && tok.propHeight !== undefined ? tok.propHeight : tok.size) * currentMap.gridSize;
      const cx = tok.x + propW / 2;
      const cy = tok.y + propH / 2;

      // Transform worldPos to token's local coordinate system taking rotation into account
      const dx = worldPos.x - cx;
      const dy = worldPos.y - cy;
      const rotRad = ((tok.rotation || 0) * Math.PI) / 180;
      const localX = dx * Math.cos(-rotRad) - dy * Math.sin(-rotRad);
      const localY = dx * Math.sin(-rotRad) + dy * Math.cos(-rotRad);

      if (isProp) {
        if (Math.abs(localX) <= propW / 2 && Math.abs(localY) <= propH / 2) {
          matchingTokens.push(tok);
        }
      } else {
        const radius = (tok.size * currentMap.gridSize) / 2;
        if (Math.hypot(localX, localY) <= radius) {
          matchingTokens.push(tok);
        }
      }
    }
    return matchingTokens;
  }

  private handleSelectPointerDown(worldPos: Point) {
    if (!this.session) return;
    const currentMap =
      this.session.maps.find((m) => m.id === this.currentMapId) ||
      this.session.maps[0];
    if (!currentMap) return;

    const isGm = this.localPlayer?.role === 'gm';
    const localId = this.localPlayer?.id;

    const matchingTokens = this.findMatchingTokens(worldPos, currentMap);

    let clickedToken: Token | null = null;
    if (matchingTokens.length > 0) {
      // If clicking one of the currently selected tokens in a multi-token group, preserve group selection
      const alreadySelected = matchingTokens.find((t) => this.selectedTokenIds.includes(t.id));
      if (alreadySelected && this.selectedTokenIds.length > 1) {
        clickedToken = alreadySelected;
      } else {
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
    }

    if (clickedToken) {
      this.selectedMarkerId = null;
      this.callbacks.onMarkerSelect?.(null);

      if (!this.selectedTokenIds.includes(clickedToken.id)) {
        this.selectedTokenId = clickedToken.id;
        this.selectedTokenIds = [clickedToken.id];
        this.callbacks.onTokenSelect?.(clickedToken);
        this.callbacks.onTokensSelect?.([clickedToken]);
      } else {
        this.selectedTokenId = clickedToken.id;
      }

      const isControllable =
        isGm || clickedToken.ownerId === localId || Boolean(this.localPlayer?.assignedTokenIds?.includes(clickedToken.id));

      // Player permissions check: Players can only move their own tokens, and cannot drag locked tokens/props
      if (isControllable && !clickedToken.locked) {
        this.draggingToken = clickedToken;
        this.dragStartPos = { x: clickedToken.x, y: clickedToken.y };
        this.dragCurrentPos = worldPos;
        this.dragGroupInitialPositions.clear();
        for (const id of this.selectedTokenIds) {
          const t = this.session.tokens[id];
          if (t) {
            this.dragGroupInitialPositions.set(id, { x: t.x, y: t.y });
          }
        }
      }
    } else {
      // Check if clicking on interactive edge handle dot of selected persistent cone
      if (this.selectedMarkerId && this.session?.markers) {
        const selMarker = this.session.markers.find((m) => m.id === this.selectedMarkerId);
        if (
          selMarker &&
          selMarker.type === 'cone' &&
          selMarker.persist &&
          (isGm || selMarker.userId === localId) &&
          !selMarker.locked
        ) {
          const rad = selMarker.radius || 100;
          const theta = ((selMarker.angle ?? 0) * Math.PI) / 180;
          const alpha = (((selMarker.spreadAngle ?? 60) / 2) * Math.PI) / 180;
          const h2 = {
            x: selMarker.x + rad * Math.cos(theta + alpha),
            y: selMarker.y + rad * Math.sin(theta + alpha),
          };
          const h1 = {
            x: selMarker.x + rad * Math.cos(theta - alpha),
            y: selMarker.y + rad * Math.sin(theta - alpha),
          };
          if (
            Math.hypot(worldPos.x - h2.x, worldPos.y - h2.y) <= 18 ||
            Math.hypot(worldPos.x - h1.x, worldPos.y - h1.y) <= 18
          ) {
            this.draggingMarkerHandle = { marker: selMarker, handle: 'spread' };
            return;
          }
        }
      }

      this.selectedTokenId = null;
      this.selectedTokenIds = [];
      this.callbacks.onTokenSelect?.(null);
      this.callbacks.onTokensSelect?.([]);

      // Hit-test persistent markers on the drawing layer
      const clickedMarker = this.findMatchingPersistentMarker(worldPos, currentMap);
      if (clickedMarker && (isGm || clickedMarker.userId === localId)) {
        this.selectedMarkerId = clickedMarker.id;
        this.callbacks.onMarkerSelect?.(clickedMarker);

        if (!clickedMarker.locked) {
          this.draggingMarker = clickedMarker;
          this.dragStartPos = { x: clickedMarker.x, y: clickedMarker.y };
          this.dragCurrentPos = worldPos;
        }
      } else {
        this.selectedMarkerId = null;
        this.callbacks.onMarkerSelect?.(null);
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
      const ptsBefore = Array.from(this.activePointers.values());
      this.activePointers.set(e.pointerId, currentScreen);
      const ptsAfter = Array.from(this.activePointers.values());

      // 1. Calculate pan delta from midpoint movement
      const prevMidX = (ptsBefore[0].x + ptsBefore[1].x) / 2;
      const prevMidY = (ptsBefore[0].y + ptsBefore[1].y) / 2;
      const currentMidX = (ptsAfter[0].x + ptsAfter[1].x) / 2;
      const currentMidY = (ptsAfter[0].y + ptsAfter[1].y) / 2;
      this.viewport.pan(currentMidX - prevMidX, currentMidY - prevMidY);

      // 2. Calculate zoom factor from pinch distance ratio
      const prevDist = Math.hypot(ptsBefore[0].x - ptsBefore[1].x, ptsBefore[0].y - ptsBefore[1].y);
      const currentDist = Math.hypot(ptsAfter[0].x - ptsAfter[1].x, ptsAfter[0].y - ptsAfter[1].y);
      if (this.initialPinchDist && prevDist > 0) {
        const factor = currentDist / this.initialPinchDist;
        this.viewport.zoomAt(currentMidX, currentMidY, factor);
        this.initialPinchDist = currentDist;
      }
      return;
    }

    const worldPos = this.viewport.screenToWorld(e.clientX, e.clientY);

    // Cone spread angle handle dragging (Task #118)
    if (this.draggingMarkerHandle) {
      const m = this.draggingMarkerHandle.marker;
      const currAngleDeg = (Math.atan2(worldPos.y - m.y, worldPos.x - m.x) * 180) / Math.PI;
      const centerAngleDeg = m.angle ?? 0;
      const diff = Math.abs(((currAngleDeg - centerAngleDeg + 540) % 360) - 180);
      let newSpread = Math.round(diff * 2);
      newSpread = Math.max(15, Math.min(180, newSpread));
      m.spreadAngle = newSpread;
      this.callbacks.onMarkerUpdate?.(m.id, { spreadAngle: newSpread });
      this.callbacks.onMarkerSelect?.({ ...m });
      return;
    }

    // Pan with mouse drag or pan tool
    if (
      e.buttons === 4 ||
      e.buttons === 2 ||
      this.activeTool === 'pan' ||
      (e.buttons === 1 &&
        !this.draggingToken &&
        !this.isDrawing &&
        !this.draggingMarker &&
        !this.draggingMarkerHandle)
    ) {
      this.viewport.pan(currentScreen.x - prevScreen.x, currentScreen.y - prevScreen.y);
      return;
    }

    // Persistent Marker Dragging
    if (this.draggingMarker && this.dragCurrentPos && !this.draggingMarker.locked) {
      const dx = worldPos.x - this.dragCurrentPos.x;
      const dy = worldPos.y - this.dragCurrentPos.y;
      this.draggingMarker.x += dx;
      this.draggingMarker.y += dy;
      if (this.draggingMarker.targetX !== undefined) this.draggingMarker.targetX += dx;
      if (this.draggingMarker.targetY !== undefined) this.draggingMarker.targetY += dy;
      this.dragCurrentPos = worldPos;
      return;
    }

    // Token Dragging with dynamic movement ruler
    if (this.draggingToken && this.dragStartPos && this.session) {
      const currentMap =
        this.session.maps.find((m) => m.id === this.currentMapId) ||
        this.session.maps[0];
      const isProp = Boolean(this.draggingToken.isProp);
      const propW = (isProp && this.draggingToken.propWidth !== undefined ? this.draggingToken.propWidth : this.draggingToken.size) * currentMap.gridSize;
      const propH = (isProp && this.draggingToken.propHeight !== undefined ? this.draggingToken.propHeight : this.draggingToken.size) * currentMap.gridSize;

      // Offset token center to follow cursor
      let newX = worldPos.x - propW / 2;
      let newY = worldPos.y - propH / 2;

      if (this.snapEnabled) {
        const snapped = snapToGrid(
          newX,
          newY,
          currentMap.gridSize,
          this.draggingToken.size,
          currentMap.gridOffsetX || 0,
          currentMap.gridOffsetY || 0,
          currentMap.gridType || 'square'
        );
        newX = snapped.x;
        newY = snapped.y;
      }

      const deltaX = newX - this.dragStartPos.x;
      const deltaY = newY - this.dragStartPos.y;

      this.draggingToken.x = newX;
      this.draggingToken.y = newY;

      if (this.session && this.selectedTokenIds.length > 1) {
        for (const id of this.selectedTokenIds) {
          if (id === this.draggingToken.id) continue;
          const tok = this.session.tokens[id];
          if (tok?.locked) continue;
          const initial = this.dragGroupInitialPositions.get(id);
          if (tok && initial) {
            tok.x = initial.x + deltaX;
            tok.y = initial.y + deltaY;
          }
        }
      }

      // Active ruler
      const startCenter: Point = {
        x: this.dragStartPos.x + propW / 2,
        y: this.dragStartPos.y + propH / 2,
      };
      const endCenter: Point = {
        x: newX + propW / 2,
        y: newY + propH / 2,
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

    // Measuring tape in-progress
    if (this.isDrawing && this.drawStart && this.activeTool === 'measure') {
      const currentMap =
        this.session?.maps.find((m) => m.id === this.currentMapId) ||
        this.session?.maps[0];
      let endPoint = worldPos;
      if (currentMap) {
        const matching = this.findMatchingTokens(worldPos, currentMap);
        if (matching.length > 0) {
          const tok = matching[0];
          const radius = (tok.size * currentMap.gridSize) / 2;
          endPoint = { x: tok.x + radius, y: tok.y + radius };
        } else if (this.snapEnabled && !e.shiftKey) {
          const offX = currentMap.gridOffsetX || 0;
          const offY = currentMap.gridOffsetY || 0;
          const half = currentMap.gridSize / 2;
          endPoint = {
            x: Math.round((worldPos.x - offX - half) / currentMap.gridSize) * currentMap.gridSize + offX + half,
            y: Math.round((worldPos.y - offY - half) / currentMap.gridSize) * currentMap.gridSize + offY + half,
          };
        }
        this.drawCurrent = endPoint;
        this.measuringTape = measureDistance(
          this.drawStart,
          endPoint,
          currentMap.gridSize,
          Infinity,
          currentMap.scaleFtPerCell || 5
        );
        this.measuringTape.color = this.localPlayer?.color || '#06b6d4';
      }
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
    if (this.activePointers.size < 2) {
      this.initialPinchDist = 0;
    }

    // Finish Token Drag
    if (this.draggingToken && this.dragStartPos) {
      if (this.selectedTokenIds.length > 1 && this.session) {
        for (const id of this.selectedTokenIds) {
          const tok = this.session.tokens[id];
          if (tok) {
            this.callbacks.onTokenMove?.(tok.id, tok.x, tok.y);
          }
        }
      } else {
        const token = this.draggingToken;
        this.callbacks.onTokenMove?.(token.id, token.x, token.y);
      }
      this.draggingToken = null;
      this.dragStartPos = null;
      this.dragGroupInitialPositions.clear();
      this.activeRuler = null;
    }

    // Finish Persistent Marker Drag
    if (this.draggingMarker) {
      const marker = this.draggingMarker;
      this.draggingMarker = null;
      this.callbacks.onMarkerUpdate?.(marker.id, {
        x: marker.x,
        y: marker.y,
        targetX: marker.targetX,
        targetY: marker.targetY,
      });
    }

    // Finish Cone Handle Drag (Task #118)
    if (this.draggingMarkerHandle) {
      const m = this.draggingMarkerHandle.marker;
      this.draggingMarkerHandle = null;
      this.callbacks.onMarkerUpdate?.(m.id, { spreadAngle: m.spreadAngle });
      this.callbacks.onMarkerSelect?.({ ...m });
    }

    // Finish Marker or Fog drawing
    if (this.isDrawing && this.drawStart && this.drawCurrent) {
      this.finishDrawing(e);
    }

    this.isDrawing = false;
    this.drawStart = null;
    this.drawCurrent = null;
    this.laserPoints = [];
  };

  private finishDrawing(e?: PointerEvent) {
    if (!this.drawStart || !this.drawCurrent || !this.localPlayer) return;

    const { x: x1, y: y1 } = this.drawStart;
    const { x: x2, y: y2 } = this.drawCurrent;

    const currentMap =
      this.session?.maps.find((m) => m.id === this.currentMapId) ||
      this.session?.maps[0];

    if (this.activeTool === 'measure') {
      return;
    }

    if (this.activeTool === 'box-select') {
      if (Math.abs(x2 - x1) < 5 && Math.abs(y2 - y1) < 5) {
        this.handleSelectPointerDown(this.drawStart);
        return;
      }

      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);

      if (!currentMap || !this.session) return;

      const tokens = Object.values(this.session.tokens).filter(
        (t) => t.mapId === currentMap.id
      );

      const isGm = this.localPlayer?.role === 'gm';
      const localId = this.localPlayer?.id;
      const isControllable = (t: Token) =>
        isGm || t.ownerId === localId || Boolean(this.localPlayer?.assignedTokenIds?.includes(t.id));

      const enclosedTokens = tokens.filter((t) => {
        const isProp = Boolean(t.isProp);
        const propW = (isProp && t.propWidth !== undefined ? t.propWidth : t.size) * currentMap.gridSize;
        const propH = (isProp && t.propHeight !== undefined ? t.propHeight : t.size) * currentMap.gridSize;
        const cx = t.x + propW / 2;
        const cy = t.y + propH / 2;
        return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY;
      });

      const controllableEnclosed = enclosedTokens.filter(isControllable);
      const toSelect = isGm ? enclosedTokens : (controllableEnclosed.length > 0 ? controllableEnclosed : enclosedTokens);

      this.selectedTokenIds = toSelect.map((t) => t.id);
      this.selectedTokenId = toSelect[0] ? toSelect[0].id : null;
      this.callbacks.onTokensSelect?.(toSelect);
      this.callbacks.onTokenSelect?.(toSelect[0] || null);

      // Auto-revert box select tool to arrow ('select') tool when tokens are successfully selected (Task #117)
      if (toSelect.length > 0) {
        this.activeTool = 'select';
        this.callbacks.onToolChange?.('select');
      }
      return;
    }

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
        persist: false,
        durationMs: 2000,
        createdAt: Date.now(),
      });
    } else if (this.activeTool === 'arrow') {
      const isPersistent = this.persistMarkersMode ? !(e && e.shiftKey) : Boolean(e && e.shiftKey);
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
        mapId: currentMap?.id,
        persist: isPersistent,
        durationMs: isPersistent ? 0 : 5000,
        createdAt: Date.now(),
      });
    } else if (this.activeTool === 'circle') {
      const radius = Math.hypot(x2 - x1, y2 - y1);
      const isPersistent = this.persistMarkersMode ? !(e && e.shiftKey) : Boolean(e && e.shiftKey);
      this.broadcastMarker({
        id: crypto.randomUUID(),
        type: 'circle',
        userId: this.localPlayer.id,
        userName: this.localPlayer.name,
        color: this.localPlayer.color,
        x: x1,
        y: y1,
        radius,
        mapId: currentMap?.id,
        persist: isPersistent,
        durationMs: isPersistent ? 0 : 6000,
        createdAt: Date.now(),
      });
    } else if (this.activeTool === 'rectangle') {
      const isPersistent = this.persistMarkersMode ? !(e && e.shiftKey) : Boolean(e && e.shiftKey);
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
        mapId: currentMap?.id,
        persist: isPersistent,
        durationMs: isPersistent ? 0 : 6000,
        createdAt: Date.now(),
      });
    } else if (this.activeTool === 'cone') {
      const radius = Math.hypot(x2 - x1, y2 - y1);
      if (radius > 10) {
        const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
        const isPersistent = this.persistMarkersMode ? !(e && e.shiftKey) : Boolean(e && e.shiftKey);
        this.broadcastMarker({
          id: crypto.randomUUID(),
          type: 'cone',
          userId: this.localPlayer.id,
          userName: this.localPlayer.name,
          color: this.localPlayer.color,
          x: x1,
          y: y1,
          radius,
          angle,
          spreadAngle: 60,
          mapId: currentMap?.id,
          persist: isPersistent,
          durationMs: isPersistent ? 0 : 6000,
          createdAt: Date.now(),
        });
      }
    } else if (this.activeTool === 'crosshair') {
      const dist = Math.hypot(x2 - x1, y2 - y1);
      const minSize = 18;
      const radius = Math.max(minSize, dist);
      const isPersistent = this.persistMarkersMode ? !(e && e.shiftKey) : Boolean(e && e.shiftKey);
      this.broadcastMarker({
        id: crypto.randomUUID(),
        type: 'crosshair',
        userId: this.localPlayer.id,
        userName: this.localPlayer.name,
        color: this.localPlayer.color,
        x: x1,
        y: y1,
        radius,
        mapId: currentMap?.id,
        persist: isPersistent,
        durationMs: isPersistent ? 0 : 4000,
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

  setPersistMarkersMode(persist: boolean) {
    this.persistMarkersMode = persist;
  }

  deleteSelectedMarker() {
    if (!this.selectedMarkerId) return;
    const id = this.selectedMarkerId;
    this.selectedMarkerId = null;
    if (this.session) {
      this.session.markers = this.session.markers.filter((m) => m.id !== id);
    }
    this.callbacks.onMarkerSelect?.(null);
    this.callbacks.onMarkerDelete?.(id);
  }

  toggleLockSelectedMarker() {
    if (!this.selectedMarkerId || !this.session) return;
    const marker = this.session.markers.find((m) => m.id === this.selectedMarkerId);
    if (!marker) return;
    marker.locked = !marker.locked;
    this.callbacks.onMarkerUpdate?.(marker.id, { locked: marker.locked });
    this.callbacks.onMarkerSelect?.({ ...marker });
  }

  private findMatchingPersistentMarker(worldPos: Point, map: GameMap): ScreenMarker | null {
    if (!this.session?.markers) return null;
    const candidates = this.session.markers.filter(
      (m) => m.persist && (!m.mapId || m.mapId === map.id)
    );
    for (let i = candidates.length - 1; i >= 0; i--) {
      const m = candidates[i];
      if (m.type === 'circle') {
        const rad = m.radius || 50;
        if (Math.hypot(worldPos.x - m.x, worldPos.y - m.y) <= rad) return m;
      } else if (m.type === 'rectangle') {
        const w = m.width || 100;
        const h = m.height || 100;
        const minX = Math.min(m.x, m.x + w);
        const maxX = Math.max(m.x, m.x + w);
        const minY = Math.min(m.y, m.y + h);
        const maxY = Math.max(m.y, m.y + h);
        if (worldPos.x >= minX && worldPos.x <= maxX && worldPos.y >= minY && worldPos.y <= maxY) {
          return m;
        }
      } else if (m.type === 'arrow') {
        const tx = m.targetX ?? m.x;
        const ty = m.targetY ?? m.y;
        if (distToSegment(worldPos, { x: m.x, y: m.y }, { x: tx, y: ty }) <= 20) {
          return m;
        }
      } else if (m.type === 'cone') {
        const rad = m.radius || 100;
        const dist = Math.hypot(worldPos.x - m.x, worldPos.y - m.y);
        if (dist <= 25) return m; // Caster origin
        const thetaDeg = (Math.atan2(worldPos.y - m.y, worldPos.x - m.x) * 180) / Math.PI;
        const centerDeg = m.angle ?? 0;
        const diff = Math.abs(((thetaDeg - centerDeg + 540) % 360) - 180);
        const halfSpread = (m.spreadAngle ?? 60) / 2;
        if (diff <= halfSpread) {
          const diffRad = (diff * Math.PI) / 180;
          if (dist <= rad || (dist * Math.cos(diffRad) <= rad && dist <= rad * 1.5)) {
            return m;
          }
        }
      } else if (m.type === 'crosshair') {
        const rad = Math.max(30, m.radius || 18);
        if (Math.hypot(worldPos.x - m.x, worldPos.y - m.y) <= rad) return m;
      }
    }
    return null;
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Pinch-to-zoom gesture on trackpads (macOS synthesizes e.ctrlKey === true) or Ctrl/Cmd+scroll
      // Smooth exponential zoom response at cursor anchor
      const factor = Math.exp(-e.deltaY * TRACKPAD_ZOOM_SENSITIVITY);
      this.viewport.zoomAt(e.clientX, e.clientY, factor);
    } else {
      // Standard two-finger trackpad swipe or mouse wheel scroll -> Pan battlemap smoothly
      const dx = -e.deltaX * TRACKPAD_PAN_SENSITIVITY;
      const dy = -e.deltaY * TRACKPAD_PAN_SENSITIVITY;
      this.viewport.pan(dx, dy);
    }
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

function distToSegment(p: Point, v: Point, w: Point): number {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}
