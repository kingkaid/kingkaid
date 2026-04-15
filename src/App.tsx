import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "./router";
import { SetupWizard } from "./components/shared/SetupWizard";
import { useAppStore } from "./stores/appStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60, retry: 1 },
  },
});

export default function App() {
  const wizardComplete = useAppStore((s) => s.wizardComplete);

  return (
    <QueryClientProvider client={queryClient}>
      {wizardComplete ? <RouterProvider router={router} /> : <SetupWizard />}
    </QueryClientProvider>
  );
}
