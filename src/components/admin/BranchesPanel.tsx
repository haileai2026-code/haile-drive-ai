import { useState } from "react";
import { useStore } from "@/lib/data-store";
import { Network, Plus, Trash2, MapPin } from "lucide-react";

const ISRAELI_CITIES = [
  "תל אביב", "ירושלים", "חיפה", "באר שבע", "אשדוד", "אשקלון", "נתניה",
  "רחובות", "רמלה", "לוד", "פתח תקווה", "ראשון לציון", "הרצליה", "כפר סבא",
  "רעננה", "מודיעין", "בית שמש", "קריית גת", "דימונה", "אופקים",
  "קריית מלאכי", "יבנה", "גדרה", "נס ציונה", "חולון", "בת ים",
  "גבעתיים", "רמת גן", "בני ברק", "קריית שמונה",
];

const NEW_CITY_VALUE = "__new__";

export function BranchesPanel() {
  const { branches, cities, addBranch, removeBranch, addCity } = useStore();
  const [name, setName] = useState("");
  const [citySelect, setCitySelect] = useState("");
  const [newCity, setNewCity] = useState("");
  const [address, setAddress] = useState("");

  const create = () => {
    if (!name.trim()) return alert("יש להזין שם סניף");
    let cityName = "";
    let cid = "";

    if (citySelect === NEW_CITY_VALUE) {
      if (!newCity.trim()) return alert("יש להזין שם עיר חדשה");
      cityName = newCity.trim();
    } else if (citySelect.startsWith("existing:")) {
      cid = citySelect.slice("existing:".length);
    } else if (citySelect.startsWith("preset:")) {
      cityName = citySelect.slice("preset:".length);
    } else {
      return alert("יש לבחור עיר");
    }

    if (!cid && cityName) {
      const existing = cities.find((c) => c.name.trim() === cityName);
      cid = existing ? existing.id : addCity(cityName).id;
    }
    if (!cid) return;

    addBranch({ name: name.trim(), cityId: cid, address: address.trim() || undefined });
    setName(""); setNewCity(""); setAddress(""); setCitySelect("");
  };

  const existingCityNames = new Set(cities.map((c) => c.name.trim()));
  const presetUnused = ISRAELI_CITIES.filter((n) => !existingCityNames.has(n));

  return (
    <div dir="rtl">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Network className="h-4 w-4 text-gold" /> כל הסניפים ({branches.length})
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
                    onClick={() => confirm(`למחוק את ${b.name}?`) && removeBranch(b.id)}
                    className="rounded-md p-2 text-rose-400 hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
            {branches.length === 0 && (
              <li className="py-8 text-center text-sm text-muted-foreground">עדיין אין סניפים.</li>
            )}
          </ul>
        </section>

        <aside className="rounded-2xl border border-gold/30 bg-card/40 p-4">
          <h3 className="text-sm font-semibold text-gold">הוסף סניף</h3>
          <div className="mt-3 space-y-3">
            <Field label="שם הסניף">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: סניף אשדוד"
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
            </Field>
            <Field label="עיר">
              <select
                value={citySelect}
                onChange={(e) => setCitySelect(e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">— בחר/י עיר —</option>
                {cities.length > 0 && (
                  <optgroup label="ערים שכבר נוספו">
                    {cities.map((c) => (
                      <option key={c.id} value={`existing:${c.id}`}>{c.name}</option>
                    ))}
                  </optgroup>
                )}
                {presetUnused.length > 0 && (
                  <optgroup label="ערים בישראל">
                    {presetUnused.map((n) => (
                      <option key={n} value={`preset:${n}`}>{n}</option>
                    ))}
                  </optgroup>
                )}
                <option value={NEW_CITY_VALUE}>➕ הוסף עיר חדשה...</option>
              </select>
            </Field>
            {citySelect === NEW_CITY_VALUE && (
              <input
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                placeholder="שם העיר החדשה"
                className="h-10 w-full rounded-xl border border-gold/40 bg-background px-3 text-sm"
              />
            )}
            <Field label="כתובת (לא חובה)">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="רחוב ומספר"
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
            </Field>
            <button
              onClick={create}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gold text-sm font-semibold text-gold-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> צור סניף
            </button>
            <p className="text-[11px] text-center text-muted-foreground">
              המערכת תומכת בפריסה ארצית ללא הגבלת סניפים וערים
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
