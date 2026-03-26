import { notFound } from "next/navigation";
import {
  processDueTasksAction,
  retryRegistrationAction,
  validateAndSyncCalendarAction,
} from "@/app/ops/actions";
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
            <p className="subtle-text">Use these actions to resync inventory and push stalled registration tasks forward.</p>
          </div>
        </div>

        <div className="button-row">
          <form action={processDueTasksAction}>
            <input name="limit" type="hidden" value="20" />
            <input name="redirect_to" type="hidden" value={`/ops/tenants/${tenantId}/recovery`} />
            <button className="button" type="submit">
              Process due tasks
            </button>
          </form>
          {detail.calendars.map((calendar) => (
            <form action={validateAndSyncCalendarAction} key={calendar.calendar_connection_id}>
              <input name="calendar_connection_id" type="hidden" value={calendar.calendar_connection_id} />
              <input name="redirect_to" type="hidden" value={`/ops/tenants/${tenantId}/recovery`} />
              <button className="button button-secondary button-small" type="submit">
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
            <p className="subtle-text">Dead letters and retry waits are visible here with direct per-session retry buttons.</p>
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
              <p className="subtle-text">{task.last_error || "No error recorded"}</p>
              <form action={retryRegistrationAction}>
                <input name="session_id" type="hidden" value={task.session_id} />
                <input name="redirect_to" type="hidden" value={`/ops/tenants/${tenantId}/recovery`} />
                <button className="button button-secondary button-small" type="submit">
                  Retry this session
                </button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
