import type { AspectRatio } from '@openlumo/providers';

export function imageBriefRules(aspectRatio: AspectRatio): string {
  return [
    'Write each image brief as one scene paragraph, not a keyword list: setting, subject, action, key details, light, camera and lens, mood, then the intended use (such as "Instagram feed post for a neighbourhood bakery").',
    "Show one focal subject: the brand's actual product in use, or a person using it, placed on the rule of thirds or as a centred hero.",
    'Follow the image style in the Brand DNA. Without one, describe a real photo taken in the moment: natural light, real texture and small imperfections, candid framing for social posts and a cleaner editorial look for ads.',
    'Say where one or two brand palette colours appear in the scene, such as a prop, a wall or clothing, as an accent rather than a flood.',
    `Compose for a ${aspectRatio} frame.`,
    'Never ask for text, letters, logos or watermarks in the image. The app adds the headline and the logo.',
    'When you set headlineOverlay, keep it to 7 words or fewer in sentence case and keep the lower third of the image calm and dark enough for white text.',
    'Never use the words epic, cinematic, award-winning, hyper-detailed, 8k or masterpiece. End each brief with an "Avoid:" line listing stock-photo look, glossy plastic skin, heavy bokeh, lens flare, oversaturated neon, fake smiles, posed symmetrical groups and clutter.',
    "In a carousel, start every slide's brief with the same style line (palette, background, light) so the slides look like one set.",
  ].join('\n');
}
