import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';

import { fetchArticles } from './utils';

interface SellersPage {
    hasPart: Array<{ name: string; url: string }>;
}

export const route: Route = {
    path: '/sellers',
    categories: ['shopping'],
    example: '/amazon/sellers',
    name: 'Seller news',
    maintainers: [],
    radar: [{ source: ['www.aboutamazon.com/news/tag/sellers'], target: '/sellers' }],
    handler: async () => {
        const link = 'https://www.aboutamazon.com/news/tag/sellers';
        const page = await ofetch<SellersPage>('https://www.aboutamazon.com/json/news/tag/sellers');
        return {
            title: 'About Amazon - Sellers',
            link,
            item: await fetchArticles(
                page.hasPart.map((item) => ({ title: item.name, link: item.url })),
                '.ArticlePage-articleBody'
            ),
        };
    },
};
