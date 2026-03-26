import { randomUUID } from "node:crypto";
import {
  getCalendarConnection,
  getRegistrationTaskBySession,
  getSession,
  listDueRegistrationTasks,
  putRegistrationTask,
  updateSession,
} from "@/lib/app-state/state";
import type { CheckoutSession, RegistrationTask } from "@/lib/app-state/types";
import { addMinutes, asRecord, nowIso, taskRetryDelayMinutes } from "@/lib/app-state/utils";
import { ensureUsageLedgerEntryForSession } from "@/lib/billing/usage-ledger";
import { addLumaGuest, getLumaGuest } from "@/lib/luma";
import { logEvent } from "@/lib/observability";
import { getSecretStore } from "@/lib/secrets";

const MAX_REGISTRATION_TASK_ATTEMPTS = 5;

function hasRegistrationGuestLookup(session: CheckoutSession) {
  const registration = asRecord(session.luma_registration_json);
  const guestLookup = asRecord(registration?.guest_lookup);
  return Boolean(asRecord(guestLookup?.guest));
}

function classifyRegistrationFailure(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Luma registration failed";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("429") ||
    normalized.includes("rate limit") ||
    normalized.includes("500") ||
    normalized.includes("502") ||
    normalized.includes("503") ||
    normalized.includes("504")
  ) {
    return {
      code: "transient_provider_error",
      message,
      retryable: true,
    };
  }

  return {
    code: "registration_failed",
    message,
    retryable: false,
  };
}

async function resolveLumaApiKey(session: CheckoutSession) {
  const calendar = await getCalendarConnection(session.calendar_connection_id);
  if (!calendar?.luma_api_secret_ref) {
    throw new Error("This calendar connection does not have a Luma API secret.");
  }

  const apiKey = await getSecretStore().getSecret(calendar.luma_api_secret_ref);
  if (!apiKey) {
    throw new Error("The Luma API secret could not be resolved from the secret store.");
  }

  return apiKey;
}

async function markTaskOutcome(
  task: RegistrationTask,
  patch: Partial<RegistrationTask>,
) {
  const next: RegistrationTask = {
    ...task,
    ...patch,
    task_id: task.task_id,
    tenant_id: task.tenant_id,
    calendar_connection_id: task.calendar_connection_id,
    session_id: task.session_id,
    cipherpay_invoice_id: task.cipherpay_invoice_id,
    created_at: task.created_at,
    updated_at: nowIso(),
  };

  return putRegistrationTask(next);
}

export async function ensureRegistrationTaskForSession(session: CheckoutSession) {
  if (!["detected", "confirmed"].includes(session.status)) {
    throw new Error("Only accepted sessions can be queued for registration.");
  }

  const existing = await getRegistrationTaskBySession(session.session_id);
  if (
    existing &&
    (existing.status === "pending" ||
      existing.status === "retry_wait" ||
      existing.status === "in_progress")
  ) {
    return existing;
  }

  const timestamp = nowIso();
  const task: RegistrationTask = {
    task_id: existing?.task_id || randomUUID(),
    tenant_id: session.tenant_id,
    calendar_connection_id: session.calendar_connection_id,
    session_id: session.session_id,
    cipherpay_invoice_id: session.cipherpay_invoice_id,
    status: "pending",
    attempt_count: existing?.attempt_count || 0,
    next_attempt_at: timestamp,
    last_error: null,
    created_at: existing?.created_at || timestamp,
    updated_at: timestamp,
    last_attempt_at: existing?.last_attempt_at || null,
  };

  await Promise.all([
    putRegistrationTask(task),
    updateSession(session.session_id, {
      registration_task_id: task.task_id,
      registration_status:
        session.registration_status === "registered" ? "registered" : "pending",
      registration_error: null,
      registration_failure_code: null,
      registration_next_retry_at: timestamp,
    }),
  ]);

  return task;
}

