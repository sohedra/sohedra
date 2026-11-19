// What both pages import: the bundler may put it in a chunk the two share.
export const greeting = (page: string): string => `shared-chunk-marker ${page}`;
