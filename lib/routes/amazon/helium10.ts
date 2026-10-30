import type { Route } from '@/types';

import { fetchWordPress } from './utils';

export const route: Route = {
    path: '/helium10',
    url: 'www.helium10.com/blog/',
    categories: ['shopping'],
    example: '/amazon/helium10',
    name: 'Helium 10',
    maintainers: [],
    radar: [{ source: ['www.helium10.com/blog/'], target: '/helium10' }],
    handler: () => fetchWordPress('https://www.helium10.com/wp-json/wp/v2/posts', 'https://www.helium10.com/blog/', 'Helium 10 - Blog'),
};
