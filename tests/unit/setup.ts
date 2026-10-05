/*
 * src/lib/format.ts legge `window.claude` al caricamento (download dentro gli
 * Artifact). In Node `window` non esiste: basta un oggetto vuoto.
 */
const g = globalThis as unknown as { window?: unknown }
if (typeof g.window === 'undefined') g.window = {}
