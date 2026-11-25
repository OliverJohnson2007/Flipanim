/**
 * Windows 95 Flipbook Studio
 * Faithful 1995 desktop recreation with frame-by-frame animation engine,
 * filmstrip timeline, onion skinning, Web Audio retro sounds, and GIF/WebM export.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { soundFx } from './utils/soundEffects';
import { createGifBlob, createWebmBlob } from './utils/gifEncoder';
import { drawBouncingBall, drawStickman } from './utils/presets';
import {
  floodFill,
  ToolType,
  drawGhostStrokes,
  findConnectedObjectBounds,
  findAllArtworkBounds,
  RectBounds,
} from './utils/canvasTools';
import { generateStandaloneHtml } from './utils/standaloneHtml';
import { BrushStyle, applyBrushStroke, BrushState } from './utils/brushEngine';

interface FrameItem {
  id: string;
  canvas: HTMLCanvasElement;
  thumbnail: string;
  undoStack: ImageData[];
  redoStack: ImageData[];
}

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

// Classic 28-color Windows 95 palette
const WIN95_PALETTE = [
  '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080',
  '#808040', '#004040', '#0080ff', '#004080', '#8000ff', '#804000',
  '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff',
  '#ffff80', '#00ff80', '#80ffff', '#7f7fff', '#ff0080', '#ff8040',
];

// Authentic Windows 95 Pink-and-Blue Beveled Rubber Eraser Icon
function RubberIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      {/* Drop shadow */}
      <path d="M4 16L15 16L17 14L6 14Z" fill="#888888" />
      {/* Pink rubber top facet (highlight) */}
      <polygon points="3,12 8,7 13,7 8,12" fill="#ffaec0" />
      {/* Pink rubber front beveled face */}
      <polygon points="3,12 8,12 6,15 1,15" fill="#ff4d73" stroke="#000000" strokeWidth="0.8" />
      {/* Pink rubber main side */}
      <polygon points="8,12 13,7 16,10 11,15" fill="#ff6b8b" stroke="#000000" strokeWidth="0.8" />
      {/* Blue sleeve / cardboard sleeve */}
      <polygon points="7,13 12,8 15,11 10,16" fill="#2563eb" stroke="#000000" strokeWidth="0.8" />
      {/* White cardboard sleeve stripe */}
      <polygon points="8.5,14.5 13.5,9.5 14.2,10.2 9.2,15.2" fill="#ffffff" />
      {/* Rubber outline border */}
      <path d="M3 12L8 7L13 7L16 10L10 16L6 15L1 15L3 12Z" stroke="#000000" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

