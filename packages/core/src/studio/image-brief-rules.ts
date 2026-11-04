import type { AspectRatio } from '@openlumo/providers';

export function imageBriefRules(aspectRatio: AspectRatio): string {
  return [
    'Write each image brief as one scene paragraph, not a keyword list: setting, subject, action, key details, light, camera and lens, mood, then the purpose in plain words (such as "make fresh bread feel close to home"). Never name a platform, an app, a screen or a post type.',
    "Show one focal subject: the brand's actual product in use, or a person using it, placed on the rule of thirds or as a centred hero.",
    'Follow the image style in the Brand DNA. Without one, describe a real photo taken in the moment: natural light, real texture and small imperfections, candid framing for organic posts and a cleaner editorial look for ads.',
    'Say where one or two brand palette colours appear in the scene, such as a prop, a wall or clothing, as an accent rather than a flood. Name colours in words such as "warm amber", never as hex codes.',
    `Compose for a ${aspectRatio} frame.`,
    'Never ask for text, letters, logos or watermarks in the image. The app adds the headline and the logo.',
    'When you set headlineOverlay, keep it to 7 words or fewer in sentence case, and give the scene an uncluttered, darker lower third.',
    'Never use the words epic, cinematic, award-winning, hyper-detailed, 8k or masterpiece. End each brief with a short "Avoid:" line: stock-photo look, plastic skin, posed groups, clutter.',
    "In a carousel, start every slide's brief with the same style line (palette, background, light) so the slides look like one set.",
  ].join('\n');
}
