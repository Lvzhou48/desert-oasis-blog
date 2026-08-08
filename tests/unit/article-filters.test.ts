import { describe, expect, it } from 'vitest';
import { deserializeTags, serializeTags } from '../../src/lib/article-filters';

describe('article tag filter serialization', () => {
  it('round-trips a tag containing the former pipe delimiter', () => {
    const serialized = serializeTags(['数据|AI', '工程']);

    expect(deserializeTags(serialized)).toEqual(['数据|ai', '工程']);
  });

  it('fails closed to an empty tag list for malformed or non-array data', () => {
    expect(deserializeTags('{bad json')).toEqual([]);
    expect(deserializeTags(JSON.stringify({ tag: '数据|ai' }))).toEqual([]);
  });
});
