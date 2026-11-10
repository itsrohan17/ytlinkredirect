import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Loader2,
  AlertCircle,
  Download,
  RefreshCw,
  Shuffle,
  Sliders,
  Info,
} from 'lucide-react';
import {
  AiConfigResponse,
  AiGeneratedImage,
  FluxResolutionId,
  ThumbnailStylePreset,
} from '../types';
import { ThumbnailCanvasEditor } from './ThumbnailCanvasEditor';

interface AiThumbnailGeneratorProps {
  initialTopic?: string;
}

const PRESET_LABELS: Array<{ id: ThumbnailStylePreset; label: string }> = [
  { id: 'gaming', label: 'Gaming' },
  { id: 'tech', label: 'Tech' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'documentary', label: 'Documentary' },
  { id: 'reaction', label: 'Reaction' },
  { id: 'tutorial', label: 'Tutorial' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'none', label: 'Custom / None' },
];

export const AiThumbnailGenerator: React.FC<AiThumbnailGeneratorProps> = ({ initialTopic }) => {
  const [config, setConfig] = useState<AiConfigResponse | null>(null);
  const [topic, setTopic] = useState(initialTopic || '');
  const [prompt, setPrompt] = useState('');
  const [preset, setPreset] = useState<ThumbnailStylePreset>('tech');
  const [resolution, setResolution] = useState<FluxResolutionId>('1344x768');
  const [steps, setSteps] = useState<number>(28);
  const [cfgScale, setCfgScale] = useState<number>(3.5);
  const [seedInput, setSeedInput] = useState<string>('0');

  const [generating, setGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<AiGeneratedImage | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    if (initialTopic) setTopic(initialTopic);
  }, [initialTopic]);

  useEffect(() => {
    fetch('/api/ai/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.success) setConfig(data as AiConfigResponse);
      })
      .catch(() => {});
  }, []);

  const runGeneration = async (overrideSeed?: number) => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || cleanPrompt.length < 3) {
      setError('Describe the scene you want for your thumbnail background (at least 3 characters).');
      return;
    }

    const parsedSeed =
      overrideSeed !== undefined ? overrideSeed : Math.max(0, Math.round(Number(seedInput || 0)));

    setGenerating(true);
    setError(null);
    setStatusMessage(
      `Generating artwork with ${config?.model || 'black-forest-labs/flux.1-dev'}...`
    );

    try {
      const res = await fetch('/api/ai/thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          prompt: cleanPrompt,
          preset,
          resolution,
          steps,
          cfgScale,
          seed: parsedSeed,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || 'AI thumbnail generation failed.');
        setStatusMessage('');
        return;
      }

      setGenerated({
        model: json.model,
        seed: json.seed,
        width: json.width,
        height: json.height,
        mimeType: json.mimeType,
        dataUrl: json.dataUrl,
      });
      setStatusMessage(
        `Ready · ${json.width}×${json.height} · Seed ${json.seed}`
      );
      setEditorOpen(true);
    } catch {
      setError('Network error communicating with NVIDIA generation API.');
      setStatusMessage('');
    } finally {
      setGenerating(false);
    }
  };

  const downloadRawConverted = async (targetFormat: 'png' | 'jpeg') => {
    if (!generated) return;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to decode generated image.'));
      el.src = generated.dataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || generated.width;
    canvas.height = img.naturalHeight || generated.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);

    const mime = targetFormat === 'png' ? 'image/png' : 'image/jpeg';
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flux-thumbnail-${generated.seed}.${targetFormat === 'png' ? 'png' : 'jpg'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      mime,
      targetFormat === 'jpeg' ? 0.94 : undefined
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          AI YouTube Thumbnail Generator
        </h1>
        <p className="text-sm text-zinc-400">
          Generate custom thumbnail backgrounds via NVIDIA FLUX.1-dev, then frame, caption, and export cleanly at 1280&times;720 (16:9).
        </p>
      </div>

      {config && !config.configured && (
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <span>
            <strong>AI Service Not Configured:</strong> Configure the server image-generation API credential to enable live FLUX.1-dev generation. You can still use the headline &amp; layout editor below.
          </span>
        </div>
      )}

      {/* Generator Controls Card */}
      <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Prompts */}
          <div className="lg:col-span-7 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Video Topic or Title (Used for context &amp; Canvas headline)
              </label>
              <input
                type="text"
                maxLength={200}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. I Built a Custom Mini ITX PC in 24 Hours"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500/70"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Detailed Background Prompt
              </label>
              <textarea
                rows={4}
                maxLength={1500}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the background subject, lighting, mood, and open space for headline text..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500/70"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">
                Style Preset
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_LABELS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPreset(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      preset === p.id
                        ? 'bg-red-600/20 border-red-500 text-red-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Model Settings */}
          <div className="lg:col-span-5 p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-red-400" />
                FLUX.1-dev Parameters
              </span>
              <span className="font-mono text-[11px] text-zinc-500 truncate max-w-[160px]">
                {config?.model || 'black-forest-labs/flux.1-dev'}
              </span>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Aspect Ratio &amp; Resolution</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as FluxResolutionId)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100"
              >
                {(
                  config?.resolutions || [
                    { id: '1344x768', label: '1344 × 768 (7:4 Widescreen · fits 1280×720)' },
                    { id: '1280x768', label: '1280 × 768 (5:3 Landscape)' },
                    { id: '1216x832', label: '1216 × 832 (3:2 Landscape)' },
                    { id: '1024x1024', label: '1024 × 1024 (1:1 Square)' },
                    { id: '768x1344', label: '768 × 1344 (4:7 Vertical)' },
                  ]
                ).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Inference Steps ({steps})
                </label>
                <input
                  type="range"
                  min={5}
                  max={50}
                  value={steps}
                  onChange={(e) => setSteps(Number(e.target.value))}
                  className="w-full accent-red-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  CFG Scale ({cfgScale})
                </label>
                <input
                  type="range"
                  min={1}
                  max={9}
                  step={0.5}
                  value={cfgScale}
                  onChange={(e) => setCfgScale(Number(e.target.value))}
                  className="w-full accent-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Seed (0 = random per request)
              </label>
              <input
                type="number"
                min={0}
                max={4294967295}
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-100"
              />
            </div>

            <button
              type="button"
              onClick={() => runGeneration()}
              disabled={generating}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors disabled:opacity-60"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {generating ? 'Generating Artwork...' : 'Generate Thumbnail'}
            </button>

            <p className="text-[11px] text-zinc-500">
              Single image per API request. Click New Variation after generation to run a fresh seed.
            </p>
          </div>
        </div>

        {statusMessage && !error && (
          <div className="text-xs text-emerald-400 font-mono">{statusMessage}</div>
        )}

        {error && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Generated Artwork Preview + Actions */}
      {generated && (
        <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white">Generated Background Artwork</h2>
              <p className="text-xs text-zinc-400 font-mono">
                {generated.model} &bull; {generated.width}&times;{generated.height} &bull; Seed {generated.seed}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => runGeneration(0)}
                disabled={generating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-zinc-100"
              >
                <Shuffle className="w-3.5 h-3.5 text-sky-400" />
                New Variation
              </button>
              <button
                type="button"
                onClick={() => runGeneration(generated.seed)}
                disabled={generating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-zinc-100"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                Regenerate
              </button>
              <button
                type="button"
                onClick={() => downloadRawConverted('png')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold"
              >
                <Download className="w-3.5 h-3.5" />
                PNG
              </button>
              <button
                type="button"
                onClick={() => downloadRawConverted('jpeg')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-zinc-100"
              >
                <Download className="w-3.5 h-3.5" />
                JPEG
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 max-w-2xl">
              <img
                src={generated.dataUrl}
                alt="Generated FLUX thumbnail background"
                className="w-full h-auto block"
              />
            </div>
            <p className="text-[11px] text-zinc-500">
              Native {generated.width}&times;{generated.height} preview (aspect preserved). Use the 1280&times;720 editor below to crop or fit with blur backdrop and add headlines.
            </p>
          </div>
        </div>
      )}

      {/* Lightweight Canvas Editor (can be used after AI generation or toggled manually) */}
      {(generated || editorOpen) ? (
        <ThumbnailCanvasEditor
          backgroundDataUrl={generated?.dataUrl || null}
          sourceWidth={generated?.width}
          sourceHeight={generated?.height}
          suggestedHeadline={topic}
        />
      ) : (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            className="text-xs text-zinc-500 hover:text-zinc-300 underline"
          >
            Open Headline &amp; Canvas Editor without generating an image first
          </button>
        </div>
      )}
    </div>
  );
};
