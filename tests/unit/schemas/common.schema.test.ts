import { describe, expect, it } from 'vitest';
import { dateStrSchema, timeStrSchema } from '../../../src/schemas/common.schema';

describe('dateStrSchema', () => {
  it.each(['2026-08-16', '2026-01-01', '2026-12-31'])('accepts %s', (value) => {
    expect(dateStrSchema.safeParse(value).success).toBe(true);
  });

  it.each(['2026-8-16', '16-08-2026', '2026/08/16', 'not-a-date', ''])('rejects %s', (value) => {
    expect(dateStrSchema.safeParse(value).success).toBe(false);
  });
});

describe('timeStrSchema', () => {
  it.each(['00:00', '09:30', '23:59'])('accepts %s', (value) => {
    expect(timeStrSchema.safeParse(value).success).toBe(true);
  });

  it.each(['24:00', '9:30', '23:60', '1pm', ''])('rejects %s', (value) => {
    expect(timeStrSchema.safeParse(value).success).toBe(false);
  });
});
