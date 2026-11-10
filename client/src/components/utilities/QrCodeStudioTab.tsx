import React, { useState, useRef, useMemo } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import {
  QrCode,
  Link2,
  Type,
  Mail,
  Phone,
  Wifi,
  MessageCircle,
  Download,
  Copy,
  Check,
  Upload,
  Trash2,
  AlertTriangle,
  Sparkles,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

type QrType = 'url' | 'linktwin' | 'text' | 'email' | 'phone' | 'wifi' | 'whatsapp';
type EcLevel = 'L' | 'M' | 'Q' | 'H';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  const full = clean.padEnd(6, '0').slice(0, 6);
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getContrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(hexToRgb(fgHex));
  const l2 = relativeLuminance(hexToRgb(bgHex));
  const bright = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (bright + 0.05) / (dark + 0.05);
}

const QR_TYPE_TABS: { id: QrType; label: string; icon: React.ReactNode }[] = [
  { id: 'url', label: 'URL', icon: <Link2 className="w-3.5 h-3.5" /> },
  { id: 'linktwin', label: 'LinkTwin Short Link', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: 'text', label: 'Plain Text', icon: <Type className="w-3.5 h-3.5" /> },
  { id: 'email', label: 'Email', icon: <Mail className="w-3.5 h-3.5" /> },
  { id: 'phone', label: 'Phone', icon: <Phone className="w-3.5 h-3.5" /> },
  { id: 'wifi', label: 'Wi-Fi', icon: <Wifi className="w-3.5 h-3.5" /> },
  { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle className="w-3.5 h-3.5" /> },
];

interface QrCodeStudioTabProps {
  defaultSize?: number;
  defaultEcLevel?: EcLevel;
}

