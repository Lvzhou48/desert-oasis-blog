export const CATEGORIES = ['数据工程和 AI', '生活与成长', '远方与见闻', '随想'] as const;
export type Category = (typeof CATEGORIES)[number];

export const NAV_ITEMS = [
  { label: '首页', href: '/' },
  { label: '文章', href: '/articles/' },
  { label: '搜索', href: '/articles/#article-search' },
  { label: '分类', href: '/categories/' },
  { label: '关于', href: '/about/' },
] as const;

export const siteConfig = {
  name: '沙漠里的绿洲',
  tagline: '在喧嚣世界里，保留一小片生长。',
  description: '记录数据工程与 AI，也记录生活、远方，以及那些尚未有答案的思考。',
  locale: 'zh-CN',
  timeZone: 'Asia/Shanghai',
} as const;
