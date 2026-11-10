import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Code2,
  ShieldAlert,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Link as LinkIcon,
  Info,
  Image as ImageIcon,
  Video,
  Upload,
  Sparkles,
  FileImage,
  AlertCircle,
} from 'lucide-react';
import { MediaInspectResult, Platform, VideoStreamOption } from '../types';
import { PlatformIcon, getPlatformMeta } from './PlatformIcon';

interface MediaToolsSectionProps {
  externalUrl?: string;
}

type MediaTab = 'video' | 'thumbnail';
type ThumbFormat = 'jpg' | 'png' | 'webp';
type ThumbResolution = '1280x720' | '640x480' | '480x360' | 'original';

function detectClientPlatform(testUrl: string): Platform | null {
  const trimmed = testUrl.trim();
  if (!trimmed) return null;
  if (/^(https?:\/\/)?(www\.|m\.|music\.|gaming\.)?(youtube\.com|youtu\.be)\/.+$/i.test(trimmed)) {
    return 'youtube';
  }
  if (/^(https?:\/\/)?(www\.|m\.)?(instagram\.com|instagr\.am)\/.+$/i.test(trimmed)) {
    return 'instagram';
  }
  if (/^(https?:\/\/)?(www\.|m\.|mbasic\.|web\.)?(facebook\.com|fb\.watch|fb\.com)\/.+$/i.test(trimmed)) {
    return 'facebook';
  }
  return null;
}

const RESOLUTION_OPTIONS: Array<{
  id: ThumbResolution;
  label: string;
  width: number | null;
  height: number | null;
}> = [
  { id: '1280x720', label: '1280 × 720', width: 1280, height: 720 },
  { id: '640x480', label: '640 × 480', width: 640, height: 480 },
  { id: '480x360', label: '480 × 360', width: 480, height: 360 },
  { id: 'original', label: 'Original', width: null, height: null },
];

