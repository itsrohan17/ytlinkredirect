import React, { useState } from 'react';
import { QrCode, Eye, FileArchive, Wrench } from 'lucide-react';
import { QrCodeStudioTab } from './utilities/QrCodeStudioTab';
import { SocialPreviewTesterTab } from './utilities/SocialPreviewTesterTab';
import { FileCompressorTab } from './utilities/FileCompressorTab';

type UtilityTab = 'qr' | 'preview' | 'compressor';

export const UtilitiesSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<UtilityTab>('qr');

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
    <section id="utilities-toolkit" className="py-12 sm:py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4">
          <Wrench className="w-3.5 h-3.5" />
          <span>LinkTwin Creator Toolkit</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          QR Studio, Social Previews &amp; Compression
        </h2>
        <p className="mt-4 text-sm sm:text-base text-zinc-400">
          Generate branded scannable QR codes, audit how links appear on WhatsApp, Telegram, and Facebook, and compress images, PDFs, audio, and video cleanly.
        </p>
      </div>

      <div className="glass-card rounded-2xl border border-zinc-800/90 p-5 sm:p-8 shadow-2xl">
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
          {activeTab === 'qr' && <QrCodeStudioTab />}
          {activeTab === 'preview' && <SocialPreviewTesterTab />}
          {activeTab === 'compressor' && <FileCompressorTab />}
        </div>
      </div>
    </section>
  );
};
