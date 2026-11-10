import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Download,
  Copy,
  Check,
  Upload,
  Link as LinkIcon,
  Loader2,
  Type,
  Square,
  Plus,
  Trash2,
  Eye,
  AlertCircle,
  Move,
} from 'lucide-react';
import { Platform } from '../../types';
import { PlatformIcon, getPlatformMeta } from '../PlatformIcon';
import { readFileHeaderHex, triggerBlobDownload } from '../../utils/fileHelpers';

type ThumbFormat = 'jpg' | 'png' | 'webp';
type ThumbRes = '1280x720' | '640x480' | '480x360' | 'original';

interface TextOverlay {
  id: string;
  text: string;
  fontSize: number;
  color: string;
  xPct: number;
  yPct: number;
  shadow: boolean;
}

interface ShapeOverlay {
  id: string;
  kind: 'rect' | 'pill' | 'circle';
  color: string;
  opacity: number;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
}

interface ThumbnailInspectResponse {
  platform: Platform;
  contentId?: string;
  cleanUrl: string;
  metadata: { title: string; authorName: string; thumbnailUrl: string };
  thumbnailInfo: { proxyUrl: string; originalUrl: string; youtubeVideoId?: string };
  permittedAssets: Array<{
    id: string;
    label: string;
    format: string;
    resolution: string;
    downloadUrl: string;
    filename: string;
  }>;
  publicAccessNote?: string;
}

const RES_OPTIONS: Array<{ id: ThumbRes; label: string; w: number | null; h: number | null }> = [
  { id: '1280x720', label: '1280 × 720', w: 1280, h: 720 },
  { id: '640x480', label: '640 × 480', w: 640, h: 480 },
  { id: '480x360', label: '480 × 360', w: 480, h: 360 },
  { id: 'original', label: 'Original', w: null, h: null },
];

