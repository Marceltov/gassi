// "Mit authentik anmelden" in the Android app: the server's OIDC sign-in in the browser's auth session, which ends at
// gassi://join?… (a device link, or ?error=signin); the app then signs in with it on /join. The web app goes there
// in the page itself (oidc.web.ts).
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { openAuthSessionAsync } from "expo-web-browser";

export async function startOidc(server: string): Promise<void> {
  const result = await openAuthSessionAsync(`${server}/api/oidc/start?app=1`, "gassi://join");
  if (result.type === "success") router.replace({ pathname: "/join", params: Linking.parse(result.url).queryParams ?? {} });
}
