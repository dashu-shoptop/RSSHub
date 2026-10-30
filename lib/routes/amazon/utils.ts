import { load } from 'cheerio';
import { decodeHTML } from 'entities';
import pMap from 'p-map';

import type { Data, DataItem } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import parser from '@/utils/rss-parser';

export type Article = DataItem & { link: string };

interface ArticleMetadata {
    '@type'?: string | string[];
    '@graph'?: ArticleMetadata[];
    datePublished?: string;
    dateModified?: string;
    author?: Array<{ name?: string }> | { name?: string };
}

export async function fetchRss(feedUrl: string, link: string, title: string): Promise<Data> {
    const feed = await parser.parseURL(feedUrl);
    return {
        title,
        link,
        description: feed.description,
        language: feed.language,
        item: feed.items
            .filter((item) => item.link && item.title)
            .map((item) => ({
                title: item.title!,
                link: item.link,
                description: item['content:encoded'] ?? item.content ?? item.description,
                pubDate: item.isoDate || item.pubDate ? parseDate(item.isoDate || item.pubDate!) : undefined,
                author: item.creator ?? item.author,
                category: item.categories,
            })),
    };
}

export function fetchArticles(items: Article[], contentSelector: string, headers?: Record<string, string>): Promise<DataItem[]> {
    const uniqueItems = new Map(items.map((item) => [item.link, item])).values().toArray();
    return pMap(
        uniqueItems,
        (item) =>
            cache.tryGet(item.link, async () => {
                const html = await ofetch(item.link, { responseType: 'text', headers });
                const $ = load(html);
                const schemas = $('script[type="application/ld+json"]')
                    .toArray()
                    .flatMap((element) => {
                        const schema = JSON.parse($(element).text()) as ArticleMetadata | ArticleMetadata[];
                        return Array.isArray(schema) ? schema : (schema['@graph'] ?? [schema]);
                    });
                const metadata = schemas.find((schema) => [schema['@type']].flat().some((type) => ['Article', 'NewsArticle', 'BlogPosting'].includes(type!)));
                const content = $(contentSelector).first();
                if (!content.length) {
                    throw new Error(`Article content was not found at ${item.link}`);
                }
                content.find('script, style, h1').remove();
                content.find('img').each((_, element) => {
                    const image = $(element);
                    const src = image.attr('data-src') || image.attr('src');
                    if (src && !src.startsWith('data:')) {
                        image.attr('src', new URL(src, item.link).href);
                    }
                });
                const published = metadata?.datePublished || $('meta[property="article:published_time"]').attr('content') || $('time[datetime]').first().attr('datetime');
                const updated = metadata?.dateModified || $('meta[property="article:modified_time"]').attr('content');
                const authors = metadata?.author
                    ? [metadata.author]
                          .flat()
                          .map((author) => author.name)
                          .filter(Boolean)
                          .join(', ')
                    : undefined;
                const tags = $('meta[property="article:tag"], meta[property="article:section"]')
                    .toArray()
                    .map((element) => $(element).attr('content')!)
                    .filter(Boolean);
                return {
                    ...item,
                    title: $('meta[property="og:title"]').attr('content') || $('h1').first().text() || item.title,
                    description: content.html()!,
                    pubDate: published ? parseDate(published) : item.pubDate,
                    updated: updated ? parseDate(updated) : undefined,
                    author: authors || $('meta[name="author"]').attr('content') || $('.Page-authorInfo-name, .ArticlePage-authorName').first().text() || item.author,
                    category: tags.length ? tags : item.category,
                };
            }),
        { concurrency: 4 }
    );
}

interface WordPressPost {
    title: { rendered: string };
    link: string;
    content: { rendered: string };
    date_gmt?: string;
    modified_gmt?: string;
    _embedded?: {
        author?: Array<{ name: string }>;
        'wp:term'?: Array<Array<{ name: string }>>;
    };
}

export async function fetchWordPress(apiUrl: string, link: string, title: string): Promise<Data> {
    const posts = await ofetch<WordPressPost[]>(apiUrl, { query: { per_page: 10, _embed: true } });
    return {
        title,
        link,
        item: posts.map((post) => ({
            title: decodeHTML(post.title.rendered),
            link: post.link,
            description: post.content.rendered,
            pubDate: post.date_gmt ? parseDate(`${post.date_gmt}Z`) : undefined,
            updated: post.modified_gmt ? parseDate(`${post.modified_gmt}Z`) : undefined,
            author: post._embedded?.author?.map((author) => author.name).join(', '),
            category: post._embedded?.['wp:term']?.flat().map((term) => decodeHTML(term.name)),
        })),
    };
}

interface AdsArticle {
    title: string;
    url: string;
    description: string;
    publishDateTimestamp?: string;
    subPageType: string;
    relatedTopics: string[];
    relatedProducts: string[];
}

export async function fetchAds(subpageType: 'Education' | 'Whats new', link: string, title: string): Promise<Data> {
    const articles = await ofetch<AdsArticle[]>('https://advertising.amazon.com/a20m-api/v1/pages', { query: { subpageType, locale: 'en-us' } });
    return {
        title,
        link,
        language: 'en-us',
        // The website displays twelve results before its "See more" button.
        item: articles.slice(0, 12).map((article) => ({
            title: article.title,
            link: new URL(article.url.replace(/^\/advertising\.amazon\.com/, '/en-us'), 'https://advertising.amazon.com').href,
            description: article.description,
            pubDate: article.publishDateTimestamp ? parseDate(article.publishDateTimestamp) : undefined,
            category: [...new Set([article.subPageType, ...article.relatedTopics, ...article.relatedProducts].filter((tag) => !tag.startsWith('sKey-')))],
        })),
    };
}
