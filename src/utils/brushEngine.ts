/**
 * Brush Engine for Windows 95 Flipbook Studio
 * Supports classic tools and animated creative brushes.
 */

export type BrushStyle =
  | 'round'       // Classic Round Pencil / Pen
  | 'chisel'      // Calligraphy Chisel
  | 'spray'       // 90s Spray Can / Airbrush
  | 'dither'      // 90s Pixel Dither Shading
  | 'marker'      // Semi-transparent Chisel Highlighter
  | 'neon'        // Neon Glowing Laser Line
  | 'rainbow'     // Animated: Rainbow Spectrum Stream
  | 'stars'       // Animated: Twinkling Starbursts & Sparkles
  | 'fire'        // Animated: Rising Flame Ember Particles
  | 'hearts';     // Animated: Pulsating Retro Pixel Hearts

export interface Point {
  x: number;
  y: number;
}

export interface BrushState {
  hue: number;
  distance: number;
  stepCount: number;
}

/**
 * Draw a 4-point twinkling starburst
 */
function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, color: string, rotation: number = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  // Outer colorful diamond rays
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -radius * 1.5);
  ctx.quadraticCurveTo(radius * 0.15, -radius * 0.15, radius * 1.5, 0);
  ctx.quadraticCurveTo(radius * 0.15, radius * 0.15, 0, radius * 1.5);
  ctx.quadraticCurveTo(-radius * 0.15, radius * 0.15, -radius * 1.5, 0);
  ctx.quadraticCurveTo(-radius * 0.15, -radius * 0.15, 0, -radius * 1.5);
  ctx.fill();

  // Glowing white diamond core
  ctx.fillStyle = '#ffffff';
  const innerR = radius * 0.45;
  ctx.beginPath();
  ctx.moveTo(0, -innerR);
  ctx.lineTo(innerR, 0);
  ctx.lineTo(0, innerR);
  ctx.lineTo(-innerR, 0);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a retro pixel heart stamp
 */
function drawPixelHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  const s = Math.max(1, Math.round(size * 0.35));
  ctx.fillStyle = color;

  // Pixel heart bitmap grid (7x6)
  const pattern = [
    [0, 1, 1, 0, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0],
  ];

  const ox = cx - (3.5 * s);
  const oy = cy - (3 * s);

  for (let r = 0; r < pattern.length; r++) {
    for (let c = 0; c < pattern[r].length; c++) {
      if (pattern[r][c]) {
        ctx.fillRect(ox + c * s, oy + r * s, s, s);
      }
    }
  }

  // Cute white specular glint in top-left
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(ox + 1 * s, oy + 1 * s, s, s);
}

/**
 * Draw flame ember particle
 */
function drawFlameEmber(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const rx = (Math.random() - 0.5) * size * 1.8;
    const ry = -Math.random() * size * 2.2; // rises upward
    const r = Math.max(1.5, Math.random() * (size * 0.6));

    // Flame gradient colors: yellow center, orange mid, red edge
    const colors = ['#fff700', '#ff9900', '#ff4400', '#ff0033'];
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    ctx.beginPath();
    ctx.arc(cx + rx, cy + ry, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Main stroke drawer applying the selected brush style
 */
export function applyBrushStroke(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  style: BrushStyle,
  size: number,
  color: string,
  state: BrushState
) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);

  switch (style) {
    case 'round': {
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = size;
      ctx.strokeStyle = color;
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      break;
    }

    case 'chisel': {
      // Calligraphy angled flat nib (45°)
      const steps = Math.max(1, Math.round(dist));
      ctx.fillStyle = color;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = from.x + (to.x - from.x) * t;
        const y = from.y + (to.y - from.y) * t;
        ctx.beginPath();
        ctx.ellipse(x, y, size * 1.4, Math.max(1, size * 0.35), Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'spray': {
      // 90s MS Paint Airbrush splatter
      const radius = size * 2.2 + 6;
      const density = Math.round(10 + size * 4);
      ctx.fillStyle = color;
      for (let i = 0; i < density; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * radius;
        const px = Math.round(to.x + Math.cos(angle) * r);
        const py = Math.round(to.y + Math.sin(angle) * r);
        ctx.fillRect(px, py, 1.5, 1.5);
      }
      break;
    }

    case 'dither': {
      // 50% checkerboard dither pixel shading
      const steps = Math.max(1, Math.round(dist));
      ctx.fillStyle = color;
      const half = Math.max(1, Math.round(size / 2));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const cx = Math.round(from.x + (to.x - from.x) * t);
        const cy = Math.round(from.y + (to.y - from.y) * t);
        for (let dx = -half; dx <= half; dx++) {
          for (let dy = -half; dy <= half; dy++) {
            const px = cx + dx;
            const py = cy + dy;
            if ((px + py) % 2 === 0 && dx * dx + dy * dy <= half * half) {
              ctx.fillRect(px, py, 1, 1);
            }
          }
        }
      }
      break;
    }

    case 'marker': {
      // Semi-transparent chisel highlighter
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.lineCap = 'square';
      ctx.lineJoin = 'miter';
      ctx.lineWidth = size * 2.2 + 4;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'neon': {
      // Luminescent glowing neon laser
      ctx.save();
      ctx.shadowBlur = size * 2.5 + 8;
      ctx.shadowColor = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = size + 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();

      // White hot core
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.5, size * 0.45);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'rainbow': {
      // Animated Rainbow stream
      state.hue = (state.hue + 5) % 360;
      ctx.save();
      ctx.strokeStyle = `hsl(${state.hue}, 100%, 50%)`;
      ctx.lineWidth = size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'stars': {
      // Animated Twinkling Starbursts along stroke
      state.distance += dist;
      const interval = Math.max(10, size * 2);
      if (state.distance >= interval) {
        state.distance = 0;
        state.stepCount++;
        const rot = (state.stepCount * 0.45) % (Math.PI * 2);
        drawStar(ctx, to.x, to.y, Math.max(4, size * 1.4), color, rot);
      }
      break;
    }

    case 'fire': {
      // Animated Flame Embers
      ctx.save();
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineWidth = size;
      ctx.strokeStyle = '#ff6600';
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();

      drawFlameEmber(ctx, to.x, to.y, size);
      break;
    }

    case 'hearts': {
      // Animated Cute Pixel Heart Stamp Trail
      state.distance += dist;
      const interval = Math.max(12, size * 2.2);
      if (state.distance >= interval) {
        state.distance = 0;
        state.stepCount++;
        // Pulsate sizes slightly
        const scale = 1 + (state.stepCount % 3) * 0.25;
        drawPixelHeart(ctx, to.x, to.y, size * scale + 3, color);
      }
      break;
    }
  }
}
