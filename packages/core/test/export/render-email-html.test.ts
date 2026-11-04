import { describe, expect, it } from 'vitest';
import { createPartialBrandDna } from '../../src/brand-dna/brand-dna-schema';
import { renderEmailHtml } from '../../src/export/render-email-html';

const dna = createPartialBrandDna({ name: 'Acme', palette: ['#112233'] });
const base = { subject: 'Hello', preheader: 'Pre', body: 'Hi **there**' };

describe('renderEmailHtml', () => {
  it('renders a 600px table layout with the accent colour', () => {
    const html = renderEmailHtml(base, dna);
    expect(html).toContain('width="600"');
    expect(html).toContain('#112233');
    expect(html).toContain('<strong>there</strong>');
  });

  it('escapes script tags from the copy', () => {
    const html = renderEmailHtml({ ...base, body: 'Hi <script>alert(1)</script>' }, dna);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes img onerror tags and scripts in subject and preheader', () => {
    const html = renderEmailHtml(
      { subject: '<script>x</script>', preheader: '<b>p</b>', body: '<img src=x onerror=alert(1)>' },
      dna,
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>p</b>');
  });
});