export default function App() {
  // Desktop & Window state
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(true);
  const [isWindowActive, setIsWindowActive] = useState(true);
  const [windowPos, setWindowPos] = useState({ x: 16, y: 12 });
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Start Menu & Menus
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Time & Audio
  const [clockStr, setClockStr] = useState('');
  const [isMuted, setIsMuted] = useState(false);

  // Animation & Timeline state
  const [frames, setFrames] = useState<FrameItem[]>([]);
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [fps, setFps] = useState(10);

  // Onion skinning
  const [onionSkinEnabled, setOnionSkinEnabled] = useState(true);
  const [showNextGhost, setShowNextGhost] = useState(false);
  const [onionOpacity, setOnionOpacity] = useState(0.35);

  // Tools, Brush Styles & Colors
  const [tool, setTool] = useState<ToolType>('brush');
  const [brushStyle, setBrushStyle] = useState<BrushStyle>('round');
  const [brushSize, setBrushSize] = useState(4);
  const [primaryColor, setPrimaryColor] = useState('#000000');
  const [secondaryColor, setSecondaryColor] = useState('#ffffff');
  const [fillShape, setFillShape] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showGrid, setShowGrid] = useState(false);

  // Status bar readout
  const [mouseCoords, setMouseCoords] = useState<{ x: number; y: number } | null>(null);

  // Hand Tool (Select & Move) state
  const [selection, setSelection] = useState<{
    isActive: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    floatingCanvas: HTMLCanvasElement | null;
    baseSnapshot: ImageData | null;
  }>({
    isActive: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    floatingCanvas: null,
    baseSnapshot: null,
  });
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  const [marqueeRect, setMarqueeRect] = useState<RectBounds | null>(null);
  const isMovingSelectionRef = useRef(false);
  const moveStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const initialSelectionPosRef = useRef<{ x: number; y: number } | null>(null);

  // Dialogs
  const [newCanvasDialogOpen, setNewCanvasDialogOpen] = useState(false);
  const [newCanvasBg, setNewCanvasBg] = useState<string>('#ffffff');
  const [newCanvasFramesCount, setNewCanvasFramesCount] = useState<number>(1);
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  const [exportState, setExportState] = useState<{
    open: boolean;
    format: 'gif' | 'webm';
    progress: number;
    currentFrame: number;
    totalFrames: number;
    completed: boolean;
  }>({
    open: false,
    format: 'gif',
    progress: 0,
    currentFrame: 0,
    totalFrames: 0,
    completed: false,
  });

  // Canvas Refs
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const onionCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Drawing state refs
  const isDrawingRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);
  const playTimerRef = useRef<number | null>(null);
  const brushStateRef = useRef<BrushState>({ hue: 0, distance: 0, stepCount: 0 });
  const framesRef = useRef<FrameItem[]>([]);
  framesRef.current = frames;

  // Helper to create empty frame canvas
  const createEmptyCanvas = useCallback(() => {
    const c = document.createElement('canvas');
    c.width = CANVAS_WIDTH;
    c.height = CANVAS_HEIGHT;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    return c;
  }, []);

  // Sync main canvas with active frame
  const syncActiveFrameToCanvas = useCallback((frameIdx: number, frameList?: FrameItem[]) => {
    const list = frameList || framesRef.current;
    if (!mainCanvasRef.current || !list[frameIdx]) return;
    const ctx = mainCanvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.drawImage(list[frameIdx].canvas, 0, 0);
  }, []);

  // Update thumbnail of active frame
  const updateActiveThumbnail = useCallback(() => {
    const list = framesRef.current;
    if (!mainCanvasRef.current || !list[activeFrameIndex]) return;
    const thumbData = mainCanvasRef.current.toDataURL('image/png');
    const activeFrame = list[activeFrameIndex];
    const frameCtx = activeFrame.canvas.getContext('2d');
    if (frameCtx) {
      frameCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      frameCtx.drawImage(mainCanvasRef.current, 0, 0);
    }

    setFrames((prev) => {
      const updated = [...prev];
      if (updated[activeFrameIndex]) {
        updated[activeFrameIndex] = {
          ...updated[activeFrameIndex],
          thumbnail: thumbData,
        };
      }
      return updated;
    });
  }, [activeFrameIndex]);

  // Render Onion Skin
  const renderOnionSkin = useCallback(() => {
    if (!onionCanvasRef.current) return;
    const ctx = onionCanvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const list = framesRef.current;
    if (!onionSkinEnabled || isPlaying || list.length <= 1) return;

    // Previous frame ghost (red-tinted ghost strokes: #e74c3c)
    const prevIdx = activeFrameIndex > 0 ? activeFrameIndex - 1 : (isLooping ? list.length - 1 : -1);
    if (prevIdx >= 0 && list[prevIdx]) {
      drawGhostStrokes(ctx, list[prevIdx].canvas, 235, 45, 45, onionOpacity, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Next frame ghost (cyan-blue tinted ghost strokes: #3498db)
    if (showNextGhost) {
      const nextIdx = activeFrameIndex < list.length - 1 ? activeFrameIndex + 1 : (isLooping ? 0 : -1);
      if (nextIdx >= 0 && nextIdx !== prevIdx && list[nextIdx]) {
        drawGhostStrokes(ctx, list[nextIdx].canvas, 45, 130, 235, onionOpacity * 0.85, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    }
  }, [onionSkinEnabled, isPlaying, activeFrameIndex, isLooping, onionOpacity, showNextGhost, frames]);

  // Load demo animation preset
  const loadPreset = useCallback((presetType: 'ball' | 'stickman') => {
    soundFx.playClick();
    const count = 8;
    const newFrames: FrameItem[] = [];

    for (let i = 0; i < count; i++) {
      const c = createEmptyCanvas();
      const ctx = c.getContext('2d');
      if (ctx) {
        if (presetType === 'ball') {
          drawBouncingBall(i, ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
        } else {
          drawStickman(i, ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
      }

      newFrames.push({
        id: `frame_${Date.now()}_${i}`,
        canvas: c,
        thumbnail: c.toDataURL('image/png'),
        undoStack: [],
        redoStack: [],
      });
    }

    framesRef.current = newFrames;
    setFrames(newFrames);
    setActiveFrameIndex(0);
    syncActiveFrameToCanvas(0, newFrames);
    soundFx.playAddFrame();
  }, [createEmptyCanvas, syncActiveFrameToCanvas]);

  // Initial startup: build default bouncing ball demo + setup chime (runs ONCE on mount)
  useEffect(() => {
    loadPreset('ball');

    const handleInitialChime = () => {
      soundFx.playStartupChime();
      window.removeEventListener('pointerdown', handleInitialChime);
    };
    window.addEventListener('pointerdown', handleInitialChime, { once: true });

    return () => {
      window.removeEventListener('pointerdown', handleInitialChime);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time taskbar clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockStr(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Update onion skin when dependencies change
  useEffect(() => {
    renderOnionSkin();
  }, [renderOnionSkin]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying || frames.length === 0) {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
      return;
    }

    const interval = 1000 / fps;
    playTimerRef.current = window.setInterval(() => {
      setActiveFrameIndex((prev) => {
        const next = prev + 1;
        if (next >= frames.length) {
          if (!isLooping) {
            setIsPlaying(false);
            return prev;
          }
          return 0;
        }
        return next;
      });
      soundFx.playTick();
    }, interval);

    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [isPlaying, fps, frames.length, isLooping]);

  // Sync canvas on active frame index change
  useEffect(() => {
    syncActiveFrameToCanvas(activeFrameIndex);
  }, [activeFrameIndex, syncActiveFrameToCanvas]);

  // Push undo snapshot before drawing changes
  const saveUndoSnapshot = useCallback(() => {
    if (!mainCanvasRef.current || !frames[activeFrameIndex]) return;
    const ctx = mainCanvasRef.current.getContext('2d');
    if (!ctx) return;
    const snapshot = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    setFrames((prev) => {
      const updated = [...prev];
      const cur = updated[activeFrameIndex];
      if (cur) {
        const stack = [...cur.undoStack, snapshot];
        if (stack.length > 25) stack.shift();
        updated[activeFrameIndex] = {
          ...cur,
          undoStack: stack,
          redoStack: [],
        };
      }
      return updated;
    });
  }, [activeFrameIndex, frames]);

  // Commit floating hand selection onto canvas
  const commitSelection = useCallback(() => {
    const sel = selectionRef.current;
    if (!sel.isActive) return;
    if (sel.floatingCanvas && mainCanvasRef.current) {
      const ctx = mainCanvasRef.current.getContext('2d');
      if (ctx) {
        if (sel.baseSnapshot) {
          ctx.putImageData(sel.baseSnapshot, 0, 0);
        }
        ctx.drawImage(sel.floatingCanvas, sel.x, sel.y);
      }
    }
    setSelection({
      isActive: false,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      floatingCanvas: null,
      baseSnapshot: null,
    });
    updateActiveThumbnail();
    renderOnionSkin();
  }, [renderOnionSkin, updateActiveThumbnail]);

  // Delete selected object
  const handleDeleteSelection = useCallback(() => {
    const sel = selectionRef.current;
    if (!sel.isActive) return;
    soundFx.playDeleteFrame();
    setSelection({
      isActive: false,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      floatingCanvas: null,
      baseSnapshot: null,
    });
    updateActiveThumbnail();
    renderOnionSkin();
  }, [renderOnionSkin, updateActiveThumbnail]);

  // Nudge selection with arrow keys
  const handleNudgeSelection = useCallback((key: string, step: number) => {
    const sel = selectionRef.current;
    if (!sel.isActive || !sel.floatingCanvas || !mainCanvasRef.current) return;
    const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
    const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
    const nextX = sel.x + dx;
    const nextY = sel.y + dy;

    const ctx = mainCanvasRef.current.getContext('2d');
    if (ctx && sel.baseSnapshot) {
      ctx.putImageData(sel.baseSnapshot, 0, 0);
      ctx.drawImage(sel.floatingCanvas, nextX, nextY);
    }

    setSelection((prev) => ({
      ...prev,
      x: nextX,
      y: nextY,
    }));
    updateActiveThumbnail();
  }, [updateActiveThumbnail]);

  // Select all drawn artwork on the current frame
  const handleSelectAll = useCallback(() => {
    if (!mainCanvasRef.current) return;
    const ctx = mainCanvasRef.current.getContext('2d');
    if (!ctx) return;
    if (selectionRef.current.isActive) {
      commitSelection();
    }
    const bounds = findAllArtworkBounds(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (!bounds) return;

    saveUndoSnapshot();
    const floatCanvas = document.createElement('canvas');
    floatCanvas.width = bounds.width;
    floatCanvas.height = bounds.height;
    const fCtx = floatCanvas.getContext('2d');
    if (!fCtx) return;

    fCtx.drawImage(mainCanvasRef.current, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    const baseSnap = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.drawImage(floatCanvas, bounds.x, bounds.y);

    setTool('hand');
    setSelection({
      isActive: true,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      floatingCanvas: floatCanvas,
      baseSnapshot: baseSnap,
    });
    soundFx.playClick();
  }, [commitSelection, saveUndoSnapshot]);

  // Helper to switch tool with selection auto-commit
  const changeTool = useCallback((newTool: ToolType) => {
    if (tool !== newTool && selectionRef.current.isActive) {
      commitSelection();
    }
    soundFx.playClick();
    setTool(newTool);
  }, [tool, commitSelection]);

  // Undo Handler
  const handleUndo = useCallback(() => {
    soundFx.playClick();
    if (selectionRef.current.isActive) {
      commitSelection();
    }
    if (!mainCanvasRef.current || !frames[activeFrameIndex]) return;
    const cur = frames[activeFrameIndex];
    if (cur.undoStack.length === 0) return;

    const ctx = mainCanvasRef.current.getContext('2d');
    if (!ctx) return;
    const currentState = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const prevUndo = [...cur.undoStack];
    const previousState = prevUndo.pop();
    if (!previousState) return;

    ctx.putImageData(previousState, 0, 0);

    setFrames((prevList) => {
      const list = [...prevList];
      list[activeFrameIndex] = {
        ...cur,
        undoStack: prevUndo,
        redoStack: [...cur.redoStack, currentState],
      };
      return list;
    });

    updateActiveThumbnail();
  }, [activeFrameIndex, frames, updateActiveThumbnail]);

  // Redo Handler
  const handleRedo = useCallback(() => {
    soundFx.playClick();
    if (selectionRef.current.isActive) {
      commitSelection();
    }
    if (!mainCanvasRef.current || !frames[activeFrameIndex]) return;
    const cur = frames[activeFrameIndex];
    if (cur.redoStack.length === 0) return;

    const ctx = mainCanvasRef.current.getContext('2d');
    if (!ctx) return;
    const currentState = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const prevRedo = [...cur.redoStack];
    const nextState = prevRedo.pop();
    if (!nextState) return;

    ctx.putImageData(nextState, 0, 0);

    setFrames((prevList) => {
      const list = [...prevList];
      list[activeFrameIndex] = {
        ...cur,
        undoStack: [...cur.undoStack, currentState],
        redoStack: prevRedo,
      };
      return list;
    });

    updateActiveThumbnail();
  }, [activeFrameIndex, frames, updateActiveThumbnail, commitSelection]);

  // Create a brand new blank animation canvas
  const handleCreateNewCanvas = useCallback((bgColor: string = '#ffffff', count: number = 1) => {
    soundFx.playClick();
    if (isPlaying) setIsPlaying(false);

    const safeCount = Math.max(1, Math.min(32, count));
    const newFrames: FrameItem[] = [];

    for (let i = 0; i < safeCount; i++) {
      const c = document.createElement('canvas');
      c.width = CANVAS_WIDTH;
      c.height = CANVAS_HEIGHT;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
      newFrames.push({
        id: `frame_${Date.now()}_${i}`,
        canvas: c,
        thumbnail: c.toDataURL('image/png'),
        undoStack: [],
        redoStack: [],
      });
    }

    framesRef.current = newFrames;
    setFrames(newFrames);
    setActiveFrameIndex(0);
    syncActiveFrameToCanvas(0, newFrames);
    soundFx.playAddFrame();
    setNewCanvasDialogOpen(false);
  }, [isPlaying, syncActiveFrameToCanvas]);

  // Frame operations
  const handleAddFrame = useCallback(() => {
    soundFx.playAddFrame();
    const newCanvas = createEmptyCanvas();
    const newFrame: FrameItem = {
      id: `frame_${Date.now()}_${Math.random()}`,
      canvas: newCanvas,
      thumbnail: newCanvas.toDataURL('image/png'),
      undoStack: [],
      redoStack: [],
    };

    setFrames((prev) => {
      const nextList = [...prev];
      nextList.splice(activeFrameIndex + 1, 0, newFrame);
      return nextList;
    });
    setActiveFrameIndex((idx) => idx + 1);
  }, [activeFrameIndex, createEmptyCanvas]);

  const handleDuplicateFrame = useCallback(() => {
    if (!frames[activeFrameIndex]) return;
    soundFx.playAddFrame();
    const current = frames[activeFrameIndex];
    const newCanvas = createEmptyCanvas();
    const ctx = newCanvas.getContext('2d');
    if (ctx) ctx.drawImage(current.canvas, 0, 0);

    const newFrame: FrameItem = {
      id: `frame_${Date.now()}_${Math.random()}`,
      canvas: newCanvas,
      thumbnail: newCanvas.toDataURL('image/png'),
      undoStack: [],
      redoStack: [],
    };

    setFrames((prev) => {
      const nextList = [...prev];
      nextList.splice(activeFrameIndex + 1, 0, newFrame);
      return nextList;
    });
    setActiveFrameIndex((idx) => idx + 1);
  }, [activeFrameIndex, frames, createEmptyCanvas]);

  const handleDeleteFrame = useCallback(() => {
    if (frames.length <= 1) {
      soundFx.playDing();
      return;
    }
    soundFx.playDeleteFrame();

    setFrames((prev) => {
      return prev.filter((_, i) => i !== activeFrameIndex);
    });

    setActiveFrameIndex((idx) => Math.max(0, Math.min(idx, frames.length - 2)));
  }, [activeFrameIndex, frames.length]);

  const handleMoveFrame = useCallback((direction: 'left' | 'right') => {
    soundFx.playClick();
    if (direction === 'left' && activeFrameIndex === 0) return;
    if (direction === 'right' && activeFrameIndex === frames.length - 1) return;

    const targetIdx = direction === 'left' ? activeFrameIndex - 1 : activeFrameIndex + 1;

    setFrames((prev) => {
      const nextList = [...prev];
      const temp = nextList[activeFrameIndex];
      nextList[activeFrameIndex] = nextList[targetIdx];
      nextList[targetIdx] = temp;
      return nextList;
    });

    setActiveFrameIndex(targetIdx);
  }, [activeFrameIndex, frames.length]);

  const handleClearFrame = useCallback(() => {
    soundFx.playClick();
    if (!mainCanvasRef.current) return;
    saveUndoSnapshot();
    const ctx = mainCanvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    updateActiveThumbnail();
  }, [saveUndoSnapshot, updateActiveThumbnail]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleSelectAll();
      } else if (e.key === 'Enter' || e.key === 'Escape') {
        if (selectionRef.current.isActive) {
          e.preventDefault();
          commitSelection();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectionRef.current.isActive) {
          e.preventDefault();
          handleDeleteSelection();
        }
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        if (selectionRef.current.isActive) {
          e.preventDefault();
          handleNudgeSelection(e.key, e.shiftKey ? 5 : 1);
        }
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (selectionRef.current.isActive) {
          commitSelection();
        }
        setIsPlaying((p) => !p);
        soundFx.playClick();
      } else if (e.key === '[') {
        e.preventDefault();
        if (selectionRef.current.isActive) commitSelection();
        setActiveFrameIndex((idx) => Math.max(0, idx - 1));
        soundFx.playClick();
      } else if (e.key === ']') {
        e.preventDefault();
        if (selectionRef.current.isActive) commitSelection();
        setActiveFrameIndex((idx) => Math.min(frames.length - 1, idx + 1));
        soundFx.playClick();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        soundFx.playClick();
        if (selectionRef.current.isActive) commitSelection();
        setNewCanvasDialogOpen(true);
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (selectionRef.current.isActive) commitSelection();
        handleAddFrame();
      } else if (e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (selectionRef.current.isActive) commitSelection();
        handleDuplicateFrame();
      } else if (e.key.toLowerCase() === 'b') {
        changeTool('brush');
      } else if (e.key.toLowerCase() === 'e') {
        changeTool('eraser');
      } else if (e.key.toLowerCase() === 'h' || e.key.toLowerCase() === 'm') {
        changeTool('hand');
      } else if (e.key.toLowerCase() === 'o') {
        setOnionSkinEnabled((o) => !o);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleUndo,
    handleRedo,
    frames.length,
    handleSelectAll,
    commitSelection,
    handleDeleteSelection,
    handleNudgeSelection,
    changeTool,
    handleAddFrame,
    handleDuplicateFrame,
  ]);

  // Pointer drawing handlers
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? CANVAS_WIDTH / rect.width : 1;
    const scaleY = rect.height > 0 ? CANVAS_HEIGHT / rect.height : 1;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPlaying) {
      setIsPlaying(false);
    }
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore pointer capture errors
    }

    const coords = getCanvasCoords(e);

    // Hand Tool (Select & Move)
    if (tool === 'hand') {
      const sel = selectionRef.current;
      if (sel.isActive) {
        const isInside =
          coords.x >= sel.x &&
          coords.x <= sel.x + sel.width &&
          coords.y >= sel.y &&
          coords.y <= sel.y + sel.height;

        if (isInside) {
          isMovingSelectionRef.current = true;
          moveStartPosRef.current = coords;
          initialSelectionPosRef.current = { x: sel.x, y: sel.y };
          return;
        } else {
          commitSelection();
        }
      }

      isDrawingRef.current = true;
      startPosRef.current = coords;
      setMarqueeRect({ x: coords.x, y: coords.y, width: 0, height: 0 });
      return;
    }

    // Eyedropper tool
    if (tool === 'picker') {
      const pixel = ctx.getImageData(coords.x, coords.y, 1, 1).data;
      const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
      if (e.button === 2) {
        setSecondaryColor(hex);
      } else {
        setPrimaryColor(hex);
      }
      changeTool('brush');
      soundFx.playClick();
      return;
    }

    // Bucket fill tool
    if (tool === 'bucket') {
      saveUndoSnapshot();
      const color = e.button === 2 ? secondaryColor : primaryColor;
      floodFill(ctx, coords.x, coords.y, color, CANVAS_WIDTH, CANVAS_HEIGHT);
      updateActiveThumbnail();
      soundFx.playClick();
      return;
    }

    saveUndoSnapshot();

    isDrawingRef.current = true;
    startPosRef.current = coords;
    lastPointRef.current = coords;
    snapshotRef.current = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const color = e.button === 2 ? secondaryColor : primaryColor;

    if (tool === 'brush') {
      applyBrushStroke(ctx, coords, coords, brushStyle, brushSize, color, brushStateRef.current);
    } else if (tool === 'eraser') {
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, brushSize, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    setMouseCoords(coords);

    if (tool === 'hand') {
      if (
        isMovingSelectionRef.current &&
        moveStartPosRef.current &&
        initialSelectionPosRef.current &&
        selectionRef.current.floatingCanvas
      ) {
        const dx = coords.x - moveStartPosRef.current.x;
        const dy = coords.y - moveStartPosRef.current.y;
        const nextX = Math.round(initialSelectionPosRef.current.x + dx);
        const nextY = Math.round(initialSelectionPosRef.current.y + dy);

        setSelection((prev) => ({ ...prev, x: nextX, y: nextY }));

        const ctx = mainCanvasRef.current?.getContext('2d');
        if (ctx && selectionRef.current.baseSnapshot && selectionRef.current.floatingCanvas) {
          ctx.putImageData(selectionRef.current.baseSnapshot, 0, 0);
          ctx.drawImage(selectionRef.current.floatingCanvas, nextX, nextY);
        }
        return;
      }

      if (isDrawingRef.current && startPosRef.current) {
        const minX = Math.min(startPosRef.current.x, coords.x);
        const minY = Math.min(startPosRef.current.y, coords.y);
        const w = Math.abs(coords.x - startPosRef.current.x);
        const h = Math.abs(coords.y - startPosRef.current.y);
        setMarqueeRect({ x: minX, y: minY, width: w, height: h });
        return;
      }
      return;
    }

    if (!isDrawingRef.current || !mainCanvasRef.current) return;
    const ctx = mainCanvasRef.current.getContext('2d');
    if (!ctx) return;

    const color = e.buttons === 2 ? secondaryColor : primaryColor;

    if (tool === 'brush') {
      applyBrushStroke(
        ctx,
        lastPointRef.current || coords,
        coords,
        brushStyle,
        brushSize,
        color,
        brushStateRef.current
      );
      lastPointRef.current = coords;
    } else if (tool === 'eraser') {
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = brushSize * 2;
      ctx.strokeStyle = '#ffffff';
      ctx.moveTo(lastPointRef.current ? lastPointRef.current.x : coords.x, lastPointRef.current ? lastPointRef.current.y : coords.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      lastPointRef.current = coords;
    } else if (snapshotRef.current && startPosRef.current) {
      ctx.putImageData(snapshotRef.current, 0, 0);
      const start = startPosRef.current;
      ctx.lineWidth = brushSize;
      ctx.strokeStyle = color;
      ctx.fillStyle = fillShape ? secondaryColor : 'transparent';

      if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
      } else if (tool === 'rect') {
        const x = Math.min(start.x, coords.x);
        const y = Math.min(start.y, coords.y);
        const w = Math.abs(coords.x - start.x);
        const h = Math.abs(coords.y - start.y);
        if (fillShape) ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      } else if (tool === 'circle') {
        const rx = Math.abs(coords.x - start.x) / 2;
        const ry = Math.abs(coords.y - start.y) / 2;
        const cx = Math.min(start.x, coords.x) + rx;
        const cy = Math.min(start.y, coords.y) + ry;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        if (fillShape) ctx.fill();
        ctx.stroke();
      }
    }
  };

  const handlePointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    if (tool === 'hand') {
      if (isMovingSelectionRef.current) {
        isMovingSelectionRef.current = false;
        moveStartPosRef.current = null;
        initialSelectionPosRef.current = null;
        updateActiveThumbnail();
        renderOnionSkin();
        return;
      }

      if (isDrawingRef.current && startPosRef.current) {
        isDrawingRef.current = false;
        const start = startPosRef.current;
        startPosRef.current = null;
        setMarqueeRect(null);

        const canvas = mainCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const coords = e ? getCanvasCoords(e) : start;
        const minX = Math.min(start.x, coords.x);
        const minY = Math.min(start.y, coords.y);
        const w = Math.abs(coords.x - start.x);
        const h = Math.abs(coords.y - start.y);

        if (w >= 4 && h >= 4) {
          // Dragged selection box
          saveUndoSnapshot();
          const floatCanvas = document.createElement('canvas');
          floatCanvas.width = w;
          floatCanvas.height = h;
          const fCtx = floatCanvas.getContext('2d');
          if (fCtx) {
            fCtx.drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(minX, minY, w, h);
            const baseSnap = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.drawImage(floatCanvas, minX, minY);

            setSelection({
              isActive: true,
              x: minX,
              y: minY,
              width: w,
              height: h,
              floatingCanvas: floatCanvas,
              baseSnapshot: baseSnap,
            });
            soundFx.playClick();
          }
        } else {
          // Single click: detect connected object
          const bounds = findConnectedObjectBounds(ctx, coords.x, coords.y, CANVAS_WIDTH, CANVAS_HEIGHT);
          if (bounds) {
            saveUndoSnapshot();
            const floatCanvas = document.createElement('canvas');
            floatCanvas.width = bounds.width;
            floatCanvas.height = bounds.height;
            const fCtx = floatCanvas.getContext('2d');
            if (fCtx) {
              fCtx.drawImage(canvas, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
              const baseSnap = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
              ctx.drawImage(floatCanvas, bounds.x, bounds.y);

              setSelection({
                isActive: true,
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
                floatingCanvas: floatCanvas,
                baseSnapshot: baseSnap,
              });
              soundFx.playClick();
            }
          }
        }
        return;
      }
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    startPosRef.current = null;
    lastPointRef.current = null;
    snapshotRef.current = null;
    brushStateRef.current.distance = 0;
    updateActiveThumbnail();
    renderOnionSkin();
  };

  // Export handlers
  const handleExportGif = async () => {
    soundFx.playClick();
    if (frames.length === 0) return;
    setExportState({
      open: true,
      format: 'gif',
      progress: 0,
      currentFrame: 1,
      totalFrames: frames.length,
      completed: false,
    });

    try {
      const canvasList = frames.map((f) => f.canvas);
      const blob = await createGifBlob(canvasList, fps, (current, total) => {
        setExportState((prev) => ({
          ...prev,
          currentFrame: current,
          progress: Math.round((current / total) * 100),
        }));
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'flipbook_animation.gif';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      soundFx.playDing();
      setExportState((prev) => ({
        ...prev,
        completed: true,
        progress: 100,
      }));
    } catch {
      alert('Error exporting GIF. Please try again.');
      setExportState((prev) => ({ ...prev, open: false }));
    }
  };

  const handleExportWebm = async () => {
    soundFx.playClick();
    if (frames.length === 0) return;
    setExportState({
      open: true,
      format: 'webm',
      progress: 0,
      currentFrame: 1,
      totalFrames: frames.length * 2,
      completed: false,
    });

    try {
      const canvasList = frames.map((f) => f.canvas);
      const blob = await createWebmBlob(canvasList, fps, (current, total) => {
        setExportState((prev) => ({
          ...prev,
          currentFrame: current,
          progress: Math.round((current / total) * 100),
        }));
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'flipbook_animation.webm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      soundFx.playDing();
      setExportState((prev) => ({
        ...prev,
        completed: true,
        progress: 100,
      }));
    } catch {
      alert('WebM recording not supported by browser.');
      setExportState((prev) => ({ ...prev, open: false }));
    }
  };

  const handleExportStandaloneHtml = () => {
    soundFx.playClick();
    const htmlCode = generateStandaloneHtml();
    const blob = new Blob([htmlCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flipbook_studio_standalone.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    soundFx.playDing();
  };

  const handleSaveProjectJson = () => {
    soundFx.playClick();
    const projectData = {
      version: '1.0',
      fps,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      frames: frames.map((f) => f.canvas.toDataURL('image/png')),
    };
    const jsonStr = JSON.stringify(projectData);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my_flipbook_project.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    soundFx.playDing();
  };

  const handleLoadProjectJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.frames && Array.isArray(json.frames)) {
          const loadedFrames: FrameItem[] = [];
          for (let i = 0; i < json.frames.length; i++) {
            const img = new Image();
            img.src = json.frames[i];
            await new Promise((res) => { img.onload = res; });
            const c = createEmptyCanvas();
            const ctx = c.getContext('2d');
            if (ctx) ctx.drawImage(img, 0, 0);
            loadedFrames.push({
              id: `frame_${Date.now()}_${i}`,
              canvas: c,
              thumbnail: json.frames[i],
              undoStack: [],
              redoStack: [],
            });
          }
          if (loadedFrames.length > 0) {
            setFrames(loadedFrames);
            setActiveFrameIndex(0);
            if (json.fps) setFps(json.fps);
            syncActiveFrameToCanvas(0, loadedFrames);
            soundFx.playAddFrame();
          }
        }
      } catch {
        alert('Invalid project file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Window Dragging
  const handleTitlePointerDown = (e: React.PointerEvent) => {
    if (isMaximized) return;
    setIsDraggingWindow(true);
    setDragOffset({
      x: e.clientX - windowPos.x,
      y: e.clientY - windowPos.y,
    });
    setIsWindowActive(true);
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingWindow) return;
      setWindowPos({
        x: Math.max(0, Math.min(window.innerWidth - 300, e.clientX - dragOffset.x)),
        y: Math.max(0, Math.min(window.innerHeight - 150, e.clientY - dragOffset.y)),
      });
    };
    const handlePointerUp = () => {
      setIsDraggingWindow(false);
    };

    if (isDraggingWindow) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingWindow, dragOffset]);

  // Click outside menu closer
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('.win-menubar') &&
          !target.closest('.win-menu-dropdown') &&
          !target.closest('#start-btn') &&
          !target.closest('#start-menu')) {
        setActiveMenu(null);
        setStartMenuOpen(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#008080] font-['Pixelify_Sans',_'MS_Sans_Serif',_Tahoma,_sans-serif] text-xs select-none">
      <input
        type="file"
        id="projectFileInput"
        accept=".json"
        className="hidden"
        onChange={handleLoadProjectJson}
      />

      {/* Retro Desktop Icons */}
      <div className="absolute top-4 left-4 flex flex-col gap-5 z-0">
        <button
          type="button"
          className="flex flex-col items-center w-20 p-1 cursor-pointer hover:bg-[#000080]/30 rounded text-center text-white"
          onClick={() => {
            soundFx.playClick();
            setNewCanvasDialogOpen(true);
            setIsMinimized(false);
            setIsWindowActive(true);
          }}
          title="Start a new blank animation canvas"
        >
          <div className="w-10 h-10 flex items-center justify-center text-2xl">📄</div>
          <span className="text-[11px] leading-tight px-1 bg-[#000080]/60">New Canvas</span>
        </button>

        <button
          type="button"
          className="flex flex-col items-center w-20 p-1 cursor-pointer hover:bg-[#000080]/30 rounded text-center text-white"
          onClick={() => {
            setIsMinimized(false);
            setIsWindowActive(true);
            soundFx.playClick();
          }}
        >
          <div className="w-10 h-10 flex items-center justify-center text-2xl">🎬</div>
          <span className="text-[11px] leading-tight px-1 bg-[#000080]/60">Flipbook Studio</span>
        </button>

        <button
          type="button"
          className="flex flex-col items-center w-20 p-1 cursor-pointer hover:bg-[#000080]/30 rounded text-center text-white"
          onClick={() => loadPreset('ball')}
        >
          <div className="w-10 h-10 flex items-center justify-center text-2xl">⚽</div>
          <span className="text-[11px] leading-tight px-1 bg-[#000080]/60">Demo: Ball</span>
        </button>

        <button
          type="button"
          className="flex flex-col items-center w-20 p-1 cursor-pointer hover:bg-[#000080]/30 rounded text-center text-white"
          onClick={() => loadPreset('stickman')}
        >
          <div className="w-10 h-10 flex items-center justify-center text-2xl">🏃</div>
          <span className="text-[11px] leading-tight px-1 bg-[#000080]/60">Demo: Stickman</span>
        </button>

        <button
          type="button"
          className="flex flex-col items-center w-20 p-1 cursor-pointer hover:bg-[#000080]/30 rounded text-center text-white"
          onClick={() => setHelpDialogOpen(true)}
        >
          <div className="w-10 h-10 flex items-center justify-center text-2xl">💡</div>
          <span className="text-[11px] leading-tight px-1 bg-[#000080]/60">Flipbook Tips</span>
        </button>
      </div>

      {/* Main App Window */}
      {!isMinimized && (
        <div
          className={`win-window absolute flex flex-col z-10 ${
            isMaximized
              ? 'top-0 left-0 right-0 bottom-7'
              : 'rounded-none shadow-2xl'
          }`}
          style={
            isMaximized
              ? undefined
              : {
                  left: `${windowPos.x}px`,
                  top: `${windowPos.y}px`,
                  width: 'calc(100vw - 32px)',
                  maxWidth: '1100px',
                  height: 'calc(100vh - 50px)',
                  maxHeight: '760px',
                }
          }
          onPointerDown={() => setIsWindowActive(true)}
        >
          {/* Window Title Bar */}
          <div
            className={`win-titlebar flex items-center justify-between px-2 py-1 select-none ${
              !isMaximized ? 'cursor-move' : ''
            } ${!isWindowActive ? 'inactive' : ''}`}
            onPointerDown={handleTitlePointerDown}
            onDoubleClick={() => setIsMaximized((m) => !m)}
          >
            <div className="flex items-center gap-1.5 font-bold tracking-wider text-xs">
              <span className="text-sm">🎬</span>
              <span>Flipbook Studio - [{frames.length} frames @ {fps}fps]</span>
            </div>
            <div className="flex items-center gap-1 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="win-button w-4 h-3.5 flex items-center justify-center text-[10px] leading-none font-bold"
                onClick={() => {
                  soundFx.playClick();
                  setIsMinimized(true);
                }}
                title="Minimize"
              >
                _
              </button>
              <button
                type="button"
                className="win-button w-4 h-3.5 flex items-center justify-center text-[10px] leading-none font-bold"
                onClick={() => {
                  soundFx.playClick();
                  setIsMaximized((m) => !m);
                }}
                title={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? '❐' : '□'}
              </button>
              <button
                type="button"
                className="win-button w-4 h-3.5 flex items-center justify-center text-[10px] leading-none font-bold"
                onClick={() => {
                  soundFx.playClick();
                  setNewCanvasDialogOpen(true);
                }}
                title="New Canvas"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Menu Bar */}
          <div className="win-menubar relative flex items-center gap-1 px-1 py-0.5 bg-[#c0c0c0] border-b border-[#808080] text-xs">
            {/* File Menu */}
            <div className="relative">
              <button
                type="button"
                className={`px-2 py-0.5 win-button text-xs ${activeMenu === 'file' ? 'active' : ''}`}
                onClick={() => {
                  soundFx.playClick();
                  setActiveMenu(activeMenu === 'file' ? null : 'file');
                }}
              >
                <span className="underline">F</span>ile
              </button>
              {activeMenu === 'file' && (
                <div className="win-menu-dropdown absolute top-full left-0 w-56 bg-[#c0c0c0] win-outset shadow-lg py-1 z-50">
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer flex justify-between font-bold"
                    onClick={() => {
                      soundFx.playClick();
                      setActiveMenu(null);
                      setNewCanvasDialogOpen(true);
                    }}
                  >
                    <span>New Blank Canvas...</span>
                    <span className="text-gray-500 font-normal">Ctrl+N</span>
                  </div>
                  <div className="border-t border-[#808080] my-1"></div>
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer"
                    onClick={() => {
                      setActiveMenu(null);
                      loadPreset('ball');
                    }}
                  >
                    Sample: Bouncing Ball
                  </div>
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer"
                    onClick={() => {
                      setActiveMenu(null);
                      loadPreset('stickman');
                    }}
                  >
                    Sample: Walking Stickman
                  </div>
                  <div className="border-t border-[#808080] my-1"></div>
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer font-bold flex justify-between"
                    onClick={() => {
                      setActiveMenu(null);
                      handleExportGif();
                    }}
                  >
                    <span>Export Animated GIF...</span>
                    <span>🎞</span>
                  </div>
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer flex justify-between"
                    onClick={() => {
                      setActiveMenu(null);
                      handleExportWebm();
                    }}
                  >
                    <span>Export WebM Video...</span>
                    <span>📹</span>
                  </div>
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer"
                    onClick={() => {
                      setActiveMenu(null);
                      handleExportStandaloneHtml();
                    }}
                  >
                    Download Standalone HTML...
                  </div>
                  <div className="border-t border-[#808080] my-1"></div>
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer"
                    onClick={() => {
                      setActiveMenu(null);
                      handleSaveProjectJson();
                    }}
                  >
                    Save Project (.json)...
                  </div>
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer"
                    onClick={() => {
                      setActiveMenu(null);
                      document.getElementById('projectFileInput')?.click();
                    }}
                  >
                    Load Project (.json)...
                  </div>
                </div>
              )}
            </div>

            {/* Edit Menu */}
            <div className="relative">
              <button
                type="button"
                className={`px-2 py-0.5 win-button text-xs ${activeMenu === 'edit' ? 'active' : ''}`}
                onClick={() => {
                  soundFx.playClick();
                  setActiveMenu(activeMenu === 'edit' ? null : 'edit');
                }}
              >
                <span className="underline">E</span>dit
              </button>
              {activeMenu === 'edit' && (
                <div className="win-menu-dropdown absolute top-full left-0 w-48 bg-[#c0c0c0] win-outset shadow-lg py-1 z-50">
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer flex justify-between"
                    onClick={() => {
                      setActiveMenu(null);
                      handleUndo();
                    }}
                  >
                    <span>Undo</span>
                    <span className="text-gray-500">Ctrl+Z</span>
                  </div>
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer flex justify-between"
                    onClick={() => {
                      setActiveMenu(null);
                      handleRedo();
                    }}
                  >
                    <span>Redo</span>
                    <span className="text-gray-500">Ctrl+Y</span>
                  </div>
                  <div className="border-t border-[#808080] my-1"></div>
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer"
                    onClick={() => {
                      setActiveMenu(null);
                      handleClearFrame();
                    }}
                  >
                    Clear Current Frame
                  </div>
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer"
                    onClick={() => {
                      setActiveMenu(null);
                      handleDuplicateFrame();
                    }}
                  >
                    Duplicate Frame (D)
                  </div>
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer"
                    onClick={() => {
                      setActiveMenu(null);
                      handleDeleteFrame();
                    }}
                  >
                    Delete Frame
                  </div>
                </div>
              )}
            </div>

            {/* View Menu */}
            <div className="relative">
              <button
                type="button"
                className={`px-2 py-0.5 win-button text-xs ${activeMenu === 'view' ? 'active' : ''}`}
                onClick={() => {
                  soundFx.playClick();
                  setActiveMenu(activeMenu === 'view' ? null : 'view');
                }}
              >
                <span className="underline">V</span>iew
              </button>
              {activeMenu === 'view' && (
                <div className="win-menu-dropdown absolute top-full left-0 w-52 bg-[#c0c0c0] win-outset shadow-lg py-1 z-50">
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer flex items-center justify-between"
                    onClick={() => {
                      soundFx.playClick();
                      setOnionSkinEnabled((o) => !o);
                    }}
                  >
                    <span>Onion Skin (Ghosts)</span>
                    <span>{onionSkinEnabled ? '✓' : ''}</span>
                  </div>
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer flex items-center justify-between"
                    onClick={() => {
                      soundFx.playClick();
                      setShowNextGhost((g) => !g);
                    }}
                  >
                    <span>Show Next Frame Ghost</span>
                    <span>{showNextGhost ? '✓' : ''}</span>
                  </div>
                  <div className="border-t border-[#808080] my-1"></div>
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer flex items-center justify-between"
                    onClick={() => {
                      soundFx.playClick();
                      setShowGrid((g) => !g);
                    }}
                  >
                    <span>Alignment Grid</span>
                    <span>{showGrid ? '✓' : ''}</span>
                  </div>
                  <div className="border-t border-[#808080] my-1"></div>
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer flex items-center justify-between"
                    onClick={() => {
                      soundFx.playClick();
                      setZoomLevel(1);
                    }}
                  >
                    <span>Zoom: 100% Normal</span>
                    <span>{zoomLevel === 1 ? '✓' : ''}</span>
                  </div>
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer flex items-center justify-between"
                    onClick={() => {
                      soundFx.playClick();
                      setZoomLevel(1.5);
                    }}
                  >
                    <span>Zoom: 150% Large</span>
                    <span>{zoomLevel === 1.5 ? '✓' : ''}</span>
                  </div>
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer flex items-center justify-between"
                    onClick={() => {
                      soundFx.playClick();
                      setZoomLevel(0.75);
                    }}
                  >
                    <span>Zoom: 75% Small</span>
                    <span>{zoomLevel === 0.75 ? '✓' : ''}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Help Menu */}
            <div className="relative">
              <button
                type="button"
                className={`px-2 py-0.5 win-button text-xs ${activeMenu === 'help' ? 'active' : ''}`}
                onClick={() => {
                  soundFx.playClick();
                  setActiveMenu(activeMenu === 'help' ? null : 'help');
                }}
              >
                <span className="underline">H</span>elp
              </button>
              {activeMenu === 'help' && (
                <div className="win-menu-dropdown absolute top-full left-0 w-48 bg-[#c0c0c0] win-outset shadow-lg py-1 z-50">
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer"
                    onClick={() => {
                      setActiveMenu(null);
                      setHelpDialogOpen(true);
                    }}
                  >
                    Animation Tips
                  </div>
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer"
                    onClick={() => {
                      setActiveMenu(null);
                      setShortcutsDialogOpen(true);
                    }}
                  >
                    Keyboard Shortcuts
                  </div>
                  <div className="border-t border-[#808080] my-1"></div>
                  <div
                    className="px-3 py-1 hover:bg-[#000080] hover:text-white cursor-pointer font-bold"
                    onClick={() => {
                      setActiveMenu(null);
                      setAboutDialogOpen(true);
                    }}
                  >
                    About Flipbook Studio...
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Playback Bar */}
          <div className="flex flex-wrap items-center justify-between px-2 py-1 bg-[#c0c0c0] border-b border-[#808080] gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="win-button px-2 py-1 font-bold text-xs"
                onClick={() => {
                  soundFx.playClick();
                  setActiveFrameIndex(0);
                }}
                title="First Frame (Home)"
              >
                |◀
              </button>
              <button
                type="button"
                className="win-button px-2 py-1 font-bold text-xs"
                onClick={() => {
                  soundFx.playClick();
                  setActiveFrameIndex((i) => Math.max(0, i - 1));
                }}
                title="Previous Frame ([)"
              >
                ◀
              </button>
              <button
                type="button"
                className={`win-button px-3 py-1 font-bold text-xs flex items-center gap-1.5 ${isPlaying ? 'active bg-[#e0e0e0]' : ''}`}
                onClick={() => {
                  soundFx.playClick();
                  setIsPlaying((p) => !p);
                }}
                title="Play / Pause (Space)"
              >
                <span>{isPlaying ? '❚❚' : '▶'}</span>
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>
              <button
                type="button"
                className="win-button px-2 py-1 font-bold text-xs"
                onClick={() => {
                  soundFx.playClick();
                  setActiveFrameIndex((i) => Math.min(frames.length - 1, i + 1));
                }}
                title="Next Frame (])"
              >
                ▶
              </button>
              <button
                type="button"
                className="win-button px-2 py-1 font-bold text-xs"
                onClick={() => {
                  soundFx.playClick();
                  setActiveFrameIndex(frames.length - 1);
                }}
                title="Last Frame (End)"
              >
                ▶|
              </button>

              <button
                type="button"
                className={`win-button px-2 py-1 text-xs ${isLooping ? 'active font-bold' : ''}`}
                onClick={() => {
                  soundFx.playClick();
                  setIsLooping((l) => !l);
                }}
                title="Toggle Looping"
              >
                🔁 Loop
              </button>

              <div className="win-inset px-2 py-0.5 bg-white font-mono text-xs font-bold min-w-24 text-center">
                Frame {activeFrameIndex + 1} / {frames.length}
              </div>
            </div>

            {/* FPS Speed Slider */}
            <div className="flex items-center gap-2 win-outset-thin px-2 py-0.5 bg-[#d4d0c8]">
              <span className="font-bold text-[11px]">Speed:</span>
              <input
                type="range"
                min="1"
                max="24"
                value={fps}
                onChange={(e) => setFps(parseInt(e.target.value, 10))}
                className="w-20 cursor-pointer accent-[#000080]"
              />
              <span className="font-mono text-xs font-bold w-12 text-right">{fps} FPS</span>
            </div>

            {/* Onion Skin controls */}
            <div className="flex items-center gap-1.5 win-outset-thin px-2 py-0.5 bg-[#d4d0c8]">
              <button
                type="button"
                className={`win-button px-2 py-0.5 text-xs ${onionSkinEnabled ? 'active font-bold text-[#000080]' : ''}`}
                onClick={() => {
                  soundFx.playClick();
                  setOnionSkinEnabled((o) => !o);
                }}
                title="Toggle Onion Skin (O) - Red ghost shows previous frame"
              >
                👻 Onion Skin
              </button>
              <button
                type="button"
                className={`win-button px-1.5 py-0.5 text-[10px] ${showNextGhost ? 'active font-bold text-[#0055aa]' : ''}`}
                onClick={() => {
                  soundFx.playClick();
                  setShowNextGhost((g) => !g);
                }}
                title="Toggle Next Frame Ghost in cyan"
              >
                +Next
              </button>
              <span className="text-[10px] text-gray-700">Opacity:</span>
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={onionOpacity}
                onChange={(e) => setOnionOpacity(parseFloat(e.target.value))}
                className="w-14 cursor-pointer accent-[#000080]"
              />
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="win-button px-2.5 py-1 font-bold text-xs bg-[#ffffff] hover:bg-[#f0f0f0] text-black flex items-center gap-1.5 border border-[#808080]"
                onClick={() => {
                  soundFx.playClick();
                  setNewCanvasDialogOpen(true);
                }}
                title="Start a new blank animation canvas (Ctrl+N)"
              >
                <span>📄</span>
                <span>New Canvas</span>
              </button>
              <button
                type="button"
                className="win-button px-2 py-1 font-bold text-xs"
                onClick={handleUndo}
                title="Undo (Ctrl+Z)"
              >
                ↶ Undo
              </button>
              <button
                type="button"
                className="win-button px-2 py-1 font-bold text-xs"
                onClick={handleRedo}
                title="Redo (Ctrl+Y)"
              >
                ↷ Redo
              </button>
              <button
                type="button"
                className="win-button px-2 py-1 font-bold text-xs bg-[#ffffc0]"
                onClick={handleExportGif}
                title="Export as Animated GIF"
              >
                💾 Export GIF
              </button>
            </div>
          </div>

          {/* Main Workspace */}
          <div className="flex-1 flex overflow-hidden p-1 gap-1.5 bg-[#c0c0c0]">
            {/* Left MS Paint-style Toolbox */}
            <div className="w-24 flex flex-col gap-1.5 shrink-0 select-none">
              <div className="grid grid-cols-2 gap-1 win-inset p-1 bg-[#c0c0c0]">
                {/* 1. Brush */}
                <button
                  type="button"
                  className={`win-button h-7 flex items-center justify-center text-sm ${tool === 'brush' ? 'active' : ''}`}
                  onClick={() => changeTool('brush')}
                  title="Brush (B)"
                >
                  ✏️
                </button>
                {/* 2. Rubber / Eraser */}
                <button
                  type="button"
                  className={`win-button h-7 flex items-center justify-center text-sm ${tool === 'eraser' ? 'active' : ''}`}
                  onClick={() => changeTool('eraser')}
                  title="Rubber / Eraser (E)"
                >
                  <RubberIcon />
                </button>
                {/* 3. Hand Tool (Select & Move) */}
                <button
                  type="button"
                  className={`win-button h-7 flex items-center justify-center text-sm ${tool === 'hand' ? 'active bg-yellow-100 font-bold' : ''}`}
                  onClick={() => changeTool('hand')}
                  title="Hand: Select & Move Drawn Objects (H / M)"
                >
                  ✋
                </button>
                {/* 4. Bucket */}
                <button
                  type="button"
                  className={`win-button h-7 flex items-center justify-center text-sm ${tool === 'bucket' ? 'active' : ''}`}
                  onClick={() => changeTool('bucket')}
                  title="Fill Bucket"
                >
                  🪣
                </button>
                {/* 5. Picker */}
                <button
                  type="button"
                  className={`win-button h-7 flex items-center justify-center text-sm ${tool === 'picker' ? 'active' : ''}`}
                  onClick={() => changeTool('picker')}
                  title="Eyedropper"
                >
                  💉
                </button>
                {/* 6. Line */}
                <button
                  type="button"
                  className={`win-button h-7 flex items-center justify-center text-sm ${tool === 'line' ? 'active' : ''}`}
                  onClick={() => changeTool('line')}
                  title="Line"
                >
                  📏
                </button>
                {/* 7. Rectangle */}
                <button
                  type="button"
                  className={`win-button h-7 flex items-center justify-center text-sm ${tool === 'rect' ? 'active' : ''}`}
                  onClick={() => changeTool('rect')}
                  title="Rectangle"
                >
                  ▭
                </button>
                {/* 8. Circle */}
                <button
                  type="button"
                  className={`win-button h-7 flex items-center justify-center text-sm ${tool === 'circle' ? 'active' : ''}`}
                  onClick={() => changeTool('circle')}
                  title="Circle"
                >
                  ⬭
                </button>
                {/* 9. Clear Frame */}
                <button
                  type="button"
                  className="col-span-2 win-button h-6 flex items-center justify-center gap-1 text-[11px]"
                  onClick={handleClearFrame}
                  title="Clear Frame"
                >
                  <span>🗑</span>
                  <span>Clear</span>
                </button>
              </div>

              {/* Hand Tool Options (Visible when Hand is active) */}
              {tool === 'hand' && (
                <div className="win-inset p-1.5 bg-[#d4d0c8] flex flex-col gap-1 text-center">
                  <span className="text-[9px] font-bold text-gray-800 leading-tight">
                    Hand / Move
                  </span>
                  <div className="text-[8px] text-gray-600 leading-tight">
                    Click object or drag box to select & move.
                  </div>
                  {selection.isActive ? (
                    <div className="flex flex-col gap-1 pt-1 border-t border-gray-400">
                      <button
                        type="button"
                        className="win-button w-full py-0.5 text-[10px] font-bold bg-[#ffffc0]"
                        onClick={commitSelection}
                        title="Commit object at current position (Enter)"
                      >
                        ✓ Drop Object
                      </button>
                      <button
                        type="button"
                        className="win-button w-full py-0.5 text-[10px] text-red-700"
                        onClick={handleDeleteSelection}
                        title="Delete selected object (Delete / Backspace)"
                      >
                        🗑 Delete
                      </button>
                    </div>
                  ) : (
                    <div className="pt-1 border-t border-gray-400">
                      <button
                        type="button"
                        className="win-button w-full py-0.5 text-[10px]"
                        onClick={handleSelectAll}
                        title="Select all artwork on this frame (Ctrl+A)"
                      >
                        Select All
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Brush Style Selector (Visible when Brush is active) */}
              {tool === 'brush' && (
                <div className="win-inset p-1 bg-[#d4d0c8] flex flex-col gap-1">
                  <div className="text-[9px] font-bold text-center text-gray-800 leading-none">
                    Brush Styles
                  </div>
                  
                  {/* Classic Brushes */}
                  <div className="grid grid-cols-3 gap-0.5">
                    <button
                      type="button"
                      className={`win-button h-6 text-xs flex items-center justify-center ${brushStyle === 'round' ? 'active' : ''}`}
                      onClick={() => {
                        soundFx.playClick();
                        setBrushStyle('round');
                      }}
                      title="Round: Smooth solid pen"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className={`win-button h-6 text-xs flex items-center justify-center ${brushStyle === 'chisel' ? 'active' : ''}`}
                      onClick={() => {
                        soundFx.playClick();
                        setBrushStyle('chisel');
                      }}
                      title="Chisel: Calligraphy 45° angle"
                    >
                      ✒️
                    </button>
                    <button
                      type="button"
                      className={`win-button h-6 text-xs flex items-center justify-center ${brushStyle === 'spray' ? 'active' : ''}`}
                      onClick={() => {
                        soundFx.playClick();
                        setBrushStyle('spray');
                      }}
                      title="Spray: 90s MS Paint airbrush"
                    >
                      💨
                    </button>
                    <button
                      type="button"
                      className={`win-button h-6 text-xs flex items-center justify-center ${brushStyle === 'dither' ? 'active' : ''}`}
                      onClick={() => {
                        soundFx.playClick();
                        setBrushStyle('dither');
                      }}
                      title="Dither: 50% checkerboard dither"
                    >
                      🏁
                    </button>
                    <button
                      type="button"
                      className={`win-button h-6 text-xs flex items-center justify-center ${brushStyle === 'marker' ? 'active' : ''}`}
                      onClick={() => {
                        soundFx.playClick();
                        setBrushStyle('marker');
                      }}
                      title="Marker: Semi-transparent highlighter"
                    >
                      🖍️
                    </button>
                    <button
                      type="button"
                      className={`win-button h-6 text-xs flex items-center justify-center ${brushStyle === 'neon' ? 'active' : ''}`}
                      onClick={() => {
                        soundFx.playClick();
                        setBrushStyle('neon');
                      }}
                      title="Neon: Glowing laser line"
                    >
                      💡
                    </button>
                  </div>

                  {/* Animated Brushes Section */}
                  <div className="pt-1 border-t border-gray-400 flex flex-col gap-0.5">
                    <span className="text-[8px] font-bold text-center text-[#800080] tracking-tight">
                      ANIMATED
                    </span>
                    <div className="grid grid-cols-2 gap-0.5">
                      <button
                        type="button"
                        className={`win-button h-6 text-xs flex items-center justify-center ${brushStyle === 'rainbow' ? 'active bg-pink-100' : ''}`}
                        onClick={() => {
                          soundFx.playClick();
                          setBrushStyle('rainbow');
                        }}
                        title="Rainbow: Cycling spectrum hue stream"
                      >
                        🌈
                      </button>
                      <button
                        type="button"
                        className={`win-button h-6 text-xs flex items-center justify-center ${brushStyle === 'stars' ? 'active bg-yellow-100' : ''}`}
                        onClick={() => {
                          soundFx.playClick();
                          setBrushStyle('stars');
                        }}
                        title="Stars: Twinkling starburst diamonds"
                      >
                        ✨
                      </button>
                      <button
                        type="button"
                        className={`win-button h-6 text-xs flex items-center justify-center ${brushStyle === 'fire' ? 'active bg-orange-100' : ''}`}
                        onClick={() => {
                          soundFx.playClick();
                          setBrushStyle('fire');
                        }}
                        title="Fire: Rising ember sparks & flame particles"
                      >
                        🔥
                      </button>
                      <button
                        type="button"
                        className={`win-button h-6 text-xs flex items-center justify-center ${brushStyle === 'hearts' ? 'active bg-red-100' : ''}`}
                        onClick={() => {
                          soundFx.playClick();
                          setBrushStyle('hearts');
                        }}
                        title="Hearts: Pulsating retro pixel hearts"
                      >
                        💖
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tool Size Options */}
              {tool !== 'hand' && (
                <div className="win-inset p-1 flex flex-col items-center gap-1 bg-[#d4d0c8]">
                  <span className="text-[10px] font-bold text-gray-700">Size</span>
                  <div className="grid grid-cols-3 gap-1 w-full">
                    {[1, 2, 4, 8, 16, 24].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        className={`h-5 win-button flex items-center justify-center cursor-pointer ${
                          brushSize === sz ? 'active' : ''
                        }`}
                        onClick={() => {
                          soundFx.playClick();
                          setBrushSize(sz);
                        }}
                        title={`Size ${sz}px`}
                      >
                        <div
                          className="rounded-full bg-black"
                          style={{
                            width: `${Math.min(sz, 10)}px`,
                            height: `${Math.min(sz, 10)}px`,
                          }}
                        />
                      </button>
                    ))}
                  </div>

                  {(tool === 'rect' || tool === 'circle') && (
                    <div className="w-full pt-1 border-t border-gray-400 flex flex-col items-center gap-1">
                      <span className="text-[9px] font-bold">Fill</span>
                      <button
                        type="button"
                        className={`win-button w-full py-0.5 text-[10px] ${!fillShape ? 'active font-bold' : ''}`}
                        onClick={() => setFillShape(false)}
                      >
                        Outline
                      </button>
                      <button
                        type="button"
                        className={`win-button w-full py-0.5 text-[10px] ${fillShape ? 'active font-bold' : ''}`}
                        onClick={() => setFillShape(true)}
                      >
                        Solid
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Center Canvas Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <div
                className="flex-1 win-inset-deep bg-[#808080] overflow-auto flex items-center justify-center p-2 relative"
                style={{ imageRendering: 'pixelated' }}
              >
                <div
                  className="relative shadow-xl border border-black bg-white shrink-0"
                  style={{
                    width: `${CANVAS_WIDTH * zoomLevel}px`,
                    height: `${CANVAS_HEIGHT * zoomLevel}px`,
                  }}
                >
                  <canvas
                    ref={mainCanvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    className={`absolute top-0 left-0 w-full h-full z-10 ${
                      tool === 'hand'
                        ? isMovingSelectionRef.current
                          ? 'cursor-grabbing'
                          : selection.isActive &&
                            mouseCoords !== null &&
                            mouseCoords.x >= selection.x &&
                            mouseCoords.x <= selection.x + selection.width &&
                            mouseCoords.y >= selection.y &&
                            mouseCoords.y <= selection.y + selection.height
                          ? 'cursor-grab'
                          : 'cursor-crosshair'
                        : 'cursor-crosshair'
                    }`}
                    style={{ imageRendering: 'pixelated', touchAction: 'none' }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onContextMenu={(e) => e.preventDefault()}
                  />

                  {/* Marquee creation box */}
                  {marqueeRect && marqueeRect.width > 0 && marqueeRect.height > 0 && (
                    <div
                      className="absolute pointer-events-none z-25 border border-dashed border-black"
                      style={{
                        left: `${marqueeRect.x * zoomLevel}px`,
                        top: `${marqueeRect.y * zoomLevel}px`,
                        width: `${marqueeRect.width * zoomLevel}px`,
                        height: `${marqueeRect.height * zoomLevel}px`,
                        outline: '1px dashed white',
                        backgroundColor: 'rgba(0, 0, 128, 0.08)',
                      }}
                    />
                  )}

                  {/* Active Hand Selection Overlay */}
                  {selection.isActive && (
                    <div
                      className="absolute z-25 border border-dashed border-black select-none pointer-events-none"
                      style={{
                        left: `${selection.x * zoomLevel}px`,
                        top: `${selection.y * zoomLevel}px`,
                        width: `${selection.width * zoomLevel}px`,
                        height: `${selection.height * zoomLevel}px`,
                        outline: '1px dashed white',
                        backgroundColor: 'rgba(0, 0, 128, 0.05)',
                      }}
                    >
                      {/* Corner and edge resize handles (authentic Win95 squares) */}
                      <div className="absolute -top-1 -left-1 w-2 h-2 bg-white border border-black" />
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-white border border-black" />
                      <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border border-black" />
                      <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border border-black" />
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border border-black" />
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border border-black" />
                      <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-white border border-black" />
                      <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-white border border-black" />

                      {/* Floating Move Tag */}
                      <div className="absolute -top-5 left-0 px-1 py-0.2 bg-[#ffffc0] border border-black text-[9px] font-sans font-bold text-black whitespace-nowrap shadow">
                        ✋ Drag to Move · [Del] cut · [Enter] drop
                      </div>
                    </div>
                  )}

                  {/* Onion Skin overlay canvas - sits directly on top of drawing canvas */}
                  <canvas
                    ref={onionCanvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    className="absolute top-0 left-0 w-full h-full pointer-events-none z-20"
                    style={{ imageRendering: 'pixelated' }}
                  />

                  {showGrid && (
                    <div
                      className="absolute top-0 left-0 w-full h-full pointer-events-none z-30"
                      style={{
                        backgroundImage:
                          'linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)',
                        backgroundSize: `${32 * zoomLevel}px ${32 * zoomLevel}px`,
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Bottom Color Palette */}
              <div className="flex items-center gap-2 p-1 bg-[#c0c0c0] border-t border-[#808080] shrink-0">
                <div className="relative w-8 h-8 win-inset bg-[#c0c0c0] shrink-0">
                  <div
                    className="absolute bottom-1 right-1 w-4 h-4 win-outset-thin"
                    style={{ backgroundColor: secondaryColor }}
                    title={`Secondary: ${secondaryColor}`}
                  />
                  <div
                    className="absolute top-1 left-1 w-4 h-4 win-outset-thin z-10"
                    style={{ backgroundColor: primaryColor }}
                    title={`Primary: ${primaryColor}`}
                  />
                </div>

                <div className="grid grid-rows-2 grid-flow-col gap-0.5 win-inset p-0.5 bg-[#808080]">
                  {WIN95_PALETTE.map((hex, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="w-3.5 h-3.5 win-outset-thin cursor-pointer focus:outline-none"
                      style={{ backgroundColor: hex }}
                      onClick={() => {
                        soundFx.playClick();
                        setPrimaryColor(hex);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        soundFx.playClick();
                        setSecondaryColor(hex);
                      }}
                      title={`${hex} (Left: Primary, Right: Secondary)`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <label className="win-button px-1.5 py-1 text-[10px] cursor-pointer flex items-center gap-1">
                    <span>🎨 Custom</span>
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-4 h-4 p-0 border-0 cursor-pointer opacity-0 absolute"
                    />
                  </label>
                </div>

                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    className="win-button px-2 py-1 font-bold text-xs"
                    onClick={handleAddFrame}
                    title="Add new frame (N)"
                  >
                    + Add Frame
                  </button>
                  <button
                    type="button"
                    className="win-button px-2 py-1 font-bold text-xs"
                    onClick={handleDuplicateFrame}
                    title="Duplicate active frame (D)"
                  >
                    📋 Duplicate
                  </button>
                  <button
                    type="button"
                    className="win-button px-2 py-1 text-xs"
                    onClick={() => handleMoveFrame('left')}
                    title="Move frame left"
                    disabled={activeFrameIndex === 0}
                  >
                    ◀ Move
                  </button>
                  <button
                    type="button"
                    className="win-button px-2 py-1 text-xs"
                    onClick={() => handleMoveFrame('right')}
                    title="Move frame right"
                    disabled={activeFrameIndex === frames.length - 1}
                  >
                    Move ▶
                  </button>
                  <button
                    type="button"
                    className="win-button px-2 py-1 text-xs text-red-700"
                    onClick={handleDeleteFrame}
                    title="Delete frame"
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>

              {/* Filmstrip Timeline */}
              <div className="h-22 bg-[#c0c0c0] border-t border-[#808080] p-1 flex flex-col shrink-0">
                <div className="flex-1 win-inset bg-[#2b2b2b] p-1 flex items-center gap-2 overflow-x-auto">
                  {frames.map((frame, index) => {
                    const isActive = index === activeFrameIndex;
                    return (
                      <div
                        key={frame.id}
                        className={`relative shrink-0 flex flex-col items-center cursor-pointer p-1 rounded-sm ${
                          isActive
                            ? 'bg-[#000080] text-white ring-2 ring-[#ffff00]'
                            : 'bg-[#505050] text-gray-200 hover:bg-[#606060]'
                        }`}
                        onClick={() => {
                          if (isPlaying) setIsPlaying(false);
                          soundFx.playClick();
                          setActiveFrameIndex(index);
                        }}
                      >
                        <div className="w-14 h-10 bg-white border border-black overflow-hidden flex items-center justify-center">
                          {frame.thumbnail ? (
                            <img
                              src={frame.thumbnail}
                              alt={`Frame ${index + 1}`}
                              className="w-full h-full object-contain pointer-events-none"
                              style={{ imageRendering: 'pixelated' }}
                            />
                          ) : (
                            <div className="text-[10px] text-gray-400">Empty</div>
                          )}
                        </div>
                        <span className="text-[10px] font-mono font-bold mt-0.5">
                          #{index + 1}
                        </span>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    className="shrink-0 w-14 h-14 win-button flex flex-col items-center justify-center gap-0.5 font-bold text-gray-700 hover:text-black"
                    onClick={handleAddFrame}
                    title="Add new frame"
                  >
                    <span className="text-lg leading-none">+</span>
                    <span className="text-[9px]">New</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Window Bottom Status Bar */}
          <div className="h-5.5 bg-[#c0c0c0] border-t border-[#808080] px-1 py-0.5 flex items-center gap-1 text-[11px] shrink-0">
            <div className="win-inset px-2 py-0.5 flex-1 truncate bg-[#d4d0c8]">
              {isPlaying
                ? `Playing animation at ${fps} FPS... (Space to pause)`
                : `Tool: ${tool.toUpperCase()} · ${
                    tool === 'hand'
                      ? selection.isActive
                        ? `Object selected at (${selection.x}, ${selection.y}) · Drag to move · Enter to drop · Del to cut`
                        : 'Click drawn object or drag box to select & move'
                      : tool === 'brush'
                      ? `Brush (${brushStyle.toUpperCase()}) · ${brushSize}px`
                      : tool === 'eraser'
                      ? `Rubber / Eraser size ${brushSize * 2}px`
                      : tool === 'bucket'
                      ? 'Click region to fill'
                      : tool === 'picker'
                      ? 'Click to sample color'
                      : `Draw ${tool}`
                  }`}
            </div>

            <div className="win-inset px-2 py-0.5 w-24 text-center font-mono bg-[#d4d0c8]">
              {mouseCoords ? `${mouseCoords.x}, ${mouseCoords.y}` : '--- , ---'}
            </div>

            <div className="win-inset px-2 py-0.5 w-20 text-center font-mono bg-[#d4d0c8]">
              640x480
            </div>

            <div className="win-inset px-2 py-0.5 w-20 text-center font-mono font-bold bg-[#d4d0c8]">
              {activeFrameIndex + 1} / {frames.length}
            </div>
          </div>
        </div>
      )}

      {/* New Blank Canvas Dialog */}
      {newCanvasDialogOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="win-window w-96 bg-[#c0c0c0] shadow-2xl">
            <div className="win-titlebar flex items-center justify-between px-2 py-1">
              <div className="flex items-center gap-1 font-bold text-xs">
                <span>📄</span>
                <span>New Blank Canvas</span>
              </div>
              <button
                type="button"
                className="win-button w-4 h-3.5 text-[10px] leading-none"
                onClick={() => setNewCanvasDialogOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="text-3xl">📄</div>
                <div>
                  <h4 className="font-bold text-xs">Start a Fresh Animation</h4>
                  <p className="text-[11px] text-gray-700">
                    Customize your blank canvas settings below.
                  </p>
                </div>
              </div>

              {/* Background Color Picker */}
              <div className="win-inset p-2.5 bg-white space-y-2">
                <span className="font-bold text-[11px] text-gray-800 block">
                  1. Choose Canvas Background:
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'White', color: '#ffffff', desc: 'Classic paper' },
                    { label: 'Black', color: '#000000', desc: 'Dark/Night' },
                    { label: 'Parchment', color: '#ffffdc', desc: 'Retro paper' },
                    { label: 'Teal 95', color: '#008080', desc: 'Desktop teal' },
                  ].map((bg) => (
                    <button
                      key={bg.color}
                      type="button"
                      className={`p-1.5 flex flex-col items-center justify-center gap-1 border-2 cursor-pointer ${
                        newCanvasBg === bg.color
                          ? 'border-[#000080] bg-[#e8f4fc]'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      onClick={() => setNewCanvasBg(bg.color)}
                    >
                      <div
                        className="w-7 h-5 border border-black shadow-inner"
                        style={{ backgroundColor: bg.color }}
                      />
                      <span className="text-[10px] font-bold">{bg.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Initial Frames Count */}
              <div className="win-inset p-2.5 bg-white space-y-2">
                <span className="font-bold text-[11px] text-gray-800 block">
                  2. Number of Initial Blank Frames:
                </span>
                <div className="flex gap-2">
                  {[
                    { label: '1 Frame', count: 1 },
                    { label: '4 Frames', count: 4 },
                    { label: '8 Frames', count: 8 },
                    { label: '12 Frames', count: 12 },
                  ].map((item) => (
                    <button
                      key={item.count}
                      type="button"
                      className={`flex-1 py-1 text-xs font-bold win-button ${
                        newCanvasFramesCount === item.count ? 'active font-black text-[#000080]' : ''
                      }`}
                      onClick={() => setNewCanvasFramesCount(item.count)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-[10px] text-gray-600 italic">
                * Note: This will start a fresh 640x480 animation project.
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-gray-400">
                <button
                  type="button"
                  className="win-button px-4 py-1.5 font-bold bg-[#e8f4fc] text-[#000080]"
                  onClick={() => handleCreateNewCanvas(newCanvasBg, newCanvasFramesCount)}
                >
                  Create Blank Canvas
                </button>
                <button
                  type="button"
                  className="win-button px-4 py-1.5"
                  onClick={() => {
                    soundFx.playClick();
                    setNewCanvasDialogOpen(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Progress Dialog */}
      {exportState.open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="win-window w-80 bg-[#c0c0c0] shadow-2xl">
            <div className="win-titlebar flex items-center justify-between px-2 py-1">
              <span className="font-bold text-xs">
                Exporting {exportState.format.toUpperCase()} Animation
              </span>
              <button
                type="button"
                className="win-button w-4 h-3.5 text-[10px] leading-none"
                onClick={() => setExportState((prev) => ({ ...prev, open: false }))}
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="text-3xl animate-bounce">💾</div>
                <div className="flex flex-col">
                  <span className="font-bold text-xs">
                    {exportState.completed
                      ? 'Export Complete!'
                      : `Encoding frame ${exportState.currentFrame} of ${exportState.totalFrames}...`}
                  </span>
                  <span className="text-[11px] text-gray-700">
                    {exportState.completed
                      ? 'File downloaded successfully.'
                      : 'Compressing frames...'}
                  </span>
                </div>
              </div>

              {/* Chunked Progress Bar */}
              <div className="win-inset p-1 bg-white h-6 flex items-center overflow-hidden">
                <div className="flex h-full w-full">
                  {Array.from({ length: 20 }).map((_, idx) => {
                    const blockThreshold = (idx / 20) * 100;
                    const isFilled = exportState.progress >= blockThreshold;
                    return (
                      <div
                        key={idx}
                        className={`h-full flex-1 mr-0.5 ${
                          isFilled ? 'bg-[#000080]' : 'bg-transparent'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="font-mono">{exportState.progress}%</span>
                {exportState.completed ? (
                  <button
                    type="button"
                    className="win-button px-4 py-1 font-bold"
                    onClick={() => setExportState((prev) => ({ ...prev, open: false }))}
                  >
                    OK
                  </button>
                ) : (
                  <button
                    type="button"
                    className="win-button px-4 py-1"
                    onClick={() => setExportState((prev) => ({ ...prev, open: false }))}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* About Dialog */}
      {aboutDialogOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="win-window w-96 bg-[#c0c0c0] shadow-2xl">
            <div className="win-titlebar flex items-center justify-between px-2 py-1">
              <span className="font-bold text-xs">About Flipbook Studio '95</span>
              <button
                type="button"
                className="win-button w-4 h-3.5 text-[10px] leading-none"
                onClick={() => setAboutDialogOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="text-4xl">🎬</div>
                <div>
                  <h3 className="font-bold text-sm">Flipbook Studio '95</h3>
                  <p className="text-[11px] text-gray-700">Version 4.0 for Windows</p>
                </div>
              </div>
              <div className="win-inset p-2 bg-white text-xs leading-relaxed">
                Nostalgic frame-by-frame 2D animation app with onion skinning, filmstrip timeline,
                synthesized Web Audio sound effects, and animated GIF & WebM export.
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="win-button px-5 py-1 font-bold"
                  onClick={() => {
                    soundFx.playClick();
                    setAboutDialogOpen(false);
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Dialog */}
      {helpDialogOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="win-window w-104 bg-[#c0c0c0] shadow-2xl">
            <div className="win-titlebar flex items-center justify-between px-2 py-1">
              <span className="font-bold text-xs">Flipbook Animation Tips</span>
              <button
                type="button"
                className="win-button w-4 h-3.5 text-[10px] leading-none"
                onClick={() => setHelpDialogOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="win-inset p-3 bg-white text-xs space-y-2 max-h-72 overflow-y-auto">
                <div className="font-bold text-[#000080]">✨ Key Flipbook Principles:</div>
                <p><strong>1. Squash and Stretch:</strong> When an object moves fast or lands, squash it wide! When speeding up, stretch it long.</p>
                <p><strong>2. Onion Skinning (👻):</strong> See the ghost of your previous frame to align your drawings cleanly.</p>
                <p><strong>3. Duplicate Frame (D):</strong> Copy the current frame, then make slight adjustments for smooth movement.</p>
                <p><strong>4. Recommended Speed:</strong> 8 to 12 FPS gives that classic hand-drawn flipbook feel.</p>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="win-button px-5 py-1 font-bold"
                  onClick={() => {
                    soundFx.playClick();
                    setHelpDialogOpen(false);
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts Dialog */}
      {shortcutsDialogOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="win-window w-96 bg-[#c0c0c0] shadow-2xl">
            <div className="win-titlebar flex items-center justify-between px-2 py-1">
              <span className="font-bold text-xs">Keyboard Shortcuts</span>
              <button
                type="button"
                className="win-button w-4 h-3.5 text-[10px] leading-none"
                onClick={() => setShortcutsDialogOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="win-inset p-2 bg-white text-xs space-y-1">
                <div className="flex justify-between py-0.5"><span>Play / Pause:</span><span className="font-mono bg-gray-100 px-1">Space</span></div>
                <div className="flex justify-between py-0.5"><span>Prev / Next Frame:</span><span className="font-mono bg-gray-100 px-1">[ and ]</span></div>
                <div className="flex justify-between py-0.5"><span>New Frame:</span><span className="font-mono bg-gray-100 px-1">N</span></div>
                <div className="flex justify-between py-0.5"><span>Duplicate Frame:</span><span className="font-mono bg-gray-100 px-1">D</span></div>
                <div className="flex justify-between py-0.5"><span>Brush / Rubber:</span><span className="font-mono bg-gray-100 px-1">B / E</span></div>
                <div className="flex justify-between py-0.5"><span>Hand (Select & Move):</span><span className="font-mono bg-gray-100 px-1">H / M</span></div>
                <div className="flex justify-between py-0.5"><span>Select All Artwork:</span><span className="font-mono bg-gray-100 px-1">Ctrl+A</span></div>
                <div className="flex justify-between py-0.5"><span>Drop / Nudge Object:</span><span className="font-mono bg-gray-100 px-1">Enter / Arrows</span></div>
                <div className="flex justify-between py-0.5"><span>Onion Skin:</span><span className="font-mono bg-gray-100 px-1">O</span></div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="win-button px-5 py-1 font-bold"
                  onClick={() => {
                    soundFx.playClick();
                    setShortcutsDialogOpen(false);
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Start Menu */}
      {startMenuOpen && (
        <div
          id="start-menu"
          className="win-window absolute bottom-7 left-0 w-60 bg-[#c0c0c0] shadow-2xl flex flex-row z-50"
        >
          <div className="w-8 bg-gradient-to-t from-[#000080] to-[#1084d0] flex items-end justify-center pb-2 select-none">
            <span
              className="text-white font-bold text-sm tracking-widest uppercase transform -rotate-90 origin-bottom-left whitespace-nowrap mb-6 ml-5"
              style={{ textShadow: '1px 1px 2px #000' }}
            >
              Windows 95
            </span>
          </div>

          <div className="flex-1 py-1 flex flex-col text-xs">
            <div
              className="px-3 py-1.5 hover:bg-[#000080] hover:text-white cursor-pointer flex items-center gap-2.5 font-bold"
              onClick={() => {
                setStartMenuOpen(false);
                setNewCanvasDialogOpen(true);
              }}
            >
              <span className="text-base">📄</span>
              <span>New Blank Canvas...</span>
            </div>

            <div className="border-t border-[#808080] my-1"></div>

            <div
              className="px-3 py-1.5 hover:bg-[#000080] hover:text-white cursor-pointer flex items-center gap-2.5"
              onClick={() => {
                setStartMenuOpen(false);
                loadPreset('ball');
              }}
            >
              <span className="text-base">⚽</span>
              <span>Demo: Bouncing Ball</span>
            </div>

            <div
              className="px-3 py-1.5 hover:bg-[#000080] hover:text-white cursor-pointer flex items-center gap-2.5"
              onClick={() => {
                setStartMenuOpen(false);
                loadPreset('stickman');
              }}
            >
              <span className="text-base">🏃</span>
              <span>Demo: Stickman</span>
            </div>

            <div className="border-t border-[#808080] my-1"></div>

            <div
              className="px-3 py-1.5 hover:bg-[#000080] hover:text-white cursor-pointer flex items-center gap-2.5"
              onClick={() => {
                setStartMenuOpen(false);
                handleExportGif();
              }}
            >
              <span className="text-base">🎞</span>
              <span>Export GIF...</span>
            </div>

            <div
              className="px-3 py-1.5 hover:bg-[#000080] hover:text-white cursor-pointer flex items-center gap-2.5"
              onClick={() => {
                setStartMenuOpen(false);
                handleExportStandaloneHtml();
              }}
            >
              <span className="text-base">💾</span>
              <span>Standalone HTML...</span>
            </div>

            <div className="border-t border-[#808080] my-1"></div>

            <div
              className="px-3 py-1.5 hover:bg-[#000080] hover:text-white cursor-pointer flex items-center gap-2.5"
              onClick={() => {
                soundFx.isMuted = !soundFx.isMuted;
                setIsMuted(soundFx.isMuted);
                soundFx.playClick();
                setStartMenuOpen(false);
              }}
            >
              <span className="text-base">{isMuted ? '🔇' : '🔊'}</span>
              <span>Sound: {isMuted ? 'Muted' : 'On'}</span>
            </div>

            <div
              className="px-3 py-1.5 hover:bg-[#000080] hover:text-white cursor-pointer flex items-center gap-2.5"
              onClick={() => {
                setStartMenuOpen(false);
                setHelpDialogOpen(true);
              }}
            >
              <span className="text-base">❓</span>
              <span>Help & Tips...</span>
            </div>
          </div>
        </div>
      )}

      {/* Taskbar */}
      <div className="win-taskbar absolute bottom-0 left-0 right-0 h-7 bg-[#c0c0c0] border-t-2 border-white flex items-center justify-between px-1 z-40 select-none">
        <div className="flex items-center gap-1">
          <button
            id="start-btn"
            type="button"
            className={`win-button h-5.5 px-1.5 flex items-center gap-1 font-bold text-xs ${
              startMenuOpen ? 'active' : ''
            }`}
            onClick={() => {
              soundFx.playClick();
              setStartMenuOpen((o) => !o);
            }}
          >
            <div className="flex flex-col gap-0.5 w-3.5 h-3">
              <div className="flex gap-0.5 h-1.5">
                <span className="w-1.5 h-1.5 bg-[#e74c3c]"></span>
                <span className="w-1.5 h-1.5 bg-[#2ecc71]"></span>
              </div>
              <div className="flex gap-0.5 h-1.5">
                <span className="w-1.5 h-1.5 bg-[#3498db]"></span>
                <span className="w-1.5 h-1.5 bg-[#f1c40f]"></span>
              </div>
            </div>
            <span>Start</span>
          </button>

          <button
            type="button"
            className={`win-button h-5.5 px-2 flex items-center gap-1.5 text-xs max-w-48 truncate ${
              !isMinimized && isWindowActive ? 'active font-bold bg-[#e0e0e0]' : ''
            }`}
            onClick={() => {
              soundFx.playClick();
              if (isMinimized) {
                setIsMinimized(false);
                setIsWindowActive(true);
              } else if (isWindowActive) {
                setIsMinimized(true);
              } else {
                setIsWindowActive(true);
              }
            }}
          >
            <span>🎬</span>
            <span className="truncate">Flipbook Studio</span>
          </button>
        </div>

        <div className="win-inset px-2 py-0.5 h-5.5 flex items-center gap-2 bg-[#c0c0c0]">
          <button
            type="button"
            className="cursor-pointer text-xs focus:outline-none"
            onClick={() => {
              soundFx.isMuted = !soundFx.isMuted;
              setIsMuted(soundFx.isMuted);
              soundFx.playClick();
            }}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>

          <span className="font-mono text-xs font-semibold text-gray-800">
            {clockStr || '12:00 PM'}
          </span>
        </div>
      </div>
    </div>
  );
}
