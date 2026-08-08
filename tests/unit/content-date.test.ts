import { describe, expect, it } from 'vitest';
import { parseContentDate } from '../../src/lib/content-date';
import { restoreRawContentDates } from '../../src/lib/content-loader';

describe('content date parsing', () => {
  it('treats a date-only frontmatter value as midnight in Asia/Shanghai', () => {
    expect(parseContentDate('2026-08-08').toISOString()).toBe('2026-08-07T16:00:00.000Z');
  });

  it('preserves the exact instant of datetime values that include a timezone', () => {
    expect(parseContentDate('2026-08-08T00:00:00Z').toISOString()).toBe('2026-08-08T00:00:00.000Z');
    expect(parseContentDate('2026-08-08T08:00:00+08:00').toISOString()).toBe('2026-08-08T00:00:00.000Z');
  });

  it('keeps Date instances at their exact instant and rejects invalid values', () => {
    const instant = new Date('2026-08-08T00:00:00.000Z');
    expect(parseContentDate(instant)).toBe(instant);
    expect(() => parseContentDate('not-a-date')).toThrow(/valid date/i);
  });

  it.each([
    '2025-02-29T08:00:00+08:00',
    '2026-02-30T08:00:00+08:00',
    '2026-04-31T08:00:00+08:00',
    '2026-13-01T08:00:00+08:00',
    '2026-01-00T08:00:00+08:00',
    '2026-01-01T24:00:00+08:00',
    '2026-01-01T23:60:00+08:00',
    '2026-01-01T23:59:60+08:00',
    '2026-01-01T08:00:00+24:00',
    '2026-01-01T08:00:00+08:60',
  ])('rejects the invalid timezone-aware datetime %s', (value) => {
    expect(() => parseContentDate(value)).toThrow(/valid date/i);
  });

  it.each([
    ['2024-02-29T08:00:00+08:00', '2024-02-29T00:00:00.000Z'],
    ['2026-08-08T08:30:45.123456789+08:00', '2026-08-08T00:30:45.123Z'],
    ['2026-08-08T00:00:00Z', '2026-08-08T00:00:00.000Z'],
    ['2026-08-08T12:00:00-05:30', '2026-08-08T17:30:00.000Z'],
    ['2026-08-08T12:00:00+05:45', '2026-08-08T06:15:00.000Z'],
  ])('preserves the valid timezone-aware datetime %s', (value, expected) => {
    expect(parseContentDate(value).toISOString()).toBe(expected);
  });

  it.each([
    '0000-01-01',
    '0001-01-01',
    '0099-01-01',
    '1899-12-31',
    '10000-01-01',
    '0000-01-01T00:00:00Z',
    '0001-01-01T00:00:00Z',
    '0099-01-01T00:00:00Z',
    '1899-12-31T23:59:59+08:00',
    '10000-01-01T00:00:00Z',
  ])('rejects the out-of-contract content year in %s', (value) => {
    expect(() => parseContentDate(value)).toThrow(/valid date/i);
  });

  it.each([
    ['1900-01-01', '1899-12-31T16:00:00.000Z'],
    ['9999-12-31', '9999-12-30T16:00:00.000Z'],
    ['1900-01-01T00:00:00Z', '1900-01-01T00:00:00.000Z'],
    ['9999-12-31T23:59:59Z', '9999-12-31T23:59:59.000Z'],
  ])('accepts the content year boundary in %s', (value, expected) => {
    expect(parseContentDate(value).toISOString()).toBe(expected);
  });
});

describe('raw frontmatter date recovery', () => {
  it('recovers date-only and timezone-aware scalar strings before schema parsing', () => {
    const parsedByAstro = {
      publishedAt: new Date('2026-08-08T00:00:00.000Z'),
      updatedAt: new Date('2026-08-08T00:30:00.000Z'),
      title: 'Example',
    };
    const contents = `---\ntitle: Example\npublishedAt: 2026-08-08\nupdatedAt: 2026-08-08T08:30:00+08:00\n---\nBody`;

    expect(restoreRawContentDates(parsedByAstro, contents)).toEqual({
      ...parsedByAstro,
      publishedAt: '2026-08-08',
      updatedAt: '2026-08-08T08:30:00+08:00',
    });
  });
});
