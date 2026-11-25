/**
 * Pre-made demo animations for Windows 95 Flipbook Studio
 */

export interface PresetFrame {
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
}

export function drawBouncingBall(frameIdx: number, ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Clear with white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // Ground line
  ctx.strokeStyle = '#808080';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(40, h - 80);
  ctx.lineTo(w - 40, h - 80);
  ctx.stroke();

  // Ball positions across 8 frames (squash & stretch cycle)
  const groundY = h - 80;
  const cx = w / 2;

  const frames = [
    { y: 120, rx: 32, ry: 32, color: '#e74c3c' },        // top apex
    { y: 180, rx: 28, ry: 36, color: '#e67e22' },        // falling stretch
    { y: 260, rx: 26, ry: 40, color: '#f1c40f' },        // high speed stretch
    { y: 340, rx: 24, ry: 44, color: '#2ecc71' },        // hitting ground stretch
    { y: groundY - 14, rx: 50, ry: 16, color: '#1abc9c' }, // IMPACT SQUASH
    { y: 320, rx: 24, ry: 42, color: '#3498db' },        // rebound stretch
    { y: 230, rx: 28, ry: 36, color: '#9b59b6' },        // rising
    { y: 140, rx: 31, ry: 33, color: '#e74c3c' },        // slowing near top
  ];

  const cur = frames[frameIdx % frames.length];

  // Draw shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  const shadowScale = Math.max(0.2, (groundY - cur.y) / groundY);
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 8, cur.rx * (1.3 - shadowScale * 0.5), 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draw ball
  ctx.fillStyle = cur.color;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, cur.y, cur.rx, cur.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Ball specular highlight
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx - cur.rx * 0.35, cur.y - cur.ry * 0.35, cur.rx * 0.25, cur.ry * 0.25, -Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();

  // Cute face on the ball
  ctx.fillStyle = '#000000';
  if (frameIdx === 4) {
    // Squished happy squint eyes
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx - 14, cur.y - 2, 6, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 14, cur.y - 2, 6, Math.PI, 0);
    ctx.stroke();
    // Open mouth
    ctx.beginPath();
    ctx.arc(cx, cur.y + 4, 8, 0, Math.PI);
    ctx.stroke();
  } else {
    // Normal cute dot eyes
    ctx.beginPath();
    ctx.arc(cx - 10, cur.y - 4, 4, 0, Math.PI * 2);
    ctx.arc(cx + 10, cur.y - 4, 4, 0, Math.PI * 2);
    ctx.fill();
    // Smile
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cur.y + 6, 8, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
}

export function drawStickman(frameIdx: number, ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // Ground line
  ctx.strokeStyle = '#808080';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(30, h - 90);
  ctx.lineTo(w - 30, h - 90);
  ctx.stroke();

  const groundY = h - 90;
  const cx = 100 + (frameIdx % 8) * 55; // Walking across screen!
  const bounce = (frameIdx % 2 === 0) ? 0 : 8;
  const hipY = groundY - 90 - bounce;
  const headY = hipY - 70;

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Head
  ctx.beginPath();
  ctx.arc(cx, headY, 22, 0, Math.PI * 2);
  ctx.stroke();

  // Eye & smile
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx + 8, headY - 4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 6, headY + 5, 8, 0.2, Math.PI - 0.4);
  ctx.stroke();

  // Body
  ctx.beginPath();
  ctx.moveTo(cx, headY + 22);
  ctx.lineTo(cx, hipY);
  ctx.stroke();

  // Walking legs phase
  const legAngle = ((frameIdx % 8) / 8) * Math.PI * 2;
  const l1Offset = Math.sin(legAngle) * 35;
  const l2Offset = -Math.sin(legAngle) * 35;

  // Left Leg
  ctx.beginPath();
  ctx.moveTo(cx, hipY);
  ctx.lineTo(cx + l1Offset * 0.7, hipY + 45);
  ctx.lineTo(cx + l1Offset, groundY);
  ctx.stroke();

  // Right Leg
  ctx.beginPath();
  ctx.moveTo(cx, hipY);
  ctx.lineTo(cx + l2Offset * 0.7, hipY + 45);
  ctx.lineTo(cx + l2Offset, groundY);
  ctx.stroke();

  // Arms (opposite to legs)
  ctx.beginPath();
  ctx.moveTo(cx, headY + 35);
  ctx.lineTo(cx - l1Offset * 0.7, headY + 65);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, headY + 35);
  ctx.lineTo(cx - l2Offset * 0.7, headY + 65);
  ctx.stroke();
}
