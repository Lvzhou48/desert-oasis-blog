import { describe, expect, it } from 'vitest';
import { estimateReadingMinutes, formatPublishedDate, getSiteYear } from '../../src/lib/format';

describe('article formatting', () => {
  it('formats dates in the site timezone', () => {
    expect(formatPublishedDate(new Date('2026-08-07T16:30:00.000Z'))).toBe('2026年8月8日');
  });

  it('estimates reading time from non-whitespace characters', () => {
    expect(estimateReadingMinutes('中'.repeat(800))).toBe(2);
  });

  it('uses one minute as the minimum reading time', () => {
    expect(estimateReadingMinutes('')).toBe(1);
  });

  it('derives the footer year strictly from Asia/Shanghai at a UTC year boundary', () => {
    expect(getSiteYear(new Date('2026-12-31T16:00:00.000Z'))).toBe(2027);
    expect(getSiteYear(new Date('2026-12-31T15:59:59.999Z'))).toBe(2026);
  });
});
