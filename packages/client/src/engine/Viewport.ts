export interface Point {
  x: number;
  y: number;
}

export class Viewport {
  x: number = 0;
  y: number = 0;
  scale: number = 1.0;
  minScale: number = 0.15;
  maxScale: number = 5.0;

  constructor(initialX = 0, initialY = 0, initialScale = 1.0) {
    this.x = initialX;
    this.y = initialY;
    this.scale = initialScale;
  }

  screenToWorld(screenX: number, screenY: number): Point {
    return {
      x: (screenX - this.x) / this.scale,
      y: (screenY - this.y) / this.scale,
    };
  }

  worldToScreen(worldX: number, worldY: number): Point {
    return {
      x: worldX * this.scale + this.x,
      y: worldY * this.scale + this.y,
    };
  }

  pan(deltaX: number, deltaY: number) {
    this.x += deltaX;
    this.y += deltaY;
  }

  zoomAt(screenAnchorX: number, screenAnchorY: number, zoomFactor: number) {
    const newScale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * zoomFactor));
    if (newScale === this.scale) return;

    // Keep world coordinate under screen anchor unchanged
    const worldAnchor = this.screenToWorld(screenAnchorX, screenAnchorY);
    this.scale = newScale;
    this.x = screenAnchorX - worldAnchor.x * this.scale;
    this.y = screenAnchorY - worldAnchor.y * this.scale;
  }

  centerOn(worldX: number, worldY: number, viewportWidth: number, viewportHeight: number) {
    this.x = viewportWidth / 2 - worldX * this.scale;
    this.y = viewportHeight / 2 - worldY * this.scale;
  }
}