export const ThumbnailStudioTab: React.FC<{ initialUrl?: string }> = ({ initialUrl }) => {
  const [url, setUrl] = useState(initialUrl || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspectData, setInspectData] = useState<ThumbnailInspectResponse | null>(null);

  // Source image
  const [uploadedSrc, setUploadedSrc] = useState<string | null>(null);
  const [uploadedBaseName, setUploadedBaseName] = useState('custom-thumbnail');
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);

  // Export settings
  const [format, setFormat] = useState<ThumbFormat>('jpg');
  const [resolution, setResolution] = useState<ThumbRes>('1280x720');
  const [compareBefore, setCompareBefore] = useState(false);

  // Editor transforms & overlays
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [textLayers, setTextLayers] = useState<TextOverlay[]>([]);
  const [shapeLayers, setShapeLayers] = useState<ShapeOverlay[]>([]);

  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeImageSrc = uploadedSrc || inspectData?.thumbnailInfo.proxyUrl || null;

  useEffect(() => {
    if (initialUrl) {
      setUrl(initialUrl);
      fetchFromUrl(initialUrl);
    }
  }, [initialUrl]);

  useEffect(() => {
    if (!activeImageSrc) {
      setLoadedImg(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setLoadedImg(img);
    img.onerror = () => setError('Could not load image into Thumbnail Editor.');
    img.src = activeImageSrc;
  }, [activeImageSrc]);

  const drawCanvas = useCallback(
    (targetCanvas: HTMLCanvasElement, targetW: number, targetH: number, includeOverlays: boolean) => {
      if (!loadedImg) return;
      targetCanvas.width = targetW;
      targetCanvas.height = targetH;
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, targetW, targetH);

      // Cover scaling + user zoom & pan
      const srcRatio = loadedImg.naturalWidth / loadedImg.naturalHeight;
      const dstRatio = targetW / targetH;
      let baseW = targetW;
      let baseH = targetH;
      if (srcRatio > dstRatio) {
        baseW = targetH * srcRatio;
      } else {
        baseH = targetW / srcRatio;
      }

      const activeZoom = includeOverlays ? zoom : 1;
      const drawW = baseW * activeZoom;
      const drawH = baseH * activeZoom;
      const offsetX = (targetW - drawW) / 2 + (includeOverlays ? (panX / 100) * targetW : 0);
      const offsetY = (targetH - drawH) / 2 + (includeOverlays ? (panY / 100) * targetH : 0);

      ctx.drawImage(loadedImg, offsetX, offsetY, drawW, drawH);

      if (!includeOverlays) return;

      // Render Shapes
      for (const s of shapeLayers) {
        ctx.save();
        ctx.globalAlpha = s.opacity;
        ctx.fillStyle = s.color;
        const x = (s.xPct / 100) * targetW;
        const y = (s.yPct / 100) * targetH;
        const w = (s.wPct / 100) * targetW;
        const h = (s.hPct / 100) * targetH;

        if (s.kind === 'circle') {
          ctx.beginPath();
          ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (s.kind === 'pill') {
          const r = Math.min(w, h) / 2;
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, r);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, w, h);
        }
        ctx.restore();
      }

      // Render Text Overlays
      for (const t of textLayers) {
        ctx.save();
        const scaledFont = Math.round((t.fontSize / 720) * targetH);
        ctx.font = `800 ${scaledFont}px "Plus Jakarta Sans", system-ui, sans-serif`;
        ctx.fillStyle = t.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const tx = (t.xPct / 100) * targetW;
        const ty = (t.yPct / 100) * targetH;
        if (t.shadow) {
          ctx.shadowColor = 'rgba(0,0,0,0.85)';
          ctx.shadowBlur = Math.max(6, scaledFont * 0.15);
          ctx.lineWidth = Math.max(3, scaledFont * 0.08);
          ctx.strokeStyle = '#000000';
          ctx.strokeText(t.text, tx, ty);
        }
        ctx.fillText(t.text, tx, ty);
        ctx.restore();
      }
    },
    [loadedImg, zoom, panX, panY, textLayers, shapeLayers]
  );

  // Update live preview canvas whenever dependencies change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImg) return;
    const resMeta = RES_OPTIONS.find((r) => r.id === resolution);
    const targetW = resMeta?.w || loadedImg.naturalWidth || 1280;
    const targetH = resMeta?.h || loadedImg.naturalHeight || 720;
    drawCanvas(canvas, targetW, targetH, !compareBefore);
  }, [loadedImg, resolution, compareBefore, drawCanvas]);

  const fetchFromUrl = async (targetUrl: string) => {
    if (!targetUrl.trim()) {
      setError('Please paste a YouTube, Instagram, or Facebook URL.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/media/thumbnail/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to inspect URL');
      setInspectData(data);
      setUploadedSrc(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    setError(null);
    try {
      const hex = await readFileHeaderHex(file, 16);
      const valRes = await fetch('/api/jobs/validate-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mime: file.type || 'image/jpeg',
          headerHex: hex,
          category: 'image',
        }),
      });
      const valData = await valRes.json();
      if (!valRes.ok || !valData.valid) {
        throw new Error(valData?.error || 'Invalid image file signature.');
      }

      if (uploadedSrc && uploadedSrc.startsWith('blob:')) URL.revokeObjectURL(uploadedSrc);
      setUploadedBaseName(
        file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_\-]+/g, '-').toLowerCase()
      );
      setUploadedSrc(URL.createObjectURL(file));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getAutoFilename = () => {
    const base = uploadedSrc
      ? uploadedBaseName
      : inspectData
      ? `${inspectData.platform}-${(inspectData.contentId || 'thumb').replace(/[^a-zA-Z0-9_\-]+/g, '-')}`
      : 'thumbnail';
    return `${base}-${resolution}.${format}`;
  };

  const exportBlob = (mime: 'image/jpeg' | 'image/png' | 'image/webp'): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!loadedImg) {
        reject(new Error('No image loaded'));
        return;
      }
      const resMeta = RES_OPTIONS.find((r) => r.id === resolution);
      const targetW = resMeta?.w || loadedImg.naturalWidth || 1280;
      const targetH = resMeta?.h || loadedImg.naturalHeight || 720;

      const offscreen = document.createElement('canvas');
      drawCanvas(offscreen, targetW, targetH, true);
      offscreen.toBlob(
        (blob) => {
          if (!blob) reject(new Error('Failed to encode thumbnail'));
          else resolve(blob);
        },
        mime,
        0.92
      );
    });
  };

  const handleDownload = async () => {
    setExporting(true);
    setError(null);
    try {
      const mimeMap: Record<ThumbFormat, 'image/jpeg' | 'image/png' | 'image/webp'> = {
        jpg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
      };
      const blob = await exportBlob(mimeMap[format]);
      triggerBlobDownload(blob, getAutoFilename());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = async () => {
    setError(null);
    try {
      if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
        throw new Error('Image clipboard copy is not supported in this browser.');
      }
      const pngBlob = await exportBlob('image/png');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Clipboard permission denied.');
    }
  };

  const addTextLayer = () => {
    setTextLayers((prev) => [
      ...prev,
      {
        id: `txt_${Date.now()}`,
        text: 'WATCH NOW',
        fontSize: 72,
        color: '#ffffff',
        xPct: 50,
        yPct: 50,
        shadow: true,
      },
    ]);
  };

  const addShapeLayer = (kind: 'rect' | 'pill' | 'circle') => {
    setShapeLayers((prev) => [
      ...prev,
      {
        id: `shp_${Date.now()}`,
        kind,
        color: '#ef4444',
        opacity: 0.9,
        xPct: 35,
        yPct: 72,
        wPct: 30,
        hPct: 14,
      },
    ]);
  };

  const platformMeta = inspectData ? getPlatformMeta(inspectData.platform) : null;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Input Row: URL Fetch + Local Upload */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchFromUrl(url);
          }}
          className="lg:col-span-8 flex flex-col sm:flex-row gap-2.5"
        >
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
              <LinkIcon className="w-4 h-4 text-emerald-400" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste YouTube, Instagram, or Facebook URL..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>Fetch Thumbnail</span>
          </button>
        </form>

        <div className="lg:col-span-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-full py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-dashed border-zinc-700 text-xs sm:text-sm font-semibold text-zinc-200 flex items-center justify-center gap-2 transition"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Upload Own Image</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Existing Official YouTube Direct Downloads Bar */}
      {inspectData && platformMeta && (
        <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <PlatformIcon platform={inspectData.platform} className={`w-5 h-5 ${platformMeta.iconColor}`} />
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate max-w-md">{inspectData.metadata.title}</p>
              <p className="text-[11px] text-zinc-400">{inspectData.publicAccessNote}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {inspectData.permittedAssets.map((asset) => (
              <a
                key={asset.id}
                href={asset.downloadUrl}
                download={asset.filename}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[11px] font-semibold text-white transition"
              >
                <Download className="w-3 h-3 text-emerald-400" />
                <span>{asset.resolution}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Canvas Thumbnail Editor */}
      {loadedImg ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Canvas Preview */}
          <div className="lg:col-span-7 space-y-3">
            <div className="relative rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl">
              <canvas ref={canvasRef} className="w-full h-auto block" />
              <button
                type="button"
                onClick={() => setCompareBefore(!compareBefore)}
                className={`absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 backdrop-blur-md border transition ${
                  compareBefore
                    ? 'bg-amber-500/80 border-amber-400 text-black'
                    : 'bg-black/70 border-zinc-700 text-white hover:bg-black/90'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{compareBefore ? 'Viewing Original' : 'Compare Original'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 px-1">
              <span>
                Source: <strong className="text-zinc-200 font-mono">{loadedImg.naturalWidth}×{loadedImg.naturalHeight}</strong>
              </span>
              <span>
                Filename: <strong className="text-emerald-400 font-mono">{getAutoFilename()}</strong>
              </span>
            </div>
          </div>

          {/* Editor Controls */}
          <div className="lg:col-span-5 space-y-4 p-4 sm:p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 h-fit">
            {/* Reposition & Zoom */}
            <div className="space-y-2 pb-3 border-b border-zinc-800">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5 text-emerald-400" />
                  Crop &amp; Position
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setPanX(0);
                    setPanY(0);
                  }}
                  className="text-[11px] text-zinc-400 hover:text-white"
                >
                  Reset
                </button>
              </div>
              <div className="space-y-1.5 text-[11px] text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="w-12">Zoom:</span>
                  <input
                    type="range"
                    min={1}
                    max={2.5}
                    step={0.05}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 accent-emerald-500"
                  />
                  <span className="w-10 text-right font-mono">{zoom.toFixed(2)}x</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-12">Pan X:</span>
                  <input
                    type="range"
                    min={-40}
                    max={40}
                    value={panX}
                    onChange={(e) => setPanX(Number(e.target.value))}
                    className="flex-1 accent-emerald-500"
                  />
                  <span className="w-10 text-right font-mono">{panX}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-12">Pan Y:</span>
                  <input
                    type="range"
                    min={-40}
                    max={40}
                    value={panY}
                    onChange={(e) => setPanY(Number(e.target.value))}
                    className="flex-1 accent-emerald-500"
                  />
                  <span className="w-10 text-right font-mono">{panY}%</span>
                </div>
              </div>
            </div>

            {/* Overlays: Text & Shapes */}
            <div className="space-y-2.5 pb-3 border-b border-zinc-800">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addTextLayer}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white"
                >
                  <Type className="w-3.5 h-3.5 text-emerald-400" />
                  <Plus className="w-3 h-3" /> Add Text
                </button>
                <button
                  type="button"
                  onClick={() => addShapeLayer('pill')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white"
                >
                  <Square className="w-3.5 h-3.5 text-red-400" />
                  <Plus className="w-3 h-3" /> Badge Shape
                </button>
              </div>

              {shapeLayers.map((s) => (
                <div key={s.id} className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-300 uppercase">Shape ({s.kind})</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={s.kind}
                        onChange={(e) =>
                          setShapeLayers((prev) =>
                            prev.map((x) => (x.id === s.id ? { ...x, kind: e.target.value as any } : x))
                          )
                        }
                        className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-white"
                      >
                        <option value="pill">Pill</option>
                        <option value="rect">Rectangle</option>
                        <option value="circle">Circle</option>
                      </select>
                      <input
                        type="color"
                        value={s.color}
                        onChange={(e) =>
                          setShapeLayers((prev) =>
                            prev.map((x) => (x.id === s.id ? { ...x, color: e.target.value } : x))
                          )
                        }
                        className="w-5 h-5 bg-transparent cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => setShapeLayers((prev) => prev.filter((x) => x.id !== s.id))}
                        className="text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="range"
                      min={0}
                      max={85}
                      value={s.xPct}
                      onChange={(e) =>
                        setShapeLayers((prev) =>
                          prev.map((x) => (x.id === s.id ? { ...x, xPct: Number(e.target.value) } : x))
                        )
                      }
                      title="X Position"
                    />
                    <input
                      type="range"
                      min={0}
                      max={85}
                      value={s.yPct}
                      onChange={(e) =>
                        setShapeLayers((prev) =>
                          prev.map((x) => (x.id === s.id ? { ...x, yPct: Number(e.target.value) } : x))
                        )
                      }
                      title="Y Position"
                    />
                  </div>
                </div>
              ))}

              {textLayers.map((t) => (
                <div key={t.id} className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={t.text}
                      onChange={(e) =>
                        setTextLayers((prev) =>
                          prev.map((x) => (x.id === t.id ? { ...x, text: e.target.value } : x))
                        )
                      }
                      className="flex-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-white"
                    />
                    <input
                      type="color"
                      value={t.color}
                      onChange={(e) =>
                        setTextLayers((prev) =>
                          prev.map((x) => (x.id === t.id ? { ...x, color: e.target.value } : x))
                        )
                      }
                      className="w-5 h-5 bg-transparent cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => setTextLayers((prev) => prev.filter((x) => x.id !== t.id))}
                      className="text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="range"
                      min={24}
                      max={120}
                      value={t.fontSize}
                      onChange={(e) =>
                        setTextLayers((prev) =>
                          prev.map((x) => (x.id === t.id ? { ...x, fontSize: Number(e.target.value) } : x))
                        )
                      }
                      title="Font Size"
                    />
                    <input
                      type="range"
                      min={5}
                      max={95}
                      value={t.xPct}
                      onChange={(e) =>
                        setTextLayers((prev) =>
                          prev.map((x) => (x.id === t.id ? { ...x, xPct: Number(e.target.value) } : x))
                        )
                      }
                      title="X Position"
                    />
                    <input
                      type="range"
                      min={5}
                      max={95}
                      value={t.yPct}
                      onChange={(e) =>
                        setTextLayers((prev) =>
                          prev.map((x) => (x.id === t.id ? { ...x, yPct: Number(e.target.value) } : x))
                        )
                      }
                      title="Y Position"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Export Resolution & Format */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-zinc-400 mb-1.5">Format</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['jpg', 'png', 'webp'] as ThumbFormat[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      className={`py-1.5 rounded text-xs font-bold uppercase border ${
                        format === f
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-zinc-400 mb-1.5">Resolution</label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as ThumbRes)}
                  className="w-full py-1.5 px-2.5 rounded bg-zinc-950 border border-zinc-800 text-xs text-white"
                >
                  {RES_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Download & Copy */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleDownload}
                disabled={exporting}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold transition disabled:opacity-50"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Download {format.toUpperCase()}</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs sm:text-sm font-semibold border border-zinc-700 transition"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Image</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-10 text-center text-xs sm:text-sm text-zinc-500 bg-zinc-900/40 rounded-xl border border-zinc-800/60">
          Fetch a YouTube, Instagram, or Facebook thumbnail above, or upload your own image to launch the Thumbnail Editor.
        </div>
      )}
    </div>
  );
};
