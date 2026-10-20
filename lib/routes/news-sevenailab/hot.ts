import { escape } from 'entities';

import type { Route } from '@/types';
import { parseDate } from '@/utils/parse-date';

import { baseUrl, fetchData } from './utils';

interface HotData {
    hot: {
        entries: Array<{
            story: { publicId: string; title: string };
            summary?: string;
            latest?: string;
            firstReportAt?: string;
            latestAt?: string;
        }>;
    };
}

export const route: Route = {
    path: '/hot',
    name: '热点',
    url: 'news.sevenailab.com/hot',
    example: '/news-sevenailab/hot?sorted=false',
    categories: ['new-media'],
    maintainers: [],
    description: '过去 48 小时的热点事件。使用公共参数 `sorted=false` 保留网站热度榜顺序，否则按发布时间排序。',
    features: { requireConfig: false, requirePuppeteer: false, antiCrawler: false, supportRadar: true },
    radar: [{ source: ['news.sevenailab.com/hot'], target: '/hot' }],
    handler: async () => {
        const { hot } = await fetchData<HotData>('/hot', 'routes/hot');
        return {
            title: '品牌AI外刊 - 热点',
            link: `${baseUrl}/hot`,
            language: 'zh-CN',
            item: hot.entries.map((entry) => ({
                title: entry.story.title,
                link: `${baseUrl}/story/${entry.story.publicId}`,
                description: `${entry.summary ? `<p>${escape(entry.summary)}</p>` : ''}${entry.latest ? `<p>${escape(entry.latest)}</p>` : ''}`,
                pubDate: entry.firstReportAt ? parseDate(entry.firstReportAt) : undefined,
                updated: entry.latestAt ? parseDate(entry.latestAt) : undefined,
            })),
        };
    },
};
