import { PageRow } from './db';

export interface ContextSnippet {
  book: string;
  pageNo: number;
  unit: string | null;
  snippet: string;
}

const SNIPPET_RADIUS = 120;
const MAX_SNIPPETS_PER_PAGE = 3;
const MAX_TOTAL_SNIPPETS = 12;

function extractSnippets(content: string, term: string): string[] {
  const snippets: string[] = [];
  let fromIndex = 0;
  const lower = content.toLowerCase();
  const lowerTerm = term.toLowerCase();

  while (snippets.length < MAX_SNIPPETS_PER_PAGE) {
    const idx = lower.indexOf(lowerTerm, fromIndex);
    if (idx === -1) break;
    const start = Math.max(0, idx - SNIPPET_RADIUS);
    const end = Math.min(content.length, idx + lowerTerm.length + SNIPPET_RADIUS);
    snippets.push(content.slice(start, end).trim());
    fromIndex = idx + lowerTerm.length;
  }

  return snippets;
}

export function buildContexts(pages: PageRow[], term: string): ContextSnippet[] {
  const contexts: ContextSnippet[] = [];

  for (const page of pages) {
    if (contexts.length >= MAX_TOTAL_SNIPPETS) break;
    const snippets = extractSnippets(page.content, term);
    for (const snippet of snippets) {
      if (contexts.length >= MAX_TOTAL_SNIPPETS) break;
      contexts.push({
        book: page.book,
        pageNo: page.page_no,
        unit: page.unit,
        snippet,
      });
    }
  }

  return contexts;
}
