import { useEffect, useState } from "react";
import {
  getClinicBranches,
  setStoredClinicBranches,
} from "./clinicConfig";
import { fetchClinicBranchesFromSupabase } from "./supabaseService";

export function useClinicBranches(additionalBranches: string[] = []) {
  const [branches, setBranches] = useState(() => getClinicBranches(additionalBranches));

  useEffect(() => {
    const refresh = () => setBranches(getClinicBranches(additionalBranches));
    refresh();
    window.addEventListener("ara-clinic-branches-updated", refresh);
    let cancelled = false;
    fetchClinicBranchesFromSupabase().then((remoteBranches) => {
      if (cancelled || !remoteBranches?.length) return;
      setStoredClinicBranches(getClinicBranches(remoteBranches));
      setBranches(getClinicBranches(additionalBranches));
    });
    return () => {
      cancelled = true;
      window.removeEventListener("ara-clinic-branches-updated", refresh);
    };
  }, [additionalBranches.join("|")]);

  return branches;
}
