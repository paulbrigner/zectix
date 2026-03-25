import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function requireValue(name, value) {
  const normalized = trim(value);
  if (!normalized) {
    throw new Error(`${name} is required.`);
  }
  return normalized;
}

function normalizeBaseUrl(baseUrl) {
  const normalized = requireValue("ZECTIX_BASE_URL", baseUrl);
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function joinUrl(baseUrl, path) {
  return new URL(path.replace(/^\//, ""), normalizeBaseUrl(baseUrl)).toString();
}

async function readBody(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text || null;
  }
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "x-ops-source": "aws-monitor",
    },
  });
  const body = await readBody(response);
  return { response, body };
}

function getDocumentClient() {
  return DynamoDBDocumentClient.from(new DynamoDBClient({}));
}

function asIsoTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : null;
}

function isRecent(isoTimestamp, windowMs, nowMs) {
  const value = asIsoTimestamp(isoTimestamp);
  if (!value) {
    return false;
  }

  return nowMs - new Date(value).getTime() <= windowMs;
}

async function queryPartition(tableName, partitionKey) {
  const client = getDocumentClient();
  const items = [];
  let ExclusiveStartKey;

  do {
    const response = await client.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": partitionKey,
        },
        ExclusiveStartKey,
      }),
    );

    items.push(...(response.Items || []));
    ExclusiveStartKey = response.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return items;
}

function toMetricData(metrics) {
  return metrics.map(({ name, value }) => ({
    MetricName: name,
    Unit: "Count",
    Value: Number(value),
  }));
}

export async function handler() {
  const baseUrl = normalizeBaseUrl(process.env.ZECTIX_BASE_URL);
  const tableName = requireValue(
    "ZECTIX_TABLE_NAME",
    process.env.ZECTIX_TABLE_NAME,
  );
  const namespace = trim(process.env.ZECTIX_METRIC_NAMESPACE) || "ZecTix/Ops";
  const nowMs = Date.now();
  const recentWindowMs = 24 * 60 * 60 * 1000;

  const [{ response: healthResponse, body: healthBody }, { response: readyResponse, body: readyBody }, sessions, webhooks] =
    await Promise.all([
      getJson(joinUrl(baseUrl, "/api/health")),
      getJson(joinUrl(baseUrl, "/api/ready")),
      queryPartition(tableName, "SESSION"),
      queryPartition(tableName, "WEBHOOK"),
    ]);

  const failedRegistrations = sessions.filter(
    (item) => item?.registration_status === "failed",
  ).length;
  const retryDueRegistrations = sessions.filter((item) => {
    if (!item) {
      return false;
    }
    if (!["detected", "confirmed"].includes(item.status)) {
      return false;
    }
    if (item.registration_status === "registered") {
      return false;
    }
    const retryAt = asIsoTimestamp(item.registration_next_retry_at);
    return retryAt ? new Date(retryAt).getTime() <= nowMs : false;
  }).length;
  const invalidWebhooks24h = webhooks.filter(
    (item) =>
      item?.signature_valid === false &&
      isRecent(item.received_at, recentWindowMs, nowMs),
  ).length;

  const cloudWatch = new CloudWatchClient({});
  await cloudWatch.send(
    new PutMetricDataCommand({
      Namespace: namespace,
      MetricData: toMetricData([
        {
          name: "HealthOk",
          value: healthResponse.ok && healthBody?.ok === true ? 1 : 0,
        },
        {
          name: "ReadyOk",
          value: readyResponse.ok && readyBody?.ok === true ? 1 : 0,
        },
        {
          name: "FailedRegistrations",
          value: failedRegistrations,
        },
        {
          name: "RetryDueRegistrations",
          value: retryDueRegistrations,
        },
        {
          name: "InvalidWebhooks24h",
          value: invalidWebhooks24h,
        },
      ]),
    }),
  );

  return {
    ok: true,
    base_url: baseUrl.replace(/\/$/, ""),
    metrics: {
      health_ok: healthResponse.ok && healthBody?.ok === true ? 1 : 0,
      ready_ok: readyResponse.ok && readyBody?.ok === true ? 1 : 0,
      failed_registrations: failedRegistrations,
      retry_due_registrations: retryDueRegistrations,
      invalid_webhooks_24h: invalidWebhooks24h,
    },
    health: healthBody,
    ready: readyBody,
  };
}
