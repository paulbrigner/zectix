import { pathToFileURL } from "node:url";

export const SECRET_REF_FIELDS = [
  "luma_api_secret_ref",
  "luma_webhook_secret_ref",
  "luma_webhook_token_ref",
  "cipherpay_api_secret_ref",
  "cipherpay_webhook_secret_ref",
];

const DEFAULT_TABLE_NAMES = ["zectix", "zectix-staging"];
const DEFAULT_SECRET_PREFIXES = ["zectix", "zectix-staging"];

function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function splitList(value) {
  if (Array.isArray(value)) {
    return value.flatMap(splitList);
  }
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeList(value, fallback) {
  const normalized = splitList(value);
  return normalized.length ? Array.from(new Set(normalized)) : fallback;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return ["1", "true", "yes", "apply"].includes(value.trim().toLowerCase());
  }

  return fallback;
}

function normalizePositiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

export function normalizeCleanupOptions(options = {}) {
  const tableNames = normalizeList(
    options.tableNames ||
      options.tables ||
      process.env.ZECTIX_TABLE_NAMES ||
      process.env.DYNAMODB_TABLE_NAMES ||
      process.env.DYNAMODB_TABLE_NAME ||
      process.env.ZECTIX_TABLE_NAME,
    DEFAULT_TABLE_NAMES,
  );
  const secretPrefixes = normalizeList(
    options.secretPrefixes ||
      options.prefixes ||
      process.env.SECRET_STORE_PREFIXES ||
      process.env.SECRET_STORE_PREFIX,
    DEFAULT_SECRET_PREFIXES,
  );

  return {
    apply:
      options.apply === undefined
        ? normalizeBoolean(process.env.SECRETS_CLEANUP_APPLY, false)
        : normalizeBoolean(options.apply, false),
    maxDeletes: normalizePositiveInteger(
      options.maxDeletes || process.env.SECRETS_CLEANUP_MAX_DELETES,
      200,
    ),
    profile: trim(options.profile),
    recoveryWindowInDays: normalizePositiveInteger(
      options.recoveryWindowInDays || process.env.SECRETS_CLEANUP_RECOVERY_DAYS,
      7,
      { min: 7, max: 30 },
    ),
    region:
      trim(options.region) ||
      trim(process.env.AWS_REGION) ||
      trim(process.env.AWS_DEFAULT_REGION) ||
      "us-east-1",
    secretPrefixes,
    tableNames,
  };
}

export function collectSecretRefs(items) {
  const refs = new Set();
  for (const item of items || []) {
    for (const field of SECRET_REF_FIELDS) {
      const value = trim(item?.[field]);
      if (value) {
        refs.add(value);
      }
    }
  }

  return refs;
}

function matchesManagedPrefix(secret, prefixes) {
  return prefixes.some((prefix) => secret.Name === prefix || secret.Name?.startsWith(`${prefix}/`));
}

export function findOrphanedSecrets(secrets, referencedRefs, prefixes) {
  return (secrets || [])
    .filter((secret) => matchesManagedPrefix(secret, prefixes))
    .filter((secret) => {
      const candidates = [secret.ARN, secret.Name].filter(Boolean);
      return !candidates.some((candidate) => referencedRefs.has(candidate));
    })
    .sort((left, right) => {
      const leftTime = left.CreatedDate ? new Date(left.CreatedDate).getTime() : 0;
      const rightTime = right.CreatedDate ? new Date(right.CreatedDate).getTime() : 0;
      return leftTime - rightTime || String(left.Name).localeCompare(String(right.Name));
    });
}

async function scanTable(documentClient, ScanCommand, tableName) {
  const items = [];
  let ExclusiveStartKey;

  do {
    const response = await documentClient.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey,
      }),
    );
    items.push(...(response.Items || []));
    ExclusiveStartKey = response.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return items;
}

async function listActiveSecrets(secretsClient, ListSecretsCommand) {
  const secrets = [];
  let NextToken;

  do {
    const response = await secretsClient.send(
      new ListSecretsCommand({
        IncludePlannedDeletion: false,
        MaxResults: 100,
        NextToken,
      }),
    );
    secrets.push(...(response.SecretList || []));
    NextToken = response.NextToken;
  } while (NextToken);

  return secrets;
}

