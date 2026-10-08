// Plain `?key=value` strings, as every link already sent out uses; the router's default JSON-encodes values.

export type SearchParams = Record<string, string | undefined>;

export function parseSearch(searchStr: string): SearchParams {
    const out: SearchParams = {};
    new URLSearchParams(searchStr).forEach((value, key) => {
        if (!(key in out)) out[key] = value;
    });
    return out;
}

export function stringifySearch(search: Record<string, unknown>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(search)) {
        if (value === undefined || value === null || value === "") continue;
        params.set(key, String(value));
    }
    const str = params.toString();
    return str ? `?${str}` : "";
}

/** Splits a full href into link fields, for targets built elsewhere: `<Link {...hrefTarget(url)}>`. */
export function hrefTarget(href: string): { to: string } {
    return { to: href };
}
