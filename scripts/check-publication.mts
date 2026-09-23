import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';

const allowed = new Set([
  '.gitattributes', '.gitignore', '.githooks/pre-commit',
  'CC0-1.0.txt', 'README.md', 'publication-manifest.json',
  'notes/linked-list-nodes.md', 'notes/linked-list-insertion.md',
  'templates.md', 'scripts/check-publication.mts',
]);
const maxBytes = 256 * 1024;
const run = (args: string[]) => execFileSync('git', args, { maxBuffer: 4 * 1024 * 1024 });
const entries = run(['ls-files', '--stage', '-z']).toString('utf8').split('\0').filter(Boolean);
const staged = new Map<string, { mode: string; oid: string }>();
for (const entry of entries) {
  const tab = entry.indexOf('\t');
  if (tab < 0) throw new Error('Cannot parse Git index.');
  const [mode, oid, stage] = entry.slice(0, tab).split(' ');
  const file = entry.slice(tab + 1);
  if (stage !== '0') throw new Error(`Resolve merge conflicts first: ${JSON.stringify(file)}`);
  if (mode !== '100644' && mode !== '100755') throw new Error(`Blocked non-regular file: ${JSON.stringify(file)}`);
  if (!allowed.has(file)) throw new Error(`Not on the public allowlist: ${JSON.stringify(file)}`);
  staged.set(file, { mode, oid });
}

const manifestOid = staged.get('publication-manifest.json')?.oid;
if (!manifestOid) throw new Error('Stage publication-manifest.json first.');
const manifestText = run(['cat-file', 'blob', manifestOid]).toString('utf8');
const manifest = JSON.parse(manifestText) as { files?: Record<string, { sha256?: string; reason?: string }> };
if (!manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) {
  throw new Error('Manifest must contain a files object.');
}

const listed = new Set(Object.keys(manifest.files));
const expected = new Set([...staged.keys()].filter(file => file !== 'publication-manifest.json'));
for (const file of listed) if (!allowed.has(file) || file === 'publication-manifest.json') {
  throw new Error(`Manifest contains a prohibited path: ${JSON.stringify(file)}`);
}
for (const file of expected) if (!listed.has(file)) throw new Error(`Unreviewed staged content: ${JSON.stringify(file)}`);
for (const file of listed) if (!expected.has(file)) throw new Error(`Approved file is missing from the index: ${JSON.stringify(file)}`);

const decoder = new TextDecoder('utf-8', { fatal: true });
const credentialPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/,
  /sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,}/,
  /AKIA[0-9A-Z]{16}/,
];
for (const file of [...expected].sort()) {
  const record = manifest.files[file];
  if (!record || typeof record.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.sha256)
      || typeof record.reason !== 'string' || record.reason.trim().length < 8) {
    throw new Error(`Manifest needs a SHA-256 and review reason for ${JSON.stringify(file)}.`);
  }
  const blob = run(['cat-file', 'blob', staged.get(file)!.oid]);
  if (blob.length > maxBytes) throw new Error(`File exceeds 256 KiB: ${JSON.stringify(file)}`);
  const text = decoder.decode(blob);
  if (createHash('sha256').update(blob).digest('hex') !== record.sha256) {
    throw new Error(`Content changed since review: ${JSON.stringify(file)}`);
  }
  if (credentialPatterns.some(pattern => pattern.test(text))) {
    throw new Error(`Credential-shaped value found in ${JSON.stringify(file)}.`);
  }
}
if (staged.size !== allowed.size) {
  const absent = [...allowed].filter(file => !staged.has(file));
  if (absent.length) throw new Error(`Required public files are missing: ${absent.join(', ')}`);
}
console.log(`Publication check passed: ${staged.size} allowlisted text files; every staged file matches its reviewed hash.`);
