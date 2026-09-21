import { Injectable, OnModuleDestroy } from "@nestjs/common";
import {
  Client,
  Connection,
  WorkflowExecutionAlreadyStartedError,
} from "@temporalio/client";

export interface TemporalReviewSignal {
  reviewerUserId: string;
  roleAssignmentId: string;
  expectedDecisionVersion: number;
  rationale: string;
}

@Injectable()
export class TemporalWorkflowService implements OnModuleDestroy {
  private connection?: Connection;
  private clientInstance?: Client;

  private namespace(): string {
    return process.env.TEMPORAL_NAMESPACE ?? "qassas-pilot";
  }

  private taskQueue(): string {
    return process.env.TEMPORAL_TASK_QUEUE ?? "qassas-decision-review";
  }

  private async client(): Promise<Client> {
    if (!this.clientInstance) {
      this.connection = await Connection.connect({
        address: process.env.TEMPORAL_ADDRESS ?? "127.0.0.1:7233",
      });
      this.clientInstance = new Client({
        connection: this.connection,
        namespace: this.namespace(),
      });
    }
    return this.clientInstance;
  }

  workflowId(decisionId: string, reviewId: string): string {
    return `qassas-review:${decisionId}:${reviewId}`;
  }

  async ensureReviewWorkflowStarted(
    workflowId: string,
    decisionId: string,
    reviewId: string,
  ): Promise<void> {
    const client = await this.client();
    try {
      await client.workflow.start("decisionHumanReviewWorkflow", {
        workflowId,
        taskQueue: this.taskQueue(),
        args: [{ decisionId, reviewId }],
      });
    } catch (error) {
      if (error instanceof WorkflowExecutionAlreadyStartedError) {
        return;
      }
      throw error;
    }
  }

  async signalReview(
    workflowId: string,
    action: "approve" | "reject",
    review: TemporalReviewSignal,
  ): Promise<void> {
    const client = await this.client();
    const handle = client.workflow.getHandle(workflowId);
    await handle.signal(action, review);
  }

  async health(): Promise<boolean> {
    try {
      const client = await this.client();
      await client.connection.workflowService.getSystemInfo({});
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.close();
  }
}
