import type { Metadata } from "next";
import { AdminShell, NotConfigured, Forbidden } from "@/components/admin/shell";
import { Table, Th, Td, EmptyState } from "@/components/admin/widgets";
import { getAdminUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  ADMIN_ROLES,
  NDA_STATUSES,
  ACCESS_LEVELS,
  type Profile,
  type Organization,
} from "@/lib/supabase/types";
import { DATA_ROOM_WINDOWS } from "@/lib/data-room";
import {
  setRoleAction,
  setProfileNdaAction,
  setOrgNdaAction,
  grantWindowAccessAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Access Control",
  robots: { index: false, follow: false },
};

const PATH = "/admin/access-control";

export default async function AccessControlPage() {
  const user = await getAdminUser();

  if (!isSupabaseConfigured()) {
    return (
      <AdminShell title="Access Control" active={PATH}>
        <NotConfigured what="User, role, and NDA management" />
      </AdminShell>
    );
  }
  if (!user || !can.assignAccess(user.role)) {
    return (
      <AdminShell title="Access Control" active={PATH}>
        <Forbidden action="managing access, roles, and NDA status" />
      </AdminShell>
    );
  }

  const supabase = getServiceClient();
  const [{ data: profiles }, { data: orgs }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("organizations").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  const people = (profiles ?? []) as Profile[];
  const organizations = (orgs ?? []) as Organization[];
  const canRole = can.administerPlatform(user.role);

  return (
    <AdminShell title="Access Control" active={PATH}>
      {/* Users */}
      <section className="mb-12">
        <h2 className="heading-md mb-3 text-ivory">Users &amp; roles</h2>
        {people.length === 0 ? (
          <EmptyState message="No user profiles yet. Profiles are created during onboarding / data room approval." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Admin role</Th>
                <Th>NDA status</Th>
                <Th>Grant window access</Th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <div className="font-medium text-ivory">{p.full_name ?? "—"}</div>
                    <div className="text-xs text-atlas-grey">{p.email ?? "—"}</div>
                  </Td>
                  <Td>
                    <form action={setRoleAction} className="flex items-center gap-2">
                      <input type="hidden" name="profileId" value={p.id} />
                      <select name="admin_role" defaultValue={p.admin_role ?? "viewer"}
                        disabled={!canRole}
                        className="rounded-md border border-atlas-line bg-obsidian-900 px-2 py-1.5 text-xs text-ivory disabled:opacity-50">
                        {ADMIN_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      {canRole && <SaveBtn />}
                    </form>
                  </Td>
                  <Td>
                    <form action={setProfileNdaAction} className="flex items-center gap-2">
                      <input type="hidden" name="profileId" value={p.id} />
                      <select name="nda_status" defaultValue={p.nda_status}
                        className="rounded-md border border-atlas-line bg-obsidian-900 px-2 py-1.5 text-xs text-ivory">
                        {NDA_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <SaveBtn />
                    </form>
                  </Td>
                  <Td>
                    <form action={grantWindowAccessAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="profileId" value={p.id} />
                      <select name="window"
                        className="rounded-md border border-atlas-line bg-obsidian-900 px-2 py-1.5 text-xs text-ivory">
                        {DATA_ROOM_WINDOWS.map((w) => (
                          <option key={w.slug} value={w.label}>{w.label}</option>
                        ))}
                      </select>
                      <select name="access_level" defaultValue="institutional_brief"
                        className="rounded-md border border-atlas-line bg-obsidian-900 px-2 py-1.5 text-xs text-ivory">
                        {ACCESS_LEVELS.map((l) => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                      <SaveBtn label="Grant" />
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {!canRole && (
          <p className="mt-2 text-xs text-atlas-grey">
            Role assignment requires Platform Admin or higher.
          </p>
        )}
      </section>

      {/* Organizations */}
      <section>
        <h2 className="heading-md mb-3 text-ivory">Organizations &amp; NDA</h2>
        {organizations.length === 0 ? (
          <EmptyState message="No organizations recorded yet." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Organization</Th>
                <Th>NDA required</Th>
                <Th>NDA status</Th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((o) => (
                <tr key={o.id}>
                  <Td>
                    <div className="font-medium text-ivory">{o.name}</div>
                    <div className="text-xs text-atlas-grey">{o.country ?? "—"}</div>
                  </Td>
                  <Td>{o.nda_required ? "Yes" : "No"}</Td>
                  <Td>
                    <form action={setOrgNdaAction} className="flex items-center gap-2">
                      <input type="hidden" name="orgId" value={o.id} />
                      <select name="nda_status" defaultValue={o.nda_status}
                        className="rounded-md border border-atlas-line bg-obsidian-900 px-2 py-1.5 text-xs text-ivory">
                        {NDA_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <SaveBtn />
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </AdminShell>
  );
}

function SaveBtn({ label = "Save" }: { label?: string }) {
  return (
    <button type="submit"
      className="rounded-md border border-gold/40 px-2.5 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold hover:text-obsidian">
      {label}
    </button>
  );
}
