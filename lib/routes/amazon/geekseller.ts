import type { Route } from '@/types';

import { fetchRss } from './utils';

export const route: Route = {
    path: '/geekseller',
    url: 'www.geekseller.com/blog/category/amazon/',
    categories: ['shopping'],
    example: '/amazon/geekseller',
    name: 'GeekSeller',
    maintainers: [],
    radar: [{ source: ['www.geekseller.com/blog/category/amazon/'], target: '/geekseller' }],
    handler: () => fetchRss('https://www.geekseller.com/blog/category/amazon/feed/', 'https://www.geekseller.com/blog/category/amazon/', 'GeekSeller - Amazon'),
};
