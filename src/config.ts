// URLs for files served from public/. BASE_URL keeps them working when the site
// is deployed under a sub-path.
const BASE = import.meta.env.BASE_URL;

/** The story intro is its own document, embedded unchanged in an iframe. Cache-busted so its animations replay. */
export const storyIntroUrl = (): string => `${BASE}story-intro.html?v=${Date.now()}`;

/** Optional recorded narration; the guide falls back to speech synthesis when the file is missing. */
export const audioUrl = (id: string): string => `${BASE}audio/${id}.mp3`;
