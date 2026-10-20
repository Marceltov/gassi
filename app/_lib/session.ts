// The signed-in user of the request being answered, for pages and server actions.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, sessionUser, type User } from "@/backend";

export async function currentUser(): Promise<User | null> {
  return sessionUser((await cookies()).get(SESSION_COOKIE)?.value);
}

/** The signed-in user; anyone else goes to the login page. Every server action starts with this. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
