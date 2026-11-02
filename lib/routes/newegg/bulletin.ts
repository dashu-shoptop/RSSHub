import { load } from 'cheerio';
import pMap from 'p-map';

import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import { isShortNews } from '@/utils/short-news';

export const route: Route = {
    path: '/bulletin',
    name: 'Bulletin',
    categories: ['shopping'],
    example: '/newegg/bulletin',
    maintainers: [],
    description: 'Taiwan seller bulletins, limited to 600 words and 1500 CJK characters from the first 20 posts.',
    radar: [{ source: ['www.newegg.tw/about-us/bulletin/'], target: '/bulletin' }],
    handler: async () => {
        const link = 'https://www.newegg.tw/about-us/bulletin/';
        const html = await ofetch(link, { responseType: 'text' });
        const $ = load(html);
        const links = $('a.w4pl_post_title[href]')
            .toArray()
            .map((element) => ({ title: $(element).text(), link: new URL($(element).attr('href')!, link).href }))
            .filter((entry) => entry.link.startsWith('https://www.newegg.tw/bulletin/'));
        const candidates = new Map(links.map((entry) => [entry.link, entry])).values().take(20).toArray();
        const articles = await pMap(
            candidates,
            (entry) =>
                cache.tryGet<DataItem>(entry.link, async () => {
                    const articleHtml = await ofetch(entry.link, { responseType: 'text' });
                    const article = load(articleHtml);
                    const content = article('article .content-inner').first();
                    if (!content.text().trim()) {
                        throw new Error(`Missing bulletin body: ${entry.link}`);
                    }
                    content.find('img[data-src]').each((_, element) => {
                        const image = article(element);
                        image.attr('src', image.attr('data-src'));
                    });
                    content.find('noscript').remove();
                    const published = article('meta[property="article:published_time"]').attr('content');
                    const updated = article('meta[property="article:modified_time"]').attr('content');
                    return {
                        title: entry.title,
                        link: entry.link,
                        description: content.html(),
                        pubDate: published ? parseDate(published) : undefined,
                        updated: updated ? parseDate(updated) : undefined,
                        author: article('meta[name="author"]').attr('content'),
                        category: article('article a[rel="category tag"]')
                            .toArray()
                            .map((element) => article(element).text()),
                    };
                }),
            { concurrency: 4 }
        );
        const items = articles.filter((entry) => isShortNews(entry.description!));
        if (!items.length) {
            throw new Error(`No short bulletins found at ${link}; check the first-page markup and the 600-word / 1500-CJK-character limits.`);
        }
        return { title: 'Newegg Taiwan Bulletin', link, language: 'zh-TW', item: items };
    },
};
