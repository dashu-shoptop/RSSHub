import { load } from 'cheerio';
import pMap from 'p-map';
import type { Page } from 'patchright';

import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';
import { getPlaywrightPage } from '@/utils/playwright';
import { isShortNews } from '@/utils/short-news';

async function allowRequests(page: Page): Promise<void> {
    await page.route('**/*', (request) => (request.request().resourceType() === 'document' ? request.continue() : request.abort()));
}

export const route: Route = {
    path: '/affiliate-news',
    name: 'Affiliate News',
    categories: ['shopping'],
    example: '/bol/affiliate-news',
    maintainers: [],
    features: { requirePuppeteer: true },
    description: 'Requires a Playwright browser. Only articles within 600 words and 1500 CJK characters from the first 20 entries are included.',
    radar: [{ source: ['affiliate.bol.com/nl/nieuws/'], target: '/affiliate-news' }],
    handler: async () => {
        const link = 'https://affiliate.bol.com/nl/nieuws/';
        const { page, context, destroy } = await getPlaywrightPage(link, { closeTimeout: 0, javaScriptEnabled: false, onBeforeLoad: allowRequests });
        try {
            await page.waitForSelector('a[data-x="link-to-article"][href^="/nl/nieuws/"]', { state: 'attached' });
            const html = await page.content();
            const $ = load(html);
            const links = $('a[data-x="link-to-article"][href^="/nl/nieuws/"]')
                .toArray()
                .map((element) => ({ link: new URL($(element).attr('href')!, link).href }))
                .filter((entry) => entry.link.startsWith('https://affiliate.bol.com/nl/nieuws/'));
            const candidates = new Map(links.map((entry) => [entry.link, entry])).values().take(20).toArray();
            const articles = await pMap(
                candidates,
                (entry) =>
                    cache.tryGet<DataItem>(entry.link, async () => {
                        const detailPage = await context.newPage();
                        try {
                            await allowRequests(detailPage);
                            await detailPage.goto(entry.link, { waitUntil: 'domcontentloaded' });
                            await detailPage.waitForSelector('main time', { state: 'attached' });
                            const articleHtml = await detailPage.content();
                            const article = load(articleHtml);
                            const content = article('main > [data-x="intro"], main > div');
                            const title = article('main h1').first().text();
                            const date = article('main time').first().attr('datetime');
                            const metadata = { pubDate: date ? parseDate(date, 'YYYY-MM-DD') : undefined };
                            if (!title || !content.text().trim()) {
                                throw new Error(`Missing full article content: ${entry.link}`);
                            }
                            return {
                                title,
                                link: entry.link,
                                description: content
                                    .toArray()
                                    .map((element) => article(element).html())
                                    .join(''),
                                ...metadata,
                            };
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
            return { title: 'bol Affiliate News', link, language: 'nl', item: items };
        } finally {
            await destroy();
        }
    },
};
