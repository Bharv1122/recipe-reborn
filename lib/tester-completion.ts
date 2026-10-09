export const TESTER_REWARD_CODE = 'testerthanks';
export const TESTER_APPROVAL_PREFIX = 'tester-completion-approved:';
export const TESTER_REDEMPTION_PREFIX = 'tester-completion-redeemed:';
export const TESTER_REDEMPTION_IDENTIFIER = 'tester-completion-reward-v1';

export interface TesterCompletionApproval {
  userId: string;
  startedAt: string;
  completedAt: string;
  approvedAt: string;
  feedbackReference: string;
  approvedBy: 'Beth';
}

/** A signup date or the passage of time alone never qualifies a tester. */
export function validTesterCompletion(raw: string, userId: string, now = new Date()): boolean {
  try {
    const a = JSON.parse(raw) as TesterCompletionApproval;
    const start = Date.parse(a.startedAt);
    const completed = Date.parse(a.completedAt);
    const approved = Date.parse(a.approvedAt);
    return a.userId === userId && a.approvedBy === 'Beth'
      && typeof a.feedbackReference === 'string' && a.feedbackReference.trim().length > 0
      && Number.isFinite(start) && Number.isFinite(completed) && Number.isFinite(approved)
      && completed - start >= 14 * 86_400_000
      && approved >= completed && approved <= now.getTime();
  } catch {
    return false;
  }
}