export const QrCodeStudioTab: React.FC<QrCodeStudioTabProps> = ({
  defaultSize = 512,
  defaultEcLevel = 'M',
}) => {
  const [qrType, setQrType] = useState<QrType>('url');

  // Form states
  const [urlInput, setUrlInput] = useState('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const [socialTargetUrl, setSocialTargetUrl] = useState('');
  const [shortening, setShortening] = useState(false);
  const [generatedShortUrl, setGeneratedShortUrl] = useState('');

  const [textInput, setTextInput] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiEncryption, setWifiEncryption] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [wifiHidden, setWifiHidden] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [waMessage, setWaMessage] = useState('');

  // Styling & EC
  const [fgColor, setFgColor] = useState('#09090b');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [size, setSize] = useState<number>(defaultSize);
  const [ecLevel, setEcLevel] = useState<EcLevel>(defaultEcLevel);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoScale, setLogoScale] = useState<number>(20); // percentage of QR size
  const [excavateLogo, setExcavateLogo] = useState<boolean>(true);

  // Validation & active payload
  const [validatedPayload, setValidatedPayload] = useState<string>(
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  );
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const svgWrapRef = useRef<HTMLDivElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const contrastRatio = useMemo(() => getContrastRatio(fgColor, bgColor), [fgColor, bgColor]);
  const lowContrastWarning = contrastRatio < 3.0;
  const invertedContrastWarning = useMemo(() => {
    const fgLum = relativeLuminance(hexToRgb(fgColor));
    const bgLum = relativeLuminance(hexToRgb(bgColor));
    return fgLum > bgLum;
  }, [fgColor, bgColor]);

  const effectiveEcLevel: EcLevel = logoUrl && ecLevel !== 'H' ? 'H' : ecLevel;

  const buildRequestData = (): Record<string, any> => {
    switch (qrType) {
      case 'url':
        return { url: urlInput };
      case 'linktwin':
        return { url: generatedShortUrl || socialTargetUrl };
      case 'text':
        return { text: textInput };
      case 'email':
        return { email: emailTo, subject: emailSubject, body: emailBody };
      case 'phone':
        return { phone: phoneInput };
      case 'wifi':
        return {
          ssid: wifiSsid,
          password: wifiPassword,
          encryption: wifiEncryption,
          hidden: wifiHidden,
        };
      case 'whatsapp':
        return { phone: waPhone, message: waMessage };
    }
  };

  const handleGenerateQr = async () => {
    setError(null);
    setValidating(true);
    try {
      const res = await fetch('/api/utilities/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: qrType, data: buildRequestData() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || 'Could not validate QR payload.');
        return;
      }
      setValidatedPayload(json.payload);
    } catch {
      setError('Network error while validating QR payload.');
    } finally {
      setValidating(false);
    }
  };

  const handleShortenAndApply = async () => {
    setError(null);
    if (!socialTargetUrl.trim()) {
      setError('Paste a YouTube, Instagram, or Facebook URL to shorten.');
      return;
    }
    setShortening(true);
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: socialTargetUrl.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || 'Failed to generate LinkTwin Smart Link.');
        return;
      }
      const short = json.shortUrl || `${window.location.origin}/${json.link?.short_code}`;
      setGeneratedShortUrl(short);
      setValidatedPayload(short);
    } catch {
      setError('Network error while creating LinkTwin Smart Link.');
    } finally {
      setShortening(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setError('Logo must be PNG, JPG, WebP, or SVG.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo image must be under 2 MB.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(String(reader.result || ''));
      setEcLevel('H'); // Auto-set High error correction for logo scannability
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadPng = () => {
    const canvas = canvasWrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `linktwin-qr-${qrType}-${size}px.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadSvg = () => {
    const svgEl = svgWrapRef.current?.querySelector('svg');
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svgEl);
    if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
      svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linktwin-qr-${qrType}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyPayload = async () => {
    if (!validatedPayload) return;
    await navigator.clipboard.writeText(validatedPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const logoSizePx = Math.round((size * logoScale) / 100);
  const previewLogoSizePx = Math.round((240 * logoScale) / 100);

  return (
    <div className="space-y-6">
      {/* QR Type Selector */}
      <div className="flex flex-wrap gap-2">
        {QR_TYPE_TABS.map((t) => {
          const active = qrType === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setQrType(t.id);
                setError(null);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                active
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Controls */}
        <div className="lg:col-span-7 space-y-5">
          {/* Dynamic Form Fields */}
          <div className="p-4 sm:p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4">
            {qrType === 'url' && (
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Destination URL
                </label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/your-link"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                />
              </div>
            )}

            {qrType === 'linktwin' && (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-zinc-300">
                  YouTube, Instagram, or Facebook URL → Smart Short Link QR
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={socialTargetUrl}
                    onChange={(e) => setSocialTargetUrl(e.target.value)}
                    placeholder="https://www.instagram.com/reel/..."
                    className="flex-1 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                  />
                  <button
                    type="button"
                    onClick={handleShortenAndApply}
                    disabled={shortening}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold transition-colors disabled:opacity-60"
                  >
                    {shortening ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Create &amp; Bind Short Link
                  </button>
                </div>
                {generatedShortUrl && (
                  <p className="text-xs text-emerald-400 font-mono break-all">
                    Bound Smart Link: {generatedShortUrl}
                  </p>
                )}
              </div>
            )}

            {qrType === 'text' && (
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Plain Text ({textInput.length}/2000)
                </label>
                <textarea
                  rows={4}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Enter notes, coupon code, instructions, or contact text..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                />
              </div>
            )}

            {qrType === 'email' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Recipient Email</label>
                  <input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="creator@example.com"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Subject (Optional)</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Collaboration inquiry"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Body (Optional)</label>
                  <textarea
                    rows={2}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    placeholder="Hi there..."
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
              </div>
            )}

            {qrType === 'phone' && (
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Phone Number (include country code, e.g. +14155552671)
                </label>
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+14155552671"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/60"
                />
              </div>
            )}

            {qrType === 'wifi' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Network Name (SSID)</label>
                  <input
                    type="text"
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    placeholder="StudioGuest5G"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Security</label>
                  <select
                    value={wifiEncryption}
                    onChange={(e) => setWifiEncryption(e.target.value as 'WPA' | 'WEP' | 'nopass')}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/60"
                  >
                    <option value="WPA">WPA / WPA2 / WPA3</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">Open (No Password)</option>
                  </select>
                </div>
                {wifiEncryption !== 'nopass' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Password</label>
                    <input
                      type="text"
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                      placeholder="Wi-Fi password"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/60"
                    />
                  </div>
                )}
                <label className="sm:col-span-2 inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wifiHidden}
                    onChange={(e) => setWifiHidden(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-950 text-emerald-500"
                  />
                  Hidden SSID network
                </label>
              </div>
            )}

            {qrType === 'whatsapp' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    WhatsApp Number (with country code, e.g. +14155552671)
                  </label>
                  <input
                    type="tel"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    placeholder="+14155552671"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Prefilled Chat Message (Optional)</label>
                  <input
                    type="text"
                    value={waMessage}
                    onChange={(e) => setWaMessage(e.target.value)}
                    placeholder="Hello! Scanning your LinkTwin QR code."
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
              </div>
            )}

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={handleGenerateQr}
                disabled={validating}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold transition-colors disabled:opacity-60"
              >
                {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                Validate &amp; Update QR Code
              </button>
            </div>
          </div>

          {/* Customization Controls */}
          <div className="p-4 sm:p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Appearance, Error Correction &amp; Center Logo
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Foreground</label>
                <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5">
                  <input
                    type="color"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-zinc-300">{fgColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Background</label>
                <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-zinc-300">{bgColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Export Size</label>
                <select
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  className="w-full px-2.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none"
                >
                  <option value={256}>256 × 256 px</option>
                  <option value={384}>384 × 384 px</option>
                  <option value={512}>512 × 512 px</option>
                  <option value={768}>768 × 768 px</option>
                  <option value={1024}>1024 × 1024 px</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Error Correction</label>
                <select
                  value={effectiveEcLevel}
                  onChange={(e) => setEcLevel(e.target.value as EcLevel)}
                  className="w-full px-2.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none"
                >
                  <option value="L" disabled={Boolean(logoUrl)}>L (7% recovery)</option>
                  <option value="M" disabled={Boolean(logoUrl)}>M (15% recovery)</option>
                  <option value="Q" disabled={Boolean(logoUrl)}>Q (25% recovery)</option>
                  <option value="H">H (30% — Best w/ logo)</option>
                </select>
              </div>
            </div>

            {/* Scannability Feedback */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Contrast Ratio</span>
                <span
                  className={`font-mono font-medium ${
                    lowContrastWarning ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {contrastRatio.toFixed(2)} : 1 {lowContrastWarning ? '(Low contrast)' : '(Scannable)'}
                </span>
              </div>
              {lowContrastWarning && (
                <p className="text-xs text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Low foreground/background contrast may prevent older phone cameras from scanning.
                </p>
              )}
              {invertedContrastWarning && (
                <p className="text-xs text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Dark background with light foreground can fail on certain Android/iOS scanners; test on device before printing.
                </p>
              )}
            </div>

            {/* Center Logo Controls */}
            <div className="pt-2 border-t border-zinc-800/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {logoUrl ? 'Replace Center Logo' : 'Upload Center Logo'}
                  </button>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoUrl(null);
                        if (logoInputRef.current) logoInputRef.current.value = '';
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-xs text-rose-300 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  )}
                </div>
                {logoUrl && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Auto-enforced Level H (30%) error correction
                  </span>
                )}
              </div>

              {logoUrl && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      Logo Coverage: {logoScale}% (keep ≤ 22% for reliable scans)
                    </label>
                    <input
                      type="range"
                      min={12}
                      max={26}
                      value={logoScale}
                      onChange={(e) => setLogoScale(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={excavateLogo}
                      onChange={(e) => setExcavateLogo(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-950 text-emerald-500"
                    />
                    Clear QR modules behind logo (excavate)
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Live Preview & Export */}
        <div className="lg:col-span-5 flex flex-col items-center justify-between p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div className="w-full flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Live Scannable Preview
            </span>
            <span className="text-[11px] font-mono text-zinc-500">
              EC: {effectiveEcLevel} · {size}px
            </span>
          </div>

          {/* Visible Preview (Fixed crisp 240px display) */}
          <div
            className="p-4 rounded-2xl border border-zinc-800 shadow-lg flex items-center justify-center"
            style={{ backgroundColor: bgColor }}
          >
            <QRCodeCanvas
              value={validatedPayload || 'https://linktwin.app'}
              size={240}
              bgColor={bgColor}
              fgColor={fgColor}
              level={effectiveEcLevel}
              includeMargin
              imageSettings={
                logoUrl
                  ? {
                      src: logoUrl,
                      height: previewLogoSizePx,
                      width: previewLogoSizePx,
                      excavate: excavateLogo,
                    }
                  : undefined
              }
            />
          </div>

          {/* Hidden Full-Resolution Canvas & SVG for Export */}
          <div ref={canvasWrapRef} className="hidden" aria-hidden="true">
            <QRCodeCanvas
              value={validatedPayload || 'https://linktwin.app'}
              size={size}
              bgColor={bgColor}
              fgColor={fgColor}
              level={effectiveEcLevel}
              includeMargin
              imageSettings={
                logoUrl
                  ? {
                      src: logoUrl,
                      height: logoSizePx,
                      width: logoSizePx,
                      excavate: excavateLogo,
                    }
                  : undefined
              }
            />
          </div>
          <div ref={svgWrapRef} className="hidden" aria-hidden="true">
            <QRCodeSVG
              value={validatedPayload || 'https://linktwin.app'}
              size={size}
              bgColor={bgColor}
              fgColor={fgColor}
              level={effectiveEcLevel}
              includeMargin
              imageSettings={
                logoUrl
                  ? {
                      src: logoUrl,
                      height: logoSizePx,
                      width: logoSizePx,
                      excavate: excavateLogo,
                    }
                  : undefined
              }
            />
          </div>

          {/* Encoded Payload Box */}
          <div className="w-full p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2">
            <code className="text-[11px] text-zinc-300 truncate">{validatedPayload}</code>
            <button
              type="button"
              onClick={handleCopyPayload}
              className="shrink-0 p-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Copy QR payload"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Export Buttons */}
          <div className="w-full grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleDownloadPng}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export PNG ({size}px)
            </button>
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold border border-zinc-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export Vector SVG
            </button>
          </div>

          <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
            Point your phone camera directly at the preview above to verify instant recognition before downloading.
          </p>
        </div>
      </div>
    </div>
  );
};
