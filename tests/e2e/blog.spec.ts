import { expect, test } from '@playwright/test';

const configuredBase = process.env.BASE_PATH ?? '/';
const sitePath = (pathname: string) => {
  const base = `/${configuredBase.replace(/^\/+|\/+$/g, '')}`.replace(/^\/$/, '');
  return `${base}/${pathname.replace(/^\/+/, '')}`;
};

const releaseRoutes = [
  '/',
  '/articles/',
  '/categories/',
  '/about/',
  '/posts/first-oasis/',
];

for (const route of releaseRoutes) {
  test(`${route} keeps its responsive and keyboard-accessible shell`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(sitePath(route));

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: '跳到正文' })).toBeFocused();
    await expect(page.getByRole('link', { name: '跳到正文' })).toBeVisible();

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(0);
    expect(consoleErrors).toEqual([]);
  });
}

test('reduced-motion preference removes perceptible decorative motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(sitePath('/'));

  const movingElements = await page
    .locator('body > :not(astro-dev-toolbar), body > :not(astro-dev-toolbar) *')
    .evaluateAll((elements) => {
    const milliseconds = (value: string) =>
      value.split(',').map((part) => {
        const time = part.trim();
        return time.endsWith('ms') ? Number.parseFloat(time) : Number.parseFloat(time) * 1000;
      });

    return elements.flatMap((element) => {
      const style = getComputedStyle(element);
      const durations = [
        ...milliseconds(style.animationDuration),
        ...milliseconds(style.transitionDuration),
      ];
      return durations.some((duration) => duration > 0)
        ? [`${element.tagName.toLowerCase()}.${element.getAttribute('class') ?? ''}`]
        : [];
    });
    });

  expect(movingElements).toEqual([]);
});

test('shared shell exposes the approved identity and keyboard navigation', async ({ page }) => {
  await page.goto(sitePath('/'));
  await expect(page).toHaveTitle(/沙漠里的绿洲/);
  const brand = page.getByRole('link', { name: '沙漠里的绿洲' });
  await expect(brand).toBeVisible();
  await expect(brand).toHaveAttribute('href', sitePath('/'));
  await expect(page.getByRole('navigation')).toContainText('文章');
});

test('homepage leads with identity and latest writing', async ({ page }) => {
  await page.goto(sitePath('/'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('在喧嚣世界里，保留一小片生长。');
  await expect(
    page.getByText('记录数据工程与 AI，也记录生活、远方，以及那些尚未有答案的思考。'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: '最新文章' })).toBeVisible();
  const welcomeLink = page.getByRole('link', { name: /绿洲的第一粒种子/ });
  await expect(welcomeLink).toBeVisible();

  const featuredCard = page.locator('article').filter({ has: welcomeLink });
  const cardToSectionWidth = await featuredCard.evaluate((card) => {
    const section = card.closest('section');
    return section ? card.getBoundingClientRect().width / section.getBoundingClientRect().width : 0;
  });
  expect(cardToSectionWidth).toBeGreaterThan(0.9);
});

test('mobile menu can be opened with the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(sitePath('/'));
  const trigger = page.getByRole('button', { name: '打开导航' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: '分类' })).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

test('search navigation is base-aware and focuses the article search', async ({ page }) => {
  await page.goto(sitePath('/'));
  const searchNavigation = page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '搜索' });
  await expect(searchNavigation).toHaveAttribute('href', sitePath('/articles/#article-search'));
  await searchNavigation.click();
  await expect(page).toHaveURL(new RegExp(`${sitePath('/articles/')}#article-search$`));
  await expect(page.getByRole('searchbox', { name: '搜索文章' })).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(sitePath('/'));
  await page.getByRole('button', { name: '打开导航' }).click();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '搜索' }).click();
  await expect(page.getByRole('searchbox', { name: '搜索文章' })).toBeFocused();
});

test('same-page search navigation focuses on every desktop and mobile activation', async ({ page }) => {
  const blurActiveElement = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  await page.goto(sitePath('/articles/'));
  const desktopSearch = page.getByRole('searchbox', { name: '搜索文章' });
  const desktopNavigation = page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '搜索' });
  await expect(desktopSearch).not.toBeFocused();
  await desktopNavigation.click();
  await expect(desktopSearch).toBeFocused();
  await blurActiveElement();
  await desktopNavigation.click();
  await expect(desktopSearch).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`${sitePath('/articles/')}#article-search$`));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(sitePath('/articles/'));
  const mobileSearch = page.getByRole('searchbox', { name: '搜索文章' });
  const openMenu = page.getByRole('button', { name: '打开导航' });
  await expect(mobileSearch).not.toBeFocused();
  await openMenu.click();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '搜索' }).click();
  await expect(mobileSearch).toBeFocused();
  await blurActiveElement();
  await openMenu.click();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '搜索' }).click();
  await expect(mobileSearch).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`${sitePath('/articles/')}#article-search$`));
});

test('articles can be searched and reset', async ({ page }) => {
  await page.goto(sitePath('/articles/'));
  await page.getByRole('searchbox', { name: '搜索文章' }).fill('公开角落');
  await expect(page.getByRole('link', { name: /绿洲的第一粒种子/ })).toBeVisible();
  await page.getByRole('button', { name: '清除筛选' }).click();
  await expect(page.getByRole('link', { name: /绿洲的第一粒种子/ })).toBeVisible();
});

