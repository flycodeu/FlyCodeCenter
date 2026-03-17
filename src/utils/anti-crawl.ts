export interface AntiCrawlConfigInput {
  enable?: boolean;
  lockOnSuspicious?: boolean;
  maxCopyActions?: number;
  maxActions?: number;
  timeWindowMs?: number;
  warnThresholdScore?: number;
  restrictThresholdScore?: number;
  warnCooldownMs?: number;
  eventCooldownMs?: number;
  maxCopyBurst?: number;
}

interface AntiCrawlResolveOptions {
  legacyMaxActionsDefault?: number;
  timeWindowMsDefault?: number;
}

const toSafeNumber = (value: unknown, fallback: number, minimum: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, parsed);
};

export const resolveAntiCrawlRuntimeConfig = (
  config?: AntiCrawlConfigInput,
  options: AntiCrawlResolveOptions = {}
) => {
  const legacyMaxActions = toSafeNumber(
    config?.maxCopyActions ?? config?.maxActions,
    options.legacyMaxActionsDefault ?? 8,
    4
  );
  const timeWindowMs = toSafeNumber(config?.timeWindowMs, options.timeWindowMsDefault ?? 20000, 8000);
  const eventCooldownMs = toSafeNumber(config?.eventCooldownMs, Math.max(1800, Math.round(timeWindowMs / 8)), 400);
  const warnThresholdScore = toSafeNumber(
    config?.warnThresholdScore,
    Math.max(legacyMaxActions + 2, 10),
    4
  );
  const restrictThresholdScore = toSafeNumber(
    config?.restrictThresholdScore,
    Math.max(warnThresholdScore + 4, legacyMaxActions * 2 + 2),
    warnThresholdScore + 1
  );
  const warnCooldownMs = toSafeNumber(
    config?.warnCooldownMs,
    Math.max(timeWindowMs * 2, 45000),
    10000
  );
  const maxCopyBurst = toSafeNumber(config?.maxCopyBurst, Math.max(legacyMaxActions + 4, 12), 6);

  return {
    antiCrawlEnabled: Boolean(config?.enable ?? false),
    antiCrawlLockOnSuspicious: Boolean(config?.lockOnSuspicious ?? true),
    antiCrawlMaxCopyActions: legacyMaxActions,
    antiCrawlTimeWindowMs: timeWindowMs,
    antiCrawlWarnThresholdScore: warnThresholdScore,
    antiCrawlRestrictThresholdScore: restrictThresholdScore,
    antiCrawlWarnCooldownMs: warnCooldownMs,
    antiCrawlEventCooldownMs: eventCooldownMs,
    antiCrawlMaxCopyBurst: maxCopyBurst
  };
};
