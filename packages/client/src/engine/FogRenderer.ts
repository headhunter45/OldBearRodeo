import { FogState, FogShape } from '@oldbear/shared';

export class FogRenderer {
  private offscreen: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;

  constructor() {
    this.offscreen = document.createElement('canvas');
    this.offCtx = this.offscreen.getContext('2d')!;
  }

  resize(width: number, height: number) {
    if (this.offscreen.width !== width || this.offscreen.height !== height) {
      this.offscreen.width = Math.max(1, width);
      this.offscreen.height = Math.max(1, height);
    }
  }

  render(
    targetCtx: CanvasRenderingContext2D,
    fog: FogState,
    mapWidth: number,
    mapHeight: number,
    isGm: boolean
  ) {
    this.resize(mapWidth, mapHeight);
    const ctx = this.offCtx;

    // Reset offscreen canvas
    ctx.clearRect(0, 0, mapWidth, mapHeight);

    const fogColor = isGm ? 'rgba(8, 12, 22, 0.65)' : 'rgba(8, 12, 22, 1.0)';

    if (fog.globalCovered) {
      // Entire map covered by default
      ctx.fillStyle = fogColor;
      ctx.fillRect(0, 0, mapWidth, mapHeight);

      // Now cut out revealed shapes
      ctx.globalCompositeOperation = 'destination-out';
      for (const shape of fog.shapes) {
        if (shape.mode === 'reveal') {
          this.drawShape(ctx, shape);
        }
      }

      // Re-hide any areas that were hidden afterwards
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = fogColor;
      for (const shape of fog.shapes) {
        if (shape.mode === 'hide') {
          this.drawShape(ctx, shape);
        }
      }
    } else {
      // Uncovered by default, only explicit 'hide' shapes add fog
      ctx.fillStyle = fogColor;
      for (const shape of fog.shapes) {
        if (shape.mode === 'hide') {
          this.drawShape(ctx, shape);
        }
      }

      // Cut out any explicit reveal shapes
      ctx.globalCompositeOperation = 'destination-out';
      for (const shape of fog.shapes) {
        if (shape.mode === 'reveal') {
          this.drawShape(ctx, shape);
        }
      }
    }

    ctx.globalCompositeOperation = 'source-over';

    // Composite offscreen fog canvas to main target
    targetCtx.drawImage(this.offscreen, 0, 0);
  }

  private drawShape(ctx: CanvasRenderingContext2D, shape: FogShape) {
    if (!shape.points || shape.points.length === 0) return;

    if (shape.type === 'brush') {
      const radius = shape.radius || 30;
      ctx.beginPath();
      for (const pt of shape.points) {
        ctx.moveTo(pt.x + radius, pt.y);
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      }
      ctx.fill();
    } else if (shape.type === 'polygon' || shape.type === 'rect') {
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
}
