// Haptics via Capacitor on Android, navigator.vibrate fallback on the web.

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export type HapticLevel = 'none' | 'light' | 'medium' | 'heavy';

export class HapticsSystem {
  enabled = true;
  private native = Capacitor.isNativePlatform();

  impact(level: HapticLevel) {
    if (!this.enabled || level === 'none') return;
    try {
      if (this.native) {
        const style = level === 'light' ? ImpactStyle.Light : level === 'medium' ? ImpactStyle.Medium : ImpactStyle.Heavy;
        Haptics.impact({ style }).catch(() => {});
      } else if (navigator.vibrate) {
        navigator.vibrate(level === 'light' ? 10 : level === 'medium' ? 30 : [60, 40, 90]);
      }
    } catch { /* haptics unavailable */ }
  }

  /** Long rumble pattern for Secret/Prismatic reveals. */
  epic() {
    if (!this.enabled) return;
    try {
      if (this.native) {
        Haptics.notification({ type: NotificationType.Success }).catch(() => {});
        setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {}), 220);
        setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {}), 480);
      } else navigator.vibrate?.([80, 60, 120, 60, 200]);
    } catch { /* ignore */ }
  }
}
