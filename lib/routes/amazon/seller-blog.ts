import { load } from 'cheerio';

import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';

import { fetchArticles } from './utils';

// Avoid truncated zstd responses from this site.
const requestHeaders = { 'accept-encoding': 'gzip, deflate, br' };

export const route: Route = {
    path: '/seller-blog',
    categories: ['shopping'],
    example: '/amazon/seller-blog',
    name: 'Seller Blog',
    maintainers: [],
    radar: [{ source: ['sell.amazon.com/blog'], target: '/seller-blog' }],
    handler: async () => {
        const link = 'https://sell.amazon.com/blog';
        const html = await ofetch(link, { responseType: 'text', headers: requestHeaders });
        const $ = load(html);
        const items = $('.PagePromo-title a')
            .toArray()
            .map((element) => ({ title: $(element).text(), link: new URL($(element).attr('href')!, link).href }));
        return {
            title: 'Amazon Seller Blog',
            link,
            item: await fetchArticles(items, '.Page-articleBody', requestHeaders),
        };
    },
};
