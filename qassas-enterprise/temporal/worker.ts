import { NativeConnection, Worker } from "@temporalio/worker";

async function run(): Promise<void> {
  const address = process.env.TEMPORAL_ADDRESS ?? "127.0.0.1:7233";
  const namespace = process.env.TEMPORAL_NAMESPACE ?? "qassas-pilot";
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE ?? "qassas-decision-review";

  const connection = await NativeConnection.connect({ address });
  const worker = await Worker.create({
    connection,
    namespace,
    taskQueue,
    workflowsPath: require.resolve(
      "./workflows/decision-human-review.workflow",
    ),
  });

  await worker.run();
}

run().catch((error) => {
  console.error("QASSAS Temporal worker failed", error);
  process.exitCode = 1;
});
