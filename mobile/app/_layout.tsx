import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";
import { Loading } from "../src/components/ui";
import { colors } from "../src/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 2000,
      // Par defaut react-query suspend les rafraichissements periodiques des
      // que la fenetre n'est pas focalisee. Plusieurs webviews rapportent
      // « hidden » en permanence, et l'ecran reste alors fige sur un etat
      // perime alors que le round a avance chez les autres. Le cout est nul
      // sur mobile : le systeme gele les timers JS d'une app en arriere-plan.
      refetchIntervalInBackground: true,
    },
  },
});

/**
 * Branche le suivi de focus de react-query sur AppState.
 *
 * Sans ca, react-native n'a pas d'evenement de focus fenetre : react-query
 * considere l'app comme jamais focalisee et suspend les rafraichissements
 * periodiques. Pour un jeu asynchrone, le retour au premier plan est justement
 * le moment ou l'on veut des donnees fraiches.
 */
function useAppStateFocus() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = AppState.addEventListener("change", (status) => {
      focusManager.setFocused(status === "active");
    });
    return () => subscription.remove();
  }, []);
}

/**
 * Redirige vers l'onboarding tant qu'aucun compte n'existe.
 * On attend `ready` : sans ca, l'app renverrait vers l'onboarding a chaque
 * demarrage pendant la relecture du token.
 */
function AuthGate() {
  const { ready, token } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useAppStateFocus();

  useEffect(() => {
    if (!ready) return;
    const onOnboarding = segments[0] === "onboarding";
    if (!token && !onOnboarding) router.replace("/onboarding");
    if (token && onOnboarding) router.replace("/salons");
  }, [ready, token, segments, router]);

  if (!ready) return <Loading label="Ouverture…" />;

  // Sans token, on ne monte aucune route protegee. La redirection ci-dessus vit
  // dans un effet, qui ne s'execute qu'APRES le rendu : sans ce garde-fou,
  // l'ecran encore affiche se re-rend une fois sans token et useToken() leve.
  // C'est exactement ce qui se passait en se deconnectant depuis « Mes salons ».
  if (!token && segments[0] !== "onboarding") return <Loading label="Ouverture…" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="salons/index" options={{ title: "Mes salons" }} />
      <Stack.Screen name="salons/new" options={{ title: "Nouveau salon" }} />
      <Stack.Screen name="salons/join" options={{ title: "Rejoindre" }} />
      <Stack.Screen name="salon/[id]" options={{ title: "Salon" }} />
      <Stack.Screen name="round/[id]" options={{ title: "Round" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" />
          <AuthGate />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
