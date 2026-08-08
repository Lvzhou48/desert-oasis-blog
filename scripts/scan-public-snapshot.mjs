const reservedEmail = /^(?:user|name|email)@example\.(?:com|test|invalid)$/i;
const placeholderValue = /^(?:<[^>]+>|\$\{[^}]+\}|\$[A-Z_][A-Z0-9_]*|(?:YOUR|EXAMPLE|PLACEHOLDER|REDACTED)[-_A-Z0-9]*)$/i;

const detectors = [
  {
    reason: 'email address',
    find: (text) => [...text.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)]
      .map((match) => match[0])
      .filter((value) => !reservedEmail.test(value)),
  },
  { reason: 'GitHub token', find: (text) => text.match(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g) ?? [] },
  { reason: 'AWS access key', find: (text) => text.match(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g) ?? [] },
  {
    reason: 'private key',
    find: (text) => text.match(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s+[A-Za-z0-9+/=\r\n]{32,}\s+-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g) ?? [],
  },
  {
    reason: 'token or secret assignment',
    find: (text) => [...text.matchAll(/\b(?:[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PRIVATE_KEY)[A-Z0-9_]*)\s*[:=]\s*([^\s#;,]+)/gi)]
      .map((match) => match[1])
      .filter((value) => value.length >= 8 && !placeholderValue.test(value)),
  },
  {
    reason: 'absolute user path',
    find: (text) => text.match(/(?:\b[A-Za-z]:\\Users\\[^\\\s]+\\|\/(?:Users|home)\/[^/\s]+\/)/g) ?? [],
  },
];

export function findSensitiveSnapshotViolations(entries) {
  const violations = [];
  for (const entry of entries) {
    const pathReasons = detectors
      .filter((detector) => detector.find(entry.path).length > 0)
      .map((detector) => `sensitive file path: ${detector.reason}`);
    const contentReasons = (entry.scanTexts ?? [])
      .flatMap((text) => detectors
        .filter((detector) => detector.find(text).length > 0)
        .map((detector) => detector.reason));
    for (const reason of new Set([...pathReasons, ...contentReasons])) {
      violations.push({ path: entry.path, reason });
    }
  }
  return violations;
}
