import type { Route } from '@/types';

import { fetchRss } from './utils';

export const route: Route = {
    path: '/value-added-resource',
    url: 'www.valueaddedresource.net/tag/amazon/',
    categories: ['new-media'],
    example: '/amazon/value-added-resource',
    name: 'Value Added Resource',
    maintainers: [],
    radar: [{ source: ['www.valueaddedresource.net/tag/amazon/'], target: '/value-added-resource' }],
    handler: () => fetchRss('https://www.valueaddedresource.net/tag/amazon/rss/', 'https://www.valueaddedresource.net/tag/amazon/', 'Value Added Resource - Amazon'),
};
