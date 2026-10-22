// HTTP Date aligns the countdown with EC2 instead of the phone's wall clock.
// Advance from a monotonic clock so changing the phone time cannot add seconds.
declare const performance: {now: () => number};

let sample: {serverTime: number; receivedAt: number} | null = null;

export const syncSessionClock = (
  httpDate: unknown,
  receivedAt = performance.now(),
): void => {
  if (typeof httpDate !== 'string') {
    return;
  }
  const timestamp = Date.parse(httpDate);
  if (Number.isFinite(timestamp)) {
    // HTTP Date has whole-second precision; use the middle of that second.
    sample = {serverTime: timestamp + 500, receivedAt};
  }
};

export const sessionTimeNow = (now = performance.now()): number =>
  sample ? sample.serverTime + now - sample.receivedAt : Date.now();

export const sessionSecondsRemaining = (
  endsAt: string,
  durationSeconds: number,
  now = sessionTimeNow(),
): number => {
  const deadline = Date.parse(endsAt);
  if (!Number.isFinite(deadline)) {
    return 0;
  }
  return Math.min(
    durationSeconds,
    Math.max(0, Math.ceil((deadline - now) / 1000)),
  );
};
