import { load } from 'cheerio';
import pMap from 'p-map';
import type { Page } from 'patchright';

import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';
import { getPlaywrightPage } from '@/utils/playwright';
import { isShortNews } from '@/utils/short-news';

async function allowRequests(page: Page): Promise<void> {
    await page.route('**/*', (request) => (['document', 'script', 'xhr', 'fetch'].includes(request.request().resourceType()) ? request.continue() : request.abort()));
}

export const route: Route = {
    path: '/announcements',
    name: 'Announcements',
    categories: ['shopping'],
    example: '/temu/announcements',
    maintainers: [],
    features: { requirePuppeteer: true },
    description: 'Requires a Playwright browser. Only articles within 600 words and 1500 CJK characters from the first 20 entries are included.',
    radar: [{ source: ['www.temu.com/about_temu/content/announcements.html'], target: '/announcements' }],
    handler: async () => {
        const link = 'https://www.temu.com/about_temu/content/announcements.html';
        const { page, context, destroy } = await getPlaywrightPage(link, { closeTimeout: 0, onBeforeLoad: allowRequests });
        try {
            await page.waitForSelector('.listWrap a[href^="/about_temu/"]', { state: 'attached' });
            const html = await page.content();
            const $ = load(html);
            const links = $('.listWrap a[href^="/about_temu/"]')
                .toArray()
                .map((element) => ({ link: new URL($(element).attr('href')!, link).href }))
                .filter((entry) => /^\/about_temu\/[^/]+\.html$/.test(new URL(entry.link).pathname));
            const candidates = new Map(links.map((entry) => [entry.link, entry])).values().take(20).toArray();
            const articles = await pMap(
                candidates,
                (entry) =>
                    cache.tryGet<DataItem>(entry.link, async () => {
                        const detailPage = await context.newPage();
                        try {
                            await allowRequests(detailPage);
                            await detailPage.goto(entry.link, { waitUntil: 'domcontentloaded' });
                            await detailPage.waitForSelector('[class^="article-"]', { state: 'attached' });
                            const articleHtml = await detailPage.content();
                            const article = load(articleHtml);
                            const content = article('[class^="article-"]').first();
                            const title = article('[class^="titleWrap-"] [class^="title-"]').first().text();
                            const date = article('[class^="date-"]').first().text().trim();
                            content.find('img[data-src]').each((_, element) => {
                                article(element).attr('src', article(element).attr('data-src'));
                            });
                            const metadata = { pubDate: date ? parseDate(date, 'YYYY-MM-DD') : undefined, author: article('[class^="author-"]').first().text() };
                            if (!title || !content.text().trim()) {
                                throw new Error(`Missing full article content: ${entry.link}`);
                            }
                            return { title, link: entry.link, description: content.html(), ...metadata };
                        } finally {
                            await detailPage.close();
                        }
                    }),
                { concurrency: 4 }
            );
            const items = articles.filter((entry) => isShortNews(entry.description!));
            if (!items.length) {
                throw new Error(`No short news found at ${link}; check the first-page markup and the 600-word / 1500-CJK-character limits.`);
            }
            return { title: 'Temu Announcements', link, language: 'en', item: items };
        } finally {
            await destroy();
        }
    },
};
