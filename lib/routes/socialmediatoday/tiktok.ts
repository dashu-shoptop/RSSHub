import type { Route } from '@/types';
import { parseDate } from '@/utils/parse-date';
import parser from '@/utils/rss-parser';
import { isShortNews } from '@/utils/short-news';

export const route: Route = {
    path: '/tiktok',
    name: 'TikTok',
    categories: ['new-media'],
    example: '/socialmediatoday/tiktok',
    maintainers: [],
    description: 'Short news only: at most 600 words and 1500 CJK characters from the first 20 entries.',
    radar: [{ source: ['www.socialmediatoday.com/topic/tiktok/'], target: '/tiktok' }],
    handler: async () => {
        const feed = await parser.parseURL('https://www.socialmediatoday.com/feeds/topic/tiktok/');
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
            throw new Error('No short news found in the first 20 entries at https://www.socialmediatoday.com/topic/tiktok/ (600 words / 1500 CJK characters).');
        }
        return { title: feed.title!, link: 'https://www.socialmediatoday.com/topic/tiktok/', language: 'en', item: items };
    },
};
