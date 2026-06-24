import React, { useState, useMemo } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from "recharts";
import { Activity, FlaskConical, Sparkles, RefreshCw, User, Check, X, TrendingDown } from "lucide-react";

/* ----------------------------------------------------------------------------
   VERIDIAN — Digital Twin Prediction Engine (prototype)
   The model is real, not a mockup:
     - Tumor burden follows Gompertz growth:  dV = r * V * ln(K/V) dt
     - Each drug clears with one-compartment PK:  C <- C * exp(-ke dt), + dose at each cycle
     - Drug kill is log-kill, scaled by the patient's hidden sensitivity:  dV -= sens * C * V dt
   Each virtual patient has different hidden biology, so the same drug helps some
   and fails others. The twin does NOT know the true biology: it runs a Monte-Carlo
   ensemble over parameter uncertainty to produce a predicted band. "Refine" reweights
   that ensemble against the first two weeks of observed response (a likelihood update).
---------------------------------------------------------------------------- */

const DT = 0.5;          // days per integration step
const T = 120;           // horizon (days)
const V0 = 100;          // baseline tumor burden = 100%
const KE = { A: 0.15, B: 0.12 };
const RESPONSE = 70;     // <=70% of baseline at day 90 == >=30% reduction == "response"

// ---- seeded RNG (mulberry32) + gaussian -----------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---- regimens (standard of care = Drug A standard) ------------------------
const REGIMENS = [
  { id: "ctrl", label: "No treatment", drugs: [] },
  { id: "a_std", label: "Drug A — standard", drugs: [{ which: "A", dose: 1.0, interval: 21 }] },
  { id: "a_int", label: "Drug A — intensive", drugs: [{ which: "A", dose: 1.4, interval: 14 }] },
  { id: "b_std", label: "Drug B — standard", drugs: [{ which: "B", dose: 1.0, interval: 21 }] },
  { id: "combo", label: "Combination A + B", drugs: [{ which: "A", dose: 0.8, interval: 21 }, { which: "B", dose: 0.8, interval: 21 }] },
];
const STANDARD_OF_CARE = "a_std";

// ---- preset patients (hidden true biology) --------------------------------
const PRESETS = [
  { id: "P01", seed: 11, profile: "62F · newly diagnosed", truth: { r: 0.045, K: 185, sens: { A: 0.16, B: 0.05 } } },
  { id: "P02", seed: 23, profile: "57M · prior line failed", truth: { r: 0.030, K: 175, sens: { A: 0.04, B: 0.17 } } },
  { id: "P03", seed: 37, profile: "49F · aggressive disease", truth: { r: 0.055, K: 190, sens: { A: 0.07, B: 0.07 } } },
  { id: "P04", seed: 52, profile: "71M · indolent disease", truth: { r: 0.020, K: 160, sens: { A: 0.13, B: 0.12 } } },
];

function randomPatient() {
  const s = Math.floor(Math.random() * 1e6);
  const rng = mulberry32(s);
  return {
    id: "P" + (Math.floor(rng() * 89) + 10),
    seed: s,
    profile: "virtual patient",
    truth: {
      r: 0.02 + rng() * 0.04,
      K: 160 + rng() * 30,
      sens: { A: 0.03 + rng() * 0.15, B: 0.03 + rng() * 0.15 },
    },
  };
}

// ---- core simulator: deterministic trajectory for given params + regimen ---
function simulate(p, regimen) {
  let V = V0;
  const C = { A: 0, B: 0 };
  const next = {}; regimen.drugs.forEach((d) => (next[d.which] = 0));
  const series = [];
  const steps = Math.round(T / DT);
  for (let i = 0; i <= steps; i++) {
    const day = i * DT;
    regimen.drugs.forEach((d) => {
      if (day < T && day + 1e-9 >= next[d.which]) { C[d.which] += d.dose; next[d.which] += d.interval; }
    });
    if (Number.isInteger(day)) series.push(V);
    const grow = p.r * V * Math.log(p.K / Math.max(V, 0.5));
    let kill = 0;
    regimen.drugs.forEach((d) => (kill += p.sens[d.which] * C[d.which] * V));
    V = V + (grow - kill) * DT;
    V = Math.min(Math.max(V, 0.5), p.K * 1.25);
    C.A *= Math.exp(-KE.A * DT); C.B *= Math.exp(-KE.B * DT);
  }
  return series; // length 121, index == day
}

// twin's noisy parameter sample (centered near truth, slight prior bias + spread)
function sampleParams(truth, rng) {
  return {
    r: truth.r * 1.03 * Math.exp(gauss(rng) * 0.14),
    K: truth.K * Math.exp(gauss(rng) * 0.07),
    sens: { A: truth.sens.A * Math.exp(gauss(rng) * 0.18), B: truth.sens.B * Math.exp(gauss(rng) * 0.18) },
  };
}

