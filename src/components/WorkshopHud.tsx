import React from 'react';
import { Eye, RotateCcw, Volume2, VolumeX, Sparkles } from 'lucide-react';
import type { WorkshopHudState } from '../workshop/KitchenWorkshopScene';
import { BUILD_STEPS, type GradeTier } from '../workshop/steps';

interface WorkshopHudProps {
  hudState: WorkshopHudState;
  gradeTier: GradeTier;
  muted: boolean;
  onSelectGrade: (tier: GradeTier) => void;
  onReplayVoiceover: () => void;
  onToggleMute: () => void;
  onToggleCutaway: () => void;
  onReset: () => void;
}

const GRADE_TIERS: Array<{ id: GradeTier; label: string }> = [
  { id: '4-6', label: 'G4–6' },
  { id: '7-9', label: 'G7–9' },
  { id: '10-12', label: 'G10–12' },
];

export const WorkshopHud: React.FC<WorkshopHudProps> = ({
  hudState,
  gradeTier,
  muted,
  onSelectGrade,
  onReplayVoiceover,
  onToggleMute,
  onToggleCutaway,
  onReset,
}) => {
  const step = BUILD_STEPS[hudState.stepId];
  const isComplete = hudState.stepId === 'COMPLETE';
  const ringCircumference = 2 * Math.PI * 16;
  const ringOffset = ringCircumference * (1 - hudState.subProgress);

  return (
    <>
      {/* Center Aiming Reticle */}
      <div className="fixed inset-0 pointer-events-none z-20 flex items-center justify-center">
        {hudState.manualAimMode && hudState.inRange ? (
          <div className="relative flex flex-col items-center justify-center">
            <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
              <circle
                cx="22"
                cy="22"
                r="16"
                fill="none"
                stroke={hudState.reticleAligned ? 'rgba(52,211,153,0.4)' : 'rgba(251,191,36,0.48)'}
                strokeWidth="2.5"
              />
              {hudState.subProgress > 0 && (
                <circle
                  cx="22"
                  cy="22"
                  r="16"
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                />
              )}
            </svg>
            <div
              className={`absolute w-2 h-2 rounded-full ${
                hudState.reticleAligned ? 'bg-emerald-400' : 'bg-amber-300'
              }`}
            />
          </div>
        ) : (
          <div
            className={`w-1.5 h-1.5 rounded-full transition-transform ${
              hudState.inRange && !isComplete
                ? 'bg-emerald-400 scale-150'
                : 'bg-white/60'
            }`}
          />
        )}
      </div>

      {/* Top-Left Ultra-Minimal Step Chip + Guide Pop-Up Trigger (No static text walls) */}
      <div className="fixed top-4 left-4 z-20 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={onReplayVoiceover}
          title="Summon Prof. E Voice Guide"
          className="flex items-center gap-2 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-slate-700/80 px-3 py-2 shadow-lg transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-xs font-mono font-semibold text-emerald-400 tabular-nums">
            {isComplete ? '8/8' : `${step.stepNumber}/${step.totalSteps}`}
          </span>
          <span className="text-xs sm:text-sm font-semibold text-white">
            {step.title}
          </span>
          {hudState.manualAimMode && (
            <span className="text-xs font-mono font-semibold text-amber-300 tabular-nums">
              {hudState.completedSubSteps}/{hudState.totalSubSteps}
            </span>
          )}
        </button>
      </div>

      {/* Top-Right Compact Utility Controls */}
      <div className="fixed top-4 right-4 z-20 flex flex-col items-end gap-1.5 pointer-events-auto">
        <div className="flex items-center gap-1.5">
          <div
            role="group"
            aria-label="Grade Tier"
            className="hidden sm:flex items-center rounded-lg bg-slate-950/90 border border-slate-700/80 p-0.5 text-[11px] font-mono"
          >
            {GRADE_TIERS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onSelectGrade(g.id)}
                className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  gradeTier === g.id
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          {hudState.cutawayAvailable && (
            <button
              type="button"
              onClick={onToggleCutaway}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                hudState.cutawayMode
                  ? 'bg-sky-600 text-white border-sky-400'
                  : 'bg-slate-950/90 text-slate-200 border-slate-700/80 hover:bg-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{hudState.cutawayMode ? 'Cutaway On' : 'Cutaway'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio and voiceover' : 'Mute audio and voiceover'}
            className="p-2 rounded-lg bg-slate-950/90 text-slate-200 border border-slate-700/80 hover:bg-slate-900 transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onReset}
            aria-label="Reset workshop"
            title="Reset Workshop"
            className="p-2 rounded-lg bg-slate-950/90 text-slate-200 border border-slate-700/80 hover:bg-slate-900 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div
          role="group"
          aria-label="Grade Tier Mobile"
          className="flex sm:hidden items-center rounded-lg bg-slate-950/90 border border-slate-700/80 p-0.5 text-[10px] font-mono"
        >
          {GRADE_TIERS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelectGrade(g.id)}
              className={`px-1.5 py-0.5 rounded-md transition-colors cursor-pointer ${
                gradeTier === g.id
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
