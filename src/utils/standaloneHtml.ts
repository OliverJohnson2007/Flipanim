/**
 * Generates a complete, single self-contained HTML file (HTML + CSS + vanilla JS)
 * with zero external dependencies, for offline use and sharing.
 */

export function generateStandaloneHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Flipbook Studio '95 (Standalone)</title>
  <style>
    * { box-sizing: border-box; user-select: none; margin: 0; padding: 0; }
    body {
      background: #008080;
      font-family: 'MS Sans Serif', Tahoma, 'Segoe UI', Geneva, sans-serif;
      font-size: 11px;
      overflow: hidden;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .win-window {
      background: #c0c0c0;
      border: 2px solid;
      border-color: #fff #000 #000 #fff;
      box-shadow: 1px 1px 0 #000;
      display: flex;
      flex-direction: column;
      flex: 1;
      margin: 8px 8px 36px 8px;
      overflow: hidden;
    }
    .win-titlebar {
      background: linear-gradient(90deg, #000080, #1084d0);
      color: #fff;
      font-weight: bold;
      padding: 3px 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .win-btn {
      background: #c0c0c0;
      border: 2px solid;
      border-color: #fff #000 #000 #fff;
      box-shadow: inset 1px 1px 0 #dfdfdf, inset -1px -1px 0 #808080;
      padding: 2px 6px;
      cursor: pointer;
      font-family: inherit;
      font-size: 11px;
    }
    .win-btn:active, .win-btn.active {
      border-color: #000 #fff #fff #000;
      box-shadow: inset 1px 1px 0 #808080;
      padding: 3px 5px 1px 7px;
    }
    .win-inset {
      border: 2px solid;
      border-color: #808080 #fff #fff #808080;
      box-shadow: inset 1px 1px 0 #000;
      background: #808080;
    }
    .win-menubar {
      display: flex;
      gap: 12px;
      padding: 3px 8px;
      background: #c0c0c0;
      border-bottom: 1px solid #808080;
    }
    .win-taskbar {
      height: 28px;
      background: #c0c0c0;
      border-top: 2px solid #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 2px 6px;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 100;
    }
    .palette-swatch {
      width: 14px;
      height: 14px;
      border: 1px solid #000;
      cursor: pointer;
    }
    .thumb-card {
      width: 64px;
      height: 52px;
      background: #333;
      border: 2px solid #555;
      padding: 2px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      shrink-0;
    }
    .thumb-card.active {
      border-color: #ffff00;
      background: #000080;
    }
    .thumb-card canvas {
      width: 56px;
      height: 38px;
      background: #fff;
    }
  </style>
</head>
<body>
  <div class="win-window">
    <div class="win-titlebar">
      <span>🎬 Flipbook Studio '95 (Standalone Edition)</span>
      <div style="display:flex; gap:2px;">
        <button class="win-btn" style="width:16px; height:14px; padding:0; line-height:10px;">_</button>
        <button class="win-btn" style="width:16px; height:14px; padding:0; line-height:10px;">□</button>
        <button class="win-btn" style="width:16px; height:14px; padding:0; line-height:10px;">✕</button>
      </div>
    </div>

    <!-- Playback bar -->
    <div style="display:flex; align-items:center; gap:8px; padding:4px 8px; background:#c0c0c0; border-bottom:1px solid #808080;">
      <button class="win-btn" id="btnPrev">◀ Prev</button>
      <button class="win-btn" id="btnPlay" style="font-weight:bold; min-width:60px;">▶ Play</button>
      <button class="win-btn" id="btnNext">Next ▶</button>
      <label style="display:flex; align-items:center; gap:4px; margin-left:8px;">
        <input type="checkbox" id="chkLoop" checked> Loop
      </label>
      <label style="display:flex; align-items:center; gap:4px; margin-left:8px;">
        <input type="checkbox" id="chkOnion" checked> 👻 Onion Skin
      </label>
      <div style="margin-left:auto; display:flex; align-items:center; gap:6px;">
        <span>FPS:</span>
        <input type="range" id="fpsSlider" min="1" max="24" value="10" style="width:80px;">
        <span id="fpsVal" style="font-family:monospace; font-weight:bold; width:35px;">10</span>
        <span id="frameCounter" style="font-family:monospace; font-weight:bold; background:#fff; padding:2px 6px; border:1px solid #808080;">Frame 1/1</span>
      </div>
    </div>

    <!-- Workspace -->
    <div style="flex:1; display:flex; padding:6px; gap:6px; overflow:hidden;">
      <!-- Toolbox -->
      <div style="width:70px; display:flex; flex-direction:column; gap:4px;">
        <button class="win-btn active" id="toolBrush">✏ Brush</button>
        <button class="win-btn" id="toolEraser">🧹 Eraser</button>
        <button class="win-btn" id="toolClear">🗑 Clear</button>
        <div style="margin-top:6px; border-top:1px solid #808080; padding-top:4px;">
          <span>Size:</span>
          <select id="sizeSelect" style="width:100%; margin-top:2px; font-family:inherit;">
            <option value="2">2px Thin</option>
            <option value="4" selected>4px Medium</option>
            <option value="8">8px Thick</option>
            <option value="16">16px Heavy</option>
          </select>
        </div>
      </div>

      <!-- Canvas Area -->
      <div class="win-inset" style="flex:1; display:flex; align-items:center; justify-content:center; position:relative; overflow:auto;">
        <div style="position:relative; width:640px; height:480px; box-shadow:0 4px 12px rgba(0,0,0,0.4);">
          <!-- Onion skin canvas -->
          <canvas id="onionCanvas" width="640" height="480" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;"></canvas>
          <!-- Drawing canvas -->
          <canvas id="drawCanvas" width="640" height="480" style="position:absolute; top:0; left:0; width:100%; height:100%; cursor:crosshair; background:#fff;"></canvas>
        </div>
      </div>
    </div>

    <!-- Palette & Frame Controls -->
    <div style="display:flex; align-items:center; justify-content:space-between; padding:4px 8px; background:#c0c0c0; border-top:1px solid #808080;">
      <div style="display:flex; align-items:center; gap:4px;" id="paletteContainer"></div>
      <div style="display:flex; gap:4px;">
        <button class="win-btn" id="btnAddFrame" style="font-weight:bold;">+ Add Frame</button>
        <button class="win-btn" id="btnDupFrame">📋 Duplicate</button>
        <button class="win-btn" id="btnDelFrame" style="color:#a00;">🗑 Delete</button>
      </div>
    </div>

    <!-- Timeline Filmstrip -->
    <div style="height:76px; background:#222; border-top:2px solid #808080; padding:6px; display:flex; align-items:center; gap:8px; overflow-x:auto;" id="filmstrip">
    </div>
  </div>

  <!-- Taskbar -->
  <div class="win-taskbar">
    <button class="win-btn" style="font-weight:bold; display:flex; align-items:center; gap:4px;">
      <span style="color:#f00;">❖</span> Start
    </button>
    <div style="border:2px solid; border-color:#808080 #fff #fff #808080; padding:2px 8px; font-family:monospace;" id="clock">
      12:00 PM
    </div>
  </div>

  <script>
    // State
    const colors = ['#000000','#808080','#800000','#808000','#008000','#008080','#000080','#800080','#ffffff','#c0c0c0','#ff0000','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff'];
    let currentColor = '#000000';
    let currentTool = 'brush';
    let brushSize = 4;
    let frames = [];
    let activeIndex = 0;
    let isPlaying = false;
    let playInterval = null;

    const drawCanvas = document.getElementById('drawCanvas');
    const drawCtx = drawCanvas.getContext('2d');
    const onionCanvas = document.getElementById('onionCanvas');
    const onionCtx = onionCanvas.getContext('2d');
    const filmstrip = document.getElementById('filmstrip');
    const frameCounter = document.getElementById('frameCounter');

    // Create a frame canvas
    function createFrame() {
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 480;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 640, 480);
      return c;
    }

    // Initialize frames with a bouncing ball demo
    for (let i = 0; i < 6; i++) {
      const c = createFrame();
      const ctx = c.getContext('2d');
      // Ground
      ctx.strokeStyle = '#808080';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(30, 420);
      ctx.lineTo(610, 420);
      ctx.stroke();
      // Ball
      const y = [140, 220, 320, 410, 300, 200][i];
      const rx = i === 3 ? 45 : 30;
      const ry = i === 3 ? 18 : 30;
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.ellipse(320, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
      frames.push(c);
    }

    function renderActiveFrame() {
      drawCtx.clearRect(0, 0, 640, 480);
      drawCtx.drawImage(frames[activeIndex], 0, 0);
      renderOnion();
      updateFilmstrip();
      frameCounter.textContent = 'Frame ' + (activeIndex + 1) + '/' + frames.length;
    }

    function renderOnion() {
      onionCtx.clearRect(0, 0, 640, 480);
      if (!document.getElementById('chkOnion').checked || isPlaying || frames.length <= 1) return;
      const prevIdx = activeIndex > 0 ? activeIndex - 1 : (document.getElementById('chkLoop').checked ? frames.length - 1 : -1);
      if (prevIdx >= 0) {
        onionCtx.save();
        onionCtx.globalAlpha = 0.35;
        onionCtx.drawImage(frames[prevIdx], 0, 0);
        onionCtx.restore();
      }
    }

    function updateFilmstrip() {
      filmstrip.innerHTML = '';
      frames.forEach((f, idx) => {
        const div = document.createElement('div');
        div.className = 'thumb-card' + (idx === activeIndex ? ' active' : '');
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 56;
        thumbCanvas.height = 38;
        const tctx = thumbCanvas.getContext('2d');
        tctx.drawImage(f, 0, 0, 56, 38);
        div.appendChild(thumbCanvas);
        const label = document.createElement('span');
        label.style.color = '#fff';
        label.style.fontSize = '9px';
        label.textContent = '#' + (idx + 1);
        div.appendChild(label);
        div.onclick = () => {
          if (isPlaying) togglePlay();
          activeIndex = idx;
          renderActiveFrame();
        };
        filmstrip.appendChild(div);
      });
    }

    function saveCurrentToFrame() {
      const fctx = frames[activeIndex].getContext('2d');
      fctx.clearRect(0, 0, 640, 480);
      fctx.drawImage(drawCanvas, 0, 0);
      updateFilmstrip();
    }

    // Pointer drawing
    let isDrawing = false;
    drawCanvas.addEventListener('pointerdown', (e) => {
      if (isPlaying) togglePlay();
      isDrawing = true;
      const rect = drawCanvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (640 / rect.width);
      const y = (e.clientY - rect.top) * (640 / rect.height);
      drawCtx.beginPath();
      drawCtx.moveTo(x, y);
    });

    window.addEventListener('pointerup', () => {
      if (isDrawing) {
        isDrawing = false;
        saveCurrentToFrame();
      }
    });

    drawCanvas.addEventListener('pointermove', (e) => {
      if (!isDrawing) return;
      const rect = drawCanvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (640 / rect.width);
      const y = (e.clientY - rect.top) * (640 / rect.height);
      drawCtx.lineWidth = currentTool === 'eraser' ? brushSize * 3 : brushSize;
      drawCtx.lineCap = 'round';
      drawCtx.lineJoin = 'round';
      drawCtx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : currentColor;
      drawCtx.lineTo(x, y);
      drawCtx.stroke();
    });

    // Playback
    function togglePlay() {
      isPlaying = !isPlaying;
      document.getElementById('btnPlay').textContent = isPlaying ? '❚❚ Pause' : '▶ Play';
      if (isPlaying) {
        const fps = parseInt(document.getElementById('fpsSlider').value, 10);
        playInterval = setInterval(() => {
          activeIndex++;
          if (activeIndex >= frames.length) {
            if (document.getElementById('chkLoop').checked) activeIndex = 0;
            else { togglePlay(); return; }
          }
          renderActiveFrame();
        }, 1000 / fps);
      } else {
        clearInterval(playInterval);
      }
    }

    document.getElementById('btnPlay').onclick = togglePlay;
    document.getElementById('btnPrev').onclick = () => {
      if (isPlaying) togglePlay();
      activeIndex = Math.max(0, activeIndex - 1);
      renderActiveFrame();
    };
    document.getElementById('btnNext').onclick = () => {
      if (isPlaying) togglePlay();
      activeIndex = Math.min(frames.length - 1, activeIndex + 1);
      renderActiveFrame();
    };

    // Frame operations
    document.getElementById('btnAddFrame').onclick = () => {
      frames.splice(activeIndex + 1, 0, createFrame());
      activeIndex++;
      renderActiveFrame();
    };
    document.getElementById('btnDupFrame').onclick = () => {
      const dup = createFrame();
      dup.getContext('2d').drawImage(frames[activeIndex], 0, 0);
      frames.splice(activeIndex + 1, 0, dup);
      activeIndex++;
      renderActiveFrame();
    };
    document.getElementById('btnDelFrame').onclick = () => {
      if (frames.length <= 1) return;
      frames.splice(activeIndex, 1);
      activeIndex = Math.max(0, activeIndex - 1);
      renderActiveFrame();
    };
    document.getElementById('toolClear').onclick = () => {
      drawCtx.fillStyle = '#ffffff';
      drawCtx.fillRect(0, 0, 640, 480);
      saveCurrentToFrame();
    };

    // Palette
    const palBox = document.getElementById('paletteContainer');
    colors.forEach(c => {
      const btn = document.createElement('div');
      btn.className = 'palette-swatch';
      btn.style.background = c;
      btn.onclick = () => {
        currentColor = c;
        currentTool = 'brush';
        document.getElementById('toolBrush').classList.add('active');
        document.getElementById('toolEraser').classList.remove('active');
      };
      palBox.appendChild(btn);
    });

    document.getElementById('toolBrush').onclick = () => {
      currentTool = 'brush';
      document.getElementById('toolBrush').classList.add('active');
      document.getElementById('toolEraser').classList.remove('active');
    };
    document.getElementById('toolEraser').onclick = () => {
      currentTool = 'eraser';
      document.getElementById('toolEraser').classList.add('active');
      document.getElementById('toolBrush').classList.remove('active');
    };
    document.getElementById('sizeSelect').onchange = (e) => {
      brushSize = parseInt(e.target.value, 10);
    };
    document.getElementById('fpsSlider').oninput = (e) => {
      document.getElementById('fpsVal').textContent = e.target.value;
      if (isPlaying) { togglePlay(); togglePlay(); }
    };
    document.getElementById('chkOnion').onchange = renderOnion;

    // Clock
    setInterval(() => {
      const d = new Date();
      document.getElementById('clock').textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }, 1000);

    renderActiveFrame();
  </script>
</body>
</html>`;
}
