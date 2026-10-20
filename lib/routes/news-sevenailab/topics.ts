import { escape } from 'entities';

import type { Route } from '@/types';
import { parseDate } from '@/utils/parse-date';

import { baseUrl, fetchData } from './utils';

interface TopicData {
    data: {
        topic: { slug: string; name: string; definition: string };
        items: Array<{
            id: string;
            title: string;
            summary?: string;
            source: { name: string };
            publishedAt?: string;
            tags: string[];
        }>;
    };
}

export const route: Route = {
    path: '/topics/:slug',
    name: '主题',
    url: 'news.sevenailab.com/topics',
    example: '/news-sevenailab/topics/openai',
    parameters: {
        slug: '主题页面 URL 的最后一段，例如 `openai`、`google`、`ai-search`、`research`。可在 https://news.sevenailab.com/topics 查看全部主题。',
    },
    categories: ['new-media'],
    maintainers: [],
    description: '订阅指定主题第一页的资讯，包含网站提供的中文摘要。',
    features: { requireConfig: false, requirePuppeteer: false, antiCrawler: false, supportRadar: true },
    radar: [{ source: ['news.sevenailab.com/topics/:slug'], target: '/topics/:slug' }],
    handler: async (ctx) => {
        const topicSlug = ctx.req.param('slug');
        if (!topicSlug) {
            throw new Error('Missing required topic parameter: slug');
        }
        const slug = encodeURIComponent(topicSlug);
        const { data } = await fetchData<TopicData>(`/topics/${slug}`, 'topic');
        return {
            title: `品牌AI外刊 - ${data.topic.name}`,
            description: data.topic.definition,
            link: `${baseUrl}/topics/${data.topic.slug}`,
            language: 'zh-CN',
            item: data.items.map((item) => ({
                title: item.title,
                link: `${baseUrl}/items/${item.id}`,
                description: item.summary ? `<p>${escape(item.summary)}</p>` : undefined,
                pubDate: item.publishedAt ? parseDate(item.publishedAt) : undefined,
                author: item.source.name,
                category: item.tags,
            })),
        };
    },
};
