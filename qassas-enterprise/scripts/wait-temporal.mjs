import { Connection } from "@temporalio/client";

const address = process.env.TEMPORAL_ADDRESS ?? "127.0.0.1:7233";
const namespace = process.env.TEMPORAL_NAMESPACE ?? "qassas-pilot";
const attempts = Number(process.env.TEMPORAL_READY_ATTEMPTS ?? 60);
const intervalMs = Number(process.env.TEMPORAL_READY_INTERVAL_MS ?? 2000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let lastError;

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  let connection;
  try {
    connection = await Connection.connect({ address });
    await connection.workflowService.describeNamespace({ namespace });
    console.log(
      `Temporal namespace ready: ${namespace} at ${address} (attempt ${attempt})`,
    );
    await connection.close();
    process.exit(0);
  } catch (error) {
    lastError = error;
    await connection?.close().catch(() => undefined);
    if (attempt < attempts) {
      await sleep(intervalMs);
    }
  }
}

console.error(
  `Temporal namespace ${namespace} did not become ready at ${address}`,
  lastError,
);
process.exit(1);
