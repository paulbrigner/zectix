import { notFound } from "next/navigation";
import {
  processDueTasksAction,
  retryRegistrationAction,
  validateAndSyncCalendarAction,
} from "@/app/ops/actions";
import { ConsoleConfirmDialog } from "@/components/ConsoleConfirmDialog";
import { getTenantOpsDetail } from "@/lib/tenancy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TenantRecoveryPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const detail = await getTenantOpsDetail(tenantId);
  if (!detail) {
    notFound();
  }

  return (
    <>
      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Recovery actions</h2>
            <p className="subtle-text">
              Use these actions to resync inventory and push stalled
              registration tasks forward.
            </p>
          </div>
        </div>

        <div className="button-row">
          <ConsoleConfirmDialog
            action={processDueTasksAction}
            confirmClassName="button button-small"
            confirmLabel="Process due tasks"
            description="This runs up to 20 queued registration tasks immediately and may update attendee registration state."
            title="Process due tasks now?"
            triggerClassName="button button-small"
            triggerLabel="Process due tasks"
          >
            <input name="limit" type="hidden" value="20" />
            <input
              name="redirect_to"
              type="hidden"
              value={`/ops/tenants/${tenantId}/recovery`}
            />
          </ConsoleConfirmDialog>
          {detail.calendars.map((calendar) => (
            <form
              action={validateAndSyncCalendarAction}
              key={calendar.calendar_connection_id}
            >
              <input
                name="calendar_connection_id"
                type="hidden"
                value={calendar.calendar_connection_id}
              />
              <input
                name="redirect_to"
                type="hidden"
                value={`/ops/tenants/${tenantId}/recovery`}
              />
              <button
                className="button button-secondary button-small"
                type="submit"
              >
                Resync {calendar.display_name}
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Registration tasks</h2>
            <p className="subtle-text">
              Dead letters and retry waits are visible here with direct
              per-session retry buttons.
            </p>
          </div>
        </div>

        <div className="console-card-grid">
          {detail.tasks.map((task) => (
            <article className="console-detail-card" key={task.task_id}>
              <p className="console-kpi-label">{task.status}</p>
              <h3>{task.session_id}</h3>
              <p className="subtle-text">
                Attempts {task.attempt_count} · next {task.next_attempt_at}
              </p>
              <p className="subtle-text">
                {task.last_error || "No error recorded"}
              </p>
              <ConsoleConfirmDialog
                action={retryRegistrationAction}
                confirmLabel="Retry this session"
                description="This immediately requeues registration work for the selected checkout session."
                title={`Retry ${task.session_id}?`}
                triggerLabel="Retry this session"
              >
                <input
                  name="session_id"
                  type="hidden"
                  value={task.session_id}
                />
                <input
                  name="redirect_to"
                  type="hidden"
                  value={`/ops/tenants/${tenantId}/recovery`}
                />
              </ConsoleConfirmDialog>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
