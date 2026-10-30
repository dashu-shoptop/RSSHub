import type { Route } from '@/types';

import { fetchWordPress } from './utils';

export const route: Route = {
    path: '/jungle-scout',
    url: 'www.junglescout.com/resources/articles/',
    categories: ['shopping'],
    example: '/amazon/jungle-scout',
    name: 'Jungle Scout',
    maintainers: [],
    radar: [{ source: ['www.junglescout.com/resources/articles/'], target: '/jungle-scout' }],
    handler: () => fetchWordPress('https://www.junglescout.com/wp-json/wp/v2/article', 'https://www.junglescout.com/resources/articles/', 'Jungle Scout - Articles'),
};
