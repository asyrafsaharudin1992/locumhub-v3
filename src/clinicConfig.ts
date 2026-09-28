const DEFAULT_CLINIC_BRANCHES = ["Kajang", "Seri Kembangan", "Semenyih"];
export const CLINIC_BRANCHES_STORAGE_KEY = "ara_clinic_branches";

const configuredBranches = (import.meta.env.VITE_CLINIC_BRANCHES || "")
  .split(",")
  .map((branch) => branch.trim())
  .filter(Boolean);

export const CLINIC_BRANCHES = configuredBranches.length
  ? configuredBranches
  : DEFAULT_CLINIC_BRANCHES;

export const DEFAULT_CLINIC_BRANCH =
  CLINIC_BRANCHES.find((branch) => branch.toLowerCase() === "seri kembangan") ||
  CLINIC_BRANCHES[0];

export function getClinicBranches(additionalBranches: string[] = []): string[] {
  const storedBranches = (() => {
    try {
      const raw = localStorage.getItem(CLINIC_BRANCHES_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  })();

  return Array.from(
    new Set(
      [...(storedBranches.length ? storedBranches : CLINIC_BRANCHES), ...additionalBranches]
        .map((branch) => branch.trim())
        .filter((branch) => branch && !/cme|briefing/i.test(branch)),
    ),
  );
}

export function setStoredClinicBranches(branches: string[]): void {
  localStorage.setItem(CLINIC_BRANCHES_STORAGE_KEY, JSON.stringify(branches));
  window.dispatchEvent(new Event("ara-clinic-branches-updated"));
}
