import type { Channel } from '../planner/channel-formats';

export const channelGuidance: Record<Channel, string> = {
  instagram: [
    'Write something a reader would save or send to one specific person: a checklist, a sharp opinion or a relatable moment.',
    'Only the first 125 characters show before "more": put the hook or the payoff there and name the topic in plain words, never a greeting or the brand name.',
    'Captions: 50 to 150 words in 3 to 6 short paragraphs for teaching posts, otherwise one or two lines and a question.',
    'Hashtags: 3 to 5 specific topical tags, never generic ones such as #love or #instagood.',
    'Links: write "link in bio", never a URL.',
    'Carousels: 6 to 8 slides, with a cover that makes people swipe.',
  ].join('\n'),
  facebook: [
    'Posts: 1 to 3 short lines that people would forward privately on Messenger or WhatsApp.',
    'Write original material for Facebook, never a reworded post from another platform.',
    'Hashtags: 0 to 2.',
    'Links: write "link in the first comment", never a URL in the post.',
    'Carousels: 6 to 8 slides.',
  ].join('\n'),
  linkedin: [
    'The first two lines (about 140 characters) decide the "see more" click: open with a specific claim, a number or a counter-intuitive result.',
    "Name the brand's one to three expertise topics in plain words in those first lines.",
    'Posts: 800 to 1,300 characters in paragraphs of one or two sentences with white space between them.',
    'Write evergreen material worth saving, such as a framework, a checklist or a lesson, in a founder or team voice ("I", "we") rather than a corporate announcement.',
    'Hashtags: 0 to 3, all relevant.',
    'Links: write "link in the first comment", never a URL in the post.',
    'Emoji: at most 1.',
    'Carousels: 8 slides with large type and one idea per slide.',
  ].join('\n'),
  x: [
    'Posts: one standalone post of 1 or 2 sentences, under 200 characters, with one concrete claim people can reply to or quote.',
    'Hashtags: 0 or 1.',
    'Links: write "link in the first reply", never a URL in the post.',
  ].join('\n'),
  tiktok: [
    'Captions: 1 or 2 sentences that use the keyword people would search for to find this topic.',
    'Open with a question the post answers, a preview of the end result or a countdown.',
    'Write native, casual, first-person material for TikTok, never a repost from another platform.',
    'Hashtags: 3 to 5, mixing one or two broad community tags with niche ones.',
    'Links: write "link in bio", never a URL.',
  ].join('\n'),
  email: [
    'Write to one reader as "you". Sign off as the brand team, or as a person only when the Brand DNA or the instruction names one.',
    'Write the body in Markdown with short paragraphs or bullets and one bold key line.',
    'Never use spam phrases such as "free money", "act now", "click here", "guarantee", "winner" or "100% free", and never write words in all caps.',
    'Emoji: at most 1.',
  ].join('\n'),
  blog: [
    'Publish something only this brand can say: its own process, product detail, customer case or opinion from the Brand DNA.',
    'Stay inside the brand expertise and never summarise other sources without adding something new.',
    'Attribute every number in the same sentence, and never pad the article to reach a word count.',
    'Emoji: none.',
  ].join('\n'),
};
