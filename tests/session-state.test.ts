import { beforeEach, describe, expect, it, vi } from "vitest";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { makeCheckoutSession } from "@/tests/test-helpers";

const sendMock = vi.fn();

vi.mock("@/lib/app-state/dynamodb", () => ({
  appStateTableName: () => "zectix-test",
  getDynamoDocumentClient: () => ({
    send: sendMock,
  }),
}));

const { updateSession } = await import("@/lib/app-state/state");

function makeStoredSessionItem({
  includeVersion = true,
  ...overrides
}: Partial<ReturnType<typeof makeCheckoutSession>> & {
  includeVersion?: boolean;
} = {}) {
  const session = makeCheckoutSession(overrides);
  const item: Record<string, unknown> = {
    pk: "SESSION",
    sk: session.session_id,
    ...session,
  };

  if (!includeVersion) {
    delete item.version;
  }

  return item;
}

describe("updateSession", () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it("updates legacy session rows that do not yet have a version field", async () => {
    sendMock
      .mockResolvedValueOnce({
        Item: makeStoredSessionItem({
          includeVersion: false,
        }),
      })
      .mockResolvedValueOnce({});

    const updated = await updateSession("session_123", {
      status: "confirmed",
    });

    expect(updated.version).toBe(1);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[0][0]).toBeInstanceOf(GetCommand);
    expect(sendMock.mock.calls[1][0]).toBeInstanceOf(TransactWriteCommand);

    const primaryPut = sendMock.mock.calls[1][0].input.TransactItems?.[0]?.Put;
    expect(primaryPut?.ConditionExpression).toBe(
      "attribute_not_exists(#version) OR #version = :expectedVersion",
    );
    expect(primaryPut?.ExpressionAttributeValues).toEqual({
      ":expectedVersion": 0,
    });
    expect(primaryPut?.Item.version).toBe(1);
  });

  it("retries on optimistic-lock conflicts and reapplies updater patches to fresh session state", async () => {
    const firstRead = makeStoredSessionItem({
      version: 0,
      status: "pending",
      detected_at: null,
      confirmed_at: null,
    });
    const secondRead = makeStoredSessionItem({
      version: 1,
      status: "detected",
      detected_at: "2026-03-24T12:01:00.000Z",
      confirmed_at: null,
    });
    const confirmedAt = "2026-03-24T12:02:00.000Z";

    sendMock
      .mockResolvedValueOnce({
        Item: firstRead,
      })
      .mockRejectedValueOnce(
        Object.assign(new Error("conflict"), {
          name: "TransactionCanceledException",
          CancellationReasons: [{ Code: "ConditionalCheckFailed" }],
        }),
      )
      .mockResolvedValueOnce({
        Item: secondRead,
      })
      .mockResolvedValueOnce({});

    const updated = await updateSession("session_123", (current) => ({
      status: "confirmed",
      detected_at: current.detected_at,
      confirmed_at: confirmedAt,
    }));

    expect(sendMock).toHaveBeenCalledTimes(4);
    expect(updated.version).toBe(2);
    expect(updated.detected_at).toBe("2026-03-24T12:01:00.000Z");
    expect(updated.confirmed_at).toBe(confirmedAt);

    const retryPut = sendMock.mock.calls[3][0].input.TransactItems?.[0]?.Put;
    expect(retryPut?.ExpressionAttributeValues).toEqual({
      ":expectedVersion": 1,
    });
    expect(retryPut?.Item.version).toBe(2);
    expect(retryPut?.Item.detected_at).toBe("2026-03-24T12:01:00.000Z");
    expect(retryPut?.Item.confirmed_at).toBe(confirmedAt);
  });
});
