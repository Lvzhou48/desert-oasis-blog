import { describe, expect, it } from 'vitest';
import { CATEGORIES, NAV_ITEMS, siteConfig } from '../../src/data/site';

describe('site configuration', () => {
  it('keeps the approved identity and taxonomy', () => {
    expect(siteConfig.name).toBe('沙漠里的绿洲');
    expect(siteConfig.tagline).toBe('在喧嚣世界里，保留一小片生长。');
    expect(CATEGORIES).toEqual(['数据工程和 AI', '生活与成长', '远方与见闻', '随想']);
    expect(NAV_ITEMS.map((item) => item.href)).toEqual([
      '/',
      '/articles/',
      '/articles/#article-search',
      '/categories/',
      '/about/',
    ]);
  });
});
