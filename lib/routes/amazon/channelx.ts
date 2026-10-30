import type { Route } from '@/types';

import { fetchRss } from './utils';

export const route: Route = {
    path: '/channelx',
    url: 'channelx.world/category/amazon/',
    categories: ['new-media'],
    example: '/amazon/channelx',
    name: 'ChannelX',
    maintainers: [],
    radar: [{ source: ['channelx.world/category/amazon/'], target: '/channelx' }],
    handler: () => fetchRss('https://channelx.world/category/amazon/feed/', 'https://channelx.world/category/amazon/', 'ChannelX - Amazon'),
};
