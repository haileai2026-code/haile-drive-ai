import { useState } from "react";
import { useStore } from "@/lib/data-store";
import { Network, Plus, Trash2, MapPin } from "lucide-react";

export function BranchesPanel() {
  const { branches, cities, addBranch, removeBranch, addCity } = useStore();
  const [name, setName] = useState("");
  const [cityId, setCityId] = useState("");
  const [newCity, setNewCity] = useState("");
  const [address, setAddress] = useState("");

  const create = () => {
    if (!name.trim()) return;
    let cid = cityId;
    if (!cid && newCity.trim()) cid = addCity(newCity).id;
    if (!cid) return alert("Pick a city or enter a new one.");
    addBranch({ name: name.trim(), cityId: cid, address: address.trim() || undefined });
    setName(""); setNewCity(""); setAddress("");
  };

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Network className="h-4 w-4 text-gold" /> All branches ({branches.length})
          </h2>
          <ul className="divide-y divide-border/40">
            {branches.map((b) => {
              const city = cities.find((c) => c.id === b.cityId);
              return (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{b.name}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {city?.name ?? "—"} {b.address && `· ${b.address}`}
                    </div>
                  </div>
                  <button
                    onClick={() => confirm(`Delete ${b.name}?`) && removeBranch(b.id)}
                    className="rounded-md p-2 text-rose-400 hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
            {branches.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">No branches yet.</li>}
          </ul>
        </section>

        <aside className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <h3 className="text-sm font-semibold">Add branch</h3>
          <div className="mt-3 space-y-3">
            <Field label="Branch name">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tel Aviv — North"
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" />
            </Field>
            <Field label="City">
              <select value={cityId} onChange={(e) => setCityId(e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
                <option value="">— select existing —</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <div className="text-center text-[10px] uppercase tracking-wider text-muted-foreground">or create new city</div>
            <input value={newCity} onChange={(e) => { setNewCity(e.target.value); setCityId(""); }}
              placeholder="New city name" disabled={!!cityId}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm disabled:opacity-40" />
            <Field label="Address (optional)">
              <input value={address} onChange={(e) => setAddress(e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" />
            </Field>
            <button onClick={create}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gold text-sm font-semibold text-gold-foreground">
              <Plus className="h-4 w-4" /> Create branch
            </button>
            <p className="text-[11px] text-muted-foreground">
              Unlimited branches & cities — system supports nationwide expansion.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}
