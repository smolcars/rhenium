// Stage internal drafts, retrieve signed APKs, or validate without publishing.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { authenticate } from './check_play_access.mjs';

const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/';
const UPLOAD = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/';

export function mergeDraft(track, config) {
  if (!/^(?:tv:)?(?:internal|qa)$/.test(track.track)) throw new Error('Only internal testing drafts are supported.');
  const codes = Object.values(config.versionCodes).map(String).sort();
  const previousCodes = config.replacesDraftVersionCodes?.map(String).sort();
  const drafts = (track.releases ?? []).filter(release => release.status === 'draft');
  const matches = expected => JSON.stringify([...(drafts[0]?.versionCodes ?? [])].sort()) === JSON.stringify(expected);
  const replacesPrevious = previousCodes && drafts[0]?.name === `Rhenium ${config.versionName}` && matches(previousCodes);
  if (drafts.length && (drafts.length !== 1 || (!matches(codes) && !replacesPrevious))) {
    throw new Error('The internal track already has another draft; refusing to overwrite it.');
  }
  return {
    track: track.track,
    releases: [
      ...(track.releases ?? []).filter(release => release.status !== 'draft'),
      { name: `Rhenium ${config.versionName}`, versionCodes: codes, status: 'draft' },
    ],
  };
}

export function selectUniversalApks(metadata) {
  const choices = metadata.map(response => (response.generatedApks ?? []).filter(group =>
    group.generatedUniversalApk?.downloadId && typeof group.certificateSha256Hash === 'string' &&
    /^(?:[0-9a-f]{64}|(?:[0-9a-f]{2}:){31}[0-9a-f]{2})$/i.test(group.certificateSha256Hash))
    .map(group => ({ ...group, certificateSha256Hash: group.certificateSha256Hash.replaceAll(':', '').toLowerCase() })));
  const common = [...new Set(choices[0]?.map(group => group.certificateSha256Hash.toLowerCase()) ?? [])].filter(
    fingerprint => choices.every(groups => groups.some(group => group.certificateSha256Hash.toLowerCase() === fingerprint)));
  if (common.length !== 1) {
    const availability = metadata.map(response => (response.generatedApks ?? []).map(group => ({
      certificateSha256Hash: group.certificateSha256Hash,
      universal: Boolean(group.generatedUniversalApk?.downloadId),
      splitCount: group.generatedSplitApks?.length ?? 0,
      standaloneCount: group.generatedStandaloneApks?.length ?? 0,
    })));
    throw new Error('Play has not provided one unambiguous common signing key with universal APKs for both bundles. Availability (ARM32, ARM64): ' + JSON.stringify(availability));
  }
  return choices.map(groups => groups.find(group => group.certificateSha256Hash.toLowerCase() === common[0]));
}

async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

function client(token) {
  const headers = { Authorization: `Bearer ${token}` };
  const request = (url, options = {}) => fetch(url, {
    redirect: 'error', signal: AbortSignal.timeout(20 * 60_000),
    ...options, headers: { ...headers, ...options.headers },
  });
  const json = async (url, options = {}) => {
    const response = await request(url, options);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(`Play request failed (HTTP ${response.status}): ${String(data.error?.message ?? 'No details').slice(0, 1000)}`);
    }
    return response.status === 204 ? null : response.json();
  };
  return { request, json };
}

