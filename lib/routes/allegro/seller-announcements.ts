import { load } from 'cheerio';
import pMap from 'p-map';

import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import { isShortNews } from '@/utils/short-news';

export const route: Route = {
    path: '/seller-announcements',
    name: 'Seller Announcements',
    categories: ['shopping'],
    example: '/allegro/seller-announcements',
    maintainers: [],
    description: 'Polish marketplace announcements only, limited to 600 words and 1500 CJK characters from the first 20 posts.',
    radar: [{ source: ['help.allegro.com/pl/sell/a'], target: '/seller-announcements' }],
    handler: async () => {
        const link = 'https://help.allegro.com/pl/sell/a?marketplaceId=allegro-pl';
        const html = await ofetch(link, { responseType: 'text' });
        const $ = load(html);
        const candidates = $('[data-box-name="NEWS | List of news posts"] li[data-item]')
            .slice(0, 20)
            .toArray()
            .map((element) => ({
                title: $(element).find('a').first().text(),
                link: $(element).find('a').first().attr('href'),
                date: $(element).find('time').attr('datetime'),
            }))
            .filter((entry) => entry.link?.startsWith('https://help.allegro.com/pl/sell/a/'));
        const articles = await pMap(
            candidates,
            (entry) =>
                cache.tryGet<DataItem>(entry.link!, async () => {
                    const articleHtml = await ofetch(entry.link!, { responseType: 'text' });
                    const article = load(articleHtml);
                    const lead = article('[data-prototype-id="allegro.article.lead"]');
                    const content = lead.parent();
                    if (!lead.length || !content.find('[data-prototype-id="allegro.markdown"]').length) {
                        throw new Error(`Missing full announcement content: ${entry.link}`);
                    }
                    content.find('h1, script, style').remove();
                    return { title: entry.title, link: entry.link, description: content.html(), pubDate: entry.date ? parseDate(entry.date) : undefined };
                }),
            { concurrency: 4 }
        );
        const items = articles.filter((entry) => isShortNews(entry.description!));
        if (!items.length) {
            throw new Error(`No short announcements found at ${link}; check the news section and the 600-word / 1500-CJK-character limits.`);
        }
        return { title: 'Allegro Seller Announcements', link, language: 'pl', item: items };
    },
};
