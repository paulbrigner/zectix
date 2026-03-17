import {
  DynamoDBClient,
  type DynamoDBClientConfig,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

let cachedClient: DynamoDBDocumentClient | null = null;
const DEFAULT_LOCAL_DYNAMODB_ENDPOINT = "http://127.0.0.1:8000";

function dynamoConfig(): DynamoDBClientConfig {
  const endpoint =
    process.env.DYNAMODB_ENDPOINT?.trim() ||
    (process.env.NODE_ENV === "development"
      ? DEFAULT_LOCAL_DYNAMODB_ENDPOINT
      : undefined);
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const sessionToken = process.env.AWS_SESSION_TOKEN?.trim();

  return {
    region: process.env.AWS_REGION || "us-east-1",
    endpoint,
    credentials: endpoint
      ? {
          accessKeyId: accessKeyId || "local",
          secretAccessKey: secretAccessKey || "local",
        }
      : accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey,
            sessionToken,
          }
      : undefined,
  };
}

export function testStateTableName() {
  return process.env.DYNAMODB_TABLE_NAME?.trim() || "lumazcash";
}

export function getDynamoDocumentClient() {
  if (!cachedClient) {
    cachedClient = DynamoDBDocumentClient.from(new DynamoDBClient(dynamoConfig()), {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });
  }

  return cachedClient;
}
