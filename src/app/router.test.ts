import { describe, expect, it } from 'vitest';
import { parseHash } from './router';

describe('router', () => {
  it('parses routes', () => {
    expect(parseHash('')).toEqual({ name: 'home' });
    expect(parseHash('#/s/03-t-accounts')).toEqual({ name: 'section', id: '03-t-accounts' });
    expect(parseHash('#/p/03-x?a=abc')).toEqual({ name: 'problem', id: '03-x', attempt: 'abc' });
    expect(parseHash('#/sandbox?d=zz')).toEqual({ name: 'sandbox', data: 'zz' });
    expect(parseHash('#/nope')).toEqual({ name: 'not-found' });
  });
});
