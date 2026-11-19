// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { sections } from '@content';
import { PROGRESS_KEY, recordResult, resetProgress, sectionProgress, statusOf } from './progress';

const stored = () => JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}');
const someId = sections.find((s) => s.problemIds.length > 1)!.problemIds[0]!;

describe('progress', () => {
  beforeEach(() => resetProgress());

  it('records tried, then solved; solved sticks after a later wrong check', () => {
    recordResult(someId, false);
    expect(statusOf(stored(), someId)).toBe('tried');
    recordResult(someId, true);
    expect(statusOf(stored(), someId)).toBe('solved');
    recordResult(someId, false);
    expect(statusOf(stored(), someId)).toBe('solved');
  });

  it('is keyed by problem id; unknown ids (removed problems) are ignored', () => {
    recordResult('no-such-problem', true);
    expect(statusOf(stored(), 'no-such-problem')).toBeUndefined();
    const all = sectionProgress(stored());
    expect(all.reduce((n, s) => n + s.solved, 0)).toBe(0);
  });

  it('counts per section with one slot per problem, in order', () => {
    recordResult(someId, true);
    const sec = sectionProgress(stored()).find((s) => s.slots.some((x) => x.id === someId))!;
    expect(sec.solved).toBe(1);
    expect(sec.slots.length).toBe(sec.total);
    expect(sec.slots[0]).toEqual({ id: someId, status: 'solved' });
  });

  it('reset clears it from storage', () => {
    recordResult(someId, true);
    resetProgress();
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
  });
});
