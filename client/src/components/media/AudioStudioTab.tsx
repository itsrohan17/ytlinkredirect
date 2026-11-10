import React, { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import {
  Music,
  Upload,
  Download,
  Archive,
  Scissors,
  Sliders,
  Loader2,
  AlertCircle,
  Trash2,
  Cpu,
} from 'lucide-react';
import {
  formatBytes,
  formatDuration,
  getSafeBrowserWasmLimitMb,
  readFileHeaderHex,
  triggerBlobDownload,
} from '../../utils/fileHelpers';
import { fetchFile, getFfmpeg, resetFfmpeg } from '../../utils/ffmpegClient';

type AudioOutputFormat = 'mp3' | 'wav' | 'aac' | 'flac' | 'ogg';

interface AudioItem {
  id: string;
  file: File;
  headerHex: string;
  previewUrl: string;
  duration: number;
  peaks: number[];
  outputBlob?: Blob;
  outputFilename?: string;
}

export const AudioStudioTab: React.FC = () => {
  const [items, setItems] = useState<AudioItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings
  const [outputFormat, setOutputFormat] = useState<AudioOutputFormat>('mp3');
  const [bitrate, setBitrate] = useState<'96k' | '128k' | '192k' | '256k' | '320k'>('192k');
  const [sampleRate, setSampleRate] = useState<'22050' | '44100' | '48000'>('44100');
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [realProgress, setRealProgress] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const safeLimitMb = getSafeBrowserWasmLimitMb();
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedItem = items.find((i) => i.id === selectedId) || items[0] || null;

  const decodePeaks = async (file: File): Promise<{ duration: number; peaks: number[] }> => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const buf = await file.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(buf);
      const raw = audioBuffer.getChannelData(0);
      const samples = 90;
      const blockSize = Math.max(1, Math.floor(raw.length / samples));
      const peaks: number[] = [];
      for (let i = 0; i < samples; i++) {
        let sum = 0;
        const start = i * blockSize;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(raw[start + j] || 0);
        }
        peaks.push(Math.min(1, (sum / blockSize) * 2.5));
      }
      await ctx.close();
      return { duration: audioBuffer.duration, peaks };
    } catch {
      return { duration: 0, peaks: [] };
    }
  };

  // Draw waveform + trim highlight
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || !selectedItem) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = (canvas.width = 640);
    const h = (canvas.height = 110);
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, w, h);

    const peaks = selectedItem.peaks.length > 0 ? selectedItem.peaks : Array(90).fill(0.2);
    const barW = w / peaks.length;
    const dur = selectedItem.duration || 1;
    const startRatio = trimStart / dur;
    const endRatio = trimEnd > trimStart ? trimEnd / dur : 1;

    peaks.forEach((p, idx) => {
      const pos = idx / peaks.length;
      const inRange = pos >= startRatio && pos <= endRatio;
      ctx.fillStyle = inRange ? '#10b981' : '#3f3f46';
      const barH = Math.max(6, p * (h - 18));
      const x = idx * barW + 1;
      const y = (h - barH) / 2;
      ctx.fillRect(x, y, Math.max(2, barW - 2), barH);
    });
  }, [selectedItem, trimStart, trimEnd]);

  const handleFilesAdded = async (fileList: FileList | File[]) => {
    setError(null);
    const files = Array.from(fileList);
    const added: AudioItem[] = [];

    for (const file of files) {
      try {
        const hex = await readFileHeaderHex(file, 16);
        const isVideoSource = (file.type || '').startsWith('video/');
        const valRes = await fetch('/api/jobs/validate-signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mime: file.type || 'audio/mpeg',
            headerHex: hex,
            category: isVideoSource ? 'video' : 'audio',
          }),
        });
        const valData = await valRes.json();
        if (!valRes.ok || !valData.valid) {
          throw new Error(`${file.name}: ${valData?.error || 'Unsupported audio/video signature'}`);
        }

        if (file.size > safeLimitMb * 1024 * 1024) {
          throw new Error(
            `${file.name} (${formatBytes(file.size)}) exceeds safe browser limit (${safeLimitMb} MB).`
          );
        }

        const previewUrl = URL.createObjectURL(file);
        const { duration, peaks } = await decodePeaks(file);

        added.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          file,
          headerHex: hex,
          previewUrl,
          duration,
          peaks,
        });
      } catch (err: any) {
        setError(err.message || 'Skipped invalid file.');
      }
    }

    if (added.length > 0) {
      setItems((prev) => [...prev, ...added]);
      if (!selectedId) {
        setSelectedId(added[0].id);
        setTrimStart(0);
        setTrimEnd(Math.floor(added[0].duration || 0));
      }
    }
  };

  const handleConvertAll = async () => {
    if (items.length === 0) return;
    setProcessing(true);
    setError(null);
    setRealProgress(0);
    setStatusMsg('Loading FFmpeg WebAssembly...');

    try {
      const ffmpeg = await getFfmpeg(
        (pct) => setRealProgress(pct),
        (msg) => setStatusMsg(msg)
      );

      const updated: AudioItem[] = [];
      for (const item of items) {
        const ext = item.file.name.split('.').pop()?.toLowerCase() || 'mp3';
        const inputName = `in_${item.id}.${ext}`;
        const outputName = `out_${item.id}.${outputFormat}`;
        const baseName = item.file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_\-]+/g, '-');
        const outFilename = `${baseName}.${outputFormat}`;

        setStatusMsg(`Converting ${item.file.name}...`);
        await ffmpeg.writeFile(inputName, await fetchFile(item.file));

        const args: string[] = [];
        if (items.length === 1 && trimStart > 0) {
          args.push('-ss', String(trimStart));
        }
        if (
          items.length === 1 &&
          trimEnd > trimStart &&
          item.duration > 0 &&
          trimEnd < Math.floor(item.duration)
        ) {
          args.push('-t', String(trimEnd - trimStart));
        }

        args.push('-i', inputName, '-vn', '-ar', sampleRate);

        if (outputFormat === 'mp3') {
          args.push('-c:a', 'libmp3lame', '-b:a', bitrate);
        } else if (outputFormat === 'aac') {
          args.push('-c:a', 'aac', '-b:a', bitrate);
        } else if (outputFormat === 'ogg') {
          args.push('-c:a', 'libvorbis', '-b:a', bitrate);
        } else if (outputFormat === 'flac') {
          args.push('-c:a', 'flac');
        } else {
          args.push('-c:a', 'pcm_s16le');
        }

        args.push(outputName);

        const code = await ffmpeg.exec(args);
        if (code !== 0) {
          throw new Error(`FFmpeg audio conversion failed for ${item.file.name} (code ${code})`);
        }

        const outData = await ffmpeg.readFile(outputName);
        const bytes = outData instanceof Uint8Array ? outData : new TextEncoder().encode(String(outData));
        const mimeMap: Record<AudioOutputFormat, string> = {
          mp3: 'audio/mpeg',
          wav: 'audio/wav',
          aac: 'audio/aac',
          flac: 'audio/flac',
          ogg: 'audio/ogg',
        };
        const outBlob = new Blob([bytes.buffer as ArrayBuffer], { type: mimeMap[outputFormat] });

        try {
          await ffmpeg.deleteFile(inputName);
          await ffmpeg.deleteFile(outputName);
        } catch {}

        updated.push({ ...item, outputBlob: outBlob, outputFilename: outFilename });

        // Log metadata
        fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            module: 'audio-studio',
            processingMode: 'browser-wasm',
            inputFilename: item.file.name,
            inputMime: item.file.type || 'audio/mpeg',
            inputSize: item.file.size,
            outputFormat,
            outputSize: outBlob.size,
            headerHex: item.headerHex,
            category: (item.file.type || '').startsWith('video/') ? 'video' : 'audio',
          }),
        }).catch(() => {});
      }

      setItems(updated);
      setRealProgress(100);
      setStatusMsg('Audio conversion complete!');
    } catch (err: any) {
      setError(err.message || 'Audio conversion failed.');
      resetFfmpeg();
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadZip = async () => {
    const processed = items.filter((i) => i.outputBlob && i.outputFilename);
    if (processed.length === 0) return;
    const zip = new JSZip();
    for (const item of processed) {
      zip.file(item.outputFilename!, item.outputBlob!);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    triggerBlobDownload(blob, `linktwin-audio-${Date.now()}.zip`);
  };

  const removeItem = (id: string) => {
    const target = items.find((i) => i.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    if (selectedId === id) {
      setSelectedId(next[0]?.id || null);
    }
  };

  const processedCount = items.filter((i) => i.outputBlob).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center gap-2 p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs text-zinc-400">
        <Cpu className="w-4 h-4 text-purple-400 flex-shrink-0" />
        <span>
          Convert MP3, WAV, AAC, FLAC, OGG, M4A, WebM, or extract audio from video files locally via FFmpeg WASM (up to{' '}
          <strong className="text-zinc-200">{safeLimitMb} MB</strong>).
        </span>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files?.length) handleFilesAdded(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-7 text-center transition ${
          dragActive
            ? 'border-purple-500 bg-purple-500/10'
            : 'border-zinc-700/80 bg-zinc-900/40 hover:border-zinc-600'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="audio/*,video/mp4,video/webm,video/quicktime"
          onChange={(e) => {
            if (e.target.files?.length) handleFilesAdded(e.target.files);
          }}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-2">
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Upload className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-white">Drop audio or video files here (Batch Supported)</p>
          <p className="text-xs text-zinc-400">
            Supports MP3, WAV, AAC, FLAC, OGG, M4A, WebM &amp; Video-to-Audio extraction
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Waveform & Batch Queue */}
          <div className="lg:col-span-6 space-y-4">
            {selectedItem && (
              <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white truncate max-w-xs">{selectedItem.file.name}</span>
                  <span className="font-mono text-zinc-400">
                    {selectedItem.duration ? formatDuration(selectedItem.duration) : '—'}
                  </span>
                </div>
                <canvas
                  ref={waveformCanvasRef}
                  className="w-full h-24 rounded-lg border border-zinc-800 bg-zinc-950"
                />
                <audio src={selectedItem.previewUrl} controls className="w-full h-9" />
              </div>
            )}

            <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2.5 max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-400">
                <span>Audio Queue ({items.length})</span>
                {processedCount > 1 && (
                  <button
                    type="button"
                    onClick={handleDownloadZip}
                    className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Download All ZIP</span>
                  </button>
                )}
              </div>

              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedId(item.id);
                    setTrimStart(0);
                    setTrimEnd(Math.floor(item.duration || 0));
                  }}
                  className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 cursor-pointer ${
                    selectedId === item.id
                      ? 'bg-zinc-800/80 border-purple-500/40'
                      : 'bg-zinc-950/60 border-zinc-800'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">{item.file.name}</p>
                    <p className="text-[11px] text-zinc-400">
                      {formatBytes(item.file.size)}
                      {item.outputBlob && (
                        <>
                          {' → '}
                          <strong className="text-emerald-400">{formatBytes(item.outputBlob.size)}</strong>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {item.outputBlob && item.outputFilename && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerBlobDownload(item.outputBlob!, item.outputFilename!);
                        }}
                        className="p-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.id);
                      }}
                      className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Audio Settings */}
          <div className="lg:col-span-6 p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-5 h-fit">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              <span>Audio Export Settings</span>
            </h4>

            <div>
              <label className="block text-xs text-zinc-400 mb-2">Output Format</label>
              <div className="grid grid-cols-5 gap-2">
                {(['mp3', 'wav', 'aac', 'flac', 'ogg'] as AudioOutputFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setOutputFormat(fmt)}
                    className={`py-2 rounded-lg text-xs font-bold uppercase border transition ${
                      outputFormat === fmt
                        ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Bitrate</label>
                <select
                  value={bitrate}
                  onChange={(e) => setBitrate(e.target.value as any)}
                  disabled={outputFormat === 'wav' || outputFormat === 'flac'}
                  className="w-full py-2 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white disabled:opacity-40"
                >
                  <option value="96k">96 kbps (Compact)</option>
                  <option value="128k">128 kbps (Standard)</option>
                  <option value="192k">192 kbps (High)</option>
                  <option value="256k">256 kbps (Studio)</option>
                  <option value="320k">320 kbps (Max MP3)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Sample Rate</label>
                <select
                  value={sampleRate}
                  onChange={(e) => setSampleRate(e.target.value as any)}
                  className="w-full py-2 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                >
                  <option value="22050">22.05 kHz</option>
                  <option value="44100">44.1 kHz (CD)</option>
                  <option value="48000">48 kHz (Video)</option>
                </select>
              </div>
            </div>

            {items.length === 1 && selectedItem && selectedItem.duration > 1 && (
              <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                  <Scissors className="w-3.5 h-3.5 text-purple-400" />
                  <span>Trim Audio (seconds)</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-zinc-500 block mb-1">Start (s)</label>
                    <input
                      type="number"
                      min={0}
                      max={Math.max(0, trimEnd - 1)}
                      value={trimStart}
                      onChange={(e) => setTrimStart(Math.max(0, Number(e.target.value)))}
                      className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-500 block mb-1">End (s)</label>
                    <input
                      type="number"
                      min={trimStart + 1}
                      max={Math.ceil(selectedItem.duration)}
                      value={trimEnd}
                      onChange={(e) =>
                        setTrimEnd(Math.min(Math.ceil(selectedItem.duration), Number(e.target.value)))
                      }
                      className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleConvertAll}
              disabled={processing}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold shadow-lg shadow-purple-600/25 transition disabled:opacity-50"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Converting {realProgress !== null ? `${realProgress}%` : '...'}</span>
                </>
              ) : (
                <>
                  <Music className="w-4 h-4" />
                  <span>Convert Audio {items.length > 1 ? `(${items.length} Files)` : ''}</span>
                </>
              )}
            </button>

            {(processing || realProgress !== null) && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>{statusMsg}</span>
                  <span className="font-mono">{realProgress ?? 5}%</span>
                </div>
                <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all duration-150"
                    style={{ width: `${realProgress ?? 5}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
