import { ParsedRecipients } from '../types';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Safely parses raw CSV or plain text input and extracts deduplicated valid email addresses.
 */
export function parseRecipientInput(content: string): ParsedRecipients {
  if (!content || content.trim().length === 0) {
    return {
      rawCount: 0,
      valid: [],
      invalid: [],
      duplicatesRemoved: 0,
    };
  }

  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return {
      rawCount: 0,
      valid: [],
      invalid: [],
      duplicatesRemoved: 0,
    };
  }

  // Check if first line is a CSV header
  let emailColIndex = -1;
  const headerCells = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
  
  emailColIndex = headerCells.findIndex(
    (h) => h === 'email' || h === 'emails' || h === 'recipient' || h === 'recipient_email' || h === 'to'
  );

  const startLineIndex = emailColIndex !== -1 ? 1 : 0;
  const rawTokens: string[] = [];

  for (let i = startLineIndex; i < lines.length; i++) {
    const line = lines[i];

    if (emailColIndex !== -1) {
      // CSV structured mode
      const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
      if (cols[emailColIndex]) {
        rawTokens.push(cols[emailColIndex]);
      }
    } else {
      // Split by comma, semicolon, whitespace, or tabs
      const tokens = line
        .split(/[,;\t\s]+/)
        .map((t) => t.trim().replace(/^["']|["']$/g, ''))
        .filter((t) => t.length > 0);
      rawTokens.push(...tokens);
    }
  }

  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  let duplicatesRemoved = 0;

  for (const token of rawTokens) {
    const normalized = token.toLowerCase();

    if (!EMAIL_REGEX.test(token)) {
      invalid.push(token);
      continue;
    }

    if (seen.has(normalized)) {
      duplicatesRemoved++;
      continue;
    }

    seen.add(normalized);
    valid.push(normalized);
  }

  return {
    rawCount: rawTokens.length,
    valid,
    invalid,
    duplicatesRemoved,
  };
}
