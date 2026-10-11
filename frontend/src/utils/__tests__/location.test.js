const {MAX_LOCATION_AGE_MS, isLocationFresh} = require('../location');

describe('isLocationFresh', () => {
  const now = 1_000_000;

  it('accepts a recent GPS fix', () => {
    expect(isLocationFresh(now - MAX_LOCATION_AGE_MS, now)).toBe(true);
  });

  it('rejects missing and stale GPS fixes', () => {
    expect(isLocationFresh(null, now)).toBe(false);
    expect(isLocationFresh(now - MAX_LOCATION_AGE_MS - 1, now)).toBe(false);
  });
});
