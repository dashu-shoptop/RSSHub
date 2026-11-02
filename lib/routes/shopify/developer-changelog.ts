import { load } from 'cheerio';
import { FetchError } from 'ofetch';
import pMap, { pMapSkip } from 'p-map';
import Parser from 'rss-parser';

import { config } from '@/config';
import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import { isShortNews } from '@/utils/short-news';

const parser = new Parser<object, { updated?: string; description?: string; author?: string }>({
    headers: { 'User-Agent': config.ua },
    customFields: { item: [['atom:updated', 'updated']] },
});

export const route: Route = {
    path: '/developer-changelog',
    name: 'Developer Changelog',
    categories: ['program-update'],
    example: '/shopify/developer-changelog',
    maintainers: [],
    description: 'Short news only: at most 600 words and 1500 CJK characters from the first 20 entries.',
    radar: [{ source: ['shopify.dev/changelog'], target: '/developer-changelog' }],
    handler: async () => {
        const feed = await parser.parseURL('https://shopify.dev/changelog/feed.xml');
        const candidates = new Map(feed.items.filter((entry) => entry.link).map((entry) => [entry.link, entry])).values().take(20).toArray();
        const articles = await pMap(
            candidates,
            async (entry) => {
                try {
                    return await cache.tryGet<DataItem>(`shopify:developer-changelog:${entry.link}`, async () => {
                        const html = await ofetch(entry.link!, { responseType: 'text' });
                        const $ = load(html);
                        const content = $('article .markdown').first();
                        if (!content.length || !content.text().trim()) {
                            throw new Error(`Missing changelog article body: ${entry.link}`);
                        }
                        content.find('.cm-editor').parent().remove();
                        content.find('button, script, style').remove();
                        content.find('pre.hidden').removeClass('hidden');
                        const date = entry.isoDate || entry.pubDate;
                        return {
                            title: $('h1').first().text() || entry.title!,
                            link: entry.link!,
                            description: content.html(),
                            pubDate: date ? parseDate(date) : undefined,
                            updated: entry.updated ? parseDate(entry.updated) : undefined,
                            author: entry.creator || entry.author,
                            category: entry.categories,
                        };
                    });
                } catch (error) {
                    if (error instanceof FetchError && (error.statusCode === 404 || error.statusCode === 410)) {
                        logger.warn(`Skipping removed changelog article: ${entry.link} (HTTP ${error.statusCode})`);
                        return pMapSkip;
                    }
                    throw error;
                }
            },
            { concurrency: 4 }
        );
        const items = articles.filter((entry) => isShortNews(entry.description!));
        if (!items.length) {
            throw new Error('No short news found in the first 20 entries at https://shopify.dev/changelog (600 words / 1500 CJK characters).');
        }
        return { title: feed.title!, link: 'https://shopify.dev/changelog', language: 'en', item: items };
    },
};