export async function stage(api, config, directory) {
  const app = encodeURIComponent(config.packageName);
  const base = `${API}${app}/edits`;
  const certificate = readFileSync(new URL('../release/upload-cert.sha256', import.meta.url), 'utf8').trim();
  const artifacts = [];
  for (const arch of ['arm', 'arm64']) {
    const path = resolve(directory, `rhenium-${config.versionName}-${arch}.aab`);
    const report = JSON.parse(readFileSync(resolve(directory, `validation-${arch}.json`), 'utf8'));
    const hash = await sha256(path);
    if (report.packageName !== config.packageName || report.versionName !== config.versionName ||
        report.versionCode !== config.versionCodes[arch] || report.sha256 !== hash ||
        report.uploadCertificateSha256 !== certificate || !report.verifiedApks?.length) {
      throw new Error(`Release validation or checksum does not match: ${arch}`);
    }
    artifacts.push({ path, hash, code: config.versionCodes[arch], arch });
  }
  const edit = await api.json(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (!edit.id) throw new Error('Play returned no edit ID.');
  const editUrl = `${base}/${encodeURIComponent(edit.id)}`;
  let committed = false;
  try {
    const tracks = (await api.json(`${editUrl}/tracks`)).tracks ?? [];
    // Use a TV track when the account has enabled it; otherwise stage on its
    // existing shared internal track. Public TV distribution is a separate gate.
    const track = ['tv:internal', 'tv:qa', 'internal', 'qa'].map(
      name => tracks.find(item => item.track === name)).find(Boolean);
    if (!track) throw new Error('Play has no internal testing track configured.');
    const desired = mergeDraft(track, config);
    const existing = (await api.json(`${editUrl}/bundles`)).bundles ?? [];
    for (const artifact of artifacts) {
      const previous = existing.find(bundle => Number(bundle.versionCode) === artifact.code);
      if (previous) {
        if (previous.sha256 !== artifact.hash) throw new Error(`Version code ${artifact.code} is already used by different bytes.`);
      } else {
        const begin = await api.request(`${UPLOAD}${app}/edits/${encodeURIComponent(edit.id)}/bundles?uploadType=resumable`, {
          method: 'POST', headers: { 'X-Upload-Content-Type': 'application/octet-stream',
            'X-Upload-Content-Length': String(statSync(artifact.path).size) },
        });
        const location = begin.headers.get('location');
        if (!begin.ok || !location) throw new Error(`Cannot start bundle upload (HTTP ${begin.status}).`);
        const destination = new URL(location);
        if (destination.protocol !== 'https:' || !['androidpublisher.googleapis.com', 'www.googleapis.com'].includes(destination.hostname)) {
          throw new Error('Google returned an unexpected upload destination.');
        }
        const uploaded = await api.json(destination.href, {
          method: 'PUT', duplex: 'half', body: createReadStream(artifact.path),
          headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(statSync(artifact.path).size) },
        });
        if (Number(uploaded.versionCode) !== artifact.code || uploaded.sha256 !== artifact.hash) throw new Error('Google bundle checksum or version does not match.');
      }
      console.log(`Bundle verified by Google: ${artifact.arch}, version code ${artifact.code}`);
    }
    await api.json(`${editUrl}/tracks/${encodeURIComponent(track.track)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(desired),
    });
    await api.json(`${editUrl}:validate`, { method: 'POST' });
    // Draft status keeps this release unserved. The rejected-changes option is
    // not a general draft switch and Google rejects it for a new app.
    await api.json(`${editUrl}:commit?changesInReviewBehavior=ERROR_IF_IN_REVIEW`, { method: 'POST' });
    committed = true;
    const saved = await api.json(`${API}${app}/tracks/${encodeURIComponent(track.track)}/releases`);
    const codes = artifacts.map(artifact => artifact.code).sort((a, b) => a - b);
    const matching = (saved.releases ?? []).filter(release =>
      JSON.stringify((release.activeArtifacts ?? []).map(artifact => Number(artifact.versionCode)).sort((a, b) => a - b)) === JSON.stringify(codes));
    if (matching.length !== 1 || matching[0].releaseLifecycleState !== 'RELEASE_LIFECYCLE_STATE_DRAFT') {
      throw new Error('Google did not confirm the saved release is a draft; inspect Play Console before any further publishing.');
    }
    console.log(JSON.stringify({ packageName: config.packageName, track: track.track, status: 'draft',
      releaseLifecycleState: matching[0].releaseLifecycleState, versionCodes: codes }, null, 2));
  } finally {
    if (!committed) {
      const discarded = await api.request(editUrl, { method: 'DELETE' });
      if (!discarded.ok && discarded.status !== 404) console.error(`Discarding failed edit returned HTTP ${discarded.status}.`);
    }
  }
}

export async function preflight(api, config) {
  const base = `${API}${encodeURIComponent(config.packageName)}/edits`;
  const edit = await api.json(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (!edit.id) throw new Error('Play returned no edit ID.');
  const editUrl = `${base}/${encodeURIComponent(edit.id)}`;
  try {
    const tracks = (await api.json(`${editUrl}/tracks`)).tracks ?? [];
    const track = ['tv:production', 'production'].map(name => tracks.find(item => item.track === name)).find(Boolean);
    if (!track || track.releases?.length) throw new Error('Preflight requires an empty production track; no existing release will be replaced.');
    const codes = Object.values(config.versionCodes).map(String).sort();
    const bundles = (await api.json(`${editUrl}/bundles`)).bundles ?? [];
    if (!codes.every(code => bundles.some(bundle => String(bundle.versionCode) === code))) {
      throw new Error('The release bundles are not already uploaded; preflight never uploads new binaries.');
    }
    const listings = (await api.json(`${editUrl}/listings`)).listings ?? [];
    const details = await api.json(`${editUrl}/details`);
    const imageCounts = {};
    for (const type of ['icon', 'featureGraphic', 'tvBanner', 'tvScreenshots']) {
      imageCounts[type] = ((await api.json(`${editUrl}/listings/en-US/${type}`)).images ?? []).length;
    }
    console.log(JSON.stringify({ packageName: config.packageName, track: track.track, versionCodes: codes,
      imageCounts,
      contactEmailPresent: Boolean(details.contactEmail),
      contactWebsitePresent: Boolean(details.contactWebsite),
      storeListings: listings.map(item => ({ language: item.language, titlePresent: Boolean(item.title),
        shortDescriptionPresent: Boolean(item.shortDescription), fullDescriptionPresent: Boolean(item.fullDescription) })) }, null, 2));
    // This status exists only inside the temporary edit. Never call commit here.
    console.log('Checking production track assignment inside the temporary edit.');
    await api.json(`${editUrl}/tracks/${encodeURIComponent(track.track)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        track: track.track, releases: [{ name: `Rhenium ${config.versionName}`, versionCodes: codes, status: 'completed' }],
      }),
    });
    console.log('Production track assignment accepted; checking release requirements.');
    await api.json(`${editUrl}:validate`, { method: 'POST' });
    console.log('Production candidate passed API validation. This is not policy approval or publication.');
  } finally {
    const discarded = await api.request(editUrl, { method: 'DELETE' });
    if (!discarded.ok && discarded.status !== 404) throw new Error(`Preflight edit cleanup failed (HTTP ${discarded.status}).`);
    console.log('Preflight edit discarded; no release was published or submitted for review.');
  }
}

