/**
 * Convert markdown text to clean plain text suitable for email bodies.
 */
export function stripMarkdown(md: string): string {
  return (
    md
      // Code fences (handle first to avoid stripping inside them)
      .replace(/```\w*\n([\s\S]*?)```/g, "$1")
      // Remove heading markers
      .replace(/^#{1,6}\s+/gm, "")
      // Bold/italic
      .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/___(.+?)___/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/_(.+?)_/g, "$1")
      // Strikethrough
      .replace(/~~(.+?)~~/g, "$1")
      // Inline code
      .replace(/`(.+?)`/g, "$1")
      // Images: ![alt](url) → alt
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
      // Links: [text](url) → text (url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
      // Horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // Unordered list markers → bullet
      .replace(/^[\s]*[-*+]\s+/gm, "• ")
      // Block quotes
      .replace(/^>\s?/gm, "")
  );
}
