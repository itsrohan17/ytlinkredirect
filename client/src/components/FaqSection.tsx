import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export const FaqSection: React.FC = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does LinkTwin open the YouTube app directly on mobile devices?',
      a: 'On Android devices, we use intent-based deep linking (intent://...#Intent;package=com.google.android.youtube...) which the Android OS detects to automatically launch the native YouTube application. On iOS (iPhone and iPad), we invoke the official youtube:// custom URI scheme and Universal Links. Both approaches bypass the restricted in-app browser WebView.',
    },
    {
      q: 'What happens if a user does not have the YouTube app installed?',
      a: 'If the YouTube app is not found on their device, our smart redirection engine detects it and immediately falls back to loading the original video in their mobile browser (Safari, Chrome, Firefox). Viewers never see a broken page or dead end.',
    },
    {
      q: 'Does it work when links are shared on WhatsApp, Instagram, and Telegram?',
      a: 'Yes, 100%! When you share a LinkTwin link in WhatsApp, Telegram, or Discord, our server provides full OpenGraph metadata so the chat displays the video thumbnail, title, and channel name. When opened inside Instagram stories or bio, our specialized in-app handler guides the browser to launch the YouTube app directly.',
    },
    {
      q: 'Are the generated links permanent?',
      a: 'Yes. All generated links are stored permanently in our indexed database. There are no expiration dates, no click limits, and no sudden paywalls.',
    },
    {
      q: 'Can I choose my own custom link slug?',
      a: 'Yes! Simply toggle the "Customize link alias / slug" option before generating your link to create memorable custom URLs like yourdomain.com/my-music-video or /subscribe-here.',
    },
    {
      q: 'Do I need to sign up or create an account?',
      a: 'No login, no password, and no credit card required. LinkTwin is completely friction-free and ready to use immediately.',
    },
  ];

  const toggleFaq = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-16 sm:py-24 max-w-4xl mx-auto px-4 sm:px-6">
      <div className="text-center mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider mb-4">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Frequently Asked Questions</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Everything You Need to Know
        </h2>
        <p className="mt-4 text-base text-zinc-400">
          Learn how smart deep links maximize creator engagement and channel growth.
        </p>
      </div>

      <div className="space-y-3.5">
        {faqs.map((faq, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div
              key={idx}
              className="rounded-2xl glass-card border border-zinc-800/80 overflow-hidden transition"
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 text-white hover:text-red-400 transition"
              >
                <span className="font-bold text-sm sm:text-base">{faq.q}</span>
                <ChevronDown
                  className={`w-5 h-5 flex-shrink-0 text-zinc-400 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-red-500' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-zinc-400 leading-relaxed border-t border-zinc-800/50 animate-fadeIn">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
