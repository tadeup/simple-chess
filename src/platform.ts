/**
 * Thin platform layer. Inside the Capacitor Android app the native plugins are used
 * (crisp haptics, keep-awake, hardware back button); on the web the standard APIs are used.
 * Plugin modules are imported lazily so the web build never downloads them.
 */

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
}

const capacitor = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
export const isNative = Boolean(capacitor?.isNativePlatform?.());

type HapticsModule = typeof import('@capacitor/haptics');
type KeepAwakeModule = typeof import('@capacitor-community/keep-awake');

let haptics: HapticsModule | null = null;
let keepAwake: KeepAwakeModule | null = null;
let awake = false;
let wakeLock: WakeLockSentinel | null = null;
let requesting = false;

export async function initPlatform(onBack: () => boolean): Promise<void> {
  if (!isNative) return;
  const [h, k, a] = await Promise.all([import('@capacitor/haptics'), import('@capacitor-community/keep-awake'), import('@capacitor/app')]);
  haptics = h;
  keepAwake = k;
  if (awake) void k.KeepAwake.keepAwake().catch(() => {});
  void a.App.addListener('backButton', () => {
    if (!onBack()) void a.App.minimizeApp().catch(() => {});
  });
}

export function vibrate(kind: 'light' | 'medium'): void {
  if (isNative) {
    if (!haptics) return;
    const style = kind === 'light' ? haptics.ImpactStyle.Light : haptics.ImpactStyle.Medium;
    void haptics.Haptics.impact({ style }).catch(() => {});
    return;
  }
  try {
    navigator.vibrate?.(kind === 'light' ? 8 : 14);
  } catch {
    /* vibration blocked before the first user gesture */
  }
}

/** Keeps the screen on during a game so a long think never locks the phone. */
export function setAwake(on: boolean): void {
  if (isNative) {
    if (on === awake) return;
    awake = on;
    if (keepAwake) void (on ? keepAwake.KeepAwake.keepAwake() : keepAwake.KeepAwake.allowSleep()).catch(() => {});
    return;
  }
  awake = on;
  if (!on) {
    const lock = wakeLock;
    wakeLock = null;
    void lock?.release().catch(() => {});
    return;
  }
  if (wakeLock || requesting || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  requesting = true;
  navigator.wakeLock
    .request('screen')
    .then((lock) => {
      if (!awake) {
        void lock.release();
        return;
      }
      wakeLock = lock;
      lock.addEventListener('release', () => {
        if (wakeLock === lock) wakeLock = null;
      });
    })
    .catch(() => {})
    .finally(() => {
      requesting = false;
    });
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}
