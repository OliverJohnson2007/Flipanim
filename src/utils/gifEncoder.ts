/**
 * Pure JavaScript GIF89a Encoder with LZW compression and color quantization.
 * Zero external dependencies.
 */

// LZW compression helper
class LZWEncoder {
  private width: number;
  private height: number;
  private pixels: Uint8Array;
  private colorDepth: number;
  private initCodeSize: number;
  private accum = new Uint8Array(256);
  private a_count = 0;
  private free_ent = 0;
  private maxcode = 0;
  private clear_flg = false;
  private g_init_bits = 0;
  private cur_accum = 0;
  private cur_bits = 0;
  private htab = new Int32Array(5003);
  private codetab = new Int32Array(5003);
  private output: number[] = [];

  constructor(width: number, height: number, pixels: Uint8Array, colorDepth: number) {
    this.width = width;
    this.height = height;
    this.pixels = pixels;
    this.colorDepth = Math.max(2, colorDepth);
    this.initCodeSize = Math.max(2, colorDepth);
  }

  private char_out(c: number) {
    this.accum[this.a_count++] = c;
    if (this.a_count >= 254) this.flush_char();
  }

  private flush_char() {
    if (this.a_count > 0) {
      this.output.push(this.a_count);
      for (let i = 0; i < this.a_count; ++i) {
        this.output.push(this.accum[i]);
      }
      this.a_count = 0;
    }
  }

  private outputCode(code: number) {
    this.cur_accum |= code << this.cur_bits;
    this.cur_bits += this.g_init_bits;

    while (this.cur_bits >= 8) {
      this.char_out(this.cur_accum & 0xff);
      this.cur_accum >>= 8;
      this.cur_bits -= 8;
    }

    if (this.free_ent > this.maxcode || this.clear_flg) {
      if (this.clear_flg) {
        this.maxcode = (1 << this.g_init_bits) - 1;
        this.clear_flg = false;
      } else {
        this.g_init_bits++;
        if (this.g_init_bits === 12) {
          this.maxcode = 1 << 12;
        } else {
          this.maxcode = (1 << this.g_init_bits) - 1;
        }
      }
    }
  }

  public encode(): number[] {
    this.output.push(this.initCodeSize);

    this.g_init_bits = this.initCodeSize + 1;
    this.clear_flg = false;
    this.maxcode = (1 << this.g_init_bits) - 1;

    const ClearCode = 1 << this.initCodeSize;
    const EOFCode = ClearCode + 1;
    this.free_ent = ClearCode + 2;

    this.a_count = 0;
    this.cur_accum = 0;
    this.cur_bits = 0;

    const hsize = 5003;
    for (let i = 0; i < hsize; ++i) this.htab[i] = -1;

    this.outputCode(ClearCode);

    let ent = this.pixels[0];
    const n = this.pixels.length;

    for (let i = 1; i < n; ++i) {
      const c = this.pixels[i];
      const fcode = (c << 12) + ent;
      let idx = (c << 4) ^ ent;

      if (this.htab[idx] === fcode) {
        ent = this.codetab[idx];
        continue;
      } else if (this.htab[idx] >= 0) {
        let disp = hsize - idx;
        if (idx === 0) disp = 1;
        let hit = false;
        do {
          idx -= disp;
          if (idx < 0) idx += hsize;
          if (this.htab[idx] === fcode) {
            ent = this.codetab[idx];
            hit = true;
            break;
          }
        } while (this.htab[idx] >= 0);
        if (hit) continue;
      }

      this.outputCode(ent);
      ent = c;
      if (this.free_ent < 1 << 12) {
        this.codetab[idx] = this.free_ent++;
        this.htab[idx] = fcode;
      } else {
        for (let j = 0; j < hsize; ++j) this.htab[j] = -1;
        this.free_ent = ClearCode + 2;
        this.clear_flg = true;
        this.outputCode(ClearCode);
      }
    }

    this.outputCode(ent);
    this.outputCode(EOFCode);

    if (this.cur_bits > 0) {
      this.char_out(this.cur_accum & 0xff);
    }
    this.flush_char();
    this.output.push(0); // block terminator

    return this.output;
  }
}

/**
 * Fast color quantization: extracts up to 256 distinct or quantized colors from RGBA frame
 */
