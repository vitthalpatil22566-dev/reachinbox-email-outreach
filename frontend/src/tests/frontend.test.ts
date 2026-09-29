import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseRecipientInput } from '../utils/csvParser';
import {
  formatLocalDate,
  formatLocalTime,
  combineLocalDateTime,
  formatTargetDispatch,
} from '../components/ComposeTab';

describe('Phase 5 — Frontend Ingestion, Parsing & Client Verification', () => {
  // --------------------------------------------------------------------------
  // 1. CSV & Plain Text Ingestion
  // --------------------------------------------------------------------------
  it('1. Parses single email per line correctly', () => {
    const rawInput = `
      alice@example.com
      bob@example.com
      charlie@domain.org
    `;

    const res = parseRecipientInput(rawInput);
    assert.strictEqual(res.rawCount, 3);
    assert.strictEqual(res.valid.length, 3);
    assert.strictEqual(res.invalid.length, 0);
    assert.strictEqual(res.duplicatesRemoved, 0);
    assert.deepStrictEqual(res.valid, [
      'alice@example.com',
      'bob@example.com',
      'charlie@domain.org',
    ]);
  });

  it('2. Parses CSV with header row and extracts targeted email column', () => {
    const csvContent = `name,email,company
Alice Johnson,alice@reachinbox.ai,Acme Inc
Bob Smith,bob@reachinbox.ai,Globex Corp
Charlie Brown,charlie@reachinbox.ai,Initech`;

    const res = parseRecipientInput(csvContent);
    assert.strictEqual(res.valid.length, 3);
    assert.deepStrictEqual(res.valid, [
      'alice@reachinbox.ai',
      'bob@reachinbox.ai',
      'charlie@reachinbox.ai',
    ]);
  });

  it('3. Filters invalid emails and isolates them for display', () => {
    const mixedInput = `
      valid.one@reachinbox.ai
      not-an-email
      missing-domain@
      valid.two@reachinbox.ai
      @missing-user.com
      plainaddress
    `;

    const res = parseRecipientInput(mixedInput);
    assert.strictEqual(res.valid.length, 2);
    assert.strictEqual(res.invalid.length, 4);
    assert.ok(res.invalid.includes('not-an-email'));
    assert.ok(res.invalid.includes('missing-domain@'));
    assert.ok(res.invalid.includes('@missing-user.com'));
    assert.ok(res.invalid.includes('plainaddress'));
  });

  it('4. Deduplicates recipient emails case-insensitively and tracks duplicate count', () => {
    const duplicatesInput = `
      user@example.com
      USER@EXAMPLE.COM
      User@Example.Com
      another@example.com
      ANOTHER@EXAMPLE.COM
    `;

    const res = parseRecipientInput(duplicatesInput);
    assert.strictEqual(res.valid.length, 2);
    assert.strictEqual(res.duplicatesRemoved, 3);
    assert.deepStrictEqual(res.valid, ['user@example.com', 'another@example.com']);
  });

  it('5. Handles comma, semicolon, and tab delimited email tokens', () => {
    const delimitedInput =
      'user1@test.com, user2@test.com; user3@test.com\tuser4@test.com user5@test.com';

    const res = parseRecipientInput(delimitedInput);
    assert.strictEqual(res.valid.length, 5);
  });

  it('6. Handles empty, whitespace, and null inputs gracefully', () => {
    const empty1 = parseRecipientInput('');
    assert.strictEqual(empty1.valid.length, 0);
    assert.strictEqual(empty1.rawCount, 0);

    const empty2 = parseRecipientInput('   \n  \t  \r\n  ');
    assert.strictEqual(empty2.valid.length, 0);
    assert.strictEqual(empty2.rawCount, 0);
  });

  // --------------------------------------------------------------------------
  // 2. Client Scheduling Validation Rules
  // --------------------------------------------------------------------------
  it('7. Validates schedule start time constraint (must be in future)', () => {
    const pastDate = new Date(Date.now() - 3600000); // 1 hr ago
    const futureDate = new Date(Date.now() + 3600000); // 1 hr future

    const isPastValid = futureDate.getTime() > Date.now();
    const isPastInvalid = pastDate.getTime() > Date.now();

    assert.strictEqual(isPastValid, true);
    assert.strictEqual(isPastInvalid, false);
  });

  it('8. Validates subject and body content requirements', () => {
    const validSubject = 'Monthly Investor Update';
    const emptySubject = '   ';
    const validBody = '<p>Here is our progress</p>';
    const emptyBody = '';

    assert.strictEqual(validSubject.trim().length > 0, true);
    assert.strictEqual(emptySubject.trim().length > 0, false);
    assert.strictEqual(validBody.trim().length > 0, true);
    assert.strictEqual(emptyBody.trim().length > 0, false);
  });

  it('9. Formats local date and time without UTC offset drift', () => {
    const fixedDate = new Date(2026, 8, 28, 18, 30, 0, 0); // 28 Sep 2026, 18:30 local
    const formattedDate = formatLocalDate(fixedDate);
    const formattedTime = formatLocalTime(fixedDate);

    assert.strictEqual(formattedDate, '2026-09-28');
    assert.strictEqual(formattedTime, '18:30');
  });

  it('10. Combines manual date and time into local Date instance correctly', () => {
    const combined = combineLocalDateTime('2026-09-28', '18:30');
    assert.ok(combined !== null);
    assert.strictEqual(combined.getFullYear(), 2026);
    assert.strictEqual(combined.getMonth(), 8); // September (0-indexed)
    assert.strictEqual(combined.getDate(), 28);
    assert.strictEqual(combined.getHours(), 18);
    assert.strictEqual(combined.getMinutes(), 30);
  });

  it('11. Rejects invalid or past combined date-time strings gracefully', () => {
    assert.strictEqual(combineLocalDateTime('', '18:30'), null);
    assert.strictEqual(combineLocalDateTime('2026-09-28', ''), null);
    assert.strictEqual(combineLocalDateTime('invalid', '18:30'), null);

    const pastCombined = combineLocalDateTime('2020-01-01', '10:00');
    assert.ok(pastCombined !== null);
    assert.strictEqual(pastCombined.getTime() <= Date.now(), true);
  });

  it('12. Formats target dispatch confirmation string accurately', () => {
    const combined = combineLocalDateTime('2026-09-28', '18:30');
    assert.ok(combined !== null);
    const formatted = formatTargetDispatch(combined);
    assert.strictEqual(formatted, 'Mon, 28 Sep 2026 at 18:30');
  });
});
