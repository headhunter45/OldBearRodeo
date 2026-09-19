# Favicon Generation Prompt for Old Bear Rodeo

This document contains AI image generation prompts tailored for generating a modern, recognizable favicon and app icon for **Old Bear Rodeo**.

---

## Primary Recommended Prompt (Modern Vector / App Icon)

### Midjourney v6 / DALL-E 3 / Flux Prompt:
> **`A minimalist modern app icon favicon of a friendly grizzly bear wearing a fantasy adventurer ranger bandana, clean geometric vector illustration, bold silhouette, indigo and electric violet color palette (#6366f1) with warm amber gold accents, dark circular background (#0f172a), high contrast, crisp edges, recognizable at 16x16 and 32x32 pixel resolution, flat design with subtle neon gradient glow, D&D tabletop aesthetic, no text, square aspect ratio, vector graphic style --no photorealistic, noisy details, complex background`**

---

## Alternative Variations

### 1. Stylized 3D Glassmorphic App Icon
> **`Modern 3D render app icon of a stylized grizzly bear head silhouette, frosted glassmorphism texture, glowing indigo and neon cyan lighting from beneath, matte obsidian dark background, smooth rounded edges, highly legible miniature icon for browser tab, ambient occlusion, Unreal Engine 5 render style, 8k, square aspect ratio`**

### 2. Bold Minimalist Tabletop Rodeo Crest
> **`Crisp minimalist crest logo icon featuring a stylized bear head enclosed within a circular d20 polyhedral frame, flat duotone design with indigo violet (#6366f1) and crisp white on dark navy background (#0f172a), sharp vector line art, clean SVG icon style, optimized for browser favicon`**

### 3. Retro Pixel Art Favicon (16x16 / 32x32)
> **`Pixel art 32x32 icon of a brown grizzly bear face with glowing purple eyes and a blue headband, dark background, sharp clean pixels, retro RPG video game style, high contrast, crisp pixel art`**

---

## Output & Placement Instructions

Once you generate and choose your preferred image:
1. Resize or export the image to:
   - **`favicon.ico`** (multi-size 16x16, 32x32, 48x48)
   - **`favicon.svg`** or **`favicon.png`** (192x192 and 512x512 for PWA/mobile bookmarks)
2. Place the file(s) into:
   - `packages/client/public/favicon.ico`
   - `packages/client/public/favicon.png`
3. Update `packages/client/index.html`:
   ```html
   <link rel="icon" type="image/png" href="/favicon.png" />
   <link rel="icon" type="image/x-icon" href="/favicon.ico" />
   ```
