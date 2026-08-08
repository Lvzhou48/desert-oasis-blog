import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function parseHex(value: string): [number, number, number] {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value);
  if (!match) throw new Error(`Expected a six-digit hex color, received ${value}`);
  return [Number.parseInt(match[1], 16), Number.parseInt(match[2], 16), Number.parseInt(match[3], 16)];
}

function luminance(rgb: [number, number, number]) {
  const channels = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string) {
  const lighter = Math.max(luminance(parseHex(foreground)), luminance(parseHex(background)));
  const darker = Math.min(luminance(parseHex(foreground)), luminance(parseHex(background)));
  return (lighter + 0.05) / (darker + 0.05);
}

describe('small muted text contrast', () => {
  it('meets WCAG AA against every light surface where muted text is used', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');
    const muted = css.match(/--muted:\s*(#[\da-f]{6})/i)?.[1];
    if (!muted) throw new Error('Could not read --muted from global.css');

    for (const background of ['#f6f0e4', '#f3ead8', '#eadbbd']) {
      expect(contrastRatio(muted, background), `${muted} on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
