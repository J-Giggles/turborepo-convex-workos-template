import { describe, expect, it } from 'vitest';
import { slugify } from './workosSync';

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Acme Corp')).toBe('acme-corp');
  });

  it('strips non-alphanumeric chars', () => {
    expect(slugify('Foo & Bar Inc!')).toBe('foo-bar-inc');
  });

  it('collapses repeated hyphens', () => {
    expect(slugify('a   b---c')).toBe('a-b-c');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('-hello-')).toBe('hello');
  });
});
