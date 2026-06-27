import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifySession, type AdminSession } from "./auth";

/** Reads and verifies the admin session from cookies (server components). */
export async function getAdminSession(): Promise<AdminSession | null> {
  return verifySession(cookies().get(ADMIN_COOKIE)?.value);
}
