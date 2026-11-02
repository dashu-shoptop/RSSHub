import type { Route } from '@/types';
import { parseDate } from '@/utils/parse-date';
import parser from '@/utils/rss-parser';
import { isShortNews } from '@/utils/short-news';

export const route: Route = {
    path: '/changelog',
    name: 'Changelog',
    categories: ['program-update'],
    example: '/shopify/changelog',
    maintainers: [],
    description: 'Short news only: at most 600 words and 1500 CJK characters from the first 20 entries.',
    radar: [{ source: ['changelog.shopify.com'], target: '/changelog' }],
    handler: async () => {
        const feed = await parser.parseURL('https://changelog.shopify.com/feed.xml');
        const candidates = new Map(feed.items.filter((entry) => entry.link).map((entry) => [entry.link, entry])).values().take(20).toArray();
        const items = candidates
            .map((entry) => {
                const description = entry.content || entry.description;
                if (!description) {
                    throw new Error(`Missing full article body: ${entry.link}`);
                }
                const date = entry.isoDate || entry.pubDate;
                return {
                    title: entry.title!,
                    link: entry.link!,
                    description,
                    pubDate: date ? parseDate(date) : undefined,
                    author: entry.creator || entry.author,
                    category: entry.categories,
                };
            })
            .filter((entry) => isShortNews(entry.description));
        if (!items.length) {
            throw new Error('No short news found in the first 20 entries at https://changelog.shopify.com (600 words / 1500 CJK characters).');
        }
        return { title: feed.title!, link: 'https://changelog.shopify.com', language: 'en', item: items };
    },
};
