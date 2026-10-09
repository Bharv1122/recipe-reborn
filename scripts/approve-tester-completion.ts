import { PrismaClient } from '@prisma/client';
import { TESTER_APPROVAL_PREFIX, validTesterCompletion } from '../lib/tester-completion';

// Operator-only command. No public endpoint accepts completion claims.
async function main() {
  const args = process.argv.slice(2);
  const value = (name: string) => args[args.indexOf(name) + 1];
  for (const flag of ['--email', '--started-at', '--completed-at', '--feedback-reference']) {
    if (!args.includes(flag) || !value(flag) || value(flag).startsWith('--')) throw new Error(`Required: ${flag}`);
  }
  if (!args.includes('--beth-confirmed')) throw new Error('Beth must confirm the completed test and feedback first.');
  const db = new PrismaClient();
  try {
    const user = await db.user.findUnique({ where: { email: value('--email').trim().toLowerCase() }, select: { id: true, createdAt: true } });
    if (!user) throw new Error('Tester account not found.');
    const approval = {
      userId: user.id, startedAt: value('--started-at'), completedAt: value('--completed-at'),
      approvedAt: new Date().toISOString(), feedbackReference: value('--feedback-reference'), approvedBy: 'Beth',
    };
    if (!validTesterCompletion(JSON.stringify(approval), user.id) || Date.parse(approval.startedAt) < user.createdAt.getTime()) {
      throw new Error('Completion requires at least 14 full days after testing began, an existing account, and a feedback reference.');
    }
    // Approval alone grants no Premium and starts no clock. Tester redeems later.
    const result = await db.verificationToken.upsert({
      where: { token: TESTER_APPROVAL_PREFIX + user.id },
      create: { token: TESTER_APPROVAL_PREFIX + user.id, identifier: JSON.stringify(approval), expires: new Date('2028-01-01T00:00:00Z') },
      update: {},
      select: { token: true },
    });
    console.log(JSON.stringify({ approved: !!result, rewardStarted: false, code: 'TESTERTHANKS' }));
  } finally { await db.$disconnect(); }
}
main().catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
