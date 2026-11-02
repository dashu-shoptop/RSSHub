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
    path: '/seller-news',
    name: 'Seller News',
    categories: ['shopping'],
    example: '/ozon/seller-news',
    maintainers: [],
    features: { requirePuppeteer: true },
    description: 'Requires a Playwright browser. Only articles within 600 words and 1500 CJK characters from the first 20 entries are included.',
    radar: [{ source: ['seller.ozon.ru/media/news/'], target: '/seller-news' }],
    handler: async () => {
        const link = 'https://seller.ozon.ru/media/news/';
        const { page, context, destroy } = await getPlaywrightPage(link, { closeTimeout: 0, onBeforeLoad: allowRequests });
        try {
            await page.waitForSelector('a[href^="/media/news/"][href$="/"]:has(p)', { state: 'attached' });
            const html = await page.content();
            const $ = load(html);
            const links = $('a[href^="/media/news/"][href$="/"]:has(p)')
                .toArray()
                .map((element) => ({ link: new URL($(element).attr('href')!, link).href }))
                .filter((entry) => /^\/media\/news\/[^/?]+\/$/.test(new URL(entry.link).pathname));
            const candidates = new Map(links.map((entry) => [entry.link, entry])).values().take(20).toArray();
            const articles = await pMap(
                candidates,
                (entry) =>
                    cache.tryGet<DataItem>(entry.link, async () => {
                        const detailPage = await context.newPage();
                        try {
                            await allowRequests(detailPage);
                            await detailPage.goto(entry.link, { waitUntil: 'domcontentloaded' });
                            await detailPage.waitForSelector('section p', { state: 'attached' });
                            const articleHtml = await detailPage.content();
                            const article = load(articleHtml);
                            const content = article('h1').parent().next('section');
                            const title = article('h1').first().text();
                            const date = article('p')
                                .toArray()
                                .map((element) => article(element).text().trim())
                                .find((value) => /^\d{2}\.\d{2}\.\d{4}$/.test(value));
                            const metadata = {
                                pubDate: date ? parseDate(date, 'DD.MM.YYYY') : undefined,
                                category: [
                                    ...new Set(
                                        article('a[href^="/media/tags/"]')
                                            .toArray()
                                            .map((element) => article(element).text().replace(/^#/, ''))
                                    ),
                                ],
                            };
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
            return { title: 'Ozon Seller News', link, language: 'ru', item: items };
        } finally {
            await destroy();
        }
    },
};
