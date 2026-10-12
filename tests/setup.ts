import * as vue from 'vue'

// Nuxt auto-imports Vue composables globally — replicate that here.
// Skip names that already exist in the DOM environment (Text, Comment, …):
// Vue exports VNode-type symbols under those names, and since Vitest 5
// assignments to globalThis propagate to happy-dom's window, they would
// overwrite the real DOM classes and break rendering.
for (const [key, value] of Object.entries(vue)) {
  if (key in globalThis) continue
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true })
}
