const {
  sessionSecondsRemaining,
  sessionTimeNow,
  syncSessionClock,
  syncPreciseSessionClock,
} = require('../sessionClock');

describe('session countdown', () => {
  const start = Date.parse('2026-10-22T10:00:00Z');
  const end = '2026-10-22T10:03:00Z';

  it('never shows 3:02 when the phone clock is two seconds slow', () => {
    expect(sessionSecondsRemaining(end, 180, start - 2000)).toBe(180);
  });

  it('keeps elapsed time on reconnect instead of resetting the countdown', () => {
    expect(sessionSecondsRemaining(end, 180, start + 65000)).toBe(115);
    expect(sessionSecondsRemaining(end, 180, start + 180001)).toBe(0);
  });

  it('uses server time and monotonic elapsed time despite phone clock skew', () => {
    syncSessionClock('Thu, 22 Oct 2026 10:00:00 GMT', 1000);
    const phoneClock = jest.spyOn(Date, 'now').mockReturnValue(start - 60000);
    expect(sessionTimeNow(2000)).toBe(start + 1500);
    expect(sessionSecondsRemaining(end, 180, sessionTimeNow(2000))).toBe(179);
    phoneClock.mockRestore();
  });

  it('ignores missing or malformed server dates', () => {
    syncSessionClock('Thu, 22 Oct 2026 10:00:00 GMT', 1000);
    syncSessionClock(undefined, 2000);
    syncSessionClock('invalid', 2000);
    expect(sessionTimeNow(2000)).toBe(start + 1500);
  });

  it('compensates network delay and ignores slower samples and coarse dates', () => {
    expect(
      syncPreciseSessionClock('2026-10-22T10:00:00.123Z', 1000, 1200),
    ).toBe(true);
    expect(sessionTimeNow(1200)).toBe(start + 223);
    syncPreciseSessionClock('2026-10-22T10:00:05Z', 1200, 2200);
    syncSessionClock('Thu, 22 Oct 2026 10:00:05 GMT', 2200);
    expect(sessionTimeNow(2200)).toBe(start + 1223);
    expect(syncPreciseSessionClock('2026-10-22T10:00:40Z', 2200, 42200)).toBe(
      false,
    );
  });

  it('does not mistake server processing time for network delay', () => {
    syncPreciseSessionClock('2026-10-22T10:01:00Z', 60000, 61200, 1000);
    expect(sessionTimeNow(61200)).toBe(start + 60100);
  });
});