test('article search includes category names', async ({ page }) => {
  await page.goto(sitePath('/articles/'));
  await page.getByRole('searchbox', { name: '搜索文章' }).fill('随想');
  await expect(page.getByRole('link', { name: /绿洲的第一粒种子/ })).toBeVisible();
});

test('article card headings follow their surrounding page hierarchy', async ({ page }) => {
  await page.goto(sitePath('/'));
  const latest = page.locator('#latest-writing');
  await expect(latest.getByRole('heading', { level: 2, name: '最新文章' })).toBeVisible();
  await expect(latest.locator('article').getByRole('heading', { level: 3 })).toHaveCount(1);
  await expect(latest.locator('article').getByRole('heading', { level: 2 })).toHaveCount(0);

  await page.goto(sitePath('/articles/'));
  const collection = page.locator('.article-collection');
  await expect(collection.getByRole('heading', { level: 2 })).toHaveCount(1);
  await expect(collection.getByRole('heading', { level: 3 })).toHaveCount(0);

  await page.goto(sitePath('/categories/随想/'));
  const categoryCollection = page.locator('.article-collection');
  await expect(categoryCollection.getByRole('heading', { level: 2 })).toHaveCount(1);
  await expect(categoryCollection.getByRole('heading', { level: 3 })).toHaveCount(0);
});

test('category pages only show matching posts', async ({ page }) => {
  await page.goto(sitePath('/categories/随想/'));
  await expect(page.getByRole('link', { name: /绿洲的第一粒种子/ })).toBeVisible();
});

test('article detail includes metadata, navigation and readable fallback comments', async ({ page }) => {
  await page.goto(sitePath('/posts/first-oasis/'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('绿洲的第一粒种子');
  await expect(page.getByText('随想')).toBeVisible();
  await expect(page.getByRole('navigation', { name: '相邻文章' })).toBeVisible();
  await expect(page.getByText('评论将在 GitHub Discussions 配置后开放。')).toBeVisible();
  const discussions = page.getByRole('link', { name: '前往 Discussions' });
  await expect(discussions).toHaveAttribute('href', 'https://github.com/Lvzhou48/desert-oasis-blog/discussions');
  await expect(discussions).toHaveAttribute('rel', /noopener/);
  await expect(discussions).toHaveAttribute('rel', /noreferrer/);
});

test('date-only article metadata uses Shanghai midnight as its publication instant', async ({ page }) => {
  await page.goto(sitePath('/posts/first-oasis/'));
  await expect(page.locator('article time').first()).toHaveAttribute('datetime', '2026-08-07T16:00:00.000Z');
});

test('about and 404 preserve the mysterious oasis identity', async ({ page }) => {
  await page.goto(sitePath('/about/'));
  await expect(page.getByRole('heading', { name: '关于这片绿洲' })).toBeVisible();
  await expect(page.getByText('Lvzhou48')).toHaveCount(0);
  await page.goto(sitePath('/missing-place/'));
  await expect(page.getByRole('heading', { name: '你似乎迷失在沙漠里' })).toBeVisible();
  const returnLink = page.getByRole('link', { name: '返回绿洲' });
  await expect(returnLink).toBeVisible();
  await expect(returnLink).toHaveAttribute('href', sitePath('/'));
});

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`about and 404 oasis artwork stays decorative and usable in the ${viewport.name} viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(sitePath('/about/'));
    await page.waitForLoadState('networkidle');

    const aboutMark = page.locator('.about-page__mark');
    const aboutStyle = await aboutMark.evaluate((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return { position: style.position, opacity: Number(style.opacity), width: box.width, height: box.height };
    });
    expect(aboutStyle.width).toBeLessThanOrEqual(480);
    expect(aboutStyle.height).toBeLessThanOrEqual(360);
    expect(aboutStyle.position).toBe('absolute');
    expect(aboutStyle.opacity).toBeLessThanOrEqual(0.2);

    await page.goto(sitePath('/missing-place/'));
    const markBox = await page.locator('.not-found__mark svg').boundingBox();
    expect(markBox).not.toBeNull();
    expect(markBox!.width).toBeLessThanOrEqual(240);
    expect(markBox!.height).toBeLessThanOrEqual(180);

    for (const locator of [
      page.getByRole('heading', { name: '你似乎迷失在沙漠里' }),
      page.getByRole('link', { name: '返回绿洲' }),
      page.getByRole('link', { name: '浏览文章' }),
    ]) {
      await expect(locator).toBeVisible();
      const box = await locator.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(0);
  });
}

test('RSS contains public posts and excludes drafts', async ({ request }) => {
  const response = await request.get(sitePath('/rss.xml'));
  const xml = await response.text();
  expect(xml).toContain('绿洲的第一粒种子');
  expect(xml).not.toContain('从数据仓库到智能系统');
  expect(xml).not.toContain('草稿');
  expect(xml).toContain(`<link>https://lvzhou48.github.io${sitePath('/')}</link>`);
  expect(xml).toContain(`https://lvzhou48.github.io${sitePath('/posts/first-oasis/')}`);
  expect(xml).not.toContain(`https://lvzhou48.github.io${sitePath('/posts/data-engineering-and-ai/')}`);
});
