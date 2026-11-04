import { Marked } from 'marked';
import type { BrandDna } from '../brand-dna/brand-dna-schema';
import type { EmailCopy } from '../studio/format-schemas';
import { escapeHtml } from './escape-html';

const DEFAULT_ACCENT_COLOR = '#6d55f0';
const SAFE_URL = /^(https?:|mailto:)/i;
const HEX_COLOR = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;

function createMarkdown(accentColor: string): Marked {
  return new Marked({
    renderer: {
      html: ({ text }) => escapeHtml(text),
      link({ href, tokens }) {
        const label = this.parser.parseInline(tokens);
        if (!SAFE_URL.test(href)) return label;
        return `<a href="${escapeHtml(href)}" style="color:${accentColor}">${label}</a>`;
      },
      image: ({ text }) => escapeHtml(text),
    },
  });
}

export function renderEmailHtml(copy: EmailCopy, dna: BrandDna): string {
  const candidate = dna.visuals.palette[0] ?? '';
  const accentColor = HEX_COLOR.test(candidate) ? candidate : DEFAULT_ACCENT_COLOR;
  const body = createMarkdown(accentColor).parse(copy.body, { async: false });
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5">
<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(copy.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<tr><td style="height:6px;background:${accentColor}"></td></tr>
<tr><td style="padding:32px 32px 8px;font-size:22px;font-weight:bold">${escapeHtml(copy.subject)}</td></tr>
<tr><td style="padding:8px 32px 32px;font-size:16px;line-height:1.6">${body}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
}
