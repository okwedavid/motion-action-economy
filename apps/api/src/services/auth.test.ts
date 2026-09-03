import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from '../test/helpers.js';
import { UnauthorizedError } from '../lib/errors.js';

const creds = { email: 'alice@test.dev', password: 'correct-horse-123', firstName: 'Alice', lastName: 'Able' };

test('auth: register creates user and returns a session token', async () => {
  const { services } = await createTestContext();
  const { user, token, expiresAt } = await services.auth.register({ ...creds });
  assert.equal(user.email, creds.email);
  assert.equal(user.firstName, 'Alice');
  assert.ok(token.length > 20);
  assert.ok(new Date(expiresAt).getTime() > Date.now());
});

test('auth: registering the same email twice is rejected', async () => {
  const { services } = await createTestContext();
  await services.auth.register({ ...creds });
  await assert.rejects(() => services.auth.register({ ...creds }));
});

test('auth: login with correct credentials succeeds and authenticates', async () => {
  const { services } = await createTestContext();
  await services.auth.register({ ...creds });
  const { token, user } = await services.auth.login(creds.email, creds.password);
  assert.equal(user.email, creds.email);
  const authed = await services.auth.authenticate(token);
  assert.equal(authed.id, user.id);
});

test('auth: login with wrong password is rejected', async () => {
  const { services } = await createTestContext();
  await services.auth.register({ ...creds });
  await assert.rejects(() => services.auth.login(creds.email, 'wrong-password'));
});

test('auth: login with unknown email is rejected', async () => {
  const { services } = await createTestContext();
  await assert.rejects(() => services.auth.login('nobody@test.dev', 'whatever'));
});

test('auth: logout revokes the session token', async () => {
  const { services, repos } = await createTestContext();
  const { user, token } = await services.auth.register({ ...creds });
  await services.auth.logout(user.id, token);
  await assert.rejects(() => services.auth.authenticate(token), UnauthorizedError);
  void repos;
});

test('auth: expired/revoked session is rejected', async () => {
  const { services, repos } = await createTestContext();
  const { user, token } = await services.auth.register({ ...creds });
  // Simulate expiry by revoking the underlying session row.
  const hash = token; // token itself; repo re-hashes its own stored sha256
  await repos.sessions.revoke(user.id);
  void hash;
  await assert.rejects(() => services.auth.authenticate(token), UnauthorizedError);
});

test('auth: missing token is rejected', async () => {
  const { services } = await createTestContext();
  await assert.rejects(() => services.auth.authenticate(undefined), UnauthorizedError);
});
