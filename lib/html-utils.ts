/**
 * HTML sanitization and plain-text extraction utilities.
 *
 * Used for Shopify product/bundle descriptions that arrive as HTML.
 */

const ALLOWED_TAGS = [
  "p", "strong", "b", "em", "i", "ul", "ol", "li", "br",
  "h1", "h2", "h3", "h4", "h5", "h6", "a", "span",
];

/**
 * Sanitize HTML by removing dangerous tags (script, style, iframe, etc.),
 * stripping event handlers and inline styles, and keeping only safe tags.
 */
export function sanitizeHtml(html: string): string {
  let s = html;
  // Remove dangerous paired tags and their content
  s = s.replace(
    /<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    "",
  );
  // Remove self-closing dangerous tags
  s = s.replace(
    /<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/\s*>/gi,
    "",
  );
  // Remove event handlers
  s = s.replace(/\son\w+="[^"]*"/gi, "");
  s = s.replace(/\son\w+='[^']*'/gi, "");
  // Remove inline styles
  s = s.replace(/\sstyle="[^"]*"/gi, "");
  s = s.replace(/\sstyle='[^']*'/gi, "");
  // Keep only allowed tags
  s = s.replace(/<(\/?)(\w+)([^>]*)>/g, (_match, slash, tag) => {
    const lower = String(tag).toLowerCase();
    if (!ALLOWED_TAGS.includes(lower)) return "";
    if (!slash && lower === "br") return "<br/>";
    return `<${slash}${lower}>`;
  });
  return s;
}

/**
 * Strip ALL HTML tags and return plain text.
 * Useful for previews, search, and numberOfLines truncation.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
