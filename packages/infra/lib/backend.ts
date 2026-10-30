// The Convex backend's image and settings, the same for every stage but for its size. The stock
// image sizes its pools for the host: on a small Fargate task that means running out of memory.
export const BACKEND_IMAGE =
  "ghcr.io/convex/convex-backend@sha256:294944b33dc55e8f68b2feda11c5e7b195f7778b9ad2951f1bea2744ad392e5a";

export const PORT = { cloud: 3210, site: 3211 };

export const CA_FILE = "/tmp/rds-ca.pem";

/** `size` is in Fargate units: 1024 CPU is one vCPU, memory is in MiB. */
export function backendEnvironment(size: { cpu: number; memory: number }) {
  const vcpu = size.cpu / 1024;
  const atLeast = (minimum: number, value: number) => String(Math.max(minimum, Math.ceil(value)));
  const bytes = (mebibytes: number) => String(Math.round(mebibytes) * 1024 * 1024);
  return {
    DISABLE_BEACON: "true",
    DISABLE_METRICS_ENDPOINT: "true",
    DOCUMENT_RETENTION_DELAY: "172800",
    RUST_LOG: "info",
    MALLOC_ARENA_MAX: "2",
    APPLICATION_MAX_CONCURRENT_MUTATIONS: "16",
    APPLICATION_MAX_CONCURRENT_QUERIES: "16",
    APPLICATION_MAX_CONCURRENT_V8_ACTIONS: "16",
    APPLICATION_MAX_CONCURRENT_NODE_ACTIONS: "8",
    HTTP_SERVER_MAX_CONCURRENT_REQUESTS: "128",
    HTTP_SERVER_TIMEOUT_SECONDS: "300",
    DATABASE_UDF_USER_TIMEOUT_SECONDS: "5",
    MAX_BYTES_WRITTEN_PER_SECOND: "16777216",
    CODEL_QUEUE_IDLE_EXPIRATION_MILLIS: "5000",
    CODEL_QUEUE_CONGESTED_EXPIRATION_MILLIS: "500",
    RUNTIME_WORKER_THREADS: atLeast(2, vcpu * 2),
    V8_THREADS: atLeast(2, vcpu),
    FUNRUN_ISOLATE_ACTIVE_THREADS: atLeast(2, vcpu * 2),
    MAX_ISOLATE_WORKERS: atLeast(8, vcpu * 8),
    ISOLATE_QUEUE_SIZE: atLeast(64, vcpu * 64),
    SCHEDULED_JOB_EXECUTION_PARALLELISM: atLeast(2, vcpu * 4),
    ANALYZE_CONCURRENCY: atLeast(1, vcpu * 2),
    // A t4g.micro shares about 80 connections among every Preview stage.
    POSTGRES_MAX_CONNECTIONS: atLeast(8, vcpu * 16),
    UDF_CACHE_MAX_SIZE: bytes(size.memory / 32),
    INDEX_CACHE_SIZE: bytes(size.memory / 16),
    FUNRUN_CODE_CACHE_SIZE: bytes(size.memory / 32),
    FUNRUN_MODULE_CACHE_SIZE: bytes(size.memory / 32),
    FUNRUN_INDEX_CACHE_SIZE: bytes(size.memory / 64),
    SOURCE_MAP_CACHE_MAX_SIZE_BYTES: bytes(size.memory / 64),
  };
}
