# Lumo: character bible and prompts

Lumo is the OpenLumo mascot. This file is the working reference for drawing Lumo and for generating the soft vinyl scenes. The design decisions live in `docs/specs/2026-11-03-lumo-mascot-design.md`; the trademark rules are in `TRADEMARKS.md`.

## Character bible

### Shape

- A rounded triangular prism with soft edges and visible depth, about as tall as it is wide.
- Short, rounded stubby arms on the sides with mitten hands and no fingers.
- Two short, rounded stubby feet at the base.
- The triangle silhouette is the identity. Lumo is never drawn round-headed or humanoid.

### Surface

- Smooth matte vinyl, like a designer toy.
- Lilac gradient from top to base: `#F1EDFF`, `#CBBFFF`, `#9F8CF0`.
- One soft highlight on the upper left of the front face.

### Face

- Placed in the lower half of the front face.
- Two vertical oval eyes in dark indigo `#26204A`, each with a small white catch-light.
- Soft pink blush `#FF9BB8` under each eye.
- A small, simple curved smile.
- No eyebrows, nose or teeth. Expression comes from eye shape, posture and arms.

### Signature motif

One white beam enters, a rainbow leaves. Each band stands for a channel, and the same colours are used in the UI.

| Channel | Name | Colour |
|---|---|---|
| Ads | coral | `#FF5F7E` |
| Socials | amber | `#FFB347` |
| SEO and blog | sun | `#FFE156` |
| Email | mint | `#3FD68F` |
| Brand | sky | `#4AA3FF` |

The band order is always coral, amber, sun, mint, sky. When fewer bands are drawn (the logo mark uses three: coral, sun, sky), they keep that order from top to bottom.

### Personality

Curious and eager. Lumo always looks busy on the user's behalf and never smug.

### Distinctness rules

- Never white, never round-headed, never a humanoid figure.
- No factory or conveyor-belt scenes.
- Scenes use the light studio concept: light goes in, content comes out.

## Flat vector style

The flat files in `apps/web/public/brand/` are hand-written SVG and keep the same silhouette, palette and face as the 3D character:

- Body: the rounded triangle with the lilac gradient, a thin `#9F8CF0` outline so it reads on light backgrounds, one flat shadow shape on the right side and one white highlight on the upper left.
- Arms: a `#CBBFFF` stroke over a slightly wider `#9F8CF0` stroke, with round caps as the mitten hands. Feet: two `#9F8CF0` rounded rectangles behind the body.
- Props: dark `#26204A` cards with a `#9F8CF0` border for UI objects (browser, form, board), pale `#F1EDFF` for paper, channel colours only as small accents.
- Colours: only the palette above plus `#FFFFFF` and `#0B0A12`. Every spot must read on the dark `#0B0A12` background and on light backgrounds.
- Files: `viewBox` only, no scripts, no external references, no comments, gradient ids prefixed with the file name.

| File | Content |
|---|---|
| `logo/lumo-mark.svg` | Lumo front view, simplified, with three rainbow rays |
| `logo/openlumo-wordmark.svg` | Mark plus the word OpenLumo (follows the light or dark colour scheme) |
| `logo/favicon.svg`, `logo/favicon-32.png` | Body and eyes only, readable at 16 px |
| `logo/icon-512.png` | Mark on a dark rounded square |
| `spots/setup-welcome.svg` | Lumo waving |
| `spots/reading-site.svg` | Lumo reading a browser window |
| `spots/needs-input.svg` | Lumo holding a pencil, looking at a form |
| `spots/empty-board.svg` | Lumo beside an empty board |
| `spots/exported.svg` | Lumo cheering beside a package |
| `spots/not-found.svg` | Lumo with an "oops" face and a torn page |

## Soft vinyl prompts

Generate the reference sheet first. The maintainer picks one variant and keeps it as `lumo-reference.png` (not committed). Attach it to every scene prompt below. Review each result against the checklist in the mascot spec, section 5, and re-prompt with the failed item named.

### Shared style block

The same character as the reference image: Lumo, a small designer-toy mascot whose whole body is a rounded triangular prism with visible depth, smooth matte pastel-lilac vinyl (pale lavender at the top to violet at the base), dark indigo vertical oval eyes with a white catch-light, pink blush, small curved smile, short stubby arms with mitten hands, two short stubby feet. Premium 3D render, soft studio lighting, gentle rim light, soft contact shadows, clean and minimal, dark background #0B0A12. Keep proportions, colours and face exactly as in the reference.

