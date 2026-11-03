import { describe, expect, it } from 'vitest';
import { extractCssColors } from '../../src/crawl/css-colors';
import { extractPage } from '../../src/crawl/extract-page';

const html = `<!doctype html><html><head>
<title>Hello</title>
<meta name="description" content="A page">
<meta property="og:image" content="/og.png">
<meta property="og:site_name" content="Acme">
<link rel="shortcut icon" href="/fav.ico">
<link rel="stylesheet" href="/a.css">
<style>p { color: #abc; }</style>
<script>var secret = 1;</script>
</head><body>
<nav>menu text</nav>
<img class="site-logo" src="/brand.png" alt="">
<img src="/photo.jpg">
<p>Body text</p>
<a href="/next#frag">Next</a><a href="mailto:a@b.c">Mail</a>
<footer>footer text</footer>
</body></html>`;

describe('extractPage', () => {
  const page = extractPage(html, 'https://acme.test/dir/');

  it('extracts metadata and resolved urls', () => {
    expect(page.title).toBe('Hello');
    expect(page.description).toBe('A page');
    expect(page.openGraph).toEqual({ 'og:image': '/og.png', 'og:site_name': 'Acme' });
    expect(page.faviconUrl).toBe('https://acme.test/fav.ico');
    expect(page.stylesheetUrls).toEqual(['https://acme.test/a.css']);
    expect(page.links).toEqual(['https://acme.test/next']);
    expect(page.imageUrls).toEqual(['https://acme.test/brand.png', 'https://acme.test/photo.jpg']);
    expect(page.inlineCss).toContain('#abc');
  });

  it('drops script, style, nav and footer from text', () => {
    expect(page.text).toBe('Body text NextMail');
  });

  it('prefers an img with logo over icon and og:image', () => {
    expect(page.logoUrl).toBe('https://acme.test/brand.png');
  });

  it('falls back to link[rel=icon] then og:image', () => {
    const withIcon = extractPage(
      '<head><link rel="icon" href="/i.png"><meta property="og:image" content="/o.png"></head>',
      'https://x.test/',
    );
    expect(withIcon.logoUrl).toBe('https://x.test/i.png');
    const ogOnly = extractPage('<head><meta property="og:image" content="/o.png"></head>', 'https://x.test/');
    expect(ogOnly.logoUrl).toBe('https://x.test/o.png');
    expect(extractPage('<p>none</p>', 'https://x.test/').logoUrl).toBeUndefined();
  });
});

describe('extractCssColors', () => {
  it('ranks hex colors by frequency and ignores black, white and transparent', () => {
    const css = 'a{color:#FF5A1F}b{color:#ff5a1f;background:#fff}c{color:#000000;background:#1d3557}d{color:#1D3557}e{color:#ff5a1f;background:transparent}f{color:#FFFFFF}';
    expect(extractCssColors(css)).toEqual(['#ff5a1f', '#1d3557']);
  });

  it('expands three digit hex', () => {
    expect(extractCssColors('a{color:#f50}')).toEqual(['#ff5500']);
  });
});