export async function prepareProductionDraft(api, config) {
  const app = encodeURIComponent(config.packageName);
  const base = `${API}${app}/edits`;
  const edit = await api.json(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (!edit.id) throw new Error('Play returned no edit ID.');
  const editUrl = `${base}/${encodeURIComponent(edit.id)}`;
  let committed = false;
  try {
    const tracks = (await api.json(`${editUrl}/tracks`)).tracks ?? [];
    const track = ['tv:production', 'production'].map(name => tracks.find(item => item.track === name)).find(Boolean);
    const codes = Object.values(config.versionCodes).map(String).sort();
    const matches = release => release.name === `Rhenium ${config.versionName}` && release.status === 'draft' &&
      JSON.stringify([...(release.versionCodes ?? [])].sort()) === JSON.stringify(codes);
    if (!track || (track.releases?.length && (track.releases.length !== 1 || !matches(track.releases[0])))) {
      throw new Error('Production already has another release; refusing to overwrite it.');
    }
    if (track.releases?.length) { console.log('The matching production draft already exists; preserved without changes.'); return; }
    const bundles = (await api.json(`${editUrl}/bundles`)).bundles ?? [];
    if (!codes.every(code => bundles.some(bundle => String(bundle.versionCode) === code))) {
      throw new Error('Both release bundles must already be uploaded; production drafting never uploads binaries.');
    }
    console.log('Saving an unsubmitted production draft with the existing bundles.');
    await api.json(`${editUrl}/tracks/${encodeURIComponent(track.track)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        track: track.track, releases: [{ name: `Rhenium ${config.versionName}`, versionCodes: codes, status: 'draft' }],
      }),
    });
    await api.json(`${editUrl}:validate`, { method: 'POST' });
    await api.json(`${editUrl}:commit?changesInReviewBehavior=ERROR_IF_IN_REVIEW`, { method: 'POST' });
    committed = true;
    const saved = await api.json(`${API}${app}/tracks/${encodeURIComponent(track.track)}/releases`);
    const matching = (saved.releases ?? []).filter(release =>
      JSON.stringify((release.activeArtifacts ?? []).map(item => String(item.versionCode)).sort()) === JSON.stringify(codes));
    if (matching.length !== 1 || matching[0].releaseLifecycleState !== 'RELEASE_LIFECYCLE_STATE_DRAFT') {
      throw new Error('Google did not confirm the production draft; inspect Play Console before further publishing.');
    }
    console.log(JSON.stringify({ packageName: config.packageName, track: track.track, versionCodes: codes,
      releaseLifecycleState: matching[0].releaseLifecycleState }, null, 2));
    console.log('Production draft saved; it was not submitted for review or rolled out.');
  } finally {
    if (!committed) {
      const discarded = await api.request(editUrl, { method: 'DELETE' });
      if (!discarded.ok && discarded.status !== 404) throw new Error(`Production draft edit cleanup failed (HTTP ${discarded.status}).`);
    }
  }
}

export async function prepareListing(api, config) {
  const content = JSON.parse(readFileSync(new URL('../release/play-listing/en-US.json', import.meta.url), 'utf8'));
  if (typeof content.shortDescription !== 'string' || !content.shortDescription.length || content.shortDescription.length > 80 ||
      typeof content.fullDescription !== 'string' || !content.fullDescription.length || content.fullDescription.length > 4000) {
    throw new Error('Store descriptions exceed Google Play limits or are missing.');
  }
  const base = `${API}${encodeURIComponent(config.packageName)}/edits`;
  const edit = await api.json(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (!edit.id) throw new Error('Play returned no edit ID.');
  const editUrl = `${base}/${encodeURIComponent(edit.id)}`;
  let committed = false;
  try {
    const current = await api.json(`${editUrl}/listings/en-US`);
    const missing = Object.fromEntries(Object.entries(content).filter(([key]) => !current[key]));
    if (!Object.keys(missing).length) {
      console.log('Store descriptions already exist; preserved without changes.');
      return;
    }
    await api.json(`${editUrl}/listings/en-US`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(missing) });
    await api.json(`${editUrl}:validate`, { method: 'POST' });
    await api.json(`${editUrl}:commit?changesInReviewBehavior=ERROR_IF_IN_REVIEW`, { method: 'POST' });
    committed = true;
    console.log('Saved missing store descriptions; no release tracks changed.');
  } finally {
    if (!committed) {
      const discarded = await api.request(editUrl, { method: 'DELETE' });
      if (!discarded.ok && discarded.status !== 404) throw new Error(`Listing edit cleanup failed (HTTP ${discarded.status}).`);
    }
  }
}

export async function prepareImages(api, config) {
  const app = encodeURIComponent(config.packageName);
  const base = `${API}${app}/edits`;
  const edit = await api.json(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (!edit.id) throw new Error('Play returned no edit ID.');
  const editId = encodeURIComponent(edit.id);
  const editUrl = `${base}/${editId}`;
  let committed = false, added = 0;
  try {
    for (const [type, files] of Object.entries({ icon: ['icon.png'], featureGraphic: ['feature-graphic.png'],
      tvBanner: ['tv-banner.png'], tvScreenshots: ['tv-home.png', 'tv-menu.png'] })) {
      const existing = await api.json(`${editUrl}/listings/en-US/${type}`);
      if (existing.images?.length) continue;
      for (const file of files) {
        const uploaded = await api.json(`${UPLOAD}${app}/edits/${editId}/listings/en-US/${type}?uploadType=media`, {
          method: 'POST', headers: { 'Content-Type': 'image/png' },
          body: readFileSync(new URL(`../release/play-listing/images/${file}`, import.meta.url)),
        });
        if (!uploaded.image?.id) throw new Error(`Google did not confirm the uploaded image: ${file}`);
        added++;
        console.log(`Added missing store image: ${type}/${file}`);
      }
    }
    if (!added) { console.log('Store image groups already exist; preserved without changes.'); return; }
    await api.json(`${editUrl}:validate`, { method: 'POST' });
    await api.json(`${editUrl}:commit?changesInReviewBehavior=ERROR_IF_IN_REVIEW`, { method: 'POST' });
    committed = true;
    console.log(`Saved ${added} missing store images; no release tracks changed.`);
  } finally {
    if (!committed) {
      const discarded = await api.request(editUrl, { method: 'DELETE' });
      if (!discarded.ok && discarded.status !== 404) throw new Error(`Image edit cleanup failed (HTTP ${discarded.status}).`);
    }
  }
}

export async function prepareContact(api, config, email) {
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Provide the owner-approved public support email.');
  }
  const base = `${API}${encodeURIComponent(config.packageName)}/edits`;
  const edit = await api.json(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (!edit.id) throw new Error('Play returned no edit ID.');
  const editUrl = `${base}/${encodeURIComponent(edit.id)}`;
  let committed = false;
  try {
    const current = await api.json(`${editUrl}/details`);
    const missing = {};
    if (!current.contactEmail) missing.contactEmail = email;
    if (!current.contactWebsite) missing.contactWebsite = 'https://github.com/smolcars/rhenium';
    if (!Object.keys(missing).length) { console.log('Contact details already exist; preserved without changes.'); return; }
    await api.json(`${editUrl}/details`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(missing) });
    await api.json(`${editUrl}:validate`, { method: 'POST' });
    await api.json(`${editUrl}:commit?changesInReviewBehavior=ERROR_IF_IN_REVIEW`, { method: 'POST' });
    committed = true;
    console.log('Saved missing contact details; no release tracks changed.');
  } finally {
    if (!committed) {
      const discarded = await api.request(editUrl, { method: 'DELETE' });
      if (!discarded.ok && discarded.status !== 404) throw new Error(`Contact edit cleanup failed (HTTP ${discarded.status}).`);
    }
  }
}

async function download(api, config, directory) {
  mkdirSync(directory, { recursive: true });
  const base = `${API}${encodeURIComponent(config.packageName)}/generatedApks`;
  const architectures = ['arm', 'arm64'];
  const metadata = [];
  for (const arch of architectures) metadata.push(await api.json(`${base}/${config.versionCodes[arch]}`));
  console.log('Play APK availability: ' + JSON.stringify(metadata.map((response, index) => ({
    arch: architectures[index], signingKeys: (response.generatedApks ?? []).map(group => ({
      certificateSha256Hash: group.certificateSha256Hash,
      universal: Boolean(group.generatedUniversalApk?.downloadId),
      unprotectedSplitCount: group.unprotectedGeneratedSplitApks?.length ?? 0,
      unprotectedStandaloneVariants: (group.unprotectedGeneratedStandaloneApks ?? []).map(apk => apk.variantId),
    })),
  }))));
  const groups = selectUniversalApks(metadata);
  const results = [];
  for (const [index, arch] of architectures.entries()) {
    const code = config.versionCodes[arch];
    const group = groups[index];
    const name = `rhenium-${config.versionName}-${arch}.apk`;
    const output = resolve(directory, name);
    const url = `${base}/${code}/downloads/${encodeURIComponent(group.generatedUniversalApk.downloadId)}:download?alt=media`;
    const response = await api.request(url);
    if (!response.ok || !response.body) throw new Error(`Play APK download failed (HTTP ${response.status}).`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(output, { flags: 'wx' }));
    results.push({ file: name, packageName: config.packageName, versionName: config.versionName,
      versionCode: code, arch, certificateSha256: group.certificateSha256Hash.toLowerCase(), sha256: await sha256(output) });
  }
  writeFileSync(resolve(directory, 'play-apks.json'), JSON.stringify(results, null, 2) + '\n');
  writeFileSync(resolve(directory, 'SHA256SUMS'), results.map(result => `${result.sha256}  ${result.file}\n`).join(''));
  console.log('Downloaded both Play-signed universal APKs; verify them before publishing the GitHub release.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [operation, directory] = process.argv.slice(2);
    if (!['stage', 'download', 'preflight', 'production-draft', 'listing', 'images', 'contact'].includes(operation) || (['stage', 'download'].includes(operation) && !directory)) {
      throw new Error('Usage: publish_play_release.mjs stage|download DIRECTORY, preflight, production-draft, listing, images, or contact');
    }
    let credentials;
    try { credentials = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON ?? '{}'); }
    catch { throw new Error('The service-account secret is not valid JSON.'); }
    delete process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    const config = JSON.parse(readFileSync(new URL('../release/android.json', import.meta.url), 'utf8'));
    const api = client(await authenticate(credentials));
    const run = { stage, download, preflight, 'production-draft': prepareProductionDraft, listing: prepareListing, images: prepareImages,
      contact: (api, config) => prepareContact(api, config, process.env.RHENIUM_PLAY_CONTACT_EMAIL) }[operation];
    await run(api, config, directory);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Play operation failed.');
    process.exitCode = 1;
  }
}
