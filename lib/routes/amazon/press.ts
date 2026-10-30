import { load } from 'cheerio';

import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

import { fetchArticles } from './utils';

export const route: Route = {
    path: '/press',
    categories: ['new-media'],
    example: '/amazon/press',
    name: 'Press Center',
    maintainers: [],
    radar: [{ source: ['press.aboutamazon.com/press-release-archive'], target: '/press' }],
    handler: async () => {
        const link = 'https://press.aboutamazon.com/press-release-archive';
        const html = await ofetch(link, { responseType: 'text' });
        const $ = load(html);
        const items = $('.PromoCardSearchResults')
            .toArray()
            .map((element) => {
                const card = $(element);
                const anchor = card.find('.PromoCardSearchResults-title a');
                const date = card.find('.PromoCardSearchResults-date').text();
                return { title: anchor.text(), link: new URL(anchor.attr('href')!, link).href, pubDate: date ? parseDate(date) : undefined };
            });
        return {
            title: 'Amazon Press Center',
            link,
            item: await fetchArticles(items, '.PressReleasePage-articleBody'),
        };
    },
};
