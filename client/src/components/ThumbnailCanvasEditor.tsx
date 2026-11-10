import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Type,
  Square,
  Upload,
  Download,
  Trash2,
  Move,
  Layers,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import {
  BackgroundFitMode,
  CropFocus,
  computeBackgroundPlacement,
  recommendBackgroundFitMode,
} from '../utils/thumbnailFit';

type GradientPreset = 'none' | 'left-dark' | 'bottom-dark' | 'vignette' | 'red-dark';

export interface EditorTextLayer {
  id: string;
  kind: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  shadow: boolean;
  align: 'left' | 'center' | 'right';
  xPct: number;
  yPct: number;
}

export interface EditorShapeLayer {
  id: string;
  kind: 'shape';
  shape: 'rect' | 'pill' | 'circle';
  color: string;
  opacity: number;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
}

export interface EditorImageLayer {
  id: string;
  kind: 'image';
  label: string;
  img: HTMLImageElement;
  xPct: number;
  yPct: number;
  widthPct: number;
  opacity: number;
}

type EditorLayer = EditorTextLayer | EditorShapeLayer | EditorImageLayer;

interface ThumbnailCanvasEditorProps {
  backgroundDataUrl: string | null;
  sourceWidth?: number;
  sourceHeight?: number;
  suggestedHeadline?: string;
}

