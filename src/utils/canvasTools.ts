/**
 * Canvas drawing operations: Brush, Eraser, Line, Rectangle, Circle, Flood Fill
 */

export interface Point {
  x: number;
  y: number;
}

export type ToolType = 'brush' | 'eraser' | 'hand' | 'line' | 'rect' | 'circle' | 'bucket' | 'picker';

export interface RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function hexToRgba(hex: string): [number, number, number, number] {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
}

/**
 * Flood fill (paint bucket) algorithm on canvas context
 */
export function floodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColorHex: string,
  width: number,
  height: number
) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const [fr, fg, fb, fa] = hexToRgba(fillColorHex);

  const startIdx = (startY * width + startX) * 4;
  const targetR = data[startIdx];
  const targetG = data[startIdx + 1];
  const targetB = data[startIdx + 2];
  const targetA = data[startIdx + 3];

  // Already same color?
  if (targetR === fr && targetG === fg && targetB === fb && targetA === fa) {
    return;
  }

  function matches(idx: number): boolean {
    const dr = Math.abs(data[idx] - targetR);
    const dg = Math.abs(data[idx + 1] - targetG);
    const db = Math.abs(data[idx + 2] - targetB);
    const da = Math.abs(data[idx + 3] - targetA);
    return dr + dg + db + da < 32; // slight tolerance for anti-aliasing
  }

  const queue: [number, number][] = [[startX, startY]];
  const visited = new Uint8Array(width * height);
  visited[startY * width + startX] = 1;

  while (queue.length > 0) {
    const [x, y] = queue.pop()!;
    const idx = (y * width + x) * 4;

    data[idx] = fr;
    data[idx + 1] = fg;
    data[idx + 2] = fb;
    data[idx + 3] = fa;

    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1]
    ];

    for (let i = 0; i < neighbors.length; i++) {
      const [nx, ny] = neighbors[i];
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIndex = ny * width + nx;
        if (!visited[nIndex]) {
          visited[nIndex] = 1;
          const pixelIdx = nIndex * 4;
          if (matches(pixelIdx)) {
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Extracts drawn strokes from source canvas and renders them as tinted ghost strokes
 * on targetCtx, ignoring white/light background pixels.
 */
export function drawGhostStrokes(
  targetCtx: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement,
  red: number,
  green: number,
  blue: number,
  opacity: number,
  width: number,
  height: number
) {
  const sCtx = sourceCanvas.getContext('2d');
  if (!sCtx) return;
  const sData = sCtx.getImageData(0, 0, width, height);
  const s = sData.data;

  const tData = targetCtx.getImageData(0, 0, width, height);
  const t = tData.data;

  const len = s.length;
  for (let i = 0; i < len; i += 4) {
    const r = s[i];
    const g = s[i + 1];
    const b = s[i + 2];
    const a = s[i + 3];

    // Check if pixel is drawn content (not transparent and not white paper)
    if (a > 10 && (r < 242 || g < 242 || b < 242)) {
      const darkness = 255 - ((r + g + b) / 3);
      const alpha = Math.min(255, Math.round((darkness / 255) * opacity * 255 * 1.6));
      if (alpha > t[i + 3]) {
        t[i] = red;
        t[i + 1] = green;
        t[i + 2] = blue;
        t[i + 3] = alpha;
      }
    }
  }

  targetCtx.putImageData(tData, 0, 0);
}

/**
 * Finds the bounding box of a connected drawn object starting near (clickX, clickY).
 * Returns null if no drawn stroke is found in vicinity.
 */
export function findConnectedObjectBounds(
  ctx: CanvasRenderingContext2D,
  clickX: number,
  clickY: number,
  width: number,
  height: number,
  searchRadius: number = 12
): RectBounds | null {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const isDrawn = (px: number, py: number): boolean => {
    if (px < 0 || px >= width || py < 0 || py >= height) return false;
    const idx = (py * width + px) * 4;
    const a = data[idx + 3];
    if (a < 10) return false;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return r < 242 || g < 242 || b < 242;
  };

  // Find nearest drawn pixel within searchRadius
  let startX = -1;
  let startY = -1;
  let minD = Infinity;

  for (let dy = -searchRadius; dy <= searchRadius; dy++) {
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      const px = clickX + dx;
      const py = clickY + dy;
      if (isDrawn(px, py)) {
        const d = dx * dx + dy * dy;
        if (d < minD) {
          minD = d;
          startX = px;
          startY = py;
        }
      }
    }
  }

  if (startX === -1) return null;

  // Flood fill BFS to find connected component bounding box
  let minX = startX;
  let maxX = startX;
  let minY = startY;
  let maxY = startY;

  const visited = new Uint8Array(width * height);
  const queue: [number, number][] = [[startX, startY]];
  visited[startY * width + startX] = 1;

  let count = 0;
  const maxPixels = 200000;

  while (queue.length > 0 && count < maxPixels) {
    const [cx, cy] = queue.pop()!;
    count++;

    if (cx < minX) minX = cx;
    if (cx > maxX) maxX = cx;
    if (cy < minY) minY = cy;
    if (cy > maxY) maxY = cy;

    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
      [cx + 1, cy + 1],
      [cx - 1, cy - 1],
      [cx + 1, cy - 1],
      [cx - 1, cy + 1],
    ];

    for (let i = 0; i < neighbors.length; i++) {
      const [nx, ny] = neighbors[i];
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIdx = ny * width + nx;
        if (!visited[nIdx]) {
          visited[nIdx] = 1;
          if (isDrawn(nx, ny)) {
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  const pad = 3;
  const rx = Math.max(0, minX - pad);
  const ry = Math.max(0, minY - pad);
  const rw = Math.min(width - rx, maxX - minX + 1 + pad * 2);
  const rh = Math.min(height - ry, maxY - minY + 1 + pad * 2);

  return { x: rx, y: ry, width: rw, height: rh };
}

/**
 * Finds bounding box of all drawn artwork on canvas
 */
export function findAllArtworkBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): RectBounds | null {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const a = data[idx + 3];
      if (a > 10) {
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        if (r < 242 || g < 242 || b < 242) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }

  if (maxX === -1) return null;
  const pad = 4;
  const rx = Math.max(0, minX - pad);
  const ry = Math.max(0, minY - pad);
  const rw = Math.min(width - rx, maxX - minX + 1 + pad * 2);
  const rh = Math.min(height - ry, maxY - minY + 1 + pad * 2);

  return { x: rx, y: ry, width: rw, height: rh };
}

