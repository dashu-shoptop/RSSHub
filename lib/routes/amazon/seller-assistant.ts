import { load } from 'cheerio';

import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';

import { fetchArticles } from './utils';

export const route: Route = {
    path: '/seller-assistant',
    url: 'www.sellerassistant.app/blog/',
    categories: ['shopping'],
    example: '/amazon/seller-assistant',
    name: 'Seller Assistant',
    maintainers: [],
    radar: [{ source: ['www.sellerassistant.app/blog/'], target: '/seller-assistant' }],
    handler: async () => {
        const link = 'https://www.sellerassistant.app/blog/';
        const html = await ofetch(link, { responseType: 'text' });
        const $ = load(html);
        const items = $('a.card-spot[href^="/blog/"]')
            .toArray()
            .map((element) => {
                const card = $(element);
                const category = card.find('.text-brand').text();
                return { title: card.find('h5').text(), link: new URL(card.attr('href')!, link).href, category: category ? [category] : undefined };
            });
        return {
            title: 'Seller Assistant - Blog',
            link,
            item: await fetchArticles(items, '.embedded-article'),
        };
    },
};
