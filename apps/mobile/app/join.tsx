// Where a link's "Hier im Browser anmelden" / "In App öffnen" and the OIDC sign-in end: /join?token=… (in the app
// gassi://join?server=…&token=…) signs this device in with the link, ?error=signin says the sign-in didn't work.
import { useLocalSearchParams } from "expo-router";
import { linkedServer } from "@/src/data/thisDevice";
import { SignIn, SignInFailed } from "@/src/signin/SignIn";

export default function JoinScreen() {
  const { token, server, error } = useLocalSearchParams<{ token?: string; server?: string; error?: string }>();
  const target = linkedServer(server);
  if (error || !token || target === null) return <SignInFailed message={error ? "Anmeldung hat nicht geklappt." : "Dieser Link ist unvollständig."} />;
  return <SignIn token={token} server={target} />;
}