export async function retryRegistrationTaskForSession(sessionId: string) {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} was not found.`);
  }

  const task = await ensureRegistrationTaskForSession({
    ...session,
    registration_status: "pending",
  });

  return markTaskOutcome(task, {
    status: "pending",
    next_attempt_at: nowIso(),
    last_error: null,
  });
}

async function completeSuccessfulRegistration(
  task: RegistrationTask,
  session: CheckoutSession,
  guestLookup: Record<string, unknown>,
) {
  const timestamp = nowIso();
  const nextSession = await updateSession(session.session_id, {
    registration_status: "registered",
    registration_error: null,
    registration_failure_code: null,
    registration_attempt_count: task.attempt_count,
    registration_last_attempt_at: timestamp,
    registration_next_retry_at: null,
    luma_registration_json: {
      ...(session.luma_registration_json || {}),
      guest_lookup: guestLookup,
    },
    registered_at:
      (asRecord(guestLookup.guest) &&
      typeof asRecord(guestLookup.guest)?.registered_at === "string"
        ? (asRecord(guestLookup.guest)?.registered_at as string)
        : null) || session.registered_at || timestamp,
  });
  const [nextTask] = await Promise.all([
    markTaskOutcome(task, {
      status: "succeeded",
      next_attempt_at: timestamp,
      last_error: null,
    }),
    ensureUsageLedgerEntryForSession(nextSession),
  ]);

  return nextTask;
}

export async function processRegistrationTask(task: RegistrationTask) {
  const session = await getSession(task.session_id);
  if (!session) {
    return markTaskOutcome(task, {
      status: "dead_letter",
      last_error: "Checkout session could not be found for this task.",
    });
  }

  if (session.registration_status === "registered" && hasRegistrationGuestLookup(session)) {
    await ensureUsageLedgerEntryForSession(session);
    return markTaskOutcome(task, {
      status: "succeeded",
      last_error: null,
      next_attempt_at: nowIso(),
    });
  }

  const attemptAt = nowIso();
  const attemptCount = task.attempt_count + 1;
  const workingTask = await markTaskOutcome(task, {
    status: "in_progress",
    attempt_count: attemptCount,
    last_attempt_at: attemptAt,
    next_attempt_at: attemptAt,
  });

  try {
    const apiKey = await resolveLumaApiKey(session);
    await addLumaGuest({
      apiKey,
      eventApiId: session.event_api_id,
      attendeeEmail: session.attendee_email,
      attendeeName: session.attendee_name,
      ticketTypeApiId: session.ticket_type_api_id,
    });

    const guestLookup = await getLumaGuest({
      apiKey,
      eventApiId: session.event_api_id,
      attendeeEmail: session.attendee_email,
    }).catch(() => null);

    const guestLookupRecord = asRecord(guestLookup);
    if (guestLookupRecord && asRecord(guestLookupRecord.guest)) {
      logEvent("info", "registration.task.succeeded", {
        task_id: workingTask.task_id,
        session_id: session.session_id,
        invoice_id: session.cipherpay_invoice_id,
        attempt_count: attemptCount,
      });
      return completeSuccessfulRegistration(workingTask, session, guestLookupRecord);
    }

    if (attemptCount >= MAX_REGISTRATION_TASK_ATTEMPTS) {
      await Promise.all([
        markTaskOutcome(workingTask, {
          status: "dead_letter",
          last_error:
            "Payment was accepted, but Luma did not expose the guest record after repeated retries.",
        }),
        updateSession(session.session_id, {
          registration_status: "failed",
          registration_error:
            "Payment was accepted, but attendee registration still needs operator attention.",
          registration_failure_code: "guest_creation_unconfirmed",
          registration_attempt_count: attemptCount,
          registration_last_attempt_at: attemptAt,
          registration_next_retry_at: null,
        }),
      ]);
      return getRegistrationTaskBySession(session.session_id);
    }

    const retryAt = addMinutes(attemptAt, taskRetryDelayMinutes(attemptCount));
    await Promise.all([
      markTaskOutcome(workingTask, {
        status: "retry_wait",
        next_attempt_at: retryAt,
        last_error: "Waiting for Luma to surface the attendee pass.",
      }),
      updateSession(session.session_id, {
        registration_status: "pending",
        registration_error: "Payment accepted. Registration is queued for retry.",
        registration_failure_code: "guest_lookup_pending",
        registration_attempt_count: attemptCount,
        registration_last_attempt_at: attemptAt,
        registration_next_retry_at: retryAt,
      }),
    ]);

    logEvent("warn", "registration.task.retry_wait", {
      task_id: workingTask.task_id,
      session_id: session.session_id,
      retry_at: retryAt,
      attempt_count: attemptCount,
    });
    return getRegistrationTaskBySession(session.session_id);
  } catch (error) {
    const failure = classifyRegistrationFailure(error);
    const retryAt = addMinutes(attemptAt, taskRetryDelayMinutes(attemptCount));
    const deadLetter = !failure.retryable || attemptCount >= MAX_REGISTRATION_TASK_ATTEMPTS;

    await Promise.all([
      markTaskOutcome(workingTask, {
        status: deadLetter ? "dead_letter" : "retry_wait",
        next_attempt_at: deadLetter ? attemptAt : retryAt,
        last_error: failure.message,
      }),
      updateSession(session.session_id, {
        registration_status: deadLetter ? "failed" : "pending",
        registration_error: failure.message,
        registration_failure_code: failure.code,
        registration_attempt_count: attemptCount,
        registration_last_attempt_at: attemptAt,
        registration_next_retry_at: deadLetter ? null : retryAt,
      }),
    ]);

    logEvent(deadLetter ? "error" : "warn", "registration.task.failed", {
      task_id: workingTask.task_id,
      session_id: session.session_id,
      invoice_id: session.cipherpay_invoice_id,
      attempt_count: attemptCount,
      retry_at: deadLetter ? null : retryAt,
      error: failure.message,
    });
    return getRegistrationTaskBySession(session.session_id);
  }
}

export async function processDueRegistrationTasks(limit = 10) {
  const tasks = await listDueRegistrationTasks(limit);
  const results: RegistrationTask[] = [];

  for (const task of tasks) {
    const result = await processRegistrationTask(task);
    if (result) {
      results.push(result);
    }
  }

  return results;
}
