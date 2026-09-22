import { NativeConnection, Worker } from "@temporalio/worker";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function connectWithRetry(
  address: string,
  attempts = 30,
): Promise<NativeConnection> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await NativeConnection.connect({ address });
    } catch (error) {
      lastError = error;
      const delayMs = Math.min(1000 * attempt, 5000);
      console.warn(
        `Temporal not ready (attempt ${attempt}/${attempts}); retrying in ${delayMs}ms`,
      );
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Temporal connection failed after retry budget");
}

async function run(): Promise<void> {
  const address = process.env.TEMPORAL_ADDRESS ?? "127.0.0.1:7233";
  const namespace = process.env.TEMPORAL_NAMESPACE ?? "qassas-pilot";
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE ?? "qassas-decision-review";

  const connection = await connectWithRetry(address);
  const worker = await Worker.create({
    connection,
    namespace,
    taskQueue,
    workflowsPath: require.resolve(
      "./workflows/decision-human-review.workflow",
    ),
  });

  console.log(
    `QASSAS Temporal worker ready namespace=${namespace} taskQueue=${taskQueue}`,
  );
  await worker.run();
}

run().catch((error) => {
  console.error("QASSAS Temporal worker failed", error);
  process.exitCode = 1;
});
