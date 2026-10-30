import { load } from 'cheerio';

import InvalidParameterError from '@/errors/types/invalid-parameter';
import type { Language, Route } from '@/types';
import ofetch from '@/utils/ofetch';

import { fetchArticles, fetchRss } from './utils';

const regions: Record<string, { domain: string; name: string; language: Language; rss?: boolean }> = {
    us: { domain: 'www.aboutamazon.com', name: 'US', language: 'en-us', rss: true },
    uk: { domain: 'www.aboutamazon.co.uk', name: 'UK', language: 'en-gb', rss: true },
    ca: { domain: 'www.aboutamazon.ca', name: 'Canada', language: 'en-ca' },
    mx: { domain: 'www.aboutamazon.mx', name: 'Mexico', language: 'es-mx' },
    br: { domain: 'www.aboutamazon.com.br', name: 'Brasil', language: 'pt-br' },
    de: { domain: 'www.aboutamazon.de', name: 'Germany', language: 'de-de', rss: true },
    fr: { domain: 'www.aboutamazon.fr', name: 'France', language: 'fr-fr' },
    it: { domain: 'www.aboutamazon.it', name: 'Italy', language: 'it-it' },
    es: { domain: 'www.aboutamazon.es', name: 'Spain', language: 'es-es' },
    jp: { domain: 'www.aboutamazon.jp', name: 'Japan', language: 'ja', rss: true },
    in: { domain: 'www.aboutamazon.in', name: 'India', language: 'en', rss: true },
    au: { domain: 'www.aboutamazon.com.au', name: 'Australia', language: 'en-au' },
};

export const route: Route = {
    path: '/about/:region?',
    categories: ['new-media'],
    example: '/amazon/about/us',
    name: 'News by region',
    maintainers: [],
    parameters: { region: 'Region code: us (default), uk, ca, mx, br, de, fr, it, es, jp, in, au.' },
    description: 'News from the regional About Amazon websites. The Mexico website has moved to aboutamazon.mx.',
    radar: Object.entries(regions).map(([region, { domain }]) => ({ source: [`${domain}/`], target: `/about/${region}` })),
    handler: async (ctx) => {
        const region = ctx.req.param('region') ?? 'us';
        if (!Object.hasOwn(regions, region)) {
            throw new InvalidParameterError(`Unsupported region: ${region}. Use one of: ${Object.keys(regions).join(', ')}.`);
        }
        const site = regions[region];
        const link = `https://${site.domain}/`;
        const title = `About Amazon - ${site.name}`;
        if (site.rss) {
            return { ...(await fetchRss(`${link}rss/feed.rss`, link, title)), language: site.language };
        }
        const html = await ofetch(link, { responseType: 'text' });
        const $ = load(html);
        const items = $('.HubPromo-title a, .HubPromoImageOnSide-title a, .PromoCard-title a')
            .toArray()
            .filter((element) => {
                const anchor = $(element);
                const href = anchor.attr('href');
                return anchor.closest('[data-content-type]').attr('data-content-type') === 'article' && href && !/\s/.test(href);
            })
            .map((element) => ({ title: $(element).text(), link: new URL($(element).attr('href')!, link).href }));
        return {
            title,
            link,
            language: site.language,
            item: await fetchArticles(items, '.ArticlePage-articleBody'),
        };
    },
};
