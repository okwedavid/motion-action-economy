import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { createTestContext } from '../test/helpers.js';
import { BmoniWebhookService, dispatchWebhookEvent } from '../integrations/bmoni/webhookService.js';
import { buildBmoniGateway } from '../integrations/bmoni/index.js';
import { bmoniConfig } from '../integrations/bmoni/config.js';
import { BmoniRewardProvider } from '../integrations/bmoni/rewardProvider.js';
import { makeProviderKey } from '../repos/audit.js';

const SECRET = '0123456789abcdef0123456789abcdef';
const secretBytes = Buffer.from(SECRET, 'utf8');

function rawBody(payload: string): { body: Buffer; sig: string } {
  const body = Buffer.from(payload, 'utf8');
  const hmac = crypto.createHmac('sha256', secretBytes);
  hmac.update(body);
  return { body, sig: hmac.digest('hex') };
}

test('bmoni: valid signature is accepted', () => {
  const body = Buffer.from('{"hello":"world"}', 'utf8');
  const svc = new BmoniWebhookService(SECRET);
  const sig = svc.signatureFor(body);
  assert.ok(svc.isValidSignature(body, sig));
});

test('bmoni: invalid signature is rejected', () => {
  const svc = new BmoniWebhookService(SECRET);
  const body = Buffer.from('{"hello":"world"}', 'utf8');
  assert.equal(svc.isValidSignature(body, svc.signatureFor(Buffer.from('tampered'))), false);
});

test('bmoni: missing / wrong-length signature is rejected (constant-time safe)', () => {
  const svc = new BmoniWebhookService(SECRET);
  const body = Buffer.from('{"hello":"world"}', 'utf8');
  assert.equal(svc.isValidSignature(body, undefined), false);
  assert.equal(svc.isValidSignature(body, 'abc'), false, 'length mismatch is rejected');
});

test('bmoni: signature with the wrong secret is rejected', () => {
  const body = Buffer.from('{"hello":"world"}', 'utf8');
  const other = new BmoniWebhookService('different-secret-key-123456');
  const sig = other.signatureFor(body);
  const svc = new BmoniWebhookService(SECRET);
  assert.equal(svc.isValidSignature(body, sig), false);
});

test('bmoni: signature is computed over the EXACT raw bytes', () => {
  const payload = '{ "a" : 1, "b" : "two" }'; // irregular whitespace
  const { body, sig } = rawBody(payload);
  assert.ok(new BmoniWebhookService(SECRET).isValidSignature(body, sig));
  // Re-serializing normalizes whitespace -> different raw bytes -> different signature.
  const reserialized = Buffer.from(JSON.stringify(JSON.parse(payload)), 'utf8');
  assert.notEqual(reserialized.toString(), body.toString(), 're-serialization changes raw bytes');
  assert.equal(new BmoniWebhookService(SECRET).isValidSignature(reserialized, sig), false);
});

test('bmoni: dispatch is idempotent (replay is dropped, not re-processed)', async () => {
  const ctx = await createTestContext();
  const eventId = 'evt-replay-1';
  const store = {
    claim: (eid: string) => ctx.repos.webhook.claim('bmoni', makeProviderKey('bmoni', eid), 'onboarding.completed', {}),
    markProcessed: (eid: string) => ctx.repos.webhook.markProcessed('bmoni', makeProviderKey('bmoni', eid)),
  };

  const first = await dispatchWebhookEvent(eventId, 'onboarding.completed', {}, store);
  assert.deepEqual(first, { ok: true, eventId });
  assert.equal(await ctx.repos.webhook.isProcessed('bmoni', makeProviderKey('bmoni', eventId)), true);

  const second = await dispatchWebhookEvent(eventId, 'onboarding.completed', {}, store);
  assert.deepEqual(second, { ok: true, eventId });
  // isProcessed remains true; no duplicate row / processing side effects.
  assert.equal(await ctx.repos.webhook.isProcessed('bmoni', makeProviderKey('bmoni', eventId)), true);
});

test('bmoni: unknown event types are acknowledged safely', async () => {
  const ctx = await createTestContext();
  const eventId = 'evt-unknown-1';
  const store = {
    claim: (eid: string) => ctx.repos.webhook.claim('bmoni', makeProviderKey('bmoni', eid), 'something.else', {}),
    markProcessed: (eid: string) => ctx.repos.webhook.markProcessed('bmoni', makeProviderKey('bmoni', eid)),
  };
  const out = await dispatchWebhookEvent(eventId, 'something.else', {}, store);
  assert.equal(out.ok, true);
});

test('bmoni: mock gateway works deterministically without credentials', async () => {
  const gw = buildBmoniGateway({ mode: 'mock', baseUrl: '', apiKey: '' } as never);
  assert.equal(gw.mode, 'mock');
  const user = await gw.createUser({ email: 'a@b.dev', firstName: 'A', lastName: 'B' });
  assert.ok(user.bmoniUserId);
  const same = await gw.createUser({ email: 'a@b.dev', firstName: 'A', lastName: 'B' });
  assert.equal(same.bmoniUserId, user.bmoniUserId, 'mock is deterministic for the same email');
});

test('bmoni: live mode requires credentials (fails loudly, never falls back to mock)', () => {
  const prev = process.env.BMONI_MODE;
  process.env.BMONI_MODE = 'live';
  delete process.env.BMONI_API_KEY;

  // config.bmoni.apiKey was loaded at import as empty; mode=live without a key
  // must fail loudly rather than silently downgrading.
  assert.throws(() => bmoniConfig(), /BMONI_API_KEY/);

  if (prev === undefined) delete process.env.BMONI_MODE;
  else process.env.BMONI_MODE = prev;
});

test('bmoni: reward provider is honest (pending, never fabricates real money movement)', async () => {
  const gw = buildBmoniGateway({ mode: 'mock', baseUrl: '', apiKey: '' } as never);
  const provider = new BmoniRewardProvider(gw);
  assert.equal(provider.name, 'BMONI');
  const out = await provider.issue({
    userId: 'u',
    attemptId: 'a',
    missionId: 'm',
    referenceId: 'a',
    points: 100,
    reputationDelta: 0,
    reputationReason: 'x',
    reputationLabel: 'x',
  });
  // Provider must not claim an actual financial transfer happened.
  assert.equal(out.status, 'pending');
});
