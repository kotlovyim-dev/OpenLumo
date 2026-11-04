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

describe('renderEmailHtml link and image safety', () => {
  const render = (body: string) => renderEmailHtml({ ...base, body }, dna);
  const expectSafe = (html: string) => {
    expect(html).not.toMatch(/href="javascript/i);
    expect(html).not.toMatch(/<[^>]*\sonerror=/i);
    expect(html).not.toMatch(/<[^>]*\sonclick=/i);
    expect(html).not.toMatch(/<[^>]*\sonmouseover=/i);
    expect(html).not.toContain('<img');
  };

  it('drops javascript: and data: link targets', () => {
    const html = render('[x](javascript:alert(1)) [y](data:text/html,hi)');
    expectSafe(html);
    expect(html).not.toContain('<a ');
    expect(html).toContain('x');
  });

  it('escapes inline raw HTML', () => {
    const html = render('a <b onclick=x>b</b>');
    expectSafe(html);
    expect(html).toContain('&lt;b onclick=x&gt;');
  });

  it('cannot break out of the href attribute', () => {
    const html = render('[x](http://a"onmouseover="y)');
    expectSafe(html);
  });

  it('does not render markdown images', () => {
    expectSafe(render('![x](javascript:alert(1))'));
  });

  it('does not render javascript autolinks', () => {
    const html = render('<javascript:alert(1)>');
    expectSafe(html);
  });

  it('falls back to the default accent for an invalid palette colour', () => {
    const html = renderEmailHtml(base, createPartialBrandDna({ name: 'A', palette: ['red;}</style><script>'] }));
    expect(html).toContain('#6d55f0');
    expect(html).not.toContain('<script>');
  });
});
