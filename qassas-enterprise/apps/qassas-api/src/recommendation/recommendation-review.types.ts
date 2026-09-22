export interface ReviewRecommendationCommand {
  review_status: "ACCEPTED" | "REJECTED";
  rationale: string;
}
