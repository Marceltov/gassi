// Where a link's "Hier im Browser anmelden" and the OIDC sign-in end: /join?token=… signs this browser in with the
// link, /join?error=signin says the sign-in didn't work.
import { useLocalSearchParams } from "expo-router";
import { SignIn, SignInFailed } from "@/src/signin/SignIn";

export default function JoinScreen() {
  const { token, error } = useLocalSearchParams<{ token?: string; error?: string }>();
  if (error || !token) return <SignInFailed message={error ? "Anmeldung hat nicht geklappt." : "Dieser Link ist unvollständig."} />;
  return <SignIn token={token} />;
}
