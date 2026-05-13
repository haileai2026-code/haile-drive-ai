// Runtime data store for entities that can be created/imported at runtime.
// Persists to localStorage so it survives reloads in mock mode.
// Once Lovable Cloud is enabled, swap reads/writes for Supabase calls.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  cities as seedCities,
  candidates as seedCandidates,
  type City,
  type Candidate,
} from "./ops-data";

export type Branch = {
  id: string;
  name: string;
  cityId: string;
  managerId?: string;
  address?: string;
};

const seedBranches: Branch[] = [
  { id: "b-pt-main", name: "Petah Tikva — Main", cityId: "c-pt", address: "Jabotinsky 101" },
  { id: "b-as-main", name: "Ashdod — Center", cityId: "c-as", address: "Rogozin 14" },
  { id: "b-hf-main", name: "Haifa — Carmel", cityId: "c-hf", address: "Horev 22" },
];

type StoreShape = {
  cities: City[];
  branches: Branch[];
  candidates: Candidate[];
};

type Ctx = StoreShape & {
  addCity: (name: string) => City;
  removeCity: (id: string) => void;
  addBranch: (b: Omit<Branch, "id">) => Branch;
  removeBranch: (id: string) => void;
  addCandidates: (rows: Candidate[]) => { added: number; skipped: number };
  removeCandidate: (id: string) => void;
  reset: () => void;
};

const KEY = "hda.store.v1";
const StoreCtx = createContext<Ctx | null>(null);

const slug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "x";

function load(): StoreShape {
  if (typeof window === "undefined") {
    return { cities: seedCities, branches: seedBranches, candidates: seedCandidates };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { cities: seedCities, branches: seedBranches, candidates: seedCandidates };
}

export function DataStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreShape>(() => load());

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(KEY, JSON.stringify(state));
    }
  }, [state]);

  const value = useMemo<Ctx>(() => ({
    ...state,
    addCity: (name) => {
      const id = `c-${slug(name)}-${Math.random().toString(36).slice(2, 5)}`;
      const c: City = { id, name: name.trim() };
      setState((s) => ({ ...s, cities: [...s.cities, c] }));
      return c;
    },
    removeCity: (id) =>
      setState((s) => ({ ...s, cities: s.cities.filter((c) => c.id !== id) })),
    addBranch: (b) => {
      const nb: Branch = { ...b, id: `b-${slug(b.name)}-${Math.random().toString(36).slice(2, 5)}` };
      setState((s) => ({ ...s, branches: [...s.branches, nb] }));
      return nb;
    },
    removeBranch: (id) =>
      setState((s) => ({ ...s, branches: s.branches.filter((b) => b.id !== id) })),
    addCandidates: (rows) => {
      let added = 0, skipped = 0;
      setState((s) => {
        const existingPhones = new Set(s.candidates.map((c) => c.phone.replace(/\D/g, "")));
        const next = [...s.candidates];
        for (const r of rows) {
          const key = r.phone.replace(/\D/g, "");
          if (existingPhones.has(key)) { skipped++; continue; }
          existingPhones.add(key);
          next.push(r);
          added++;
        }
        return { ...s, candidates: next };
      });
      return { added, skipped };
    },
    removeCandidate: (id) =>
      setState((s) => ({ ...s, candidates: s.candidates.filter((c) => c.id !== id) })),
    reset: () => setState({ cities: seedCities, branches: seedBranches, candidates: seedCandidates }),
  }), [state]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore must be inside DataStoreProvider");
  return c;
}
