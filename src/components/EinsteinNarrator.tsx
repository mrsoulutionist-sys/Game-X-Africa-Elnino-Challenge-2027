import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import type { VoiceoverState } from '../workshop/voiceover';

interface EinsteinNarratorProps {
  voiceover: VoiceoverState;
  onDismiss: () => void;
}

export const EinsteinNarrator: React.FC<EinsteinNarratorProps> = ({
  voiceover,
  onDismiss,
}) => {
  return (
    <AnimatePresence>
      {voiceover.active && (
        <motion.div
          key="einstein-narrator"
          initial={{ opacity: 0, y: 40, scale: 0.88 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 32, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 360, damping: 26 }}
          className="fixed top-[5.5rem] lg:top-auto lg:bottom-6 left-1/2 -translate-x-1/2 z-30 w-[calc(100vw-2rem)] max-w-md pointer-events-none"
        >
          <div className="relative flex items-end gap-3 rounded-2xl bg-slate-950/95 border border-emerald-500/45 px-3.5 py-3 shadow-2xl">
            {/* Animated Procedural SVG Einstein Scientist Mentor */}
            <motion.div
              animate={
                voiceover.speaking
                  ? { y: [0, -2.5, 0], rotate: [-1.5, 1.5, -1.5] }
                  : { y: 0, rotate: 0 }
              }
              transition={{ repeat: Infinity, duration: 1.3, ease: 'easeInOut' }}
              className="shrink-0 w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-xl bg-slate-900 border border-slate-700/80 overflow-hidden flex items-end justify-center"
            >
              <svg viewBox="0 0 96 96" className="w-full h-full" aria-hidden="true">
                {/* Lab Coat & Collar */}
                <path d="M16 96 C18 76 32 70 48 70 C64 70 78 76 80 96 Z" fill="#f1f5f9" />
                <path d="M38 71 L48 88 L58 71 Z" fill="#10b981" />
                <path d="M33 73 L44 92 L41 72 Z" fill="#cbd5e1" />
                <path d="M63 73 L52 92 L55 72 Z" fill="#cbd5e1" />
                {/* Hydroponic Leaf Pocket Pin */}
                <circle cx="62" cy="84" r="4" fill="#065f46" />
                <path d="M60 85 Q62 80 65 82 Q63 86 60 85 Z" fill="#34d399" />

                {/* Neck */}
                <rect x="42" y="62" width="12" height="11" rx="4" fill="#f1c29b" />

                {/* Wild Einstein Silver Hair Back Halo */}
                <path
                  d="M16 47 C9 40 12 26 22 25 C21 15 33 10 42 15 C48 8 59 10 62 17 C72 13 82 22 77 31 C86 35 84 48 76 50 L74 60 L22 60 L20 50 Z"
                  fill="#e2e8f0"
                />
                <path
                  d="M19 46 C14 41 16 32 23 31 C24 22 33 18 41 21 C47 16 56 17 60 22 C68 19 75 26 72 34 C78 38 76 47 70 48"
                  fill="#f8fafc"
                />

                {/* Ears */}
                <circle cx="26" cy="48" r="5" fill="#eab68d" />
                <circle cx="70" cy="48" r="5" fill="#eab68d" />

                {/* Head */}
                <ellipse cx="48" cy="47" rx="20" ry="22" fill="#f5cba7" />

                {/* Cheek & Forehead Expression Lines */}
                <path d="M39 33 Q48 31 57 33" stroke="#d9a57e" strokeWidth="1.4" fill="none" strokeLinecap="round" />

                {/* Bushy Silver Eyebrows */}
                <path d="M31 39 Q38 35 44 38" stroke="#f8fafc" strokeWidth="3.6" fill="none" strokeLinecap="round" />
                <path d="M52 38 Q58 35 65 39" stroke="#f8fafc" strokeWidth="3.6" fill="none" strokeLinecap="round" />

                {/* Expressive Eyes + Glasses */}
                <circle cx="38" cy="45" r="2.7" fill="#1e293b" />
                <circle cx="58" cy="45" r="2.7" fill="#1e293b" />
                <circle cx="38.9" cy="44" r="0.9" fill="#ffffff" />
                <circle cx="58.9" cy="44" r="0.9" fill="#ffffff" />

                <circle cx="38" cy="45" r="7.5" fill="none" stroke="#64748b" strokeWidth="1.6" />
                <circle cx="58" cy="45" r="7.5" fill="none" stroke="#64748b" strokeWidth="1.6" />
                <line x1="45.5" y1="45" x2="50.5" y2="45" stroke="#64748b" strokeWidth="1.6" />

                {/* Nose */}
                <path d="M48 45 L46 53 L50 54" stroke="#d49c73" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />

                {/* Animated Talking Mouth Behind Mustache */}
                <motion.ellipse
                  cx="48"
                  cy="61"
                  rx="5.2"
                  animate={
                    voiceover.speaking
                      ? { ry: [1.5, 4.2, 2.0, 4.6, 1.5] }
                      : { ry: 1.5 }
                  }
                  transition={{ repeat: Infinity, duration: 0.42, ease: 'easeInOut' }}
                  fill="#7f1d1d"
                />

                {/* Iconic Fluffy Einstein Mustache */}
                <motion.path
                  d="M31 58 C34 52 44 52 48 56 C52 52 62 52 65 58 C60 61 52 60 48 58 C44 60 36 61 31 58 Z"
                  fill="#f8fafc"
                  animate={voiceover.speaking ? { y: [0, -0.8, 0.4, 0] } : { y: 0 }}
                  transition={{ repeat: Infinity, duration: 0.36 }}
                />
              </svg>
            </motion.div>

            {/* Concise Spoken Dialogue Bubble */}
            <div className="flex-1 min-w-0 pr-5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                Prof. E · Lab Guide
              </div>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-100 leading-snug">
                {voiceover.text}
              </p>
            </div>

            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss guide"
              className="absolute top-2 right-2 p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
