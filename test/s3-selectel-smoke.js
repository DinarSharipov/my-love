const { randomUUID } = require('node:crypto');

const baseUrl = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:5000/api/v1';
const apiUrl = new URL(baseUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(apiUrl.hostname)) {
  throw new Error('S3 smoke test may only target a loopback API URL');
}
const runId = randomUUID();
const emailPrefix = `s3-smoke-${runId}`;
const password = 'S3SmokePassword123!';
const image = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="#000"/></svg>',
);
const video = Buffer.from('s3-smoke-video');
const audio = Buffer.from('s3-smoke-audio');

function fail(message) {
  throw new Error(message);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  if (!response.ok) {
    fail(`${options.method ?? 'GET'} ${path} returned ${response.status}: ${await response.text()}`);
  }
  return response;
}

async function json(path, options = {}) {
  return (await request(path, options)).json();
}

function bearer(token) {
  return { authorization: `Bearer ${token}` };
}

async function register(label) {
  return json('/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      firstName: 'S3',
      lastName: `Smoke ${label}`,
      email: `${emailPrefix}-${label}@example.test`,
      password,
      gender: 'OTHER',
      birthDate: '1995-01-01',
    }),
  });
}

async function multipartUpload(token, file) {
  const init = await json('/media/uploads/initiate', {
    method: 'POST',
    headers: { ...bearer(token), 'content-type': 'application/json' },
    body: JSON.stringify({
      originalName: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.body.length,
    }),
  });
  if (init.parts.length !== 1) fail(`Expected one multipart part for ${file.name}`);

  const put = await fetch(init.parts[0].url, {
    method: 'PUT',
    headers: { 'content-type': file.mimeType },
    body: file.body,
  });
  if (!put.ok) fail(`S3 PUT for ${file.name} returned ${put.status}`);
  const etag = put.headers.get('etag');
  if (!etag) fail(`S3 PUT for ${file.name} did not return ETag`);

  const status = await json(`/media/uploads/${init.sessionId}/status`, { headers: bearer(token) });
  if (status.uploadedBytes !== file.body.length) {
    fail(`Unexpected uploaded bytes for ${file.name}: ${status.uploadedBytes}`);
  }

  const media = await json(`/media/uploads/${init.sessionId}/complete`, {
    method: 'POST',
    headers: { ...bearer(token), 'content-type': 'application/json' },
    body: JSON.stringify({ parts: [{ partNumber: 1, etag }] }),
  });
  return media;
}

async function run() {
  const owner = await register('owner');
  const member = await register('member');
  const ownerToken = owner.accessToken;
  const memberToken = member.accessToken;
  const invitation = await json('/family-invitations', {
    method: 'POST',
    headers: { ...bearer(ownerToken), 'content-type': 'application/json' },
    body: JSON.stringify({ recipientId: member.user.id }),
  });
  await json(`/family-invitations/${invitation.id}/accept`, {
    method: 'PATCH',
    headers: bearer(memberToken),
  });

  const uploadedImage = await multipartUpload(ownerToken, {
    name: 'smoke.svg',
    mimeType: 'image/svg+xml',
    body: image,
  });
  const uploadedVideo = await multipartUpload(ownerToken, {
    name: 'smoke.mp4',
    mimeType: 'video/mp4',
    body: video,
  });
  const uploadedAudio = await multipartUpload(ownerToken, {
    name: 'smoke.mp3',
    mimeType: 'audio/mpeg',
    body: audio,
  });

  if (!uploadedImage.previewUrl) fail('Image response does not contain previewUrl');
  const preview = await fetch(uploadedImage.previewUrl);
  if (!preview.ok || preview.headers.get('content-type') !== 'image/webp') {
    fail('Image preview is not available as WebP');
  }

  const shared = await json(`/media/${uploadedVideo.id}`, { headers: bearer(memberToken) });
  if (shared.id !== uploadedVideo.id) fail('Family member cannot access uploaded video metadata');
  const stream = await request(`/media/videos/${uploadedVideo.id}/stream`, {
    headers: { ...bearer(memberToken), range: 'bytes=0-3' },
  });
  if (stream.status !== 206 || (await stream.arrayBuffer()).byteLength !== 4) {
    fail('Video range stream did not return the requested 206 slice');
  }
  const download = await request(`/media/videos/${uploadedVideo.id}/download`, {
    headers: bearer(memberToken),
  });
  if (!download.headers.get('content-disposition')?.includes('attachment')) {
    fail('Video download is not an attachment');
  }
  const audioStream = await request(`/media/audio/${uploadedAudio.id}/stream`, {
    headers: { ...bearer(memberToken), range: 'bytes=0-3' },
  });
  if (audioStream.status !== 206 || (await audioStream.arrayBuffer()).byteLength !== 4) {
    fail('Audio range stream did not return the requested 206 slice');
  }

  const abort = await json('/media/uploads/initiate', {
    method: 'POST',
    headers: { ...bearer(ownerToken), 'content-type': 'application/json' },
    body: JSON.stringify({ originalName: 'aborted.mp3', mimeType: 'audio/mpeg', sizeBytes: audio.length }),
  });
  await request(`/media/uploads/${abort.sessionId}`, { method: 'DELETE', headers: bearer(ownerToken) });
  const aborted = await json(`/media/uploads/${abort.sessionId}/status`, { headers: bearer(ownerToken) });
  if (aborted.status !== 'ABORTED') fail(`Expected ABORTED upload status, got ${aborted.status}`);

  await Promise.all(
    [uploadedImage, uploadedVideo, uploadedAudio].map((item) =>
      request(`/media/${item.id}`, { method: 'DELETE', headers: bearer(ownerToken) }),
    ),
  );
  console.log(JSON.stringify({ result: 'PASS', runId, emails: [`${emailPrefix}-owner@example.test`, `${emailPrefix}-member@example.test`] }));
}

run().catch((error) => {
  console.error(JSON.stringify({ result: 'FAIL', runId, emailPrefix, error: error.message }));
  process.exit(1);
});
