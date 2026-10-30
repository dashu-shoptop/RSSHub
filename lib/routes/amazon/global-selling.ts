import { load } from 'cheerio';
import pMap from 'p-map';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

function fetchArticle(link: string) {
    return cache.tryGet(link, async () => {
        const html = await ofetch(link, { responseType: 'text' });
        const $ = load(html);
        const title = $('meta[property="og:title"]').attr('content')!;
        const heading = $('.as-body .heading')
            .filter((_, element) => $(element).text() === title)
            .first();
        const content = heading.closest('.as-body > .flex-full-width');
        if (!content.length) {
            throw new Error(`Global Selling article content was not found at ${link}`);
        }
        const dateElement = content
            .find('.text')
            .filter((_, element) => /^\s*\d{4}年\d{1,2}月\d{1,2}日\s*$/.test($(element).text()))
            .first();
        const published = dateElement.text().trim();
        heading.remove();
        dateElement.remove();
        content.find('[data-popup-id="as_cn_ags_news_btm_pop"]').closest('.bg-no-repeat').parent().remove();
        content
            .find('.text')
            .filter((_, element) => $(element).text().trim() === '其他热点资讯')
            .closest('.is-fluid')
            .parent()
            .remove();
        content.find('script, style, .popup-layover').remove();
        return {
            title,
            link,
            description: content.html(),
            pubDate: published ? parseDate(published, 'YYYY年MM月DD日', 'zh-cn') : undefined,
        };
    });
}

export const route: Route = {
    path: '/global-selling',
    url: 'gs.amazon.cn/news',
    categories: ['shopping'],
    example: '/amazon/global-selling',
    name: '全球开店资讯',
    maintainers: [],
    radar: [{ source: ['gs.amazon.cn/news', 'globalselling.amazon.com/news'], target: '/global-selling' }],
    handler: async () => {
        const link = 'https://gs.amazon.cn/news';
        const html = await ofetch(link, { responseType: 'text' });
        const $ = load(html);
        const links = $('a[href*="/news/news-"]')
            .toArray()
            .map((element) => {
                const url = new URL($(element).attr('href')!, link);
                url.search = '';
                return url.href;
            });
        return {
            title: '亚马逊全球开店 - 官方资讯',
            link,
            language: 'zh-CN',
            item: await pMap([...new Set(links)], fetchArticle, { concurrency: 4 }),
        };
    },
};
