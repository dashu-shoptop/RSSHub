import { decodeHTML } from 'entities';

import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import { isShortNews } from '@/utils/short-news';

interface WordPressCategory {
    id: number;
    slug: string;
}

interface WordPressPost {
    link: string;
    title: { rendered: string };
    content: { rendered: string };
    date_gmt?: string;
    modified_gmt?: string;
    _embedded?: {
        author?: Array<{ name: string }>;
        'wp:term'?: Array<Array<{ name: string }>>;
    };
}

export const route: Route = {
    path: '/tiktok',
    name: 'TikTok',
    categories: ['new-media'],
    example: '/tubefilter/tiktok',
    maintainers: [],
    description: 'Official WordPress API with full article content. Only articles within 600 words and 1500 CJK characters from the first 20 entries are included.',
    radar: [{ source: ['www.tubefilter.com/category/tiktok/'], target: '/tiktok' }],
    handler: async () => {
        const link = 'https://www.tubefilter.com/category/tiktok/';
        const api = 'https://www.tubefilter.com/wp-json/wp/v2';
        const categories = await ofetch<WordPressCategory[]>(`${api}/categories`, { query: { slug: 'tiktok' } });
        const category = categories.find((entry) => entry.slug === 'tiktok');
        if (!category) {
            throw new Error(`TikTok category is missing from ${api}/categories`);
        }
        const posts = await ofetch<WordPressPost[]>(`${api}/posts`, {
            query: {
                categories: category.id,
                per_page: 20,
                _embed: 'author,wp:term',
                _fields: 'link,title,content,date_gmt,modified_gmt,_embedded,_links',
            },
        });
        const candidates = new Map(posts.map((post) => [post.link, post])).values().take(20).toArray();
        const items = candidates
            .map((post) => {
                if (!post.content.rendered) {
                    throw new Error(`Missing full article content: ${post.link}`);
                }
                return {
                    title: decodeHTML(post.title.rendered),
                    link: post.link,
                    description: post.content.rendered,
                    pubDate: post.date_gmt ? parseDate(`${post.date_gmt}Z`) : undefined,
                    updated: post.modified_gmt ? parseDate(`${post.modified_gmt}Z`) : undefined,
                    author: post._embedded?.author?.map((entry) => decodeHTML(entry.name)).join(', '),
                    category: post._embedded?.['wp:term']?.flat().map((entry) => decodeHTML(entry.name)),
                };
            })
            .filter((entry) => isShortNews(entry.description));
        if (!items.length) {
            throw new Error(`No short news found at ${link}; check the first 20 API posts and the 600-word / 1500-CJK-character limits.`);
        }
        return { title: 'Tubefilter TikTok', link, language: 'en', item: items };
    },
};
