import React, { useState, useEffect, Suspense } from 'react';
import { QrCode, Eye, FileArchive, Loader2 } from 'lucide-react';

const QrCodeStudioTab = React.lazy(() =>
  import('./utilities/QrCodeStudioTab').then((m) => ({ default: m.QrCodeStudioTab }))
);
const SocialPreviewTesterTab = React.lazy(() =>
  import('./utilities/SocialPreviewTesterTab').then((m) => ({ default: m.SocialPreviewTesterTab }))
);
const FileCompressorTab = React.lazy(() =>
  import('./utilities/FileCompressorTab').then((m) => ({ default: m.FileCompressorTab }))
);

export type UtilityTab = 'qr' | 'preview' | 'compressor';

interface UtilitiesSectionProps {
  embedded?: boolean;
  initialTab?: UtilityTab;
  defaultQrSize?: number;
  defaultQrEc?: 'L' | 'M' | 'Q' | 'H';
}

export const UtilitiesSection: React.FC<UtilitiesSectionProps> = ({
  embedded = false,
  initialTab,
  defaultQrSize = 512,
  defaultQrEc = 'M',
}) => {
  const [activeTab, setActiveTab] = useState<UtilityTab>(initialTab || 'qr');

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const tabs: Array<{ id: UtilityTab; label: string; icon: React.ReactNode; activeClass: string }> = [
    {
      id: 'qr',
      label: 'QR Code Studio',
      icon: <QrCode className="w-4 h-4" />,
      activeClass: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25',
    },
    {
      id: 'preview',
      label: 'Social Preview Tester',
      icon: <Eye className="w-4 h-4" />,
      activeClass: 'bg-sky-600 text-white shadow-md shadow-sky-600/25',
    },
    {
      id: 'compressor',
      label: 'File Compressor',
      icon: <FileArchive className="w-4 h-4" />,
      activeClass: 'bg-amber-600 text-white shadow-md shadow-amber-600/25',
    },
  ];

  return (
    <section
      id="utilities-toolkit"
      className={embedded ? 'lt-adaptive-surface space-y-4' : 'py-12 sm:py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8'}
    >
      {!embedded && (
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
            QR Studio, Social Previews &amp; Compression
          </h2>
          <p className="mt-4 text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
            Generate branded scannable QR codes, audit how links appear on WhatsApp, Telegram, and Facebook, and compress images, PDFs, audio, and video cleanly.
          </p>
        </div>
      )}

      <div className="glass-card rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 p-1.5 bg-zinc-900/90 border border-zinc-800 rounded-xl w-full sm:w-fit mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition ${
                activeTab === tab.id ? tab.activeClass : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div>
          <Suspense
            fallback={
              <div className="py-12 flex items-center justify-center gap-2 text-xs text-zinc-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading utility module...
              </div>
            }
          >
            {activeTab === 'qr' && (
              <QrCodeStudioTab defaultSize={defaultQrSize} defaultEcLevel={defaultQrEc} />
            )}
            {activeTab === 'preview' && <SocialPreviewTesterTab />}
            {activeTab === 'compressor' && <FileCompressorTab />}
          </Suspense>
        </div>
      </div>
    </section>
  );
};
