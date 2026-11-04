import type { BlogPostCopy } from '../studio/format-schemas';

export function renderBlogMarkdown(copy: BlogPostCopy): string {
  const frontMatter = `---\ntitle: ${JSON.stringify(copy.seoTitle)}\ndescription: ${JSON.stringify(copy.metaDescription)}\n---\n`;
  const faq = copy.faq.length
    ? `\n## FAQ\n\n${copy.faq.map(({ question, answer }) => `### ${question}\n\n${answer}`).join('\n\n')}\n`
    : '';
  return `${frontMatter}\n${copy.article.trim()}\n${faq}`;
}