export function buildPalette(rgba: Uint8ClampedArray): { palette: number[]; indexedPixels: Uint8Array } {
  const pixelCount = rgba.length / 4;
  const colorMap = new Map<number, number>();
  const palette: number[] = []; // [r, g, b, r, g, b...]
  const indexedPixels = new Uint8Array(pixelCount);

  // First pass: collect unique 15-bit colors (to keep it fast and fit within 256)
  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    // Quantize 8-bit to 5-bit for palette clustering
    const r = rgba[idx] & 0xf8;
    const g = rgba[idx + 1] & 0xf8;
    const b = rgba[idx + 2] & 0xf8;
    const key = (r << 10) | (g << 5) | b;

    if (!colorMap.has(key)) {
      if (palette.length / 3 < 256) {
        const palIdx = palette.length / 3;
        colorMap.set(key, palIdx);
        palette.push(rgba[idx], rgba[idx + 1], rgba[idx + 2]);
      }
    }
  }

  // Ensure palette has at least 4 colors and power of 2
  while (palette.length / 3 < 4) {
    palette.push(0, 0, 0);
  }

  // Second pass: map each pixel to closest palette index
  const palCount = palette.length / 3;
  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const r = rgba[idx];
    const g = rgba[idx + 1];
    const b = rgba[idx + 2];

    const key = ((r & 0xf8) << 10) | ((g & 0xf8) << 5) | (b & 0xf8);
    const cached = colorMap.get(key);
    if (cached !== undefined) {
      indexedPixels[i] = cached;
    } else {
      // Find nearest euclidean color
      let bestDist = Infinity;
      let bestIdx = 0;
      for (let p = 0; p < palCount; p++) {
        const pr = palette[p * 3];
        const pg = palette[p * 3 + 1];
        const pb = palette[p * 3 + 2];
        const dist = (r - pr) * (r - pr) + (g - pg) * (g - pg) + (b - pb) * (b - pb);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = p;
        }
      }
      indexedPixels[i] = bestIdx;
    }
  }

  // Pad palette to 256 colors
  while (palette.length < 256 * 3) {
    palette.push(0);
  }

  return { palette, indexedPixels };
}

/**
 * Creates an animated GIF Blob from a sequence of Canvas frames
 */
export async function createGifBlob(
  canvases: HTMLCanvasElement[],
  fps: number,
  onProgress?: (frameIndex: number, totalFrames: number) => void
): Promise<Blob> {
  const width = canvases[0].width;
  const height = canvases[0].height;
  const bytes: number[] = [];

  // Delay in hundredths of a second
  const delay100th = Math.max(2, Math.round(100 / fps));

  // 1. Header 'GIF89a'
  bytes.push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);

  // 2. Logical Screen Descriptor
  bytes.push(width & 0xff, (width >> 8) & 0xff);
  bytes.push(height & 0xff, (height >> 8) & 0xff);
  // Packed: No Global Color Table here, we use Local Color Table per frame for fidelity
  // Resolution: 7 (8 bits), Size: 0
  bytes.push(0x70, 0x00, 0x00);

  // 3. Netscape 2.0 Loop Extension
  bytes.push(0x21, 0xff, 0x0b);
  const appExt = 'NETSCAPE2.0';
  for (let i = 0; i < appExt.length; i++) bytes.push(appExt.charCodeAt(i));
  bytes.push(0x03, 0x01, 0x00, 0x00, 0x00); // 0 = loop forever

  // 4. Frames
  for (let f = 0; f < canvases.length; f++) {
    if (onProgress) onProgress(f + 1, canvases.length);
    // Yield to main thread briefly for UI reactivity
    await new Promise((r) => setTimeout(r, 8));

    const ctx = canvases[f].getContext('2d');
    if (!ctx) continue;
    const imgData = ctx.getImageData(0, 0, width, height);
    const { palette, indexedPixels } = buildPalette(imgData.data);

    // Graphic Control Extension
    bytes.push(0x21, 0xf9, 0x04);
    bytes.push(0x04); // Disposal: restore to background, no transparent index
    bytes.push(delay100th & 0xff, (delay100th >> 8) & 0xff); // delay
    bytes.push(0x00); // transparent index
    bytes.push(0x00); // block terminator

    // Image Descriptor
    bytes.push(0x2c);
    bytes.push(0x00, 0x00, 0x00, 0x00); // Left, Top (0, 0)
    bytes.push(width & 0xff, (width >> 8) & 0xff);
    bytes.push(height & 0xff, (height >> 8) & 0xff);
    // Local Color Table Flag (1) | Size (7 => 256 colors)
    bytes.push(0x87);

    // Local Color Table (256 * 3 bytes)
    for (let p = 0; p < 256 * 3; p++) {
      bytes.push(palette[p] || 0);
    }

    // LZW compressed pixel data
    const lzw = new LZWEncoder(width, height, indexedPixels, 8);
    const lzwBytes = lzw.encode();
    for (let b = 0; b < lzwBytes.length; b++) {
      bytes.push(lzwBytes[b]);
    }
  }

  // 5. Trailer
  bytes.push(0x3b);

  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
}

/**
 * Creates a WebM Video Blob using Canvas captureStream & MediaRecorder
 */
export async function createWebmBlob(
  canvases: HTMLCanvasElement[],
  fps: number,
  onProgress?: (frameIndex: number, totalFrames: number) => void
): Promise<Blob> {
  const width = canvases[0].width;
  const height = canvases[0].height;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;

  const stream = tempCanvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm'
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.start();

  const frameIntervalMs = 1000 / fps;
  // Play through the sequence twice to give video a nice loop feel
  const totalFrames = canvases.length * 2;

  for (let i = 0; i < totalFrames; i++) {
    const frameIndex = i % canvases.length;
    if (onProgress) onProgress(i + 1, totalFrames);

    tempCtx.clearRect(0, 0, width, height);
    tempCtx.drawImage(canvases[frameIndex], 0, 0);

    await new Promise((r) => setTimeout(r, frameIntervalMs));
  }

  return new Promise((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };
    recorder.stop();
  });
}
