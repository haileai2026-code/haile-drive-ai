/** Escape LIKE/ILIKE wildcards (\, %, _) so a value is matched literally. */
export function likeLiteral(v: string): string {
  return v.replace(/[\\%_]/g, (c) => `\\${c}`);
}