function countByPrefix(secrets) {
  return Object.fromEntries(
    Object.entries(
      (secrets || []).reduce((counts, secret) => {
        const prefix = String(secret.Name || "").split("/")[0] || "<unknown>";
        counts[prefix] = (counts[prefix] || 0) + 1;
        return counts;
      }, {}),
    ).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function isoDate(value) {
  if (!value) {
    return null;
  }
  return new Date(value).toISOString().slice(0, 10);
}

function countByCreatedDay(secrets) {
  return Object.fromEntries(
    Object.entries(
      (secrets || []).reduce((counts, secret) => {
        const day = isoDate(secret.CreatedDate) || "<unknown>";
        counts[day] = (counts[day] || 0) + 1;
        return counts;
      }, {}),
    ).sort(([left], [right]) => left.localeCompare(right)),
  );
}

export async function cleanupOrphanedSecrets(options = {}) {
  const normalized = normalizeCleanupOptions(options);
  if (normalized.profile) {
    process.env.AWS_PROFILE = normalized.profile;
    process.env.AWS_SDK_LOAD_CONFIG = process.env.AWS_SDK_LOAD_CONFIG || "1";
  }

  const [
    { DynamoDBClient },
    { DynamoDBDocumentClient, ScanCommand },
    {
      DeleteSecretCommand,
      ListSecretsCommand,
      SecretsManagerClient,
    },
  ] = await Promise.all([
    import("@aws-sdk/client-dynamodb"),
    import("@aws-sdk/lib-dynamodb"),
    import("@aws-sdk/client-secrets-manager"),
  ]);

  const clientConfig = { region: normalized.region };
  const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig), {
    marshallOptions: { removeUndefinedValues: true },
  });
  const secretsClient = new SecretsManagerClient(clientConfig);

  const tableItems = (
    await Promise.all(
      normalized.tableNames.map(async (tableName) => ({
        tableName,
        items: await scanTable(documentClient, ScanCommand, tableName),
      })),
    )
  ).flatMap((table) => table.items);
  const referencedRefs = collectSecretRefs(tableItems);
  const activeSecrets = await listActiveSecrets(secretsClient, ListSecretsCommand);
  const orphanedSecrets = findOrphanedSecrets(
    activeSecrets,
    referencedRefs,
    normalized.secretPrefixes,
  );
  const selectedSecrets = orphanedSecrets.slice(0, normalized.maxDeletes);
  const deletedSecrets = [];

  if (normalized.apply) {
    for (const secret of selectedSecrets) {
      await secretsClient.send(
        new DeleteSecretCommand({
          RecoveryWindowInDays: normalized.recoveryWindowInDays,
          SecretId: secret.ARN || secret.Name,
        }),
      );
      deletedSecrets.push(secret.Name);
    }
  }

  const result = {
    apply: normalized.apply,
    deleted_names: deletedSecrets,
    deleted_secrets: deletedSecrets.length,
    managed_active_secrets: activeSecrets.filter((secret) =>
      matchesManagedPrefix(secret, normalized.secretPrefixes),
    ).length,
    max_deletes: normalized.maxDeletes,
    orphaned_by_created_day: countByCreatedDay(orphanedSecrets),
    orphaned_by_prefix: countByPrefix(orphanedSecrets),
    orphaned_names: orphanedSecrets.map((secret) => secret.Name),
    orphaned_secrets: orphanedSecrets.length,
    recovery_window_days: normalized.recoveryWindowInDays,
    referenced_secret_refs: referencedRefs.size,
    region: normalized.region,
    secret_prefixes: normalized.secretPrefixes,
    skipped_for_max_deletes: Math.max(0, orphanedSecrets.length - selectedSecrets.length),
    table_names: normalized.tableNames,
  };

  return result;
}

export async function handler(event = {}) {
  const result = await cleanupOrphanedSecrets(event);
  return {
    ok: true,
    ...result,
  };
}

function parseCliArgs(argv) {
  const options = {
    secretPrefixes: [],
    tableNames: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index];
    if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--dry-run") {
      options.apply = false;
    } else if (arg === "--max-deletes") {
      options.maxDeletes = next();
    } else if (arg === "--prefix") {
      options.secretPrefixes.push(next());
    } else if (arg === "--prefixes") {
      options.secretPrefixes.push(...splitList(next()));
    } else if (arg === "--profile") {
      options.profile = next();
    } else if (arg === "--recovery-days") {
      options.recoveryWindowInDays = next();
    } else if (arg === "--region") {
      options.region = next();
    } else if (arg === "--table") {
      options.tableNames.push(next());
    } else if (arg === "--tables") {
      options.tableNames.push(...splitList(next()));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.secretPrefixes.length) {
    delete options.secretPrefixes;
  }
  if (!options.tableNames.length) {
    delete options.tableNames;
  }

  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  cleanupOrphanedSecrets(parseCliArgs(process.argv.slice(2)))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
