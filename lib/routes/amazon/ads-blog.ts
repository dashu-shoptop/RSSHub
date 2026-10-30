import type { Route } from '@/types';

import { fetchAds } from './utils';

export const route: Route = {
    path: '/ads-blog',
    url: 'advertising.amazon.com/en-us/resources/library',
    categories: ['shopping'],
    example: '/amazon/ads-blog',
    name: 'Ads Blog',
    maintainers: [],
    description: 'The former Ads Blog now redirects to the advertising resource library.',
    radar: [{ source: ['advertising.amazon.com/blog', 'advertising.amazon.com/resources/library', 'advertising.amazon.com/en-us/resources/library'], target: '/ads-blog' }],
    handler: () => fetchAds('Education', 'https://advertising.amazon.com/en-us/resources/library', 'Amazon Ads - Resources'),
};
