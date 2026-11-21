import type { BuildStepId, GradeTier } from './steps';

export interface VoiceoverState {
  active: boolean;
  speaking: boolean;
  text: string;
}

type VoiceoverListener = (state: VoiceoverState) => void;

const INTRO_NARRATION: Record<GradeTier, string> = {
  '4-6':
    'Aha! Welcome to The El Niño Challenge! When droughts and power cuts hit, we can still grow fresh food with zero electricity. Grab the hacksaw on the West counter!',
  '7-9':
    'Greetings, young engineer! Welcome to the Game X Africa Lab for The El Niño Challenge. Let us build a self-watering PVC garden—start by grabbing the hacksaw on the West counter.',
  '10-12':
    'Welcome to The El Niño Challenge by Game X Africa. To safeguard food security when outdoor crops fail, fabricate passive capillary PVC tiers. Pick up the hacksaw on the West counter.',
};

const STEP_NARRATION: Record<BuildStepId, string> = {
  GET_SAW: INTRO_NARRATION['7-9'],
  CUT_AND_ASSEMBLE_PVC:
    'Bring that hacksaw to the island workbench! Aim your center reticle at each glowing mark on the PVC pipe and hold to saw it cleanly.',
  GET_DRILL:
    'Magnificent cuts! Now walk to the North-East counter and equip the cordless drill with the hole-saw bit.',
  DRILL_PORTS:
    'Line up your reticle with each of the four marks along the top of the PVC pipe and hold to bore every planting port yourself.',
  GET_WICKS:
    'Splendid precision! Grab the braided cotton capillary wicks and porous soil caddy from the East counter.',
  THREAD_WICKS_AND_PLANT:
    'Notice why we keep the net-cup above the bottom of the pipe! That air gap lets roots breathe oxygen so they never rot, while the cotton wick reaches down to pull water upward by capillary action.',
  FILL_AT_SINK:
    'Over to the kitchen sink! Turn on the gooseneck tap to fill your reservoir pitcher with fresh water.',
  POUR_AND_GROW:
    'Pour water into the PVC fill funnel! Watch gravity equalize the waterline across the pipe, while cotton wicks silently draw moisture upward into the dry soil—zero pumps or wires!',
  COMPLETE:
    'Pipe ready! Turn around and walk out the Garden Exit Door behind you to mount this PVC tier on your vertical rack and plant El Niño-resilient seeds!',
};

const CUTAWAY_NARRATION =
  'Look closely inside! Below is the shaded water reservoir. Above it sits an oxygen air gap so roots stay healthy. And those cotton wicks use adhesion and cohesion to pull water upward automatically—pure physics!';

class WorkshopVoiceover {
  private muted = false;
  private unlocked = false;
  private state: VoiceoverState = { active: false, speaking: false, text: '' };
  private hideTimer: number | null = null;
  private listeners = new Set<VoiceoverListener>();
  private gradeTier: GradeTier = '7-9';
  private pendingIntro = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setGradeTier(tier: GradeTier): void {
    this.gradeTier = tier;
  }

  public getGradeTier(): GradeTier {
    return this.gradeTier;
  }

  public subscribe(listener: VoiceoverListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(next: VoiceoverState): void {
    this.state = next;
    this.listeners.forEach((fn) => fn(next));
  }

  public unlockAndSpeakPending(): void {
    if (!this.unlocked) {
      this.unlocked = true;
      if (this.pendingIntro) {
        this.pendingIntro = false;
        this.speak(INTRO_NARRATION[this.gradeTier]);
      }
    }
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      this.stop();
    }
    return this.muted;
  }

  public dismiss(): void {
    this.stop();
  }

  public stop(): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore restricted speechSynthesis
      }
    }
    this.emit({ active: false, speaking: false, text: '' });
  }

  public speakStep(stepId: BuildStepId, isResetOrInit = false): void {
    if (stepId === 'GET_SAW') {
      const text = INTRO_NARRATION[this.gradeTier];
      if (!this.unlocked && isResetOrInit) {
        this.pendingIntro = true;
        this.showPopupOnly(text, 6200);
        return;
      }
      this.speak(text);
      return;
    }
    this.speak(STEP_NARRATION[stepId]);
  }

  public speakCutawayInsight(): void {
    this.speak(CUTAWAY_NARRATION);
  }

  public speakCustom(text: string): void {
    this.speak(text);
  }

  private showPopupOnly(text: string, durationMs: number): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
    }
    this.emit({ active: true, speaking: true, text });
    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = null;
      this.emit({ active: false, speaking: false, text: '' });
    }, durationMs);
  }

  public speak(text: string): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    if (this.muted) {
      this.showPopupOnly(text, 4800);
      return;
    }

    this.emit({ active: true, speaking: true, text });

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.showPopupOnly(text, Math.max(4200, text.length * 52));
      return;
    }

    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = this.gradeTier === '4-6' ? 0.94 : 1.02;
      utter.pitch = 0.96;
      utter.volume = 0.94;

      const finish = () => {
        if (this.hideTimer !== null) {
          window.clearTimeout(this.hideTimer);
          this.hideTimer = null;
        }
        this.emit({ active: false, speaking: false, text: '' });
      };

      utter.onend = finish;
      utter.onerror = () => {
        this.showPopupOnly(text, 4800);
      };

      synth.speak(utter);

      this.hideTimer = window.setTimeout(finish, Math.max(5800, text.length * 66));
    } catch {
      this.showPopupOnly(text, 4800);
    }
  }
}

export const workshopVoiceover = new WorkshopVoiceover();
