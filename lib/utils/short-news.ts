import { convert } from 'html-to-text';

export function isShortNews(description: string): boolean {
    const text = convert(description, {
        wordwrap: false,
        selectors: [
            { selector: 'a', options: { ignoreHref: true } },
            { selector: 'img', format: 'skip' },
        ],
    }).trim();
    if (!text) {
        throw new Error('Missing article body: cannot determine whether this is short news.');
    }
    const words = text.split(/\s+/u).length;
    const cjkCharacters = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)?.length ?? 0;
    return words <= 600 && cjkCharacters <= 1500;
}
