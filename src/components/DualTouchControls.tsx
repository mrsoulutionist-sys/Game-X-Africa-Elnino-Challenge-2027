import React, { useEffect, useRef, useState } from 'react';
import { Hammer, Eye, Crosshair, Footprints } from 'lucide-react';

interface DualTouchControlsProps {
  onMoveInput: (x: number, y: number) => void;
  onLookDelta: (dx: number, dy: number) => void;
  onTapViewport: (clientX: number, clientY: number) => void;
  onActionStart: () => void;
  onActionEnd: () => void;
  actionLabel: string;
  targetLabel: string;
  inRange: boolean;
  isBusy: boolean;
  isComplete: boolean;
  isDoorTarget?: boolean;
  manualAimMode: boolean;
  reticleAligned: boolean;
  subProgress: number;
  completedSubSteps: number;
  totalSubSteps: number;
}

const MAX_STICK_RADIUS = 44;

export const DualTouchControls: React.FC<DualTouchControlsProps> = ({
  onMoveInput,
  onLookDelta,
  onTapViewport,
  onActionStart,
  onActionEnd,
  actionLabel,
  targetLabel,
  inRange,
  isBusy,
  isComplete,
  isDoorTarget = false,
  manualAimMode,
  reticleAligned,
  subProgress,
  completedSubSteps,
  totalSubSteps,
}) => {
  const lookLayerRef = useRef<HTMLDivElement | null>(null);
  const stickBaseRef = useRef<HTMLDivElement | null>(null);

  const moveTouchIdRef = useRef<number | null>(null);
  const moveCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const stickMouseActiveRef = useRef(false);

  const lookTouchIdRef = useRef<number | null>(null);
  const lookLastRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseLookActiveRef = useRef(false);
  const mouseDownStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseLookLastRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const actionTouchIdRef = useRef<number | null>(null);

  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const lookEl = lookLayerRef.current;
    const stickEl = stickBaseRef.current;
    if (!lookEl || !stickEl) return;

    const updateStickFromClient = (clientX: number, clientY: number) => {
      const dx = clientX - moveCenterRef.current.x;
      const dy = clientY - moveCenterRef.current.y;
      const dist = Math.hypot(dx, dy);
      const clampedDist = Math.min(MAX_STICK_RADIUS, dist);
      const angle = Math.atan2(dy, dx);
      const kx = dist > 0.5 ? Math.cos(angle) * clampedDist : 0;
      const ky = dist > 0.5 ? Math.sin(angle) * clampedDist : 0;

      setKnobOffset({ x: kx, y: ky });
      onMoveInput(kx / MAX_STICK_RADIUS, -ky / MAX_STICK_RADIUS);
    };

    const resetStick = () => {
      moveTouchIdRef.current = null;
      stickMouseActiveRef.current = false;
      setKnobOffset({ x: 0, y: 0 });
      onMoveInput(0, 0);
    };

    const onStickTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (moveTouchIdRef.current !== null) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const rect = stickEl.getBoundingClientRect();
      moveTouchIdRef.current = touch.identifier;
      moveCenterRef.current = {
        x: rect.left + rect.width * 0.5,
        y: rect.top + rect.height * 0.5,
      };
      updateStickFromClient(touch.clientX, touch.clientY);
    };

    const onStickTouchMove = (e: TouchEvent) => {
      if (moveTouchIdRef.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === moveTouchIdRef.current) {
          e.preventDefault();
          e.stopPropagation();
          updateStickFromClient(t.clientX, t.clientY);
          break;
        }
      }
    };

    const onStickTouchEnd = (e: TouchEvent) => {
      if (moveTouchIdRef.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === moveTouchIdRef.current) {
          e.preventDefault();
          resetStick();
          break;
        }
      }
    };

    const onLookTouchStart = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === moveTouchIdRef.current || t.identifier === actionTouchIdRef.current) {
          continue;
        }
        if (lookTouchIdRef.current === null) {
          e.preventDefault();
          lookTouchIdRef.current = t.identifier;
          lookLastRef.current = { x: t.clientX, y: t.clientY };
          break;
        }
      }
    };

    const onLookTouchMove = (e: TouchEvent) => {
      if (lookTouchIdRef.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === lookTouchIdRef.current) {
          e.preventDefault();
          const dx = t.clientX - lookLastRef.current.x;
          const dy = t.clientY - lookLastRef.current.y;
          lookLastRef.current = { x: t.clientX, y: t.clientY };
          onLookDelta(dx, dy);
          break;
        }
      }
    };

    const onLookTouchEnd = (e: TouchEvent) => {
      if (lookTouchIdRef.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === lookTouchIdRef.current) {
          lookTouchIdRef.current = null;
          break;
        }
      }
    };

    stickEl.addEventListener('touchstart', onStickTouchStart, { passive: false });
    window.addEventListener('touchmove', onStickTouchMove, { passive: false });
    window.addEventListener('touchend', onStickTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onStickTouchEnd, { passive: false });

    lookEl.addEventListener('touchstart', onLookTouchStart, { passive: false });
    window.addEventListener('touchmove', onLookTouchMove, { passive: false });
    window.addEventListener('touchend', onLookTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onLookTouchEnd, { passive: false });

    return () => {
      stickEl.removeEventListener('touchstart', onStickTouchStart);
      window.removeEventListener('touchmove', onStickTouchMove);
      window.removeEventListener('touchend', onStickTouchEnd);
      window.removeEventListener('touchcancel', onStickTouchEnd);

      lookEl.removeEventListener('touchstart', onLookTouchStart);
      window.removeEventListener('touchmove', onLookTouchMove);
      window.removeEventListener('touchend', onLookTouchEnd);
      window.removeEventListener('touchcancel', onLookTouchEnd);
    };
  }, [onMoveInput, onLookDelta]);

  useEffect(() => {
    const onWinMouseMove = (e: MouseEvent) => {
      if (stickMouseActiveRef.current) {
        const dx = e.clientX - moveCenterRef.current.x;
        const dy = e.clientY - moveCenterRef.current.y;
        const dist = Math.hypot(dx, dy);
        const clamped = Math.min(MAX_STICK_RADIUS, dist);
        const ang = Math.atan2(dy, dx);
        const kx = dist > 0.5 ? Math.cos(ang) * clamped : 0;
        const ky = dist > 0.5 ? Math.sin(ang) * clamped : 0;
        setKnobOffset({ x: kx, y: ky });
        onMoveInput(kx / MAX_STICK_RADIUS, -ky / MAX_STICK_RADIUS);
        return;
      }
      if (mouseLookActiveRef.current) {
        const dx = e.clientX - mouseLookLastRef.current.x;
        const dy = e.clientY - mouseLookLastRef.current.y;
        mouseLookLastRef.current = { x: e.clientX, y: e.clientY };
        onLookDelta(dx, dy);
      }
    };

    const onWinMouseUp = (e: MouseEvent) => {
      if (stickMouseActiveRef.current) {
        stickMouseActiveRef.current = false;
        setKnobOffset({ x: 0, y: 0 });
        onMoveInput(0, 0);
      }
      if (mouseLookActiveRef.current) {
        mouseLookActiveRef.current = false;
        const moved = Math.hypot(
          e.clientX - mouseDownStartRef.current.x,
          e.clientY - mouseDownStartRef.current.y
        );
        if (moved < 6) {
          onTapViewport(e.clientX, e.clientY);
        }
      }
    };

    window.addEventListener('mousemove', onWinMouseMove);
    window.addEventListener('mouseup', onWinMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWinMouseMove);
      window.removeEventListener('mouseup', onWinMouseUp);
    };
  }, [onMoveInput, onLookDelta, onTapViewport]);

  const handleLookMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    mouseLookActiveRef.current = true;
    mouseDownStartRef.current = { x: e.clientX, y: e.clientY };
    mouseLookLastRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleStickMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    stickMouseActiveRef.current = true;
    moveCenterRef.current = {
      x: rect.left + rect.width * 0.5,
      y: rect.top + rect.height * 0.5,
    };
    const dx = e.clientX - moveCenterRef.current.x;
    const dy = e.clientY - moveCenterRef.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(MAX_STICK_RADIUS, dist);
    const ang = Math.atan2(dy, dx);
    const kx = dist > 0.5 ? Math.cos(ang) * clamped : 0;
    const ky = dist > 0.5 ? Math.sin(ang) * clamped : 0;
    setKnobOffset({ x: kx, y: ky });
    onMoveInput(kx / MAX_STICK_RADIUS, -ky / MAX_STICK_RADIUS);
  };

  const canActivate =
    !isDoorTarget &&
    !isBusy &&
    (isComplete || (inRange && (!manualAimMode || reticleAligned)));

  let buttonText = targetLabel;
  if (isDoorTarget) {
    buttonText = targetLabel;
  } else if (isBusy) {
    buttonText = 'Working...';
  } else if (isComplete) {
    buttonText = 'Toggle Cutaway';
  } else if (inRange) {
    if (manualAimMode) {
      buttonText = reticleAligned
        ? `${actionLabel} (${completedSubSteps}/${totalSubSteps})`
        : `Aim at Mark (${completedSubSteps}/${totalSubSteps})`;
    } else {
      buttonText = actionLabel;
    }
  }

  return (
    <>
      {/* Full-viewport Camera Drag Look Surface */}
      <div
        ref={lookLayerRef}
        onMouseDown={handleLookMouseDown}
        aria-label="Drag to look around kitchen workshop"
        className="fixed inset-0 z-10 cursor-grab active:cursor-grabbing select-none"
      />

      {/* Left-Side Virtual Movement Thumbstick (Clean, no static text labels) */}
      <div className="fixed left-5 bottom-6 z-20 select-none">
        <div
          ref={stickBaseRef}
          onMouseDown={handleStickMouseDown}
          aria-label="Virtual movement thumbstick"
          className="relative w-32 h-32 rounded-full bg-slate-950/70 border border-slate-600/70 shadow-lg flex items-center justify-center touch-none"
        >
          <div className="absolute inset-x-4 h-px bg-slate-600/35 pointer-events-none" />
          <div className="absolute inset-y-4 w-px bg-slate-600/35 pointer-events-none" />
          <div
            style={{
              transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            }}
            className="w-12 h-12 rounded-full bg-slate-200/90 border-2 border-white shadow-md pointer-events-none transition-transform duration-75 ease-out"
          />
        </div>
      </div>

      {/* Right-Side Action Button (Clean, no static hint text below) */}
      <div className="fixed right-5 bottom-6 z-20 select-none">
        <button
          type="button"
          onTouchStart={(e) => {
            e.stopPropagation();
            const t = e.changedTouches[0];
            if (t) actionTouchIdRef.current = t.identifier;
            if (canActivate) onActionStart();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            actionTouchIdRef.current = null;
            onActionEnd();
          }}
          onTouchCancel={(e) => {
            e.stopPropagation();
            actionTouchIdRef.current = null;
            onActionEnd();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (e.button === 0 && canActivate) onActionStart();
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
            onActionEnd();
          }}
          onMouseLeave={() => onActionEnd()}
          disabled={isDoorTarget || (!canActivate && !(manualAimMode && inRange))}
          className={`relative overflow-hidden flex items-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm shadow-lg transition-colors touch-none ${
            isDoorTarget
              ? 'bg-emerald-950/90 text-emerald-200 border border-emerald-500/60 cursor-default'
              : isBusy
                ? 'bg-amber-600/90 text-white border border-amber-400/60 cursor-pointer'
                : canActivate
                  ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white border border-emerald-400/70 cursor-pointer'
                  : manualAimMode && inRange
                    ? 'bg-amber-950/90 text-amber-200 border border-amber-500/70 cursor-default'
                    : 'bg-slate-950/80 text-slate-400 border border-slate-700/70 cursor-not-allowed'
          }`}
        >
          {manualAimMode && subProgress > 0 && !isDoorTarget && (
            <span
              style={{ width: `${Math.round(subProgress * 100)}%` }}
              className="absolute inset-y-0 left-0 bg-emerald-400/30 pointer-events-none"
            />
          )}
          <span className="relative flex items-center gap-2">
            {isDoorTarget ? (
              <Footprints className="w-4 h-4" />
            ) : isComplete ? (
              <Eye className="w-4 h-4" />
            ) : manualAimMode && !reticleAligned && inRange ? (
              <Crosshair className="w-4 h-4" />
            ) : (
              <Hammer className="w-4 h-4" />
            )}
            <span className="tabular-nums">{buttonText}</span>
          </span>
        </button>
      </div>
    </>
  );
};
