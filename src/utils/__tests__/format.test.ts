import { describe, it, expect } from 'vitest';
import { formatTime, dayName, toCSV } from '../format';

describe('formatTime', () => {
  it('formats morning time correctly', () => {
    expect(formatTime('08:05')).toBe('8:05 AM');
  });
  it('formats afternoon time correctly', () => {
    expect(formatTime('14:30')).toBe('2:30 PM');
  });
  it('formats midnight correctly', () => {
    expect(formatTime('00:00')).toBe('12:00 AM');
  });
});

describe('dayName', () => {
  it('returns correct day name', () => {
    expect(dayName(0)).toBe('Sunday');
    expect(dayName(6)).toBe('Saturday');
  });
});

describe('toCSV', () => {
  it('converts rows to CSV', () => {
    const csv = toCSV([{ a: 1, b: 'x' }]);
    expect(csv).toContain('a,b');
    expect(csv).toContain('1,"x"');
  });
  it('returns empty string for no rows', () => {
    expect(toCSV([])).toBe('');
  });
});
