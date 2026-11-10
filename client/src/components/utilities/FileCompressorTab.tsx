import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import {
  FileArchive,
  Upload,
  Download,
  Archive,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  Image as ImageIcon,
  FileText,
  Film,
  Music,
  Sliders,
} from 'lucide-react';
import {
  formatBytes,
  getSafeBrowserWasmLimitMb,
  readFileHeaderHex,
  triggerBlobDownload,
} from '../../utils/fileHelpers';
import { fetchFile, getFfmpeg } from '../../utils/ffmpegClient';

type FileCategory = 'image' | 'pdf' | 'video' | 'audio';
type ItemStatus =
  | 'ready'
  | 'processing'
  | 'reduced'
  | 'no-reduction'
  | 'queued-worker'
  | 'error';

interface CompressQueueItem {
  id: string;
  file: File;
  category: FileCategory;
  headerHex: string;
  sanitizedName: string;
  status: ItemStatus;
  progress: number;
  statusMessage?: string;
  outputBlob?: Blob;
  outputFilename?: string;
  jobId?: string;
}

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']);
const AUDIO_MIMES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
]);

function detectCategoryFromFile(file: File): FileCategory | null {
  const mime = (file.type || '').toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (IMAGE_MIMES.has(mime) || ['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (VIDEO_MIMES.has(mime) || ['mp4', 'webm', 'mov', 'mkv'].includes(ext)) return 'video';
  if (AUDIO_MIMES.has(mime) || ['mp3', 'wav', 'aac', 'ogg', 'flac'].includes(ext)) return 'audio';
  return null;
}

function inferMimeForCategory(file: File, cat: FileCategory): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (cat === 'pdf') return 'application/pdf';
  if (cat === 'image') {
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    return 'image/jpeg';
  }
  if (cat === 'video') {
    if (ext === 'webm') return 'video/webm';
    if (ext === 'mov') return 'video/quicktime';
    return 'video/mp4';
  }
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'ogg') return 'audio/ogg';
  return 'audio/mpeg';
}