const FONT_OPTIONS = [
  { label: 'Plus Jakarta Sans', value: '"Plus Jakarta Sans", system-ui, sans-serif' },
  { label: 'Impact Bold', value: 'Impact, "Arial Black", sans-serif' },
  { label: 'Arial Black', value: '"Arial Black", Gadget, sans-serif' },
  { label: 'Georgia Serif', value: 'Georgia, serif' },
  { label: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
];

export const ThumbnailCanvasEditor: React.FC<ThumbnailCanvasEditorProps> = ({
  backgroundDataUrl,
  sourceWidth = 1280,
  sourceHeight = 720,
  suggestedHeadline,
}) => {
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  const [fitMode, setFitMode] = useState<BackgroundFitMode>('cover');
  const [cropFocus, setCropFocus] = useState<CropFocus>('center');
  const [gradientPreset, setGradientPreset] = useState<GradientPreset>('left-dark');
  const [gradientOpacity, setGradientOpacity] = useState<number>(0.65);

  const [layers, setLayers] = useState<EditorLayer[]>([
    {
      id: 'txt-default',
      kind: 'text',
      text: suggestedHeadline?.trim() ? suggestedHeadline.trim().toUpperCase() : 'BIG NEWS!',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      fontSize: 92,
      color: '#ffffff',
      strokeColor: '#09090b',
      strokeWidth: 10,
      shadow: true,
      align: 'left',
      xPct: 8,
      yPct: 58,
    },
  ]);
  const [selectedLayerId, setSelectedLayerId] = useState<string>('txt-default');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const draggingRef = useRef<{ layerId: string; offsetX: number; offsetY: number } | null>(null);
  const overlayFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!backgroundDataUrl) {
      setBgImg(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setBgImg(img);
      setFitMode(recommendBackgroundFitMode(img.naturalWidth, img.naturalHeight));
      setCropFocus('center');
    };
    img.src = backgroundDataUrl;
  }, [backgroundDataUrl]);

  const selectedLayer = layers.find((l) => l.id === selectedLayerId) || null;

  const updateLayer = (id: string, patch: Partial<EditorLayer>) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? ({ ...l, ...patch } as EditorLayer) : l))
    );
  };

  const renderToCanvas = useCallback(
    (canvas: HTMLCanvasElement, w = 1280, h = 720) => {
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 1. Background fill / cover or blurred-backdrop contain (never stretches aspect ratio)
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, w, h);

      if (bgImg && bgImg.naturalWidth > 0 && bgImg.naturalHeight > 0) {
        const placement = computeBackgroundPlacement(
          bgImg.naturalWidth,
          bgImg.naturalHeight,
          w,
          h,
          fitMode,
          cropFocus
        );
        if (placement.backdropRect) {
          ctx.save();
          ctx.filter = 'blur(28px) brightness(0.55)';
          const b = placement.backdropRect;
          ctx.drawImage(bgImg, b.x, b.y, b.width, b.height);
          ctx.restore();
        }
        const f = placement.foregroundRect;
        if (placement.fitMode === 'contain-blur') {
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.45)';
          ctx.shadowBlur = 32;
          ctx.drawImage(bgImg, f.x, f.y, f.width, f.height);
          ctx.restore();
        } else {
          ctx.drawImage(bgImg, f.x, f.y, f.width, f.height);
        }
      } else {
        const bgGrad = ctx.createLinearGradient(0, 0, w, h);
        bgGrad.addColorStop(0, '#18181b');
        bgGrad.addColorStop(1, '#09090b');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);
      }

      // 2. Contrast gradient overlay
      if (gradientPreset !== 'none' && gradientOpacity > 0) {
        ctx.save();
        if (gradientPreset === 'left-dark') {
          const g = ctx.createLinearGradient(0, 0, w * 0.72, 0);
          g.addColorStop(0, `rgba(9,9,11,${gradientOpacity})`);
          g.addColorStop(1, 'rgba(9,9,11,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        } else if (gradientPreset === 'bottom-dark') {
          const g = ctx.createLinearGradient(0, h, 0, h * 0.25);
          g.addColorStop(0, `rgba(9,9,11,${gradientOpacity})`);
          g.addColorStop(1, 'rgba(9,9,11,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        } else if (gradientPreset === 'red-dark') {
          const g = ctx.createLinearGradient(0, 0, w, h);
          g.addColorStop(0, `rgba(185,28,28,${gradientOpacity * 0.65})`);
          g.addColorStop(0.55, 'rgba(9,9,11,0.15)');
          g.addColorStop(1, `rgba(9,9,11,${gradientOpacity * 0.75})`);
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        } else if (gradientPreset === 'vignette') {
          const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.22, w / 2, h / 2, w * 0.68);
          g.addColorStop(0, 'rgba(9,9,11,0)');
          g.addColorStop(1, `rgba(9,9,11,${gradientOpacity})`);
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        }
        ctx.restore();
      }

      // 3. Draw layers in stacking order
      for (const layer of layers) {
        ctx.save();
        if (layer.kind === 'shape') {
          const x = (layer.xPct / 100) * w;
          const y = (layer.yPct / 100) * h;
          const sw = (layer.wPct / 100) * w;
          const sh = (layer.hPct / 100) * h;
          ctx.globalAlpha = layer.opacity;
          ctx.fillStyle = layer.color;

          if (layer.shape === 'circle') {
            ctx.beginPath();
            ctx.ellipse(x + sw / 2, y + sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2);
            ctx.fill();
          } else {
            const radius = layer.shape === 'pill' ? sh / 2 : 16;
            ctx.beginPath();
            ctx.roundRect(x, y, sw, sh, radius);
            ctx.fill();
          }
        } else if (layer.kind === 'image') {
          const x = (layer.xPct / 100) * w;
          const y = (layer.yPct / 100) * h;
          const iw = (layer.widthPct / 100) * w;
          const aspect = layer.img.naturalHeight / Math.max(1, layer.img.naturalWidth);
          const ih = iw * aspect;
          ctx.globalAlpha = layer.opacity;
          ctx.drawImage(layer.img, x, y, iw, ih);
        } else if (layer.kind === 'text') {
          const x = (layer.xPct / 100) * w;
          const y = (layer.yPct / 100) * h;
          ctx.font = `900 ${layer.fontSize}px ${layer.fontFamily}`;
          ctx.textBaseline = 'top';
          ctx.textAlign = layer.align;

          const lines = layer.text.split('\n');
          const lineHeight = layer.fontSize * 1.12;

          if (layer.shadow) {
            ctx.shadowColor = 'rgba(0,0,0,0.75)';
            ctx.shadowBlur = 18;
            ctx.shadowOffsetX = 4;
            ctx.shadowOffsetY = 6;
          }

          lines.forEach((line, idx) => {
            const ly = y + idx * lineHeight;
            if (layer.strokeWidth > 0) {
              ctx.lineWidth = layer.strokeWidth;
              ctx.strokeStyle = layer.strokeColor;
              ctx.lineJoin = 'round';
              ctx.strokeText(line, x, ly);
            }
            ctx.fillStyle = layer.color;
            ctx.fillText(line, x, ly);
          });
        }
        ctx.restore();
      }
    },
    [bgImg, fitMode, cropFocus, gradientPreset, gradientOpacity, layers]
  );

  useEffect(() => {
    if (canvasRef.current) {
      renderToCanvas(canvasRef.current, 1280, 720);
    }
  }, [renderToCanvas]);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedLayer) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const clickXPct = ((e.clientX - rect.left) / rect.width) * 100;
    const clickYPct = ((e.clientY - rect.top) / rect.height) * 100;
    draggingRef.current = {
      layerId: selectedLayer.id,
      offsetX: clickXPct - selectedLayer.xPct,
      offsetY: clickYPct - selectedLayer.yPct,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = draggingRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const xp = Math.max(-10, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100 - drag.offsetX));
    const yp = Math.max(-10, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100 - drag.offsetY));
    updateLayer(drag.layerId, { xPct: Math.round(xp * 10) / 10, yPct: Math.round(yp * 10) / 10 });
  };

  const handleCanvasPointerUp = () => {
    draggingRef.current = null;
  };

  const addTextLayer = () => {
    const id = `txt-${Date.now()}`;
    const newLayer: EditorTextLayer = {
      id,
      kind: 'text',
      text: 'NEW HEADLINE',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      fontSize: 72,
      color: '#facc15',
      strokeColor: '#09090b',
      strokeWidth: 8,
      shadow: true,
      align: 'left',
      xPct: 8,
      yPct: 30,
    };
    setLayers((prev) => [...prev, newLayer]);
    setSelectedLayerId(id);
  };

  const addShapeLayer = (shape: 'rect' | 'pill' | 'circle') => {
    const id = `shp-${Date.now()}`;
    const newLayer: EditorShapeLayer = {
      id,
      kind: 'shape',
      shape,
      color: '#dc2626',
      opacity: 0.9,
      xPct: 8,
      yPct: 48,
      wPct: shape === 'circle' ? 18 : 34,
      hPct: shape === 'circle' ? 32 : 12,
    };
    setLayers((prev) => [newLayer, ...prev]); // Place behind text by default
    setSelectedLayerId(id);
  };

  const handleUploadSubjectOrLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const id = `img-${Date.now()}`;
        const newLayer: EditorImageLayer = {
          id,
          kind: 'image',
          label: file.name,
          img,
          xPct: 62,
          yPct: 14,
          widthPct: 30,
          opacity: 1,
        };
        setLayers((prev) => [...prev, newLayer]);
        setSelectedLayerId(id);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleExport = (fmt: 'png' | 'jpeg') => {
    const exportCanvas = document.createElement('canvas');
    renderToCanvas(exportCanvas, 1280, 720);
    const mime = fmt === 'png' ? 'image/png' : 'image/jpeg';
    exportCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `linktwin-thumbnail-1280x720.${fmt === 'png' ? 'png' : 'jpg'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      mime,
      fmt === 'jpeg' ? 0.94 : undefined
    );
  };

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-6 space-y-5 border border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            Thumbnail Headline &amp; Layout Editor
          </h3>
          <p className="text-xs text-zinc-400">
            Preview and PNG/JPEG export share an identical 1280 &times; 720 (16:9) coordinate canvas with zero image stretching.
            {bgImg?.naturalWidth
              ? ` (Source: ${bgImg.naturalWidth}×${bgImg.naturalHeight})`
              : sourceWidth && sourceHeight
              ? ` (Source: ${sourceWidth}×${sourceHeight})`
              : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleExport('png')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export PNG (1280&times;720)
          </button>
          <button
            type="button"
            onClick={() => handleExport('jpeg')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold border border-zinc-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            JPEG
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Canvas Preview */}
        <div className="lg:col-span-7 space-y-3">
          <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
            <canvas
              ref={canvasRef}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerCancel={handleCanvasPointerUp}
              className="w-full h-auto aspect-video block cursor-move touch-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addTextLayer}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200"
            >
              <Type className="w-3.5 h-3.5 text-amber-400" /> + Add Text
            </button>
            <button
              type="button"
              onClick={() => addShapeLayer('pill')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200"
            >
              <Square className="w-3.5 h-3.5 text-red-400" /> + Badge Shape
            </button>
            <input
              ref={overlayFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleUploadSubjectOrLogo}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => overlayFileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200"
            >
              <Upload className="w-3.5 h-3.5 text-sky-400" /> + Upload Subject / Logo
            </button>
          </div>
        </div>

        {/* Layer Inspector */}
        <div className="lg:col-span-5 space-y-4">
          {/* Background Fit & Framing (never stretches aspect ratio) */}
          {bgImg && (
            <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300">Background Fit (1280&times;720)</span>
                <span className="font-mono text-zinc-500">
                  {bgImg.naturalWidth}&times;{bgImg.naturalHeight}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={fitMode}
                  onChange={(e) => setFitMode(e.target.value as BackgroundFitMode)}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200"
                >
                  <option value="cover">Crop to Fill (16:9)</option>
                  <option value="contain-blur">Fit Whole Image (Blur Backdrop)</option>
                </select>
                {fitMode === 'cover' ? (
                  <select
                    value={cropFocus}
                    onChange={(e) => setCropFocus(e.target.value as CropFocus)}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200"
                  >
                    <option value="top">Crop Focus: Top</option>
                    <option value="center">Crop Focus: Center</option>
                    <option value="bottom">Crop Focus: Bottom</option>
                  </select>
                ) : (
                  <div className="px-2.5 py-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800/70 text-[11px] text-zinc-400 flex items-center">
                    No crop &bull; Aspect locked
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contrast Gradient Scrim */}
          <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-300">Background Scrim Gradient</span>
              <span className="font-mono text-zinc-500">{Math.round(gradientOpacity * 100)}%</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={gradientPreset}
                onChange={(e) => setGradientPreset(e.target.value as GradientPreset)}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200"
              >
                <option value="left-dark">Left Dark Gradient</option>
                <option value="bottom-dark">Bottom Dark Gradient</option>
                <option value="vignette">Radial Vignette</option>
                <option value="red-dark">Red + Dark Split</option>
                <option value="none">None</option>
              </select>
              <input
                type="range"
                min={0}
                max={0.95}
                step={0.05}
                value={gradientOpacity}
                onChange={(e) => setGradientOpacity(Number(e.target.value))}
                className="accent-red-500"
              />
            </div>
          </div>

          {/* Layer Selector List */}
          <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
            <span className="text-xs font-semibold text-zinc-400 block">Layers ({layers.length})</span>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {layers.map((layer) => {
                const active = layer.id === selectedLayerId;
                const label =
                  layer.kind === 'text'
                    ? `Text: ${layer.text.slice(0, 20) || 'Empty'}`
                    : layer.kind === 'shape'
                    ? `Shape: ${layer.shape}`
                    : `Image: ${layer.label.slice(0, 18)}`;
                return (
                  <div
                    key={layer.id}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer ${
                      active
                        ? 'bg-zinc-800 text-white border border-zinc-700'
                        : 'text-zinc-400 hover:bg-zinc-900'
                    }`}
                    onClick={() => setSelectedLayerId(layer.id)}
                  >
                    <span className="truncate flex items-center gap-1.5">
                      <Move className="w-3 h-3 text-zinc-500 shrink-0" />
                      {label}
                    </span>
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setLayers((prev) => prev.filter((x) => x.id !== layer.id));
                      }}
                      className="text-zinc-500 hover:text-rose-400 p-0.5"
                      title="Delete layer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Layer Controls */}
          {selectedLayer && (
            <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3 text-xs">
              {selectedLayer.kind === 'text' && (
                <>
                  <div>
                    <label className="block text-zinc-400 mb-1">Headline Text (multiline supported)</label>
                    <textarea
                      rows={2}
                      value={selectedLayer.text}
                      onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-zinc-400 mb-1">Font</label>
                      <select
                        value={selectedLayer.fontFamily}
                        onChange={(e) => updateLayer(selectedLayer.id, { fontFamily: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200"
                      >
                        {FONT_OPTIONS.map((f) => (
                          <option key={f.label} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1">Size ({selectedLayer.fontSize}px)</label>
                      <input
                        type="range"
                        min={24}
                        max={160}
                        value={selectedLayer.fontSize}
                        onChange={(e) => updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) })}
                        className="w-full accent-red-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <div>
                      <label className="block text-zinc-400 mb-1">Fill</label>
                      <input
                        type="color"
                        value={selectedLayer.color}
                        onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })}
                        className="w-full h-8 rounded bg-zinc-900 border border-zinc-800 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1">Outline</label>
                      <input
                        type="color"
                        value={selectedLayer.strokeColor}
                        onChange={(e) => updateLayer(selectedLayer.id, { strokeColor: e.target.value })}
                        className="w-full h-8 rounded bg-zinc-900 border border-zinc-800 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1">Align</label>
                      <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                        {(
                          [
                            ['left', <AlignLeft className="w-3.5 h-3.5" />],
                            ['center', <AlignCenter className="w-3.5 h-3.5" />],
                            ['right', <AlignRight className="w-3.5 h-3.5" />],
                          ] as const
                        ).map(([al, icon]) => (
                          <button
                            key={al}
                            type="button"
                            onClick={() => updateLayer(selectedLayer.id, { align: al })}
                            className={`flex-1 flex justify-center py-1 rounded ${
                              selectedLayer.align === al ? 'bg-zinc-700 text-white' : 'text-zinc-400'
                            }`}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 items-center">
                    <div>
                      <label className="block text-zinc-400 mb-1">
                        Outline Width ({selectedLayer.strokeWidth}px)
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={24}
                        value={selectedLayer.strokeWidth}
                        onChange={(e) =>
                          updateLayer(selectedLayer.id, { strokeWidth: Number(e.target.value) })
                        }
                        className="w-full accent-red-500"
                      />
                    </div>
                    <label className="inline-flex items-center gap-2 text-zinc-300 cursor-pointer pt-4">
                      <input
                        type="checkbox"
                        checked={selectedLayer.shadow}
                        onChange={(e) => updateLayer(selectedLayer.id, { shadow: e.target.checked })}
                        className="rounded border-zinc-700 bg-zinc-900 text-red-500"
                      />
                      Drop Shadow
                    </label>
                  </div>
                </>
              )}

              {selectedLayer.kind === 'shape' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={selectedLayer.shape}
                      onChange={(e) =>
                        updateLayer(selectedLayer.id, { shape: e.target.value as 'rect' | 'pill' | 'circle' })
                      }
                      className="px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200"
                    >
                      <option value="rect">Rectangle</option>
                      <option value="pill">Pill</option>
                      <option value="circle">Circle</option>
                    </select>
                    <input
                      type="color"
                      value={selectedLayer.color}
                      onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })}
                      className="w-full h-8 rounded bg-zinc-900 border border-zinc-800 cursor-pointer"
                    />
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={selectedLayer.opacity}
                      onChange={(e) => updateLayer(selectedLayer.id, { opacity: Number(e.target.value) })}
                      className="accent-red-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-zinc-400">Width ({selectedLayer.wPct}%)</label>
                      <input
                        type="range"
                        min={5}
                        max={95}
                        value={selectedLayer.wPct}
                        onChange={(e) => updateLayer(selectedLayer.id, { wPct: Number(e.target.value) })}
                        className="w-full accent-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400">Height ({selectedLayer.hPct}%)</label>
                      <input
                        type="range"
                        min={5}
                        max={95}
                        value={selectedLayer.hPct}
                        onChange={(e) => updateLayer(selectedLayer.id, { hPct: Number(e.target.value) })}
                        className="w-full accent-red-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {selectedLayer.kind === 'image' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-zinc-400 mb-1">Width ({selectedLayer.widthPct}%)</label>
                    <input
                      type="range"
                      min={5}
                      max={95}
                      value={selectedLayer.widthPct}
                      onChange={(e) => updateLayer(selectedLayer.id, { widthPct: Number(e.target.value) })}
                      className="w-full accent-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">
                      Opacity ({Math.round(selectedLayer.opacity * 100)}%)
                    </label>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={selectedLayer.opacity}
                      onChange={(e) => updateLayer(selectedLayer.id, { opacity: Number(e.target.value) })}
                      className="w-full accent-red-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
