import { describe, expect, it } from 'vitest';
import { href, parseHash } from './router';

describe('router', () => {
  it('parses routes', () => {
    expect(parseHash('')).toEqual({ name: 'home' });
    expect(parseHash('#/s/03-t-accounts')).toEqual({ name: 'section', id: '03-t-accounts' });
    expect(parseHash('#/p/03-x?a=abc')).toEqual({ name: 'problem', id: '03-x', attempt: 'abc' });
    expect(parseHash('#/nope')).toEqual({ name: 'not-found' });
  });

  it('the Sandbox: three views of the same state (journal is #/sandbox, so old links open the editor)', () => {
    expect(parseHash('#/sandbox?d=zz')).toEqual({
      name: 'sandbox',
      scenario: 0,
      view: 'journal',
      data: 'zz',
      entity: 0,
    });
    expect(parseHash(href.sandbox('zz', 1, 'entry-3'))).toEqual({
      name: 'sandbox',
      scenario: 0,
      view: 'journal',
      data: 'zz',
      entity: 1,
      at: 'entry-3',
    });
    expect(parseHash(href.taccounts('zz'))).toEqual({
      name: 'sandbox',
      scenario: 0,
      view: 'taccounts',
      data: 'zz',
      entity: 0,
    });
    expect(parseHash(href.sheet('abc', 1))).toEqual({
      name: 'sandbox',
      scenario: 0,
      view: 'grid',
      data: 'abc',
      entity: 1,
    });
    expect(parseHash('#/sheet?e=-3')).toEqual({
      name: 'sandbox',
      scenario: 0,
      view: 'grid',
      data: undefined,
      entity: 0,
    });
    // The T-accounts view shows every entity: no `e`.
    expect(href.sandboxView('taccounts', 'd1', 2)).toBe('#/taccounts?d=d1');
  });

  it('the Sandbox remembers the scenario (`s`) as well as the entity (`e`)', () => {
    const h = href.sandboxView('grid', 'd1', 1, undefined, 2);
    expect(h).toBe('#/sheet?d=d1&s=2&e=1');
    expect(parseHash(h)).toMatchObject({ view: 'grid', scenario: 2, entity: 1 });
    expect(parseHash('#/sandbox?s=-1')).toMatchObject({ scenario: 0 });
  });

  it('round-trips the ?at= deep link on sections and the cheat sheet', () => {
    expect(parseHash(href.section('06-loans', 'callout-1'))).toEqual({
      name: 'section',
      id: '06-loans',
      at: 'callout-1',
    });
    expect(parseHash(href.cheatsheet('dealer'))).toEqual({ name: 'cheatsheet', at: 'dealer' });
    expect(parseHash(href.cheatsheet())).toEqual({ name: 'cheatsheet' });
  });
});
