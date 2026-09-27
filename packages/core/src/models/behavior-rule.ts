export type BehaviorRuleType = 'usage' | 'return_pattern' | 'frequency';
export type BehaviorAction = 'ban' | 'log' | 'throttle' | 'alert';

export class BehaviorRule {
  readonly ruleType: BehaviorRuleType;
  readonly threshold: number;
  readonly window: number;
  readonly pattern: string | null;
  readonly action: BehaviorAction;
  readonly customAction: ((...args: unknown[]) => unknown) | null;
  /* Ban length in seconds for ban rules; null falls back to 3600 at
     dispatch time (reference _execute_ban_action). */
  readonly banDuration: number | null;
  /* Halves the effective threshold for global return_pattern rules while
     the IP has prior detection-category hits (reference
     correlate_with_detection). */
  readonly correlateWithDetection: boolean;

  constructor(
    ruleType: BehaviorRuleType,
    threshold: number,
    window = 3600,
    pattern: string | null = null,
    action: BehaviorAction = 'log',
    customAction: ((...args: unknown[]) => unknown) | null = null,
    banDuration: number | null = null,
    correlateWithDetection = false,
  ) {
    this.ruleType = ruleType;
    this.threshold = threshold;
    this.window = window;
    this.pattern = pattern;
    this.action = action;
    this.customAction = customAction;
    this.banDuration = banDuration;
    this.correlateWithDetection = correlateWithDetection;
  }
}
