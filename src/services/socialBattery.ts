export const SOCIAL_BATTERY_STORAGE_KEY = 'cantinho_social_battery_v1';
export const AUTONOMOUS_AI_STORAGE_KEY = 'cantinho_last_auto_ai_v1';

export const SOCIAL_BATTERY_MAX = 10;
export const SOCIAL_BATTERY_RECHARGE_MS = 30 * 60 * 1000; // 1 point every 30 minutes
export const AUTONOMOUS_AI_COOLDOWN_MS = 45 * 60 * 1000; // 45 minutes between autonomous AI calls

export interface SocialBatteryState {
  energy: number;
  lastRechargeAt: number;
  nextRechargeMs: number;
}

interface StoredSocialBattery {
  energy: number;
  lastRechargeAt: number;
}

function clampEnergy(val: unknown): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return SOCIAL_BATTERY_MAX;
  return Math.max(0, Math.min(SOCIAL_BATTERY_MAX, Math.floor(val)));
}

function writeStoredSocialBattery(data: StoredSocialBattery): void {
  try {
    localStorage.setItem(SOCIAL_BATTERY_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export function formatBatteryTimer(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const mins = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export function getFullRechargeMs(
  energy: number,
  nextRechargeMs: number,
  maxEnergy = SOCIAL_BATTERY_MAX
): number {
  if (energy >= maxEnergy) return 0;
  const remainingStepsAfterNext = Math.max(0, maxEnergy - 1 - energy);
  return Math.max(0, nextRechargeMs) + remainingStepsAfterNext * SOCIAL_BATTERY_RECHARGE_MS;
}

export function formatHoursMinutes(remainingMs: number): string {
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}min`;
}

export function readSocialBattery(now = Date.now()): SocialBatteryState {
  let stored: StoredSocialBattery = {
    energy: SOCIAL_BATTERY_MAX,
    lastRechargeAt: now,
  };
  let needsSave = false;

  try {
    const raw = localStorage.getItem(SOCIAL_BATTERY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredSocialBattery>;
      const energy = clampEnergy(parsed.energy);
      const lastRechargeAt =
        typeof parsed.lastRechargeAt === 'number' &&
        Number.isFinite(parsed.lastRechargeAt) &&
        parsed.lastRechargeAt > 0
          ? Math.min(now, parsed.lastRechargeAt)
          : now;
      stored = { energy, lastRechargeAt };
    } else {
      needsSave = true;
    }
  } catch {
    needsSave = true;
  }

  if (stored.energy < SOCIAL_BATTERY_MAX) {
    const elapsed = Math.max(0, now - stored.lastRechargeAt);
    const gained = Math.floor(elapsed / SOCIAL_BATTERY_RECHARGE_MS);
    if (gained > 0) {
      const nextEnergy = Math.min(SOCIAL_BATTERY_MAX, stored.energy + gained);
      const nextLastRechargeAt =
        nextEnergy >= SOCIAL_BATTERY_MAX
          ? now
          : stored.lastRechargeAt + gained * SOCIAL_BATTERY_RECHARGE_MS;
      stored = {
        energy: nextEnergy,
        lastRechargeAt: nextLastRechargeAt,
      };
      needsSave = true;
    }
  } else if (stored.lastRechargeAt !== now) {
    stored.lastRechargeAt = now;
  }

  if (needsSave) {
    writeStoredSocialBattery(stored);
  }

  const nextRechargeMs =
    stored.energy >= SOCIAL_BATTERY_MAX
      ? 0
      : Math.max(0, SOCIAL_BATTERY_RECHARGE_MS - (now - stored.lastRechargeAt));

  return {
    energy: stored.energy,
    lastRechargeAt: stored.lastRechargeAt,
    nextRechargeMs,
  };
}

export function consumeSocialBattery(
  cost: number,
  now = Date.now()
): { ok: boolean } & SocialBatteryState {
  const current = readSocialBattery(now);
  if (current.energy < cost) {
    return { ok: false, ...current };
  }

  const nextEnergy = Math.max(0, current.energy - cost);
  // Start the 30-minute clock when dropping from full 10/10, otherwise preserve progress
  const nextLastRechargeAt =
    current.energy >= SOCIAL_BATTERY_MAX ? now : current.lastRechargeAt;

  writeStoredSocialBattery({
    energy: nextEnergy,
    lastRechargeAt: nextLastRechargeAt,
  });

  const nextRechargeMs =
    nextEnergy >= SOCIAL_BATTERY_MAX
      ? 0
      : Math.max(0, SOCIAL_BATTERY_RECHARGE_MS - (now - nextLastRechargeAt));

  return {
    ok: true,
    energy: nextEnergy,
    lastRechargeAt: nextLastRechargeAt,
    nextRechargeMs,
  };
}

export function getLastAutonomousAiAt(): number {
  try {
    const raw = localStorage.getItem(AUTONOMOUS_AI_STORAGE_KEY);
    if (!raw) return 0;
    const val = Number(raw);
    return Number.isFinite(val) && val > 0 ? val : 0;
  } catch {
    return 0;
  }
}

export function canRunAutonomousAi(now = Date.now()): boolean {
  const lastAt = getLastAutonomousAiAt();
  if (lastAt <= 0 || lastAt > now) return true;
  return now - lastAt >= AUTONOMOUS_AI_COOLDOWN_MS;
}

export function markAutonomousAiUsed(now = Date.now()): void {
  try {
    localStorage.setItem(AUTONOMOUS_AI_STORAGE_KEY, String(now));
  } catch {
    // Ignore storage quota errors
  }
}
