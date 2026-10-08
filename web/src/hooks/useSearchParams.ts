// The query string as URLSearchParams; setting it navigates in place, without a scroll reset.

import * as React from "react";
import { useSearchParams as useRrdSearchParams } from "react-router-dom";

type SearchInit = URLSearchParams | Record<string, string>;
type SearchUpdate = SearchInit | ((prev: URLSearchParams) => SearchInit);

export function useSearchParams(): [
    URLSearchParams,
    (next: SearchUpdate, options?: { replace?: boolean }) => void,
] {
    const [params, setParamsRrd] = useRrdSearchParams();

    const setParams = React.useCallback(
        (next: SearchUpdate, options?: { replace?: boolean }) => {
            setParamsRrd(
                (prev) => {
                    const resolved = typeof next === "function" ? next(prev) : next;
                    return new URLSearchParams(resolved as Record<string, string>);
                },
                { replace: options?.replace, preventScrollReset: true },
            );
        },
        [setParamsRrd],
    );

    return [params, setParams];
}

export function useSearchParam(key: string): [string, (value: string) => void] {
    const [params, setParams] = useSearchParams();
    const setValue = React.useCallback((value: string) => {
        setParams((prev) => {
            const next = new URLSearchParams(prev);
            if (value) next.set(key, value);
            else next.delete(key);
            return next;
        }, { replace: true });
    }, [key, setParams]);
    return [params.get(key) ?? "", setValue];
}
