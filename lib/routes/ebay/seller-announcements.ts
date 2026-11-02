import { load } from 'cheerio';
import pMap from 'p-map';

import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import { isShortNews } from '@/utils/short-news';

interface AnnouncementList {
    '@type': string;
    itemListElement?: Array<{ url: string; name: string }>;
}

interface AnnouncementMetadata {
    '@type': string;
    datePublished?: string;
    dateModified?: string;
    author?: { name: string };
    articleSection?: string;
}

export const route: Route = {
    path: '/seller-announcements',
    name: 'Seller Announcements',
    categories: ['shopping'],
    example: '/ebay/seller-announcements',
    maintainers: [],
    description: 'Official announcements, limited to 600 words and 1500 CJK characters from the first 20 posts.',
    radar: [{ source: ['community.ebay.com/forum/announcements-57928/'], target: '/seller-announcements' }],
    handler: async () => {
        const link = 'https://community.ebay.com/forum/announcements-57928/';
        const html = await ofetch(link, { responseType: 'text' });
        const $ = load(html);
        const list = $('script[type="application/ld+json"]')
            .toArray()
            .map((element) => JSON.parse($(element).text()) as AnnouncementList)
            .find((entry) => entry['@type'] === 'ItemList');
        const candidates = new Map((list?.itemListElement ?? []).filter((entry) => entry.url.startsWith(`${link}topic/`)).map((entry) => [entry.url, entry])).values().take(20).toArray();
        const articles = await pMap(
            candidates,
            (entry) =>
                cache.tryGet<DataItem>(entry.url, async () => {
                    const articleHtml = await ofetch(entry.url, { responseType: 'text' });
                    const article = load(articleHtml);
                    const content = article('article [class*="styles_variant-post-detail"]').first();
                    const metadata = article('script[type="application/ld+json"]')
                        .toArray()
                        .map((element) => JSON.parse(article(element).text()) as AnnouncementMetadata)
                        .find((value) => value['@type'] === 'BlogPosting');
                    if (!content.text().trim()) {
                        throw new Error(`Missing original announcement body: ${entry.url}`);
                    }
                    return {
                        title: entry.name,
                        link: entry.url,
                        description: content.html(),
                        pubDate: metadata?.datePublished ? parseDate(metadata.datePublished) : undefined,
                        updated: metadata?.dateModified ? parseDate(metadata.dateModified) : undefined,
                        author: metadata?.author?.name,
                        category: metadata?.articleSection,
                    };
                }),
            { concurrency: 4 }
        );
        const items = articles.filter((entry) => isShortNews(entry.description!));
        if (!items.length) {
            throw new Error(`No short announcements found at ${link}; check the first-page markup and the 600-word / 1500-CJK-character limits.`);
        }
        return { title: 'eBay Seller Announcements', link, language: 'en', item: items };
    },
};
