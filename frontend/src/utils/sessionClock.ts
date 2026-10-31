// HTTP Date aligns the countdown with EC2 instead of the phone's wall clock.
// Advance from a monotonic clock so changing the phone time cannot add seconds.
declare const performance: {now: () => number};

let sample: {serverTime: number; receivedAt: number} | null = null;
let preciseSample: {roundTrip: number; receivedAt: number} | null = null;

export const sessionClockTick = (): number => performance.now();

export const syncPreciseSessionClock = (
  serverTime: unknown,
  sentAt: number,
  receivedAt = performance.now(),
  processingMs = 0,
): boolean => {
  if (typeof serverTime !== 'string') return false;
  const timestamp = Date.parse(serverTime);
  const roundTrip = receivedAt - sentAt;
  // Prefer a quick sample; long discovery requests are unsuitable for RTT.
  if (!Number.isFinite(timestamp) || roundTrip < 0 || roundTrip > 3000)
    return false;
  if (
    preciseSample &&
    receivedAt - preciseSample.receivedAt < 30000 &&
    roundTrip > preciseSample.roundTrip
  )
    return true;
  const processing = Number.isFinite(processingMs)
    ? Math.max(0, processingMs)
    : 0;
  const networkDelay = Math.max(0, roundTrip - processing) / 2;
  sample = {serverTime: timestamp + networkDelay, receivedAt};
  preciseSample = {roundTrip, receivedAt};
  return true;
};

export const syncSessionClock = (
  httpDate: unknown,
  receivedAt = performance.now(),
): void => {
  if (preciseSample && receivedAt - preciseSample.receivedAt < 30000) return;
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
