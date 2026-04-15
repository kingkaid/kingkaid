import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WizardStep = "disclaimer" | "system" | "license" | "model" | "heygem" | "done";

export interface AppState {
  // Setup wizard progress
  wizardStep: WizardStep;
  wizardComplete: boolean;

  // License
  licenseKey: string | null;
  deviceFingerprint: string | null;
  licenseValid: boolean;
  remainingCalls: number;

  // Actions
  setWizardStep: (step: WizardStep) => void;
  completeWizard: () => void;
  setLicense: (key: string, fingerprint: string, remaining: number) => void;
  resetWizard: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      wizardStep: "disclaimer",
      wizardComplete: false,
      licenseKey: null,
      deviceFingerprint: null,
      licenseValid: false,
      remainingCalls: 0,

      setWizardStep: (step) => set({ wizardStep: step }),
      completeWizard: () => set({ wizardComplete: true }),
      setLicense: (key, fingerprint, remaining) =>
        set({
          licenseKey: key,
          deviceFingerprint: fingerprint,
          licenseValid: true,
          remainingCalls: remaining,
        }),
      resetWizard: () =>
        set({
          wizardStep: "disclaimer",
          wizardComplete: false,
          licenseKey: null,
          licenseValid: false,
        }),
    }),
    {
      name: "kingkaid-app-state",
    }
  )
);
