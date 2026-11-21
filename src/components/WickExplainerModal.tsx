import React from 'react';
import { X, Droplets, Wind, ArrowUp } from 'lucide-react';

interface WickExplainerModalProps {
  open: boolean;
  onClose: () => void;
}

export const WickExplainerModal: React.FC<WickExplainerModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/75 flex items-center justify-center p-4">
      <div className="relative max-w-md w-full rounded-2xl bg-slate-950 border border-sky-500/45 p-5 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close wicking diagram"
          className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-base font-bold text-white">How Passive Self-Watering Works</h2>

        {/* Crisp Procedural Cross-Section Diagram of PVC Pipe + Wick + Air Gap */}
        <div className="mt-3 rounded-xl bg-slate-900 border border-slate-800 p-3">
          <svg viewBox="0 0 360 175" className="w-full h-auto" aria-label="PVC Capillary Wick Cross-Section">
            {/* PVC Pipe Outer Cross-Section */}
            <rect x="30" y="54" width="300" height="100" rx="46" fill="#1e293b" stroke="#e2e8f0" strokeWidth="6" />
            {/* Shaded Water Reservoir at Bottom */}
            <path d="M 40 118 Q 180 113 320 118 L 320 132 Q 300 150 280 150 L 80 150 Q 60 150 40 132 Z" fill="#0284c7" opacity="0.78" />
            {/* Air Gap Band */}
            <rect x="42" y="88" width="276" height="28" fill="#0f172a" opacity="0.55" />
            <text x="245" y="106" fill="#93c5fd" fontSize="11" fontFamily="monospace">OXYGEN AIR GAP</text>

            {/* Net Cup + Soil/LECA Seated in Top Port */}
            <path d="M 142 36 L 198 36 L 190 82 L 150 82 Z" fill="#334155" stroke="#64748b" strokeWidth="2" />
            <path d="M 146 38 L 194 38 L 190 66 L 150 66 Z" fill="#5c3d24" />
            {/* Seedling */}
            <line x1="170" y1="38" x2="170" y2="14" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="160" cy="18" rx="9" ry="4" transform="rotate(-22 160 18)" fill="#22c55e" />
            <ellipse cx="180" cy="16" rx="9" ry="4" transform="rotate(20 180 16)" fill="#4ade80" />

            {/* Braided Cotton Wick Going Down Into Water */}
            <path d="M 170 62 Q 165 95 173 142" stroke="#bae6fd" strokeWidth="7" strokeLinecap="round" fill="none" />
            <path d="M 170 62 Q 165 95 173 142" stroke="#38bdf8" strokeWidth="3" strokeDasharray="5 5" strokeLinecap="round" fill="none" />

            {/* Upward Capillary Arrows */}
            <path d="M 132 130 L 132 76" stroke="#38bdf8" strokeWidth="2" markerEnd="url(#arrow)" />
            <text x="58" y="140" fill="#e0f2fe" fontSize="11" fontFamily="monospace">SHADED WATER</text>
            <text x="54" y="74" fill="#6ee7b7" fontSize="11" fontFamily="monospace">MOIST SOIL/LECA</text>
          </svg>
        </div>

        <div className="mt-3 space-y-2.5 text-xs text-slate-200">
          <div className="flex items-start gap-2.5">
            <Droplets className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <p>
              <strong className="text-white">1. Shaded Reservoir:</strong> Water sits inside the enclosed PVC tube, blocking sunlight and cutting evaporation during hot El Niño days.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <Wind className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              <strong className="text-white">2. Oxygen Air Gap:</strong> Net-cups sit above the waterline so roots breathe oxygen and never drown or rot.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <ArrowUp className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <p>
              <strong className="text-white">3. Capillary Wicking:</strong> Cotton fibers pull water upward only as fast as the plant drinks—zero electricity or pumps.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