### Never

A round head, a humanoid body, a white body, fingers, teeth, eyebrows, a nose, text, letters, numbers, logos, watermarks, extra limbs, a cluttered background, a factory or conveyor belt.

### 0. Reference sheet (3:2, 1536 x 1024)

```
Character reference sheet for an original 3D mascot named Lumo.

Layout: a clean, plain dark background (#0B0A12). Top row: four full-body views of the same character at the same scale, evenly spaced: front, three-quarter, side, back. Bottom row: six close-ups of the face and upper body showing expressions: happy, thinking (looking up, one hand on its side), excited (arms raised), oops (eyes glancing sideways, small worried smile), sleepy (half-closed eyes), proud (arms on hips).

Character: a small, cute designer-toy figure whose entire body is a rounded triangular prism, like a soft triangle-shaped gummy with gently rounded corners and edges and visible depth. It is about as tall as it is wide. Material: smooth matte vinyl with a pastel lilac gradient, very pale lavender (#F1EDFF) at the top, soft lilac (#CBBFFF) in the middle, deeper violet (#9F8CF0) at the base, with one soft glossy highlight on the upper left. The face sits in the lower half of the front: two vertical oval eyes in dark indigo (#26204A) with a small white catch-light, soft pink blush (#FF9BB8) under each eye, and a small simple curved smile. Two short, rounded stubby arms come out of the sides with simple mitten hands and no fingers. Two short, rounded stubby feet at the base. Arms and feet are the same lilac vinyl.

Signature detail, front view only: a thin beam of white light enters the left side of the prism and exits the right side as a soft rainbow ribbon in this exact order from top to bottom: coral (#FF5F7E), amber (#FFB347), sun yellow (#FFE156), mint (#3FD68F), sky blue (#4AA3FF).

Rendering: premium 3D render with the polish of an animated feature film, soft studio lighting, gentle rim light, subtle ambient occlusion, soft contact shadows. Clean and minimal. Identical proportions, colours and face in every view.

Do not include: a round head, a humanoid body, a white body, fingers, teeth, eyebrows, a nose, text, letters, labels, logos, watermarks, extra limbs, or a busy background.
```

### 1. Hero: light studio (16:9, 1536 x 864 or larger)

```
Attach the reference image. The same character as the reference image: Lumo, a small designer-toy mascot whose whole body is a rounded triangular prism with visible depth, smooth matte pastel-lilac vinyl, dark indigo oval eyes with white catch-lights, pink blush, small smile, stubby arms with mitten hands, stubby feet.

Scene: a calm, minimal "light studio" on a dark background (#0B0A12). On the left, a floating, softly glowing blank browser window sends a single thin beam of white light to the right. In the centre stands a giant, transparent version of Lumo's prism body (no face) that catches the beam and splits it into a soft rainbow ribbon fanning out to the right, in this exact order from top to bottom: coral, amber, sun yellow, mint, sky blue. Along the ribbon, the light turns into floating blank content cards: a square social post card, a tall ad card, an envelope-shaped email card and a long article card, each with only soft coloured shapes, no text. Three small Lumo characters (identical to the reference) work happily: one on the left adjusts the beam with a small lever, one catches a floating card with both hands, one on the right pins a card onto a dark board of neatly arranged cards. Soft rim light, glossy floor reflections, gentle bokeh specks of rainbow light.

Premium 3D render, soft studio lighting, clean and minimal composition with breathing room. No text, letters, numbers, logos or watermarks anywhere. No factory, no conveyor belt, no humanoid figures.
```

### 2. Feature card: Ads (4:5, 1024 x 1280)

```
Attach the reference image. The same character as the reference image: Lumo, a small designer-toy mascot whose whole body is a rounded triangular prism with visible depth, smooth matte pastel-lilac vinyl, dark indigo oval eyes with white catch-lights, pink blush, small smile, stubby arms with mitten hands, stubby feet.

Scene: Lumo cheering with both arms raised and an excited open smile, standing in front of a floating rounded smartphone. The phone screen shows a simple glowing bar chart of five rising bars in a coral-to-pink gradient, with a small glowing dot on the tallest bar. A few coral sparkles float around. Dark background (#0B0A12), Lumo fills the lower half of the frame, the phone fills the upper middle.

Premium 3D render, soft studio lighting, gentle rim light, soft contact shadow. No text, letters, numbers, logos or watermarks.
```

