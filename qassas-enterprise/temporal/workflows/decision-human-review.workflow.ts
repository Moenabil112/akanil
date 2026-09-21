import {
  condition,
  defineSignal,
  setHandler,
} from "@temporalio/workflow";

export interface ReviewSignal {
  reviewerUserId: string;
  roleAssignmentId: string;
  expectedDecisionVersion: number;
  rationale: string;
}

export type ReviewOutcome =
  | { status: "APPROVED"; review: ReviewSignal }
  | { status: "REJECTED"; review: ReviewSignal };

export const approve = defineSignal<[ReviewSignal]>("approve");
export const reject = defineSignal<[ReviewSignal]>("reject");

export async function decisionHumanReviewWorkflow(): Promise<ReviewOutcome> {
  let outcome: ReviewOutcome | undefined;

  setHandler(approve, (review) => {
    outcome = { status: "APPROVED", review };
  });

  setHandler(reject, (review) => {
    outcome = { status: "REJECTED", review };
  });

  await condition(() => outcome !== undefined);

  return outcome!;
}