export const FileCompressorTab: React.FC = () => {
  const [items, setItems] = useState<CompressQueueItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [processingAll, setProcessingAll] = useState(false);

  // Compression Settings (Estimated Profiles)
  const [imageQuality, setImageQuality] = useState<number>(80); // 40-95
  const [pngConvertWebp, setPngConvertWebp] = useState<boolean>(false);
  const [videoCrf, setVideoCrf] = useState<number>(28); // 22 (High) - 34 (Small)
  const [audioBitrateKbps, setAudioBitrateKbps] = useState<number>(128);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const browserWasmLimitMb = getSafeBrowserWasmLimitMb();

  const updateItem = (id: string, patch: Partial<CompressQueueItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const handleFilesAdded = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setGlobalError(null);

    const newItems: CompressQueueItem[] = [];
    for (const file of Array.from(fileList)) {
      const cat = detectCategoryFromFile(file);
      if (!cat) {
        setGlobalError(
          `Skipped "${file.name}": supported formats are JPG, PNG, WebP, PDF, MP4, WebM, MOV, MP3, WAV, AAC, OGG.`
        );
        continue;
      }

      try {
        const headerHex = await readFileHeaderHex(file, 16);
        const mime = inferMimeForCategory(file, cat);
        const valRes = await fetch('/api/jobs/validate-signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mime,
            headerHex,
            category: cat,
          }),
        });
        const valJson = await valRes.json();
        if (!valRes.ok || !valJson.valid) {
          setGlobalError(
            `Rejected "${file.name}": ${valJson?.error || 'invalid file signature.'}`
          );
          continue;
        }

        newItems.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          category: cat,
          headerHex,
          sanitizedName: valJson.sanitizedFilename || file.name,
          status: 'ready',
          progress: 0,
        });
      } catch {
        setGlobalError(`Could not inspect file "${file.name}".`);
      }
    }

    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
    }
  };

  const compressImageFile = async (item: CompressQueueItem): Promise<{ blob: Blob; name: string }> => {
    const imgUrl = URL.createObjectURL(item.file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Failed to decode image for compression.'));
        el.src = imgUrl;
      });

      // Preserve exact original resolution — never silently downscale
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable.');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const srcMime = inferMimeForCategory(item.file, 'image').toLowerCase();
      let targetMime = srcMime;
      const base = item.sanitizedName.replace(/\.[^.]+$/, '');
      let ext = item.sanitizedName.split('.').pop()?.toLowerCase() || 'jpg';

      if (srcMime === 'image/png' && pngConvertWebp) {
        targetMime = 'image/webp';
        ext = 'webp';
      }

      const q = targetMime === 'image/png' ? undefined : imageQuality / 100;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Canvas encoding returned empty output.'))),
          targetMime,
          q
        );
      });

      return { blob, name: `${base}-compressed.${ext}` };
    } finally {
      URL.revokeObjectURL(imgUrl);
    }
  };

  const compressPdfFile = async (item: CompressQueueItem): Promise<{ blob: Blob; name: string }> => {
    const buf = await item.file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: false });
    const bytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 50,
    });
    const base = item.sanitizedName.replace(/\.[^.]+$/, '');
    return {
      blob: new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }),
      name: `${base}-compressed.pdf`,
    };
  };

  const compressAvFile = async (
    item: CompressQueueItem
  ): Promise<{ blob?: Blob; name: string; offloadedToWorker?: boolean; jobId?: string }> => {
    const fileSizeMb = item.file.size / (1024 * 1024);
    const mime = inferMimeForCategory(item.file, item.category);
    const outFmt = item.category === 'video' ? 'mp4' : 'mp3';

    if (fileSizeMb > browserWasmLimitMb) {
      // Offload large video/audio files to Phase 2 server worker queue
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'file-compressor',
          processingMode: 'server-worker',
          inputFilename: item.sanitizedName,
          inputMime: mime,
          inputSize: item.file.size,
          outputFormat: outFmt,
          headerHex: item.headerHex,
          category: item.category,
          dedupeKey: `compress:${item.sanitizedName}:${item.file.size}:${videoCrf}:${audioBitrateKbps}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Could not queue server worker job for large file.');
      }
      return { name: item.sanitizedName, offloadedToWorker: true, jobId: json.job?.job_id };
    }

    const ffmpeg = await getFfmpeg(
      (pct) => updateItem(item.id, { progress: pct }),
      (msg) => updateItem(item.id, { statusMessage: msg })
    );

    const ext = item.sanitizedName.split('.').pop()?.toLowerCase() || (item.category === 'video' ? 'mp4' : 'mp3');
    const inName = `in_${item.id}.${ext}`;
    const base = item.sanitizedName.replace(/\.[^.]+$/, '');
    const outName = `out_${item.id}.${outFmt}`;

    await ffmpeg.writeFile(inName, await fetchFile(item.file));
    try {
      const args =
        item.category === 'video'
          ? [
              '-i',
              inName,
              '-c:v',
              'libx264',
              '-crf',
              String(videoCrf),
              '-preset',
              'veryfast',
              '-c:a',
              'aac',
              '-b:a',
              `${audioBitrateKbps}k`,
              '-movflags',
              '+faststart',
              outName,
            ]
          : ['-i', inName, '-c:a', 'libmp3lame', '-b:a', `${audioBitrateKbps}k`, outName];

      const exitCode = await ffmpeg.exec(args);
      if (exitCode !== 0) {
        throw new Error(`FFmpeg exited with code ${exitCode}. Codec may be unsupported in browser WASM.`);
      }

      const data = (await ffmpeg.readFile(outName)) as Uint8Array;
      const outMime = item.category === 'video' ? 'video/mp4' : 'audio/mpeg';
      const blob = new Blob([new Uint8Array(data)], { type: outMime });
      return { blob, name: `${base}-compressed.${outFmt}` };
    } finally {
      try {
        await ffmpeg.deleteFile(inName);
        await ffmpeg.deleteFile(outName);
      } catch {
        // ignore cleanup errors
      }
    }
  };

  const logBrowserJob = async (
    item: CompressQueueItem,
    outputSize: number,
    outputFormat: string
  ) => {
    try {
      const mode = item.category === 'video' || item.category === 'audio' ? 'browser-wasm' : 'browser-canvas';
      await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'file-compressor',
          processingMode: mode,
          inputFilename: item.sanitizedName,
          inputMime: inferMimeForCategory(item.file, item.category),
          inputSize: item.file.size,
          outputFormat,
          outputSize,
          headerHex: item.headerHex,
          category: item.category,
        }),
      });
    } catch {
      // Telemetry logging should not discard completed client output
    }
  };

  const processSingleItem = async (item: CompressQueueItem) => {
    updateItem(item.id, {
      status: 'processing',
      progress: 5,
      statusMessage: 'Compressing...',
    });

    try {
      let outBlob: Blob | undefined;
      let outName = item.sanitizedName;

      if (item.category === 'image') {
        const res = await compressImageFile(item);
        outBlob = res.blob;
        outName = res.name;
      } else if (item.category === 'pdf') {
        const res = await compressPdfFile(item);
        outBlob = res.blob;
        outName = res.name;
      } else {
        const res = await compressAvFile(item);
        if (res.offloadedToWorker) {
          updateItem(item.id, {
            status: 'queued-worker',
            progress: 100,
            jobId: res.jobId,
            statusMessage: `File exceeds ${browserWasmLimitMb} MB browser limit — queued for background worker (${res.jobId}).`,
          });
          return;
        }
        outBlob = res.blob;
        outName = res.name;
      }

      if (!outBlob || outBlob.size === 0) {
        throw new Error('Compression produced an empty file.');
      }

      const outExt = outName.split('.').pop()?.toLowerCase() || item.category;
      await logBrowserJob(item, outBlob.size, outExt);

      // STRICT HONESTY CHECK: Never claim compression succeeded if output >= original
      if (outBlob.size >= item.file.size) {
        updateItem(item.id, {
          status: 'no-reduction',
          progress: 100,
          outputBlob: undefined,
          outputFilename: item.file.name,
          statusMessage: `Compressed result (${formatBytes(outBlob.size)}) is not smaller than the original (${formatBytes(
            item.file.size
          )}). This file is already optimally encoded — keeping your original file is recommended.`,
        });
        return;
      }

      updateItem(item.id, {
        status: 'reduced',
        progress: 100,
        outputBlob: outBlob,
        outputFilename: outName,
        statusMessage: undefined,
      });
    } catch (err: any) {
      updateItem(item.id, {
        status: 'error',
        progress: 0,
        statusMessage: err?.message || 'Compression failed.',
      });
    }
  };

  const handleCompressAll = async () => {
    const queue = items.filter((i) => i.status === 'ready' || i.status === 'error');
    if (queue.length === 0) return;
    setProcessingAll(true);
    for (const item of queue) {
      await processSingleItem(item);
    }
    setProcessingAll(false);
  };

  const handleDownloadZip = async () => {
    const reducedItems = items.filter((i) => i.status === 'reduced' && i.outputBlob);
    if (reducedItems.length === 0) return;
    const zip = new JSZip();
    for (const it of reducedItems) {
      if (it.outputBlob) {
        zip.file(it.outputFilename || it.sanitizedName, it.outputBlob);
      }
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    triggerBlobDownload(zipBlob, `linktwin-compressed-${Date.now()}.zip`);
  };

  const reducedCount = items.filter((i) => i.status === 'reduced' && i.outputBlob).length;

  const getCategoryIcon = (cat: FileCategory) => {
    switch (cat) {
      case 'image':
        return <ImageIcon className="w-4 h-4 text-emerald-400" />;
      case 'pdf':
        return <FileText className="w-4 h-4 text-amber-400" />;
      case 'video':
        return <Film className="w-4 h-4 text-sky-400" />;
      case 'audio':
        return <Music className="w-4 h-4 text-violet-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Honest Capabilities & Compression Rule Note */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs text-zinc-300">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <span>
          Supports <strong>JPG, PNG, WebP, PDF, MP4, WebM, MOV, MP3, WAV, AAC, OGG</strong>. Images keep exact resolution and PNG/WebP transparency; PDFs optimize object streams safely. If any file is already optimal and output is ≥ original size, LinkTwin reports honestly and lets you keep the original.
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
          handleFilesAdded(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-colors ${
          dragActive
            ? 'border-emerald-500 bg-emerald-500/10'
            : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.webm,.mov,.mp3,.wav,.aac,.ogg"
          onChange={(e) => handleFilesAdded(e.target.files)}
          className="hidden"
        />
        <Upload className="w-8 h-8 text-emerald-400 mx-auto mb-2.5" />
        <p className="text-sm font-medium text-zinc-200">
          Drop multiple images, PDFs, videos, or audio files here
        </p>
        <p className="text-xs text-zinc-500 mt-1">
          Magic-byte validated before processing · Browser WASM limit: {browserWasmLimitMb} MB for video/audio
        </p>
      </div>

      {globalError && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{globalError}</span>
        </div>
      )}

      {/* Compression Profiles (Estimated Targets) */}
      <div className="p-4 sm:p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <Sliders className="w-3.5 h-3.5 text-emerald-400" />
          Estimated Compression Settings (Actual savings measured after encoding)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300 font-medium">JPG / WebP Quality</span>
              <span className="font-mono text-emerald-400">{imageQuality}%</span>
            </div>
            <input
              type="range"
              min={45}
              max={95}
              value={imageQuality}
              onChange={(e) => setImageQuality(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <label className="flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={pngConvertWebp}
                onChange={(e) => setPngConvertWebp(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-950 text-emerald-500"
              />
              Convert PNG to transparent WebP for smaller size
            </label>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300 font-medium">Video CRF Target (H.264)</span>
              <span className="font-mono text-sky-400">CRF {videoCrf}</span>
            </div>
            <input
              type="range"
              min={22}
              max={34}
              value={videoCrf}
              onChange={(e) => setVideoCrf(Number(e.target.value))}
              className="w-full accent-sky-500"
            />
            <p className="text-[11px] text-zinc-500">
              Higher CRF = smaller file (26–30 recommended).
            </p>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80 space-y-2">
            <label className="block text-xs text-zinc-300 font-medium">Audio Bitrate (MP3 / AAC)</label>
            <select
              value={audioBitrateKbps}
              onChange={(e) => setAudioBitrateKbps(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none"
            >
              <option value={96}>96 kbps (Compact Voice)</option>
              <option value={128}>128 kbps (Standard Balanced)</option>
              <option value={192}>192 kbps (High Quality)</option>
            </select>
            <p className="text-[11px] text-zinc-500">
              PDF optimization uses structural object-stream compaction cleanly via pdf-lib.
            </p>
          </div>
        </div>
      </div>

      {/* Queue List & Actions */}
      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-zinc-400">
              Batch Queue ({items.length} {items.length === 1 ? 'file' : 'files'})
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {reducedCount > 1 && (
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-100 border border-zinc-700 transition-colors"
                >
                  <Archive className="w-3.5 h-3.5" />
                  Download ZIP ({reducedCount})
                </button>
              )}
              <button
                type="button"
                onClick={handleCompressAll}
                disabled={processingAll || !items.some((i) => i.status === 'ready' || i.status === 'error')}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {processingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileArchive className="w-3.5 h-3.5" />
                )}
                Compress Pending Files
              </button>
              <button
                type="button"
                onClick={() => setItems([])}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-400 border border-zinc-800"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {items.map((item) => {
              const savedBytes = item.outputBlob ? item.file.size - item.outputBlob.size : 0;
              const savedPct =
                item.outputBlob && item.file.size > 0
                  ? Math.round((savedBytes / item.file.size) * 100)
                  : 0;

              return (
                <div
                  key={item.id}
                  className="p-3.5 sm:p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(item.category)}
                      <span className="text-sm font-medium text-zinc-100 truncate">
                        {item.sanitizedName}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500 uppercase">
                        {item.category}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="text-zinc-400">
                        Original: <strong className="text-zinc-200">{formatBytes(item.file.size)}</strong>
                      </span>

                      {item.status === 'reduced' && item.outputBlob && (
                        <>
                          <span className="text-emerald-400 font-medium inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Compressed: {formatBytes(item.outputBlob.size)} (−{savedPct}%)
                          </span>
                        </>
                      )}

                      {item.status === 'processing' && (
                        <span className="text-sky-400 inline-flex items-center gap-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          {item.statusMessage || 'Compressing...'} ({item.progress}%)
                        </span>
                      )}
                    </div>

                    {item.statusMessage && item.status !== 'processing' && (
                      <p
                        className={`text-xs ${
                          item.status === 'error'
                            ? 'text-rose-400'
                            : item.status === 'no-reduction'
                            ? 'text-amber-300'
                            : 'text-sky-300'
                        }`}
                      >
                        {item.statusMessage}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === 'ready' && (
                      <button
                        type="button"
                        onClick={() => processSingleItem(item)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-medium text-emerald-300 transition-colors"
                      >
                        Compress
                      </button>
                    )}

                    {item.status === 'reduced' && item.outputBlob && (
                      <button
                        type="button"
                        onClick={() =>
                          triggerBlobDownload(item.outputBlob!, item.outputFilename || item.sanitizedName)
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                    )}

                    {item.status === 'no-reduction' && (
                      <button
                        type="button"
                        onClick={() => triggerBlobDownload(item.file, item.file.name)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 text-xs font-medium transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Keep Original
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
