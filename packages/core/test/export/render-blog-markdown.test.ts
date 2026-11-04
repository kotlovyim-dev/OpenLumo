import { describe, expect, it } from 'vitest';
import { renderBlogMarkdown } from '../../src/export/render-blog-markdown';

describe('renderBlogMarkdown', () => {
  it('writes front matter, article and FAQ', () => {
    const markdown = renderBlogMarkdown({
      seoTitle: 'My "Title"',
      metaDescription: 'Desc',
      outline: ['a'],
      article: 'Body text',
      faq: [{ question: 'Why?', answer: 'Because.' }],
    });
    expect(markdown.startsWith('---\ntitle: "My \\"Title\\""\ndescription: "Desc"\n---\n')).toBe(true);
    expect(markdown).toContain('Body text');
    expect(markdown).toContain('## FAQ');
    expect(markdown).toContain('### Why?\n\nBecause.');
  });

  it('omits the FAQ section when there are no questions', () => {
    const markdown = renderBlogMarkdown({ seoTitle: 'T', metaDescription: 'D', outline: ['a'], article: 'B', faq: [] });
    expect(markdown).not.toContain('## FAQ');
  });
});