export const MediaToolsSection: React.FC<MediaToolsSectionProps> = ({ externalUrl }) => {
  const [activeTab, setActiveTab] = useState<MediaTab>('video');
  const [url, setUrl] = useState(externalUrl || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MediaInspectResult | null>(null);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  // Video Download Progress state
  const [downloadingStreamId, setDownloadingStreamId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadStatusMsg, setDownloadStatusMsg] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Thumbnail Studio state
  const [thumbFormat, setThumbFormat] = useState<ThumbFormat>('jpg');
  const [thumbRes, setThumbRes] = useState<ThumbResolution>('1280x720');
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('custom-thumbnail');
  const [naturalDims, setNaturalDims] = useState<{ w: number; h: number } | null>(null);
  const [thumbCopied, setThumbCopied] = useState(false);
  const [thumbActionError, setThumbActionError] = useState<string | null>(null);
  const [exportingThumb, setExportingThumb] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const detectedPlatform = detectClientPlatform(url);
  const detectedMeta = detectedPlatform ? getPlatformMeta(detectedPlatform) : null;

  useEffect(() => {
    if (externalUrl) {
      setUrl(externalUrl);
      setUploadedImageSrc(null);
      inspectUrl(externalUrl);
    }
  }, [externalUrl]);

  // Cleanup object URLs for uploaded images
  useEffect(() => {
    return () => {
      if (uploadedImageSrc && uploadedImageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(uploadedImageSrc);
      }
    };
  }, [uploadedImageSrc]);

  const inspectUrl = async (targetUrl: string) => {
    const clean = targetUrl.trim();
    if (!clean) {
      setError('Please enter a YouTube, Instagram, or Facebook URL.');
      return;
    }

    setLoading(true);
    setError(null);
    setDownloadError(null);
    setThumbActionError(null);

    try {
      const res = await fetch('/api/media/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: clean }),
      });

      const text = await res.text();
      let data: any = {};
      if (text && text.trim()) {
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(text.slice(0, 150) || `Server error (${res.status})`);
        }
      }

      if (!res.ok) {
        throw new Error(data?.error || `Failed to inspect URL (HTTP ${res.status})`);
      }

      setResult(data);
      setUploadedImageSrc(null);
      setNaturalDims(null);
    } catch (err: any) {
      setError(err.message || 'Unable to inspect this URL.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inspectUrl(url);
  };

  const handleCopyEmbed = async () => {
    if (!result?.embedCode) return;
    try {
      await navigator.clipboard.writeText(result.embedCode);
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
    } catch {}
  };

  // Real streaming download with progress bar for permitted video streams
  const handleStreamDownload = async (stream: VideoStreamOption) => {
    setDownloadingStreamId(stream.id);
    setDownloadProgress(0);
    setDownloadError(null);
    setDownloadStatusMsg('Connecting to permitted stream...');

    try {
      const res = await fetch(stream.downloadUrl);
      if (!res.ok) {
        const errText = await res.text();
        let errMsg = `Download failed (${res.status})`;
        try {
          const parsed = JSON.parse(errText);
          if (parsed?.error) errMsg = parsed.error;
        } catch {}
        throw new Error(errMsg);
      }

      const contentLength = Number(res.headers.get('content-length') || stream.fileSizeBytes || 0);
      const reader = res.body?.getReader();

      if (!reader) {
        const blob = await res.blob();
        triggerBlobDownload(blob, stream.filename);
        setDownloadProgress(100);
        setDownloadStatusMsg('Download complete');
        return;
      }

      const chunks: Uint8Array[] = [];
      let received = 0;
      setDownloadStatusMsg('Downloading...');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (contentLength > 0) {
            setDownloadProgress(Math.min(99, Math.round((received / contentLength) * 100)));
          }
        }
      }

      const mimeType = stream.format === 'WebM' ? 'video/webm' : 'video/mp4';
      const blob = new Blob(chunks as BlobPart[], { type: mimeType });
      triggerBlobDownload(blob, stream.filename);
      setDownloadProgress(100);
      setDownloadStatusMsg(`Saved ${stream.filename}`);
    } catch (err: any) {
      setDownloadError(err.message || 'Unable to download video stream.');
      setDownloadStatusMsg(null);
    } finally {
      setTimeout(() => {
        setDownloadingStreamId(null);
      }, 1500);
    }
  };

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  // Safe client-side image upload for Thumbnail Studio (zero server upload, zero SQLite storage)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setThumbActionError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setThumbActionError('Only JPG, PNG, and WebP images are supported.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setThumbActionError('Image size must be 15 MB or smaller.');
      return;
    }

    if (uploadedImageSrc && uploadedImageSrc.startsWith('blob:')) {
      URL.revokeObjectURL(uploadedImageSrc);
    }

    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_\-]+/g, '-').toLowerCase();
    setUploadedFileName(baseName || 'custom-thumbnail');
    setUploadedImageSrc(URL.createObjectURL(file));
    setNaturalDims(null);
  };

  const activeThumbSource = uploadedImageSrc || result?.thumbnailInfo?.proxyUrl || null;

  const getAutoFilename = (): string => {
    const resLabel = thumbRes;
    if (uploadedImageSrc) {
      return `${uploadedFileName}-${resLabel}.${thumbFormat}`;
    }
    if (result) {
      const slug = result.contentId
        ? result.contentId.replace(/[^a-zA-Z0-9_\-]+/g, '-').slice(0, 24)
        : 'media';
      return `${result.platform}-${slug}-${resLabel}.${thumbFormat}`;
    }
    return `thumbnail-${resLabel}.${thumbFormat}`;
  };

  const renderToCanvasBlob = (
    src: string,
    targetFormat: 'image/jpeg' | 'image/png' | 'image/webp',
    resolution: ThumbResolution
  ): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const resMeta = RESOLUTION_OPTIONS.find((r) => r.id === resolution);
        const targetW = resMeta?.width || img.naturalWidth || 1280;
        const targetH = resMeta?.height || img.naturalHeight || 720;

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        // Fill black background for JPEG transparency safety
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, targetW, targetH);

        // Cover crop to preserve aspect ratio cleanly without distortion
        const srcRatio = img.naturalWidth / img.naturalHeight;
        const dstRatio = targetW / targetH;
        let drawW = targetW;
        let drawH = targetH;
        let offsetX = 0;
        let offsetY = 0;

        if (srcRatio > dstRatio) {
          drawW = targetH * srcRatio;
          offsetX = (targetW - drawW) / 2;
        } else if (srcRatio < dstRatio) {
          drawH = targetW / srcRatio;
          offsetY = (targetH - drawH) / 2;
        }

        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to encode image'));
              return;
            }
            resolve(blob);
          },
          targetFormat,
          0.92
        );
      };
      img.onerror = () => reject(new Error('Could not load source image for export'));
      img.src = src;
    });
  };

  const handleDownloadThumbnail = async () => {
    if (!activeThumbSource) return;
    setExportingThumb(true);
    setThumbActionError(null);

    try {
      const mimeMap: Record<ThumbFormat, 'image/jpeg' | 'image/png' | 'image/webp'> = {
        jpg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
      };
      const blob = await renderToCanvasBlob(activeThumbSource, mimeMap[thumbFormat], thumbRes);
      triggerBlobDownload(blob, getAutoFilename());
    } catch (err: any) {
      setThumbActionError(err.message || 'Failed to export thumbnail.');
    } finally {
      setExportingThumb(false);
    }
  };

  const handleCopyThumbnail = async () => {
    if (!activeThumbSource) return;
    setThumbActionError(null);

    try {
      if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
        throw new Error('Image clipboard copy is not supported in this browser.');
      }
      // Browsers require image/png for ClipboardItem image writes
      const pngBlob = await renderToCanvasBlob(activeThumbSource, 'image/png', thumbRes);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      setThumbCopied(true);
      setTimeout(() => setThumbCopied(false), 2200);
    } catch (err: any) {
      setThumbActionError(err.message || 'Clipboard permission denied or unsupported in this browser.');
    }
  };

  const brandMeta = result ? getPlatformMeta(result.platform) : null;

  return (
    <section id="media-tools" className="py-16 sm:py-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Media Tools</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Video Downloader &amp; Thumbnail Studio
        </h2>
        <p className="mt-4 text-sm sm:text-base text-zinc-400">
          Inspect permitted media downloads for content you own or have rights to use, or export high-resolution thumbnails in JPG, PNG, and WebP.
        </p>
      </div>

      {/* Main Card Container */}
      <div className="glass-card rounded-2xl border border-zinc-800/90 p-5 sm:p-8 shadow-2xl">
        {/* Exactly Two Primary Tabs */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 p-1.5 bg-zinc-900/90 border border-zinc-800 rounded-xl w-full sm:w-fit mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('video')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition ${
              activeTab === 'video'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/25'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Video Downloader</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('thumbnail')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition ${
              activeTab === 'thumbnail'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Thumbnail Studio</span>
          </button>
        </div>

        {/* Shared URL Input Bar */}
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              {detectedPlatform && detectedMeta ? (
                <PlatformIcon platform={detectedPlatform} className={`w-4 h-4 ${detectedMeta.iconColor}`} />
              ) : (
                <LinkIcon className="w-4 h-4 text-zinc-400" />
              )}
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              placeholder="Paste YouTube, Instagram, or Facebook URL..."
              className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-sm shadow-lg transition disabled:opacity-60 whitespace-nowrap"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>{activeTab === 'video' ? 'Check Media' : 'Load Thumbnail'}</span>
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs sm:text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* TAB 1: VIDEO DOWNLOADER */}
        {activeTab === 'video' && (
          <div className="mt-6 space-y-6 animate-fadeIn">
            <div className="flex items-start gap-2.5 text-xs text-zinc-400 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3.5">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p>
                <strong>Permitted Video Policy:</strong> Supports YouTube, Instagram, and Facebook URLs. Direct MP4/WebM downloads (360p–1080p) are offered only when legitimately exposed by official public endpoints. DRM, encrypted streams, and private content are never bypassed.
              </p>
            </div>

            {result && brandMeta && (
              <div className="pt-4 border-t border-zinc-800 space-y-6">
                {/* Metadata Preview Card */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <div className="w-full sm:w-44 aspect-video rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                    <img
                      src={result.metadata.thumbnailUrl}
                      alt={result.metadata.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase border ${brandMeta.badgeClass}`}
                      >
                        <PlatformIcon platform={result.platform} className="w-3 h-3" />
                        {brandMeta.label} {result.contentType}
                      </span>
                      <span className="text-xs text-zinc-400 truncate">{result.metadata.authorName}</span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-white line-clamp-2">
                      {result.metadata.title}
                    </h3>
                    <p className="text-[11px] text-zinc-500 font-mono truncate mt-1">{result.cleanUrl}</p>
                  </div>
                </div>

                {/* Permitted Video Streams OR Transparent Unsupported Notice */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {result.videoDownloadInfo.supported &&
                    result.videoDownloadInfo.availableStreams.length > 0 ? (
                      <div className="p-4 rounded-xl bg-zinc-900/70 border border-emerald-500/30 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                          <Download className="w-3.5 h-3.5" />
                          <span>Permitted Public Video Streams</span>
                        </h4>

                        <div className="space-y-2.5">
                          {result.videoDownloadInfo.availableStreams.map((stream) => (
                            <div
                              key={stream.id}
                              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-zinc-950/80 border border-zinc-800"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white">
                                    {stream.format} &bull; {stream.quality}
                                  </span>
                                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                                    {stream.fileSizeLabel}
                                  </span>
                                </div>
                                <p className="text-[11px] text-zinc-500 truncate max-w-[200px] mt-0.5">
                                  {stream.filename}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleStreamDownload(stream)}
                                disabled={downloadingStreamId !== null}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition disabled:opacity-50"
                              >
                                {downloadingStreamId === stream.id ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>{downloadProgress}%</span>
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download</span>
                                  </>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>

                        {(downloadingStreamId || downloadStatusMsg) && (
                          <div className="space-y-1.5 pt-2">
                            <div className="flex justify-between text-[11px] text-zinc-400">
                              <span>{downloadStatusMsg}</span>
                              <span>{downloadProgress}%</span>
                            </div>
                            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 transition-all duration-200"
                                style={{ width: `${downloadProgress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {downloadError && (
                          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-xs text-red-400">
                            {downloadError}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/25 space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4" />
                          <span>Direct Stream Download Unavailable</span>
                        </h4>
                        <p className="text-xs text-zinc-300 leading-relaxed">
                          {result.videoDownloadInfo.unsupportedReason}
                        </p>
                      </div>
                    )}

                    {/* Official Embed Snippet */}
                    {result.embedCode && (
                      <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                            <Code2 className="w-3.5 h-3.5" />
                            <span>Official Embed Snippet</span>
                          </h4>
                          <button
                            type="button"
                            onClick={handleCopyEmbed}
                            className="inline-flex items-center gap-1 text-xs text-zinc-300 hover:text-white px-2.5 py-1 rounded bg-zinc-800 transition"
                          >
                            {copiedEmbed ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy HTML</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 overflow-x-auto font-mono">
                          {result.embedCode}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Official Owner Download Guide */}
                  <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3 h-fit">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                      {result.officialOwnerGuide.title}
                    </h4>
                    <ol className="space-y-2.5 text-xs text-zinc-400 list-decimal list-inside">
                      {result.officialOwnerGuide.steps.map((step, i) => (
                        <li key={i} className="leading-relaxed">
                          {step}
                        </li>
                      ))}
                    </ol>
                    <div className="pt-2">
                      <a
                        href={result.officialOwnerGuide.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-emerald-400 transition"
                      >
                        <span>{result.officialOwnerGuide.officialLabel}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: THUMBNAIL STUDIO */}
        {activeTab === 'thumbnail' && (
          <div className="mt-6 space-y-6 animate-fadeIn">
            {/* Local Upload Option */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-zinc-900/60 border border-dashed border-zinc-700/80">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <FileImage className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-white">
                    Load from URL above or upload your own image
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Local images are processed safely in your browser (JPG, PNG, WebP up to 15 MB) — never stored on our server.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-white transition"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Upload Image</span>
                </button>
                {uploadedImageSrc && (
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedImageSrc(null);
                      setNaturalDims(null);
                    }}
                    className="px-2.5 py-2 rounded-lg bg-zinc-900 text-xs text-zinc-400 hover:text-white transition"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {activeThumbSource ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                {/* Preview Column */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-xl flex items-center justify-center">
                    <img
                      src={activeThumbSource}
                      alt="Thumbnail preview"
                      crossOrigin="anonymous"
                      onLoad={(e) => {
                        const target = e.target as HTMLImageElement;
                        setNaturalDims({ w: target.naturalWidth, h: target.naturalHeight });
                      }}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 px-1">
                    <span>
                      Source dimensions:{' '}
                      <strong className="text-zinc-200 font-mono">
                        {naturalDims ? `${naturalDims.w} × ${naturalDims.h}` : 'Loading...'}
                      </strong>
                    </span>
                    <span>
                      Output filename:{' '}
                      <strong className="text-emerald-400 font-mono">{getAutoFilename()}</strong>
                    </span>
                  </div>
                </div>

                {/* Controls Column */}
                <div className="lg:col-span-5 space-y-5 p-4 sm:p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 h-fit">
                  {/* Format Selection */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                      Export Format
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['jpg', 'png', 'webp'] as ThumbFormat[]).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setThumbFormat(fmt)}
                          className={`py-2 rounded-lg text-xs font-bold uppercase border transition ${
                            thumbFormat === fmt
                              ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                              : 'bg-zinc-950/80 border-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Resolution Selection */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                      Target Resolution
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {RESOLUTION_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setThumbRes(opt.id)}
                          className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                            thumbRes === opt.id
                              ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                              : 'bg-zinc-950/80 border-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={handleDownloadThumbnail}
                      disabled={exportingThumb}
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/25 transition disabled:opacity-50"
                    >
                      {exportingThumb ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Exporting...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Download {thumbFormat.toUpperCase()}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyThumbnail}
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs sm:text-sm font-semibold border border-zinc-700 transition"
                    >
                      {thumbCopied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>Copied Image!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy Image</span>
                        </>
                      )}
                    </button>
                  </div>

                  {thumbActionError && (
                    <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-xs text-red-400">
                      {thumbActionError}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-xs sm:text-sm text-zinc-500 bg-zinc-900/40 rounded-xl border border-zinc-800/60">
                Paste a YouTube, Instagram, or Facebook link above and click <strong>Load Thumbnail</strong>, or upload an image from your device to resize and export.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
