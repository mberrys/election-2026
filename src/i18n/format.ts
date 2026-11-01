export type Vars = Record<string, string | number>;

const PLACEHOLDER = /\{(\w+)\}/g;

/** Placeholder names in a message: "{a} of {b}" -> ["a", "b"]. */
export function placeholders(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((m) => m[1]);
}

/**
 * Fills `{name}` placeholders. A placeholder with no value is left as written, so a mistake is visible, not silent.
 * Free of any catalog, so client components can use it without bundling the translations.
 */
export function format(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(PLACEHOLDER, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}
