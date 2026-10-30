import type { Route } from '@/types';

import { fetchAds } from './utils';

export const route: Route = {
    path: '/ads-updates',
    url: 'advertising.amazon.com/en-us/resources/whats-new',
    categories: ['shopping'],
    example: '/amazon/ads-updates',
    name: 'Ads product updates',
    maintainers: [],
    radar: [{ source: ['advertising.amazon.com/en-us/resources/whats-new'], target: '/ads-updates' }],
    handler: () => fetchAds('Whats new', 'https://advertising.amazon.com/en-us/resources/whats-new', 'Amazon Ads - Product updates'),
};
