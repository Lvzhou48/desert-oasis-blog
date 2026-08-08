import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { siteConfig } from '../data/site';
import { getPublishedPosts } from '../lib/posts';
import { resolveProjectSite, withBase } from '../lib/urls';

export async function GET(context: { site?: URL }) {
  const posts = getPublishedPosts(await getCollection('posts'));
  const projectSite = resolveProjectSite(context.site);
  return rss({
    title: siteConfig.name,
    description: siteConfig.description,
    site: projectSite,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishedAt,
      link: new URL(withBase(`/posts/${post.id}/`), projectSite).href,
    })),
  });
}
