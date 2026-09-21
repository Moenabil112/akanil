import {
  condition,
  defineSignal,
  setHandler,
} from "@temporalio/workflow";

export interface DecisionHumanReviewInput {
  decisionId: string;
  reviewId: string;
}

export interface ReviewSignal {
  reviewerUserId: string;
  roleAssignmentId: string;
  expectedDecisionVersion: number;
  rationale: string;
}

export type ReviewOutcome =
  | {
      status: "APPROVED";
      decisionId: string;
      reviewId: string;
      review: ReviewSignal;
    }
  | {
      status: "REJECTED";
      decisionId: string;
      reviewId: string;
      review: ReviewSignal;
    };

export const approve = defineSignal<[ReviewSignal]>("approve");
export const reject = defineSignal<[ReviewSignal]>("reject");

export async function decisionHumanReviewWorkflow(
  input: DecisionHumanReviewInput,
): Promise<ReviewOutcome> {
  let outcome: ReviewOutcome | undefined;

  setHandler(approve, (review) => {
    outcome = {
      status: "APPROVED",
      decisionId: input.decisionId,
      reviewId: input.reviewId,
      review,
    };
  });

  setHandler(reject, (review) => {
    outcome = {
      status: "REJECTED",
      decisionId: input.decisionId,
      reviewId: input.reviewId,
      review,
    };
  });

  await condition(() => outcome !== undefined);
  return outcome!;
}
