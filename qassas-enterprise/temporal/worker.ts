import { NativeConnection, Worker } from "@temporalio/worker";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function createWorkerWithRetry(
  address: string,
  namespace: string,
  taskQueue: string,
  attempts = 30,
): Promise<Worker> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let connection: NativeConnection | undefined;
    try {
      connection = await NativeConnection.connect({ address });
      return await Worker.create({
        connection,
        namespace,
        taskQueue,
        workflowsPath: require.resolve(
          "./workflows/decision-human-review.workflow",
        ),
      });
    } catch (error) {
      lastError = error;
      await connection?.close().catch(() => undefined);
      const delayMs = Math.min(1000 * attempt, 5000);
      console.warn(
        `Temporal/namespace not ready (attempt ${attempt}/${attempts}); retrying in ${delayMs}ms`,
      );
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Temporal worker could not initialise after retry budget");
}

async function run(): Promise<void> {
  const address = process.env.TEMPORAL_ADDRESS ?? "127.0.0.1:7233";
  const namespace = process.env.TEMPORAL_NAMESPACE ?? "qassas-pilot";
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE ?? "qassas-decision-review";

  const worker = await createWorkerWithRetry(address, namespace, taskQueue);

  console.log(
    `QASSAS Temporal worker ready namespace=${namespace} taskQueue=${taskQueue}`,
  );
  await worker.run();
}

run().catch((error) => {
  console.error("QASSAS Temporal worker failed", error);
  process.exitCode = 1;
});
