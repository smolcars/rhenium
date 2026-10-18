import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { mergeDraft, selectUniversalApks, stage, preflight } from '../tools/publish_play_release.mjs';

const config = { versionName: '0.1.0', versionCodes: { arm: 1001, arm64: 1002 } };

test('production preflight validates only a temporary edit and discards it even on rejection', async () => {
  for (const rejected of [false, true]) {
    const requests = [];
    const api = {
      json: async (url, options = {}) => {
        const path = new URL(url).pathname;
        requests.push([options.method ?? 'GET', path]);
        assert.ok(!path.includes(':commit'), 'Preflight must never commit');
        if (path.endsWith('/edits')) return { id: 'preflight' };
        if (path.endsWith('/tracks')) return { tracks: [{ track: 'production', releases: [] }] };
        if (path.endsWith('/bundles')) return { bundles: [{ versionCode: 1001 }, { versionCode: 1002 }] };
        if (path.endsWith('/listings')) return { listings: [] };
        if (path.endsWith('/tracks/production')) {
          assert.equal(options.method, 'PUT');
          assert.deepEqual(JSON.parse(options.body).releases, [{ name: 'Rhenium 0.1.0',
            versionCodes: ['1001', '1002'], status: 'completed' }]);
          if (rejected) throw new Error('Only releases with status draft may be created on draft app.');
          return {};
        }
        if (path.endsWith(':validate')) return {};
        assert.fail(`Unexpected preflight request: ${url}`);
      },
      request: async (url, options) => {
        requests.push([options.method, new URL(url).pathname]);
        assert.equal(options.method, 'DELETE');
        return { ok: true };
      },
    };
    if (rejected) await assert.rejects(preflight(api, { ...config, packageName: 'com.nitesh.rhenium' }), /draft app/);
    else await preflight(api, { ...config, packageName: 'com.nitesh.rhenium' });
    assert.equal(requests.at(-1)[0], 'DELETE');
    assert.equal(requests.some(([, path]) => path.endsWith(':validate')), !rejected);
  }
});

