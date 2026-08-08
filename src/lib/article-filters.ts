const normalizeTag = (value: string) => value.trim().toLocaleLowerCase('zh-CN');

export function serializeTags(tags: string[]) {
  return JSON.stringify(tags.map(normalizeTag));
}

export function deserializeTags(serialized: string) {
  try {
    const value: unknown = JSON.parse(serialized);
    return Array.isArray(value) && value.every((tag) => typeof tag === 'string') ? value : [];
  } catch {
    return [];
  }
}
