const {
  sessionSecondsRemaining,
  sessionTimeNow,
  syncSessionClock,
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
});