### 3. Feature card: Socials (4:5)

```
Attach the reference image. The same character as the reference image: Lumo, a small designer-toy mascot whose whole body is a rounded triangular prism with visible depth, smooth matte pastel-lilac vinyl, dark indigo oval eyes with white catch-lights, pink blush, small smile, stubby arms with mitten hands, stubby feet.

Scene: Lumo taking a selfie, holding a dark smartphone up in one mitten hand at arm's length, the other mitten raised in a cheerful wave, eyes happily squinting. Behind it floats a soft content calendar grid of rounded pastel cards in amber, pink and sky blue, a few marked with a small amber heart shape. Dark background (#0B0A12).

Premium 3D render, soft studio lighting, gentle rim light, soft contact shadow. No text, letters, numbers, logos or watermarks.
```

### 4. Feature card: SEO (4:5)

```
Attach the reference image. The same character as the reference image: Lumo, a small designer-toy mascot whose whole body is a rounded triangular prism with visible depth, smooth matte pastel-lilac vinyl, dark indigo oval eyes with white catch-lights, pink blush, small smile, stubby arms with mitten hands, stubby feet.

Scene: Lumo holding a large round magnifying glass in front of one eye, so the eye looks big and curious through the lens, the other mitten resting on its side. Above it float three stacked rounded pills with soft sun-yellow glows, like search results rising upward, the top one with a small trophy shape. Dark background (#0B0A12).

Premium 3D render, soft studio lighting, gentle rim light, soft contact shadow. No text, letters, numbers, logos or watermarks.
```

### 5. Feature card: Emails (4:5)

```
Attach the reference image. The same character as the reference image: Lumo, a small designer-toy mascot whose whole body is a rounded triangular prism with visible depth, smooth matte pastel-lilac vinyl, dark indigo oval eyes with white catch-lights, pink blush, small smile, stubby arms with mitten hands, stubby feet.

Scene: Lumo, leaning forward on one foot, launching a folded paper-plane made from a mint-green envelope into the air with one mitten. The plane leaves a soft mint glowing trail that curves up into a gentle rising line chart. Lumo looks proud and happy. Dark background (#0B0A12).

Premium 3D render, soft studio lighting, gentle rim light, soft contact shadow. No text, letters, numbers, logos or watermarks.
```

### 6. Feature card: Brand DNA (4:5)

```
Attach the reference image. The same character as the reference image: Lumo, a small designer-toy mascot whose whole body is a rounded triangular prism with visible depth, smooth matte pastel-lilac vinyl, dark indigo oval eyes with white catch-lights, pink blush, small smile, stubby arms with mitten hands, stubby feet.

Scene: Lumo proudly holding up an open fan of colour swatch cards with both mittens, the swatches in coral, amber, sun yellow, mint and sky blue. Floating around it: a small soft speech-bubble shape, a small rounded font-sample tile showing only abstract shapes, and a tiny rounded image tile. Dark background (#0B0A12).

Premium 3D render, soft studio lighting, gentle rim light, soft contact shadow. No text, letters, numbers, logos or watermarks.
```

### 7. README banner (3:1, 1536 x 512)

```
Attach the reference image. The same character as the reference image: Lumo, a small designer-toy mascot whose whole body is a rounded triangular prism with visible depth, smooth matte pastel-lilac vinyl, dark indigo oval eyes with white catch-lights, pink blush, small smile, stubby arms with mitten hands, stubby feet.

Wide banner composition on a dark background (#0B0A12). The left 45% of the frame is empty dark space (reserved for a logo added later). Right of centre, Lumo stands waving at the viewer. A thin beam of white light enters Lumo from the left and leaves on the right as a soft rainbow ribbon, in this exact order from top to bottom: coral, amber, sun yellow, mint, sky blue, which curls gently off the right edge. Subtle glossy floor reflection.

Premium 3D render, soft studio lighting, gentle rim light. No text, letters, numbers, logos or watermarks.
```

