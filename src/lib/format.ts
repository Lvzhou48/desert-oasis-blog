const zhDate = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const shanghaiYear = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
});

export function formatPublishedDate(date: Date): string {
  return zhDate.format(date);
}

export function getSiteYear(date = new Date()): number {
  const year = shanghaiYear.formatToParts(date).find((part) => part.type === 'year')?.value;
  if (!year) throw new RangeError('Could not derive the site year in Asia/Shanghai');
  return Number(year);
}

export function estimateReadingMinutes(body: string): number {
  return Math.max(1, Math.ceil(body.replace(/\s/g, '').length / 400));
}