test('a new internal draft commits without the rejected-changes option and verifies its lifecycle', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'rhenium-play-draft-'));
  const release = { ...config, packageName: 'com.nitesh.rhenium' };
  const bundles = [];
  const certificate = readFileSync(new URL('../release/upload-cert.sha256', import.meta.url), 'utf8').trim();
  try {
    for (const arch of ['arm', 'arm64']) {
      const bytes = Buffer.from(`Synthetic publisher test bundle: ${arch}`);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      bundles.push({ versionCode: config.versionCodes[arch], sha256 });
      writeFileSync(join(directory, `rhenium-0.1.0-${arch}.aab`), bytes);
      writeFileSync(join(directory, `validation-${arch}.json`), JSON.stringify({
        packageName: release.packageName, versionName: release.versionName,
        versionCode: config.versionCodes[arch], sha256,
        uploadCertificateSha256: certificate, verifiedApks: ['synthetic-test.apk'],
      }));
    }
    for (const lifecycle of ['RELEASE_LIFECYCLE_STATE_DRAFT', 'RELEASE_LIFECYCLE_STATE_IN_REVIEW']) {
      let committed = false;
      const api = {
        json: async (url, options = {}) => {
          const path = new URL(url).pathname;
          if (path.endsWith('/edits')) return { id: 'synthetic-edit' };
          if (path.endsWith('/edits/synthetic-edit/tracks')) return { tracks: [{ track: 'internal' }] };
          if (path.endsWith('/bundles')) return { bundles };
          if (path.endsWith('/edits/synthetic-edit/tracks/internal')) {
            assert.equal(options.method, 'PUT');
            assert.deepEqual(JSON.parse(options.body), mergeDraft({ track: 'internal' }, release));
            return {};
          }
          if (path.endsWith(':validate')) return {};
          if (path.endsWith(':commit')) {
            // Exact rejection returned by Google for the first release.
            if (new URL(url).searchParams.has('changesNotSentForReview')) {
              throw new Error('Play request failed (HTTP 400): Changes are sent for review automatically. The query parameter changesNotSentForReview must not be set.');
            }
            assert.equal(new URL(url).searchParams.get('changesInReviewBehavior'), 'ERROR_IF_IN_REVIEW');
            committed = true;
            return {};
          }
          if (path.endsWith('/tracks/internal/releases')) {
            assert.equal(committed, true);
            return { releases: [{ releaseLifecycleState: lifecycle,
              activeArtifacts: [{ versionCode: 1001 }, { versionCode: 1002 }] }] };
          }
          assert.fail(`Unexpected publishing request: ${url}`);
        },
        request: async () => ({ ok: true }),
      };
      if (lifecycle === 'RELEASE_LIFECYCLE_STATE_DRAFT') await stage(api, release, directory);
      else await assert.rejects(stage(api, release, directory), /confirm.*draft/);
      assert.equal(committed, true);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('internal drafting preserves the current release and cannot target production', () => {
  const current = { name: 'Previous', versionCodes: ['900'], status: 'completed' };
  const result = mergeDraft({ track: 'tv:internal', releases: [current] }, config);
  assert.deepEqual(result.releases[0], current);
  assert.equal(result.releases[1].status, 'draft');
  assert.deepEqual(result.releases[1].versionCodes, ['1001', '1002']);
  for (const track of ['production', 'tv:production', 'beta', 'tv:beta']) {
    assert.throws(() => mergeDraft({ track }, config), /Only internal/);
  }
  assert.throws(() => mergeDraft({ track: 'internal', releases: [
    { status: 'draft', versionCodes: ['950'] },
  ] }, config), /refusing to overwrite/);
  assert.deepEqual(mergeDraft(result, config), result);
});

test('GitHub APKs require an unambiguous common Play signing identity', () => {
  const group = (certificate, id) => ({ certificateSha256Hash: certificate,
    generatedUniversalApk: { downloadId: id } });
  const first = group('a'.repeat(64), 'arm');
  const second = group('a'.repeat(64), 'arm64');
  assert.deepEqual(selectUniversalApks([{ generatedApks: [first] }, { generatedApks: [second] }]), [first, second]);
  assert.throws(() => selectUniversalApks([
    { generatedApks: [first] }, { generatedApks: [group('b'.repeat(64), 'other-key')] },
  ]), /unambiguous/);
  const ambiguous = [first, group('b'.repeat(64), 'another-key')];
  assert.throws(() => selectUniversalApks([{ generatedApks: ambiguous }, { generatedApks: ambiguous }]), /unambiguous/);
  assert.throws(() => selectUniversalApks([{ generatedApks: [{ certificateSha256Hash: 'a'.repeat(64) }] }, { generatedApks: [second] }]), /unambiguous/);
});

test('a replacement candidate can supersede only its explicitly named previous draft', () => {
  const replacement = { versionName: '0.1.0', versionCodes: { arm: 1003, arm64: 1004 },
    replacesDraftVersionCodes: [1001, 1002] };
  const previous = { name: 'Rhenium 0.1.0', status: 'draft', versionCodes: ['1002', '1001'] };
  const current = { name: 'Existing release', status: 'completed', versionCodes: ['900'] };
  const track = { track: 'internal', releases: [current, previous] };
  const result = mergeDraft(track, replacement);
  assert.deepEqual(result.releases, [current,
    { name: 'Rhenium 0.1.0', status: 'draft', versionCodes: ['1003', '1004'] }]);
  assert.deepEqual(mergeDraft(result, replacement), result);
  for (const draft of [{ ...previous, name: 'Another release' },
    { ...previous, versionCodes: ['950'] }, { ...previous, versionCodes: ['1001', '1005'] }]) {
    assert.throws(() => mergeDraft({ track: 'internal', releases: [draft] }, replacement), /refusing to overwrite/);
  }
  assert.throws(() => mergeDraft({ track: 'internal', releases: [previous, previous] }, replacement), /refusing to overwrite/);
  assert.throws(() => mergeDraft(track, { ...replacement, replacesDraftVersionCodes: undefined }), /refusing to overwrite/);
});

test('Google colon-separated SHA256 certificates normalize to the APK verifier format', () => {
  const certificate = 'E1:F1:15:3D:F5:39:03:26:FF:76:6F:1F:CC:D1:76:FF:7E:5D:1D:50:74:17:6F:CB:1B:CA:B9:99:9C:09:03:4B';
  const hex = certificate.replaceAll(':', '').toLowerCase();
  const group = value => ({ certificateSha256Hash: value, generatedUniversalApk: { downloadId: 'synthetic-test' } });
  const selected = selectUniversalApks([{ generatedApks: [group(certificate)] }, { generatedApks: [group(hex)] }]);
  assert.deepEqual(selected.map(item => item.certificateSha256Hash), [hex, hex]);
  for (const invalid of [certificate + ':', ':' + certificate, certificate.replace(':', ''), 'not-a-certificate']) {
    assert.throws(() => selectUniversalApks([{ generatedApks: [group(invalid)] }, { generatedApks: [group(hex)] }]), /unambiguous/);
  }
});
