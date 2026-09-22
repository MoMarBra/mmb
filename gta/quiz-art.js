/** Original QUIZSSOIR artwork created with the built-in image generator.
 * Full prompts and source/runtime checksums: assets/quiz/art-credits.json.
 * The standalone build injects WebP data URLs before this module executes.
 */
const artURL = (filename) => globalThis.__BBE_QUIZ_ART__?.[filename] || './assets/quiz/' + filename;
export const QUIZ_ART = Object.freeze({
  logo: Object.freeze({
    filename: 'quizssoir-logo.webp',
    url: artURL('quizssoir-logo.webp'),
    width: 1536,
    height: 1024,
    transparent: true,
    contentBounds: Object.freeze({ x: 60, y: 21, width: 1422, height: 947 }),
    solidBounds: Object.freeze({ x: 65, y: 30, width: 1404, height: 931 }),
    alt: 'QUIZSSOIR',
  }),
  backdrop: Object.freeze({
    filename: 'quizssoir-backdrop.webp',
    url: artURL('quizssoir-backdrop.webp'),
    width: 1672,
    height: 941,
    transparent: false,
    alt: '',
  }),
});
export const QUIZ_ART_CREDITS_URL = './assets/quiz/art-credits.json';
