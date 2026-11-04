import type { ItemFormat } from '../planner/channel-formats';

export const formatGuidance: Record<ItemFormat, string> = {
  social_post: [
    'Write a caption, a list of hashtags and one image brief describing the picture to render.',
    'The first line is the hook: under 125 characters, built on a specific noun, number or tension, with no greeting and no brand name.',
    'Carry one idea per post and keep the length the channel rules give.',
    'Put hashtags only in the hashtags field, as many as the channel rules allow and never more than 5, each a single specific tag starting with #.',
    'End with a specific question or a line worth saving or sending.',
  ].join('\n'),
  carousel: [
    'Write 6 to 8 slides, each with a title, a short text and its own image brief, plus a caption for the whole carousel.',
    'Slide 1: a hook title of at most 10 words that promises a payoff or names a tension, and a text of at most 8 words.',
    'Slide 2 delivers value or stakes at once, never an introduction.',
    'Middle slides carry one point each: a title of at most 8 words and a text of at most 25 words.',
    'Last slide: a one-line recap and one call to action (save it, follow the series, or a specific question).',
    'Follow the arc problem, insight, steps or examples, result, call to action.',
    'The caption adds context and never repeats the slides.',
  ].join('\n'),
  static_ad: [
    'Write a headline, primary text, a call to action and one image brief describing the picture to render.',
    'Pick one framework and write to it: problem-agitate-solution, before-after-bridge, social proof or offer first.',
    'The headline states the outcome or the offer, never the brand name, within the length the channel rules give.',
    'Put the hook and the offer in the first 125 characters of the primary text.',
    'Use proof such as a number, a named customer or a rating only when the Brand DNA gives one.',
    'The call to action is one short verb phrase that fits the goal, such as "Order today" or "Get the guide". It labels the link button, so never send readers anywhere else for the link.',
    'No hashtags.',
  ].join('\n'),
  email: [
    'Write a subject line, a preheader and the email body.',
    'Subject: 30 to 50 characters in sentence case, with a number or "How to" where it fits naturally. No all caps, no "!!!", and urgency only for a real deadline from the Brand DNA or the instruction.',
    'Preheader: 40 to 90 characters that extend the subject without repeating it, never "View in browser".',
    'The first 150 characters of the body carry the point: state the main value or offer in the first one or two sentences, because inbox summaries may replace the preheader.',
    'Body: 50 to 200 words on one idea, in 3 to 5 short paragraphs or bullets, with one primary call to action labelled with a verb and an outcome (such as "Get the checklist") and an optional P.S. that repeats it.',
  ].join('\n'),
  blog_post: [
    'Write an SEO title, a meta description, an outline, the full article in Markdown and an FAQ.',
    'SEO title: at most 60 characters, saying exactly what the reader gets, with no clickbait.',
    'Meta description: 140 to 160 characters with the answer and the reason to click.',
    "Answer the title's question in the first 40 to 60 words.",
    'After the introduction, add a "Key takeaways" list of 3 to 5 bullets.',
    'Use H2 headings phrased as the questions readers ask, each opened by a direct answer of one or two sentences. The outline lists these headings in order.',
    'Add a table or numbered steps when comparing or instructing.',
    'Include at least one first-hand element from the Brand DNA: a process, a product detail, a customer case or a quote. Where the article needs a fact, number, quote or case the Brand DNA lacks, write a placeholder such as [ADD: customer result] instead of inventing it.',
    'End with a short conclusion and one call to action, and keep the FAQ out of the article.',
    'FAQ: 3 to 6 questions customers really ask, drawn from the audience pain points and objections, each answered in one to three sentences.',
  ].join('\n'),
};
