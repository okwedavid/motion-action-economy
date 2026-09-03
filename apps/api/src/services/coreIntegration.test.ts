import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from '../test/helpers.js';

/**
 * End-to-end core loop across the assembled services:
 * REGISTER → LOGIN → HOME → DISCOVER → PROVE (server-graded quiz)
 * → EARN (points) → REPUTATION → WALLET.
 */
test('core integration: full register→...→wallet loop is genuinely wired', async () => {
  const { services, repos } = await createTestContext();

  // 1. REGISTER
  const { user, token } = await services.auth.register({
    email: 'jay@motion.dev',
    password: 'hunter2-secret',
    firstName: 'Jay',
    lastName: 'Ade',
    displayName: 'Jay A',
  });
  assert.equal(user.email, 'jay@motion.dev');

  // 2. LOGIN / authenticate
  const authed = await services.auth.authenticate(token);
  assert.equal(authed.id, user.id);
  const login = await services.auth.login('jay@motion.dev', 'hunter2-secret');
  assert.equal(login.user.id, user.id);

  // 3. HOME (pre-completion state)
  const homeBefore = await services.home.getSummary(user.id);
  assert.equal(homeBefore.points, 0);
  assert.equal(homeBefore.reputation.score, 0);
  assert.ok(homeBefore.recommendedMission, 'a mission is recommended');

  // 4. DISCOVER missions
  const missions = await services.missions.list();
  assert.ok(missions.length >= 3);
  const quiz = missions.find((m) => m.verification === 'QUIZ')!;
  const detail = await services.missions.detail(quiz.id);
  assert.equal(detail.id, quiz.id);

  // 5. PROVE — complete the quiz (server-graded)
  const answers = quiz.quiz!.questions.map((_, i) => ({ questionIndex: i, answerIndex: 0 }));
  const done = await services.proofs.completeQuiz(user.id, quiz.id, answers, { ip: '127.0.0.1' });
  assert.equal(done.ok, true);
  assert.equal(done.points, quiz.rewardPoints);

  // 6. EARN — points on the ledger
  assert.equal(await repos.ledger.getBalance(user.id), quiz.rewardPoints);

  // 7. REPUTATION updated with an explainable reason
  const rep = await services.reputation.get(user.id);
  assert.equal(rep.score, 10);
  assert.ok(rep.reasons.length >= 1);
  assert.ok(rep.reasons[0].label.includes('verified') || rep.reasons[0].label.includes('learning'));

  // 8. HOME reflects the earned state
  const homeAfter = await services.home.getSummary(user.id);
  assert.equal(homeAfter.points, quiz.rewardPoints);

  // 9. WALLET overview reachable (demo, mocked — never a fabricated balance)
  const wallet = await services.wallet.getOverview(user.id);
  assert.equal(wallet.mode, 'mock');
  assert.equal(wallet.demo, true);
  assert.equal(wallet.balanceAvailable, false, 'no fake balance in demo');
  assert.ok(wallet.supportedCurrencies.includes('NGN'));

  // 10. Replay protection — completing again is rejected
  await assert.rejects(() => services.proofs.completeQuiz(user.id, quiz.id, answers, { ip: 'x' }));
});
