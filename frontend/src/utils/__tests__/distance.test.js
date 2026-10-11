const {formatDistanceTh} = require('../distance');

describe('formatDistanceTh', () => {
  it('uses metres below one kilometre', () => {
    expect(formatDistanceTh(0.45)).toBe('450 ม.');
    expect(formatDistanceTh(0.004)).toBe('4 ม.');
  });

  it('uses a compact kilometre value from one kilometre', () => {
    expect(formatDistanceTh(1)).toBe('1 กม.');
    expect(formatDistanceTh(1.38)).toBe('1.4 กม.');
  });
});
