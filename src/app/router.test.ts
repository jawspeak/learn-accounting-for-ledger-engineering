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
      view: 'journal',
      data: 'zz',
      entity: 0,
    });
    expect(parseHash(href.sandbox('zz', 1, 'entry-3'))).toEqual({
      name: 'sandbox',
      view: 'journal',
      data: 'zz',
      entity: 1,
      at: 'entry-3',
    });
    expect(parseHash(href.taccounts('zz'))).toEqual({
      name: 'sandbox',
      view: 'taccounts',
      data: 'zz',
      entity: 0,
    });
    expect(parseHash(href.sheet('abc', 1))).toEqual({
      name: 'sandbox',
      view: 'grid',
      data: 'abc',
      entity: 1,
    });
    expect(parseHash('#/sheet?e=-3')).toEqual({
      name: 'sandbox',
      view: 'grid',
      data: undefined,
      entity: 0,
    });
    expect(href.sandboxView('taccounts', 'd1', 2)).toBe('#/taccounts?d=d1&e=2');
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
