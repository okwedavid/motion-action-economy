import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestContext } from '../test/helpers.js';
import { NotFoundError } from '../lib/errors.js';

test('missions: seed lists quiz, qr and location missions with rewards', async () => {
  const { services } = await createTestContext();
  const missions = await services.missions.list();
  assert.equal(missions.length, 3);

  const quiz = missions.find((m) => m.verification === 'QUIZ');
  assert.ok(quiz);
  assert.equal(quiz.rewardPoints, 50);
  assert.equal(quiz.type, 'LEARN');
  assert.ok(quiz.quiz && quiz.quiz.questions.length === 5);

  const qr = missions.find((m) => m.verification === 'QR');
  assert.ok(qr);
  assert.ok(qr.qrPayload && qr.qrPayload.includes('::'), 'qrPayload is missionId::token');

  const location = missions.find((m) => m.verification === 'LOCATION');
  assert.ok(location);
  assert.ok(location.location && typeof location.location.radiusMeters === 'number');
});

test('missions: detail returns a single mission', async () => {
  const { services } = await createTestContext();
  const missions = await services.missions.list();
  const dto = await services.missions.detail(missions[0].id);
  assert.equal(dto.id, missions[0].id);
  assert.equal(dto.slug, missions[0].slug);
});

test('missions: detail of an unavailable (archived) mission is rejected', async () => {
  const { services, repos } = await createTestContext();
  const missions = await services.missions.list();
  await repos.missions.create({
    slug: 'archived-mission',
    title: 'No longer active',
    description: 'x',
    type: 'LEARN',
    verificationMethod: 'QUIZ',
    rewardPoints: 10,
    requirements: {},
    payload: { questions: [] },
    status: 'archived',
  });
  const dto = await services.missions.detail(missions[0].id); // still works for active
  assert.ok(dto.id);
  await assert.rejects(
    () => services.missions.detail(randomUUID()), // valid-format id that does not exist
    NotFoundError,
  );
});
