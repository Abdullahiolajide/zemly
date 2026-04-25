/**
 * Sanitize note-like text before embedding it into Gemini prompts.
 */
export function sanitizeNoteForPrompt(note: string): string {
    return note
    .replace(/\r\n/g, '\n')
        .replace(/\s{3,}/g, '  ')
        .trim();
}