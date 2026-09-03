import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, runMigrationsOn } from '../test/helpers.js';
import { createServices } from './app.js';
import { seedMissions } from './missions.js';
import { createRepos } from './container.js';

/**
 * Core loop integration test (pg-mem):
 * REGISTER -> LOGIN -> DISCOVER -> COMPLETE (server-graded quiz)
 * -> REWARD (points) -> REPUTATION updated.
 */
test('core loop: register, discover, complete quiz, earn points + reputation', async () => {
  const mem = createTestDb();
  await runMigrationsOn(mem);

  const app = createServices(mem);
  const repos = createRepos(mem);

  // Seed one quiz mission.
  await seedMissions(repos.missions);
  const missions = await app.missions.list();
  const quiz = missions.find((m) => m.verification === 'QUIZ');
  assert.ok(quiz, 'seeded quiz mission exists');
  assert.ok(quiz.quiz && quiz.quiz.questions.length >= 3, 'quiz has questions');

  // Register a user.
  const { user, token } = await app.auth.register({
    email: 'core@test.dev',
    password: 'password123',
    firstName: 'Core',
    lastName: 'Loop',
  });
  assert.equal(user.email, 'core@test.dev');
  assert.ok(token, 'session token returned');

  // Authenticate with the bearer token.
  const authed = await app.auth.authenticate(token);
  assert.equal(authed.id, user.id);

  // Workspace balance starts at 0.
  assert.equal(await app.repos.ledger.getBalance(user.id), 0);
  assert.equal(await app.repos.reputation.scoreFor(user.id), 0);

  // Complete the quiz with the correct answers (server-graded).
  const answers = quiz.quiz!.questions.map((q) => ({ questionIndex: q.index, answerIndex: 0 }));
  const result = await app.proofs.completeQuiz(user.id, quiz.id, answers, { ip: '127.0.0.1' });
  assert.equal(result.ok, true);
  assert.equal(result.points, quiz.rewardPoints);

  // Points + reputation credited.
  assert.equal(await app.repos.ledger.getBalance(user.id), quiz.rewardPoints);
  assert.equal(await app.repos.reputation.scoreFor(user.id), 10);

  // Reputation summary reflects the credited event.
  const rep = await app.reputation.get(user.id);
  assert.equal(rep.score, 10);
  assert.ok(rep.reasons.length >= 1, 'reputation reason recorded');
});

test('duplicate completion is rejected (no double reward)', async () => {
  const mem = createTestDb();
  await runMigrationsOn(mem);
  const app = createServices(mem);
  const repos = createRepos(mem);
  await seedMissions(repos.missions);

  const { user } = await app.auth.register({
    email: 'dup@test.dev',
    password: 'password123',
    firstName: 'Dup',
    lastName: 'User',
  });
  const quiz = (await app.missions.list()).find((m) => m.verification === 'QUIZ')!;
  const answers = quiz.quiz!.questions.map((q) => ({ questionIndex: q.index, answerIndex: 0 }));

  await app.proofs.completeQuiz(user.id, quiz.id, answers, { ip: 'x' });
  await assert.rejects(() => app.proofs.completeQuiz(user.id, quiz.id, answers, { ip: 'x' }));
});