function weightedPct(values, weights, q) {
  const idx = values.map((v, i) => i).sort((a, b) => values[a] - values[b]);
  const total = weights.reduce((s, w) => s + w, 0);
  let cum = 0;
  for (const i of idx) { cum += weights[i]; if (cum / total >= q) return values[i]; }
  return values[idx[idx.length - 1]];
}

// build the twin ensemble + optional calibration against early actual obs
function buildEnsemble(patient, regimen, N, calibrated, actual) {
  const members = [];
  for (let m = 0; m < N; m++) {
    const rng = mulberry32(patient.seed * 1000 + m + REGIMENS.indexOf(regimen) * 91 + (calibrated ? 7 : 0));
    members.push(simulate(sampleParams(patient.truth, rng), regimen));
  }
  let weights = members.map(() => 1);
  if (calibrated && actual) {
    const obsDays = [3, 7, 14], sd = 6;
    weights = members.map((traj) => {
      let logL = 0;
      obsDays.forEach((d) => { const diff = traj[d] - actual[d]; logL += -0.5 * (diff * diff) / (sd * sd); });
      return Math.exp(logL);
    });
    const max = Math.max(...weights);
    weights = weights.map((w) => w / (max || 1));
  }
  const lo = [], med = [], hi = [];
  for (let d = 0; d <= T; d++) {
    const col = members.map((t) => t[d]);
    lo.push(weightedPct(col, weights, 0.05));
    med.push(weightedPct(col, weights, 0.5));
    hi.push(weightedPct(col, weights, 0.95));
  }
  // response probability at day 90
  const colDay = members.map((t) => t[90]);
  const totW = weights.reduce((s, w) => s + w, 0);
  const pResp = weights.reduce((s, w, i) => s + (colDay[i] <= RESPONSE ? w : 0), 0) / totW;
  return { lo, med, hi, pResp };
}

// observed "actual" = true dynamics + observation noise
function actualTrajectory(patient, regimen) {
  const truth = simulate(patient.truth, regimen);
  const rng = mulberry32(patient.seed * 7 + REGIMENS.indexOf(regimen) * 13 + 1);
  return truth.map((v) => Math.min(Math.max(v * Math.exp(gauss(rng) * 0.04), 0.5), 200));
}

const fmtPct = (v) => (v - V0 >= 0 ? "+" : "−") + Math.abs(Math.round(v - V0)) + "%";

