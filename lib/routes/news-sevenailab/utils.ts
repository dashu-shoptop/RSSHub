import { escape } from 'entities';
import pMap from 'p-map';

import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const baseUrl = 'https://news.sevenailab.com';

type EncodedValue = string | number | boolean | null | number[] | Record<string, number>;

// React Router data responses store object keys and values as references into a flat array.
function decodeValue(values: EncodedValue[], index: number): unknown {
    if (index === -5) {
        return null;
    }
    if (index === -7) {
        return undefined;
    }
    if (index < 0 || index >= values.length) {
        throw new Error('Invalid Seven AI Lab data reference');
    }
    const value = values[index];
    if (Array.isArray(value)) {
        return value.map((entry) => decodeValue(values, entry));
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [String(values[Number(key.slice(1))]), decodeValue(values, entry)]));
    }
    return value;
}

export async function fetchData<T>(path: string, routeId: string): Promise<T> {
    const values = await ofetch<EncodedValue[]>(`${baseUrl}${path}.data`, { responseType: 'json' });
    const loaders = decodeValue(values, 0) as Record<string, { data?: T }>;
    const data = loaders[routeId]?.data;
    if (!data) {
        throw new Error(`Seven AI Lab returned no data for ${path}`);
    }
    return data;
}

interface ReportStory {
    title: string;
    summary?: string;
    sourceUrl?: string;
    available: boolean;
}

interface ReportSection {
    label: string;
    summary?: string;
    items: ReportStory[];
}

interface Report {
    key: string;
    title: string;
    generatedAt?: string;
    lead?: { title: string; leadParagraph?: string };
    overview?: string;
    sections: ReportSection[];
    flashes: ReportStory[];
}

interface ReportData {
    report?: Report;
    index: Array<{ key: string }>;
}

function renderStory(story: ReportStory): string {
    if (!story.available) {
        return '';
    }
    return `<h3>${escape(story.title)}</h3>${story.summary ? `<p>${escape(story.summary)}</p>` : ''}${story.sourceUrl ? `<p><a href="${escape(story.sourceUrl)}">阅读原文</a></p>` : ''}`;
}

function reportItem(report: Report, kind: string): DataItem {
    const overview = report.lead?.leadParagraph || report.overview;
    const sections = report.sections.map((section) => `<h2>${escape(section.label)}</h2>${section.summary ? `<p>${escape(section.summary)}</p>` : ''}${section.items.map(renderStory).join('')}`).join('');
    return {
        title: report.lead?.title ? `${report.title} · ${report.lead.title}` : report.title,
        link: `${baseUrl}/${kind}/${report.key}`,
        description: `${overview ? `<p>${escape(overview)}</p>` : ''}${sections}${report.flashes.length ? `<h2>快讯</h2>${report.flashes.map(renderStory).join('')}` : ''}`,
        pubDate: report.generatedAt ? parseDate(report.generatedAt) : undefined,
        author: '品牌AI外刊',
    };
}

export function reportRoute(kind: 'daily' | 'weekly' | 'monthly', name: string): Route {
    return {
        path: `/${kind}`,
        name,
        url: `news.sevenailab.com/${kind}`,
        example: `/news-sevenailab/${kind}`,
        categories: ['new-media'],
        maintainers: [],
        description: `每期${name}作为一条订阅内容，包含整期正文。`,
        features: { requireConfig: false, requirePuppeteer: false, antiCrawler: false, supportRadar: true },
        radar: [{ source: [`news.sevenailab.com/${kind}`, `news.sevenailab.com/${kind}/*`], target: `/${kind}` }],
        handler: async () => {
            const { report, index } = await fetchData<ReportData>(`/${kind}`, `${kind}-latest`);
            if (!report) {
                throw new Error(`Seven AI Lab has not published a ${kind} report`);
            }
            const items = await pMap(
                index,
                ({ key }) =>
                    key === report.key
                        ? reportItem(report, kind)
                        : cache.tryGet(`${baseUrl}/${kind}/${key}`, async () => {
                              const { report: detail } = await fetchData<ReportData>(`/${kind}/${key}`, `${kind}-detail`);
                              if (!detail) {
                                  throw new Error(`Seven AI Lab report is unavailable: ${kind}/${key}`);
                              }
                              return reportItem(detail, kind);
                          }),
                { concurrency: 4 }
            );
            return {
                title: `品牌AI外刊 - ${name}`,
                link: `${baseUrl}/${kind}`,
                language: 'zh-CN',
                item: items,
            };
        },
    };
}
