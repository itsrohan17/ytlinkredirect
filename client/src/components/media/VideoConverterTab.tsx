import React, { useState, useRef, useEffect } from 'react';
import {
  Video,
  Upload,
  Loader2,
  Download,
  AlertCircle,
  CheckCircle2,
  Scissors,
  Sliders,
  Cpu,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import {
  formatBytes,
  formatDuration,
  getSafeBrowserWasmLimitMb,
  readFileHeaderHex,
  triggerBlobDownload,
} from '../../utils/fileHelpers';
import { fetchFile, getFfmpeg, resetFfmpeg } from '../../utils/ffmpegClient';

type OutputFormat = 'mp4' | 'webm' | 'gif';
type ResolutionOpt = 'original' | '360p' | '480p' | '720p' | '1080p' | '1440p';
type CompressionPreset = 'low' | 'balanced' | 'high' | 'custom';

export const VideoConverterTab: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [headerHex, setHeaderHex] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Source metadata
  const [duration, setDuration] = useState<number>(0);
  const [sourceWidth, setSourceWidth] = useState<number>(0);
  const [sourceHeight, setSourceHeight] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Conversion settings
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('mp4');
  const [resolution, setResolution] = useState<ResolutionOpt>('original');
  const [compression, setCompression] = useState<CompressionPreset>('balanced');
  const [customCrf, setCustomCrf] = useState<number>(24);
  const [fps, setFps] = useState<'original' | '24' | '30' | '60'>('original');
  const [extractAudioOnly, setExtractAudioOnly] = useState(false);
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'aac'>('mp3');
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);

  // Capabilities
  const [workerAvailable, setWorkerAvailable] = useState<boolean>(false);
  const safeBrowserLimitMb = getSafeBrowserWasmLimitMb();

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [realProgress, setRealProgress] = useState<number | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);
  const [workerJobState, setWorkerJobState] = useState<{
    jobId: string;
    status: string;
    signedDownloadUrl?: string | null;
  } | null>(null);

  // Result state
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultFilename, setResultFilename] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch('/api/media/video')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.objectStorageConfigured === 'boolean') {
          setWorkerAvailable(d.objectStorageConfigured);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelected = async (selected: File) => {
    setValidationError(null);
    setProcessError(null);
    setResultBlob(null);
    setWorkerJobState(null);
    setRealProgress(null);
    setStatusMsg(null);
    setValidating(true);

    try {
      const hex = await readFileHeaderHex(selected, 16);
      const mime = selected.type || 'video/mp4';

      const valRes = await fetch('/api/jobs/validate-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: selected.name,
          mime,
          headerHex: hex,
          category: 'video',
        }),
      });
      const valData = await valRes.json();
      if (!valRes.ok || !valData.valid) {
        throw new Error(valData?.error || 'Invalid or unsupported video file signature.');
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const objUrl = URL.createObjectURL(selected);
      setPreviewUrl(objUrl);
      setFile(selected);
      setHeaderHex(hex);

      // Probe video dimensions & duration via HTML5 video element
      if (mime !== 'image/gif') {
        const vid = document.createElement('video');
        vid.preload = 'metadata';
        vid.src = objUrl;
        vid.onloadedmetadata = () => {
          setDuration(vid.duration || 0);
          setTrimStart(0);
          setTrimEnd(Math.floor(vid.duration || 0));
          setSourceWidth(vid.videoWidth || 0);
          setSourceHeight(vid.videoHeight || 0);
        };
      } else {
        setDuration(0);
        setTrimStart(0);
        setTrimEnd(0);
        setSourceWidth(0);
        setSourceHeight(0);
      }
    } catch (err: any) {
      setValidationError(err.message || 'Could not validate video file.');
      setFile(null);
    } finally {
      setValidating(false);
    }
  };

  const getEffectiveCrf = (): number => {
    if (compression === 'low') return 19;
    if (compression === 'balanced') return 23;
    if (compression === 'high') return 29;
    return customCrf;
  };

  const getEstimatedOutputSize = (): string => {
    if (!file) return '—';
    const ratioMap: Record<CompressionPreset, number> = {
      low: 0.92,
      balanced: 0.65,
      high: 0.4,
      custom: Math.max(0.25, Math.min(1.0, 1 - (customCrf - 16) * 0.032)),
    };
    let factor = extractAudioOnly ? 0.12 : ratioMap[compression];
    if (outputFormat === 'gif' && !extractAudioOnly) factor = 1.15;
    if (duration > 0 && trimEnd > trimStart && trimEnd - trimStart < duration) {
      factor *= (trimEnd - trimStart) / duration;
    }
    return `~${formatBytes(Math.round(file.size * factor))} (estimated)`;
  };

  const runBrowserWasmConversion = async () => {
    if (!file) return;
    setProcessing(true);
    setProcessError(null);
    setResultBlob(null);
    setRealProgress(0);
    setStatusMsg('Initializing FFmpeg WebAssembly...');

    try {
      const ffmpeg = await getFfmpeg(
        (pct) => setRealProgress(pct),
        (msg) => setStatusMsg(msg)
      );

      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
      const inputName = `input.${ext}`;
      const targetExt = extractAudioOnly ? audioFormat : outputFormat;
      const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_\-]+/g, '-');
      const outFilename = `${baseName}-converted.${targetExt}`;
      const outputName = `output.${targetExt}`;

      setStatusMsg('Writing file to WASM memory...');
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      const args: string[] = [];

      // Trim if specified
      if (trimStart > 0) {
        args.push('-ss', String(trimStart));
      }
      if (trimEnd > trimStart && (duration === 0 || trimEnd < Math.floor(duration))) {
        args.push('-t', String(trimEnd - trimStart));
      }

      args.push('-i', inputName);

      if (extractAudioOnly) {
        args.push('-vn');
        if (audioFormat === 'mp3') {
          args.push('-c:a', 'libmp3lame', '-b:a', '192k');
        } else {
          args.push('-c:a', 'aac', '-b:a', '192k');
        }
      } else {
        // Video filters: scale + fps
        const filters: string[] = [];
        const heightMap: Record<ResolutionOpt, number | null> = {
          original: null,
          '360p': 360,
          '480p': 480,
          '720p': 720,
          '1080p': 1080,
          '1440p': 1440,
        };
        const targetH = heightMap[resolution];
        if (targetH) {
          filters.push(`scale=-2:${targetH}`);
        }
        if (fps !== 'original') {
          filters.push(`fps=${fps}`);
        }
        if (filters.length > 0) {
          args.push('-vf', filters.join(','));
        }

        const crf = getEffectiveCrf();
        if (outputFormat === 'mp4') {
          args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf), '-c:a', 'aac', '-movflags', '+faststart');
        } else if (outputFormat === 'webm') {
          args.push('-c:v', 'libvpx-vp9', '-crf', String(Math.min(40, crf + 6)), '-b:v', '0', '-c:a', 'libopus');
        } else if (outputFormat === 'gif') {
          args.push('-loop', '0');
        }
      }

      args.push(outputName);

      setStatusMsg(`Converting to ${targetExt.toUpperCase()}...`);
      const exitCode = await ffmpeg.exec(args);
      if (exitCode !== 0) {
        throw new Error(`FFmpeg conversion exited with error code ${exitCode}. Try MP4 format or lower resolution.`);
      }

      const data = await ffmpeg.readFile(outputName);
      const mimeMap: Record<string, string> = {
        mp4: 'video/mp4',
        webm: 'video/webm',
        gif: 'image/gif',
        mp3: 'audio/mpeg',
        aac: 'audio/aac',
      };
      const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mimeMap[targetExt] || 'application/octet-stream' });

      // Cleanup WASM virtual filesystem
      try {
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);
      } catch {}

      setResultBlob(blob);
      setResultFilename(outFilename);
      setRealProgress(100);
      setStatusMsg('Conversion complete!');

      // Log job metadata (zero media bytes sent to Turso)
      fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'video-converter',
          processingMode: 'browser-wasm',
          inputFilename: file.name,
          inputMime: file.type || 'video/mp4',
          inputSize: file.size,
          outputFormat: targetExt,
          outputSize: blob.size,
          headerHex,
          category: 'video',
        }),
      }).catch(() => {});
    } catch (err: any) {
      setProcessError(
        err?.message || 'Browser FFmpeg processing failed (possibly due to codec or browser memory limits).'
      );
      resetFfmpeg();
    } finally {
      setProcessing(false);
    }
  };

  const runServerWorkerJob = async () => {
    if (!file) return;
    setProcessing(true);
    setProcessError(null);
    setStatusMsg('Queueing job for background worker...');

    try {
      const targetExt = extractAudioOnly ? audioFormat : outputFormat;
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'video-converter',
          processingMode: 'server-worker',
          inputFilename: file.name,
          inputMime: file.type || 'video/mp4',
          inputSize: file.size,
          outputFormat: targetExt,
          headerHex,
          category: 'video',
          dedupeKey: `${file.name}_${file.size}_${targetExt}_${resolution}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Could not queue server worker job.');
      }

      if (data.signedUploadUrl) {
        setStatusMsg('Uploading securely to private storage...');
        const putRes = await fetch(data.signedUploadUrl, {
          method: 'PUT',
          body: file,
        });
        if (!putRes.ok) {
          throw new Error(`Upload to object storage failed (HTTP ${putRes.status})`);
        }
      }

      setWorkerJobState({ jobId: data.job.job_id, status: data.job.status });
      setStatusMsg(`Queued as ${data.job.job_id}. Polling worker status...`);
      pollWorkerJob(data.job.job_id);
    } catch (err: any) {
      setProcessError(err.message);
      setProcessing(false);
    }
  };

  const pollWorkerJob = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`);
        const data = await res.json();
        if (!res.ok) {
          clearInterval(interval);
          setProcessError(data?.error || 'Lost worker job status');
          setProcessing(false);
          return;
        }
        setWorkerJobState({
          jobId,
          status: data.job.status,
          signedDownloadUrl: data.signedDownloadUrl,
        });
        if (data.job.status === 'completed' || data.job.status === 'failed' || data.job.status === 'expired') {
          clearInterval(interval);
          setProcessing(false);
          if (data.job.status === 'failed') {
            setProcessError(data.job.error_message || 'Background worker failed.');
          } else if (data.job.status === 'completed') {
            setStatusMsg('Worker conversion complete!');
          }
        }
      } catch {
        clearInterval(interval);
        setProcessing(false);
      }
    }, 3000);
  };

  const fileSizeMb = file ? file.size / (1024 * 1024) : 0;
  const exceedsBrowserMemory = fileSizeMb > safeBrowserLimitMb;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Architecture & Memory Limit Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>
            Browser FFmpeg WASM handles files up to <strong className="text-zinc-200">{safeBrowserLimitMb} MB</strong> locally on your device.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-zinc-400" />
          <span>
            Worker + S3/R2 Storage:{' '}
            <strong className={workerAvailable ? 'text-emerald-400' : 'text-amber-400'}>
              {workerAvailable ? 'Configured' : 'Not Configured (Browser WASM Active)'}
            </strong>
          </span>
        </div>
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
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) handleFileSelected(dropped);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
          dragActive
            ? 'border-red-500 bg-red-500/10'
            : 'border-zinc-700/80 bg-zinc-900/40 hover:border-zinc-600'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/x-msvideo,image/gif"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileSelected(f);
          }}
          className="hidden"
        />
        {validating ? (
          <div className="flex flex-col items-center gap-2 text-zinc-300">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
            <span className="text-sm font-semibold">Verifying file signature...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-white">
              {file ? file.name : 'Drop a video file here or click to browse'}
            </p>
            <p className="text-xs text-zinc-400">
              Supports MP4, WebM, MOV, MKV, AVI, and GIF &bull; Magic-byte signature verified
            </p>
          </div>
        )}
      </div>

      {validationError && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{validationError}</span>
        </div>
      )}

      {file && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Metadata + Preview */}
          <div className="lg:col-span-5 space-y-4">
            {previewUrl && (
              <div className="rounded-xl overflow-hidden bg-black border border-zinc-800 aspect-video flex items-center justify-center">
                {file.type === 'image/gif' ? (
                  <img src={previewUrl} alt="Preview" className="max-h-full object-contain" />
                ) : (
                  <video src={previewUrl} controls className="w-full h-full" />
                )}
              </div>
            )}

            <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2 text-xs">
              <h4 className="font-bold uppercase tracking-wider text-zinc-400">Source File Metadata</h4>
              <div className="flex justify-between">
                <span className="text-zinc-400">Original Size:</span>
                <span className="text-white font-mono">{formatBytes(file.size)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Resolution:</span>
                <span className="text-white font-mono">
                  {sourceWidth && sourceHeight ? `${sourceWidth} × ${sourceHeight}` : 'Auto'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Duration:</span>
                <span className="text-white font-mono">{duration ? formatDuration(duration) : '—'}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-800 pt-2">
                <span className="text-zinc-400">Estimated Output:</span>
                <span className="text-amber-400 font-mono">{getEstimatedOutputSize()}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Settings & Execution */}
          <div className="lg:col-span-7 p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-red-400" />
                <span>Conversion Settings</span>
              </h4>

              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={extractAudioOnly}
                  onChange={(e) => setExtractAudioOnly(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-950 text-red-600 focus:ring-red-500"
                />
                <span>Extract Audio Only</span>
              </label>
            </div>

            {extractAudioOnly ? (
              <div>
                <label className="block text-xs text-zinc-400 mb-2">Audio Output Format</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['mp3', 'aac'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setAudioFormat(fmt)}
                      className={`py-2 rounded-lg text-xs font-bold uppercase border transition ${
                        audioFormat === fmt
                          ? 'bg-red-600/20 border-red-500 text-red-300'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-2">Output Format</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['mp4', 'webm', 'gif'] as OutputFormat[]).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setOutputFormat(fmt)}
                          className={`py-2 rounded-lg text-xs font-bold uppercase border transition ${
                            outputFormat === fmt
                              ? 'bg-red-600/20 border-red-500 text-red-300'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                          }`}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-2">Frame Rate</label>
                    <select
                      value={fps}
                      onChange={(e) => setFps(e.target.value as any)}
                      className="w-full py-2 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                    >
                      <option value="original">Original FPS</option>
                      <option value="24">24 fps (Cinema)</option>
                      <option value="30">30 fps (Standard)</option>
                      <option value="60">60 fps (Smooth)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-2">Resolution</label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {(['original', '360p', '480p', '720p', '1080p', '1440p'] as ResolutionOpt[]).map(
                      (resOpt) => (
                        <button
                          key={resOpt}
                          type="button"
                          onClick={() => setResolution(resOpt)}
                          className={`py-1.5 rounded-lg text-xs font-semibold border transition ${
                            resolution === resOpt
                              ? 'bg-red-600/20 border-red-500 text-red-300'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                          }`}
                        >
                          {resOpt}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-2">Video Compression</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['low', 'balanced', 'high', 'custom'] as CompressionPreset[]).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCompression(preset)}
                        className={`py-2 rounded-lg text-xs font-semibold capitalize border transition ${
                          compression === preset
                            ? 'bg-red-600/20 border-red-500 text-red-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  {compression === 'custom' && (
                    <div className="mt-2 flex items-center gap-3 text-xs text-zinc-400">
                      <span>CRF: {customCrf}</span>
                      <input
                        type="range"
                        min={16}
                        max={36}
                        value={customCrf}
                        onChange={(e) => setCustomCrf(Number(e.target.value))}
                        className="flex-1 accent-red-500"
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Trim Timestamps */}
            {duration > 1 && (
              <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                  <Scissors className="w-3.5 h-3.5 text-red-400" />
                  <span>Trim Timestamps (seconds)</span>
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
                      max={Math.ceil(duration)}
                      value={trimEnd}
                      onChange={(e) => setTrimEnd(Math.min(Math.ceil(duration), Number(e.target.value)))}
                      className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3 pt-1">
              {exceedsBrowserMemory ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 space-y-2">
                  <p>
                    This file ({formatBytes(file.size)}) exceeds the safe browser memory limit ({safeBrowserLimitMb} MB) and must run on the background worker.
                  </p>
                  <button
                    type="button"
                    onClick={runServerWorkerJob}
                    disabled={processing || !workerAvailable}
                    className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition disabled:opacity-50"
                  >
                    {workerAvailable
                      ? 'Queue on Background Worker'
                      : 'External S3/R2 Storage & Worker Required (Not Configured)'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={runBrowserWasmConversion}
                    disabled={processing}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-600/25 transition disabled:opacity-50"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Processing {realProgress !== null ? `${realProgress}%` : '...'}</span>
                      </>
                    ) : (
                      <>
                        <Video className="w-4 h-4" />
                        <span>Convert in Browser (FFmpeg WASM)</span>
                      </>
                    )}
                  </button>

                  {workerAvailable && (
                    <button
                      type="button"
                      onClick={runServerWorkerJob}
                      disabled={processing}
                      className="px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white border border-zinc-700 transition disabled:opacity-50"
                    >
                      Queue on Worker
                    </button>
                  )}
                </div>
              )}

              {/* Actual Real FFmpeg Progress Bar */}
              {(processing || realProgress !== null) && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-zinc-400">
                    <span>{statusMsg || 'Processing...'}</span>
                    <span className="font-mono">{realProgress !== null ? `${realProgress}% (actual)` : 'Initializing...'}</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 transition-all duration-150"
                      style={{ width: `${realProgress ?? 5}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Worker Job State */}
              {workerJobState && (
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
                  <span>
                    Worker Job <code className="text-zinc-300">{workerJobState.jobId}</code>:{' '}
                    <strong className="uppercase text-emerald-400">{workerJobState.status}</strong>
                  </span>
                  {workerJobState.signedDownloadUrl && (
                    <a
                      href={workerJobState.signedDownloadUrl}
                      download
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold"
                    >
                      Download Output
                    </a>
                  )}
                </div>
              )}

              {processError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-400 flex items-center justify-between gap-2">
                  <span>{processError}</span>
                  <button
                    type="button"
                    onClick={() => {
                      resetFfmpeg();
                      setProcessError(null);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 text-zinc-200 hover:text-white flex-shrink-0"
                  >
                    <RefreshCw className="w-3 h-3" /> Reset Engine
                  </button>
                </div>
              )}

              {resultBlob && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="font-bold text-white">{resultFilename}</p>
                      <p className="text-zinc-400">
                        Output size: <strong className="text-emerald-300">{formatBytes(resultBlob.size)}</strong>{' '}
                        (Original: {formatBytes(file.size)})
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerBlobDownload(resultBlob, resultFilename)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download File</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
