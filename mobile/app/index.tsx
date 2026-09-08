import { Redirect } from "expo-router";
import { useAuth } from "../src/auth/AuthContext";
import { Loading } from "../src/components/ui";

export default function Index() {
  const { ready, token } = useAuth();
  if (!ready) return <Loading />;
  return <Redirect href={token ? "/salons" : "/welcome"} />;
}