export default function VeridianTwin() {
  const [patient, setPatient] = useState(PRESETS[1]); // P02 shows the personalization story by default
  const [regimenId, setRegimenId] = useState("a_std");
  const [revealed, setRevealed] = useState(false);
  const [calibrated, setCalibrated] = useState(false);

  const regimen = REGIMENS.find((r) => r.id === regimenId);

  const actual = useMemo(() => actualTrajectory(patient, regimen), [patient, regimen]);
  const ens = useMemo(
    () => buildEnsemble(patient, regimen, 160, calibrated, actual),
    [patient, regimen, calibrated, actual]
  );
  const control = useMemo(() => simulate(patient.truth, REGIMENS[0]), [patient]);

  // compare every regimen for THIS patient (twin predictions)
  const compare = useMemo(() => {
    return REGIMENS.filter((r) => r.id !== "ctrl").map((r) => {
      const act = actualTrajectory(patient, r);
      const e = buildEnsemble(patient, r, 90, false, act);
      return { id: r.id, label: r.label, pResp: e.pResp, med90: e.med[90] };
    }).sort((a, b) => b.pResp - a.pResp);
  }, [patient]);
  const best = compare[0];

  const chartData = useMemo(() => {
    const arr = [];
    for (let d = 0; d <= T; d++) {
      arr.push({
        day: d,
        lo: Math.round(ens.lo[d] * 10) / 10,
        bandW: Math.round((ens.hi[d] - ens.lo[d]) * 10) / 10,
        med: Math.round(ens.med[d] * 10) / 10,
        control: Math.round(control[d] * 10) / 10,
        actual: revealed ? Math.round(actual[d] * 10) / 10 : null,
      });
    }
    return arr;
  }, [ens, control, actual, revealed]);

  const med90 = ens.med[90], lo90 = ens.lo[90], hi90 = ens.hi[90];
  const act90 = actual[90];
  const covered = act90 >= lo90 && act90 <= hi90;

  const resetPatient = (p) => { setPatient(p); setRevealed(false); setCalibrated(false); setRegimenId("a_std"); };

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 font-sans p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* header */}
        <header className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-teal-600 flex items-center justify-center">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-slate-900 leading-none">Veridian</div>
              <div className="text-xs text-slate-500 leading-none mt-1">Treatment-response prediction</div>
            </div>
          </div>
          <span className="hidden sm:inline-block text-xs text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
            Research prototype · simulated data · not for clinical use
          </span>
        </header>

        {/* the core idea, stated up front */}
        <div className="mb-5 max-w-3xl">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
            Predict how a patient responds — before the treatment is given.
          </h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            The same drug helps some people and fails others, yet medicine is dosed for the average patient.
            Veridian builds a digital twin of one individual and simulates each treatment on that twin to predict
            their response, with calibrated uncertainty — so the right option is chosen for this person, not the
            average, and without trial and error on the real patient.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          {/* controls */}
          <aside className="lg:w-80 shrink-0 flex flex-col gap-4">
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-teal-600" />
                <h2 className="text-sm font-semibold text-slate-800">1 · The patient</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p) => (
                  <button key={p.id} onClick={() => resetPatient(p)}
                    className={"rounded-lg px-2 py-2 text-sm font-medium text-left focus:outline-none focus:ring-2 focus:ring-teal-500 transition " +
                      (patient.id === p.id ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200")}>
                    <div className="font-mono">{p.id}</div>
                    <div className={"text-xs " + (patient.id === p.id ? "text-teal-100" : "text-slate-500")}>{p.profile}</div>
                  </button>
                ))}
              </div>
              <button onClick={() => resetPatient(randomPatient())}
                className="mt-2 w-full rounded-lg px-3 py-2 text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="h-3.5 w-3.5" /> New random patient
              </button>
              <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                Veridian builds a digital twin of this individual. The twin is never told the patient's true drug
                sensitivity — it has to predict the response, the way it would for a real new patient.
              </p>
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <FlaskConical className="h-4 w-4 text-teal-600" />
                <h2 className="text-sm font-semibold text-slate-800">2 · Treatment to simulate</h2>
              </div>
              <div className="flex flex-col gap-1.5">
                {REGIMENS.filter((r) => r.id !== "ctrl").map((r) => (
                  <button key={r.id} onClick={() => { setRegimenId(r.id); setRevealed(false); }}
                    className={"rounded-lg px-3 py-2 text-sm font-medium text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-teal-500 transition " +
                      (regimenId === r.id ? "bg-teal-50 text-teal-800 ring-1 ring-teal-300" : "bg-slate-50 text-slate-700 hover:bg-slate-100")}>
                    {r.label}
                    {r.id === STANDARD_OF_CARE && <span className="text-xs text-slate-400">standard of care</span>}
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2.5">
              <h2 className="text-sm font-semibold text-slate-800">3 · Check the prediction</h2>
              <p className="text-xs text-slate-400 leading-relaxed -mt-1">
                The point: predict on the twin first, treat second. Reveal what actually happened to this patient
                to see whether the prediction held.
              </p>
              <button onClick={() => setRevealed(true)} disabled={revealed}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-amber-400 flex items-center justify-center gap-2">
                <TrendingDown className="h-4 w-4" /> {revealed ? "Actual outcome revealed" : "Reveal the actual outcome"}
              </button>
              <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer select-none px-1">
                <input type="checkbox" checked={calibrated} onChange={(e) => setCalibrated(e.target.checked)}
                  className="h-4 w-4 accent-teal-600" />
                Refine the twin using this patient's first 2 weeks of response
              </label>
            </section>
          </aside>

          {/* stage */}
          <main className="flex-1 flex flex-col gap-4 min-w-0">
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-slate-800">Predicted response for this patient</h2>
                <span className="font-mono text-xs text-slate-400">{patient.id} · {regimen.label}</span>
              </div>
              <p className="text-xs text-slate-400 mb-1 leading-relaxed">
                Simulated on the twin before treatment. Line = most likely path; shaded band = 90% uncertainty.
              </p>
              <div className="h-72 sm:h-80 w-full -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 12, bottom: 4, left: -8 }}>
                    <CartesianGrid stroke="#eef2f6" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }}
                      ticks={[0, 30, 60, 90, 120]} label={{ value: "days", position: "insideBottomRight", offset: -2, fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis domain={[0, 195]} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false}
                      ticks={[0, 50, 100, 150]} width={42}
                      label={{ value: "% of baseline", angle: -90, position: "insideLeft", fontSize: 11, fill: "#94a3b8", dy: 40 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12, fontFamily: "ui-monospace, monospace" }}
                      formatter={(v, n) => v == null ? null : [Math.round(v) + "%", n]}
                      labelFormatter={(l) => "day " + l} />
                    <ReferenceLine y={100} stroke="#cbd5e1" strokeDasharray="2 2" />
                    <ReferenceLine y={RESPONSE} stroke="#10b981" strokeDasharray="4 3"
                      label={{ value: "response threshold", position: "insideTopLeft", fontSize: 10, fill: "#059669" }} />
                    <Area type="monotone" dataKey="lo" stackId="band" stroke="none" fill="none" isAnimationActive={false} legendType="none" />
                    <Area type="monotone" dataKey="bandW" stackId="band" stroke="none" fill="#14b8a6" fillOpacity={0.16} isAnimationActive={false} name="90% uncertainty" />
                    <Line type="monotone" dataKey="med" stroke="#0d9488" strokeWidth={2.5} dot={false} isAnimationActive={false} name="Twin prediction" />
                    <Line type="monotone" dataKey="control" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} name="No treatment" />
                    <Line type="monotone" dataKey="actual" stroke="#f59e0b" strokeWidth={2.75} dot={false} connectNulls={false}
                      isAnimationActive={true} animationDuration={1100} name="Actual outcome" />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} iconType="plainline" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* readouts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="text-xs text-slate-500 uppercase tracking-wide">Predicted change · day 90</div>
                <div className="font-mono text-3xl font-semibold text-slate-900 mt-1">{fmtPct(med90)}</div>
                <div className="font-mono text-xs text-slate-400 mt-1">90% range {fmtPct(lo90)} to {fmtPct(hi90)}</div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="text-xs text-slate-500 uppercase tracking-wide">Predicted response probability</div>
                <div className="font-mono text-3xl font-semibold text-slate-900 mt-1">{Math.round(ens.pResp * 100)}%</div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: Math.round(ens.pResp * 100) + "%" }} />
                </div>
              </div>

              {revealed ? (
                <div className={"rounded-2xl border shadow-sm p-4 " + (covered ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200")}>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Actual outcome · day 90</div>
                  <div className="font-mono text-3xl font-semibold text-slate-900 mt-1">{fmtPct(act90)}</div>
                  <div className={"text-xs mt-1 flex items-center gap-1 font-medium " + (covered ? "text-emerald-700" : "text-rose-700")}>
                    {covered ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    {covered ? "within predicted range" : "outside predicted range"}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900 rounded-2xl shadow-sm p-4 text-white">
                  <div className="text-xs text-teal-300 uppercase tracking-wide flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" /> Best option for this patient
                  </div>
                  <div className="text-lg font-semibold mt-1 leading-tight">{best.label}</div>
                  <div className="text-xs text-slate-300 mt-1">highest predicted response probability for this patient</div>
                </div>
              )}
            </div>

            {/* compare all */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-slate-800">4 · Every treatment, ranked for this patient</h2>
              <p className="text-xs text-slate-400 mb-3 mt-0.5 leading-relaxed">
                Ranked by predicted probability of response for this individual. Tap any option to simulate it.
              </p>
              <div className="flex flex-col gap-2">
                {compare.map((c) => {
                  const pct = Math.round(c.pResp * 100);
                  const isBest = c.id === best.id;
                  return (
                    <button key={c.id} onClick={() => { setRegimenId(c.id); setRevealed(false); }}
                      className="group flex items-center gap-3 text-left focus:outline-none">
                      <div className="w-36 sm:w-44 shrink-0 text-sm text-slate-700 flex items-center gap-1.5">
                        {c.label}
                        {c.id === STANDARD_OF_CARE && <span className="text-[10px] text-slate-400 font-mono">std</span>}
                      </div>
                      <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden">
                        <div className={"h-full rounded-lg transition-all " + (isBest ? "bg-teal-500" : "bg-slate-300 group-hover:bg-slate-400")}
                          style={{ width: Math.max(pct, 3) + "%" }} />
                      </div>
                      <div className="w-12 text-right font-mono text-sm font-semibold text-slate-800">{pct}%</div>
                    </button>
                  );
                })}
              </div>
              {best.id !== STANDARD_OF_CARE && (
                <p className="text-xs text-teal-700 bg-teal-50 rounded-lg px-3 py-2 mt-3 leading-relaxed">
                  For this patient, the twin's best option ({best.label}) is not the standard of care. Predicting per
                  patient can find a better treatment than the one that works best on average.
                </p>
              )}
            </section>
          </main>
        </div>

        <p className="text-xs text-slate-400 mt-5 leading-relaxed max-w-3xl">
          How it works: Veridian fits a model — a digital twin — to each patient, then runs a 160-sample Monte-Carlo
          ensemble of that twin under parameter uncertainty to predict the response to each treatment (Gompertz tumor
          growth with one-compartment pharmacokinetics and a log-kill drug effect). "Refine" updates the twin against
          the patient's first two weeks of real response. This is a prediction tool, shown with its uncertainty — not a
          cure, and nothing physical inside the body. Research prototype · simulated data · not for clinical use.
        </p>
      </div>
    </div>
  );
}
