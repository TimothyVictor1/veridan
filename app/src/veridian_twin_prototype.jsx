import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip,
} from "recharts";
import { Activity, Check, Droplet, FlaskConical, Heart, Plus, RefreshCw, Search, Sparkles, X, Zap } from "lucide-react";

/* ----------------------------------------------------------------------------
   VERIDIAN — cardiac digital-twin response lab (visual prototype)
   Light "health monitoring" dashboard styling. A glossy beating 3D heart is the
   hero; testing a compound combination animates the drug into the twin and the
   vitals react live. All numbers are simulated for a fictional demo.
---------------------------------------------------------------------------- */

const SCAN_MS = 3200;
const TEST_MS = 3000;
const PASSING_COMBO = ["nanoclear-x", "immunorin-b", "stabilin-7"];

const DISEASE = {
  name: "Aster-17 Cellular Drift",
  site: "left ventricular wall",
  severity: "moderate simulated risk",
  confidence: 94,
};

const CHEMICALS = [
  { id: "nanoclear-x", name: "NanoClear X", code: "NCX-41", className: "nanobot solvent", color: "orange", note: "clears synthetic signal residue" },
  { id: "immunorin-b", name: "Immunorin B", code: "IMB-22", className: "immune modulator", color: "rose", note: "boosts virtual immune response" },
  { id: "stabilin-7", name: "Stabilin-7", code: "STB-07", className: "metabolic stabilizer", color: "amber", note: "reduces organ stress in the twin" },
  { id: "hepagard", name: "HepaGard", code: "HPG-18", className: "liver shield", color: "lime", note: "protective but not curative" },
  { id: "myocline", name: "MyoCline", code: "MYC-03", className: "muscle pathway agent", color: "blue", note: "low anomaly effect" },
  { id: "neuroflux", name: "NeuroFlux", code: "NFX-12", className: "neural signal tuner", color: "violet", note: "wrong target system" },
  { id: "oxypherin", name: "OxyPherin", code: "OXP-90", className: "oxygen carrier", color: "sky", note: "raises signal noise" },
  { id: "cardiostat", name: "CardioStat", code: "CDS-11", className: "cardiac stabilizer", color: "teal", note: "stabilizes rhythm only" },
  { id: "inflamase", name: "Inflamase", code: "IFM-28", className: "inflammation blocker", color: "orange", note: "partial suppression" },
  { id: "lymphorin", name: "Lymphorin", code: "LYM-04", className: "lymphatic tracer", color: "sky", note: "diagnostic signal only" },
];

// vitals — baseline (with anomaly) vs healthy (after a passing combo)
const VITALS = {
  base: { hrv: 58, bpm: 95, sys: 138, dia: 88, stress: "High" },
  good: { hrv: 92, bpm: 72, sys: 118, dia: 76, stress: "Low" },
};

function sortIds(ids) {
  return [...ids].sort().join("|");
}
function isPassingCombo(selected) {
  return sortIds(selected.map((item) => item.id)) === sortIds(PASSING_COMBO);
}

// chip styling per compound (light theme)
function colorClasses(color) {
  const map = {
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    lime: "border-lime-200 bg-lime-50 text-lime-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    teal: "border-teal-200 bg-teal-50 text-teal-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
  };
  return map[color] || "border-slate-200 bg-slate-50 text-slate-700";
}

// deterministic pseudo-random for stable chart data
function seeded(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HRV_LABELS = ["12am", "4am", "8am", "12pm", "4pm", "8pm"];
function makeHrv(healthy) {
  const rng = seeded(healthy ? 99 : 7);
  const center = healthy ? 95 : 72;
  return Array.from({ length: 26 }, (_, i) => {
    const mid = center + Math.sin(i * 0.5) * 14 + (rng() - 0.5) * 26;
    const span = 10 + rng() * 26;
    const lo = Math.max(8, mid - span / 2);
    return { i, base: lo, span, label: i % 5 === 0 ? HRV_LABELS[Math.min(5, i / 5)] : "" };
  });
}

function makeEcg(healthy) {
  const rng = seeded(healthy ? 51 : 3);
  const pts = [];
  for (let beat = 0; beat < 4; beat += 1) {
    const amp = healthy ? 1 : 0.78 + rng() * 0.5;
    const shape = [0, 0.04, 0, -0.06, 1.0 * amp, -0.16, 0.12, 0, 0.18, 0.06, 0];
    shape.forEach((v, k) => pts.push({ x: beat * 11 + k, y: v + (rng() - 0.5) * 0.05 }));
  }
  return pts;
}

/* ───────────────────────── 3D heart ───────────────────────── */
function HeartTwin3D({ phase, isDragOver, onDrop, onDragOver, onDragLeave }) {
  const mountRef = useRef(null);
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0.1, 6.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);
    const heart = new THREE.Group();
    root.add(heart);

    // glossy "wet tissue" material
    const heartMat = new THREE.MeshPhysicalMaterial({
      color: 0xb1271a, roughness: 0.34, metalness: 0.0,
      clearcoat: 1.0, clearcoatRoughness: 0.28, sheen: 0.6, sheenColor: 0xff6a4d,
      emissive: 0x4a0d06, emissiveIntensity: 0.5,
    });

    // procedural heart: overlapping lobes + tapered tip read as a glossy heart
    function lobe(r, pos, scale) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 40), heartMat);
      m.position.set(...pos); m.scale.set(...scale); heart.add(m); return m;
    }
    lobe(0.92, [-0.52, 0.46, 0], [1, 1.05, 1]);
    lobe(0.86, [0.52, 0.5, 0], [1, 1.05, 1]);
    lobe(1.02, [0, 0.0, 0.04], [1.06, 1.0, 1.0]);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.5, 48, 1, true), heartMat);
    tip.position.set(0.04, -1.06, 0); tip.rotation.x = Math.PI; tip.scale.set(0.92, 1, 0.86);
    heart.add(tip);

    // great vessels (aorta + pulmonary arch) as tubes on top
    const vesselMat = new THREE.MeshPhysicalMaterial({ color: 0xc23a26, roughness: 0.4, clearcoat: 0.8, emissive: 0x3a0a05, emissiveIntensity: 0.4 });
    function vessel(points, radius) {
      const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, radius, 16, false), vesselMat);
      heart.add(mesh); return mesh;
    }
    vessel([[-0.1, 0.9, 0.1], [-0.05, 1.5, 0.0], [0.25, 1.95, -0.1], [0.6, 1.6, -0.2]], 0.16);
    vessel([[0.25, 1.0, 0.1], [0.35, 1.6, 0.05], [0.15, 2.1, 0.0]], 0.12);
    vessel([[-0.45, 1.0, 0.15], [-0.55, 1.55, 0.1], [-0.85, 1.85, 0.0]], 0.1);

    // surface veins (faint, darker)
    const veinMat = new THREE.MeshBasicMaterial({ color: 0x6e1410, transparent: true, opacity: 0.5 });
    const veinSeeds = [[0.1, 0.4], [-0.3, 0.2], [0.4, 0.1], [-0.1, -0.3], [0.25, -0.5]];
    veinSeeds.forEach(([ox, oy], k) => {
      const pts = Array.from({ length: 6 }, (_, j) => new THREE.Vector3(ox + Math.sin(j + k) * 0.18, oy - j * 0.22, 0.95 - j * 0.02));
      const curve = new THREE.CatmullRomCurve3(pts);
      heart.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.02, 6, false), veinMat));
    });

    // anomaly patch on the ventricular wall
    const anomalyMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.9 });
    const anomaly = new THREE.Mesh(new THREE.SphereGeometry(0.2, 28, 24), anomalyMat);
    anomaly.position.set(0.42, -0.1, 0.92); heart.add(anomaly);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.25 });
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.34, 28, 24), haloMat);
    halo.position.copy(anomaly.position); heart.add(halo);

    // drug particles that stream into the heart during a test
    const particles = new THREE.Group(); scene.add(particles);
    const dots = [];
    for (let i = 0; i < 46; i += 1) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.04 + (i % 3) * 0.012, 12, 12),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0xf97316 : 0xfcd34d, transparent: true, opacity: 0.9 }));
      const ang = (i / 46) * Math.PI * 2;
      d.userData = { ang, rad: 2.6 + (i % 5) * 0.18, y: -1.6 + (i % 7) * 0.5, sp: 0.5 + (i % 4) * 0.16 };
      particles.add(d); dots.push(d);
    }

    // lighting tuned for a light backdrop — bright key, warm rim
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(2.5, 3.5, 4); scene.add(key);
    const warm = new THREE.PointLight(0xffb27a, 3, 12); warm.position.set(-3, 1, 3); scene.add(warm);
    const rim = new THREE.PointLight(0xff5a3c, 2.5, 12); rim.position.set(0, -2, -3); scene.add(rim);

    // optional: drop a real model into /models/heart.glb to replace the procedural one
    new GLTFLoader().load(
      "/models/heart.glb",
      (gltf) => {
        heart.children.slice().forEach((c) => { if (c !== anomaly && c !== halo) heart.remove(c); });
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const s = 2.6 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(s);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center.multiplyScalar(s));
        heart.add(model);
      },
      undefined,
      () => { /* no model file — keep the procedural heart */ }
    );

    const clock = new THREE.Clock();
    let frameId = 0;
    function resize() {
      const w = mount.clientWidth || 480, h = mount.clientHeight || 480;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    // a "lub-dub" beat curve
    function beat(t, rate) {
      const p = (t * rate) % 1;
      const lub = Math.exp(-Math.pow((p - 0.0) * 7, 2));
      const dub = Math.exp(-Math.pow((p - 0.28) * 9, 2)) * 0.6;
      return lub + dub;
    }
    function render() {
      const t = clock.getElapsedTime();
      const ph = phaseRef.current;
      const testing = ph === "testing", passed = ph === "passed", failed = ph === "failed";
      const rate = testing ? 2.2 : passed ? 1.0 : 1.5;

      root.rotation.y = Math.sin(t * 0.25) * 0.35;
      root.position.y = Math.sin(t * 0.8) * 0.05;
      const b = beat(t, rate);
      heart.scale.setScalar(1 + b * (testing ? 0.085 : 0.055));

      heartMat.emissiveIntensity = 0.4 + b * 0.5 + (testing ? 0.2 : 0);
      heartMat.color.set(failed ? 0x8f1f15 : passed ? 0xc23a2a : 0xb1271a);

      const ax = passed ? 0x22c55e : failed ? 0xef4444 : 0xf59e0b;
      anomalyMat.color.set(ax); haloMat.color.set(ax);
      const grow = 1 + Math.sin(t * (testing ? 10 : 4)) * (testing ? 0.3 : 0.14);
      anomaly.scale.setScalar(passed ? Math.max(0.05, 1 - (t % 100)) * 0 + 0.18 : grow);
      anomaly.visible = !passed;
      halo.visible = !passed;
      halo.scale.setScalar(1.2 + Math.sin(t * 3) * 0.3);
      halo.material.opacity = passed ? 0 : 0.22;

      particles.visible = testing;
      dots.forEach((d) => {
        const u = d.userData;
        u.rad -= 0.02 * u.sp;
        if (u.rad < 0.4) u.rad = 2.8;
        const a = u.ang + t * 0.6 * u.sp;
        d.position.set(Math.cos(a) * u.rad, u.y * (u.rad / 2.8) + Math.sin(t * 2 + u.ang) * 0.1, Math.sin(a) * u.rad * 0.5 + 0.6);
        d.material.opacity = Math.min(1, (2.8 - u.rad) / 1.6);
      });

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    }
    resize(); render();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      data-testid="body-drop-target"
      onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
      className={(isDragOver ? "ring-2 ring-orange-400/70" : "ring-0") + " relative h-full w-full rounded-[28px] transition"}
    >
      {/* soft radial glow behind the heart */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(242,106,58,0.22),rgba(242,106,58,0.06)_45%,transparent_70%)] blur-2xl" />
      <div ref={mountRef} className="absolute inset-0" />
      {isDragOver && (
        <div className="absolute inset-3 z-10 grid place-items-center rounded-3xl border-2 border-dashed border-orange-400/70 bg-orange-100/30 backdrop-blur-[1px]">
          <span className="rounded-full bg-white/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-orange-600 shadow">release to administer</span>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── small UI bits ───────────────────────── */
const CARD = "rounded-[28px] bg-[#edebe8] shadow-[0_18px_50px_-24px_rgba(20,15,10,0.35)]";
const GLASS = "rounded-2xl bg-white/60 backdrop-blur-md shadow-[0_8px_24px_-12px_rgba(20,15,10,0.25)]";
const LABEL = "text-[11px] font-medium tracking-wide text-stone-500";

function StatPill({ label, value, unit }) {
  return (
    <div className={GLASS + " px-4 py-2.5"}>
      <div className={LABEL}>{label}</div>
      <div className="mt-0.5 text-stone-900">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {unit && <span className="ml-1 text-sm text-stone-400">{unit}</span>}
      </div>
    </div>
  );
}

function HrvBars({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -16 }} barCategoryGap="22%">
        <defs>
          <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f78a4f" />
            <stop offset="100%" stopColor="#ef5f2b" />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#a8a29e" }} interval={0} />
        <YAxis hide domain={[0, 130]} />
        <Tooltip cursor={{ fill: "rgba(0,0,0,0.03)" }} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", fontSize: 12 }}
          formatter={(v, n) => n === "span" ? [Math.round(v) + " ms", "variability"] : null} />
        <Bar dataKey="base" stackId="a" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="span" stackId="a" radius={[8, 8, 8, 8]} fill="url(#hrvGrad)" isAnimationActive animationDuration={700}>
          {data.map((d, i) => <Cell key={i} fillOpacity={0.55 + (i % 3) * 0.2} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function EcgLine({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <YAxis hide domain={[-0.6, 1.2]} />
        <XAxis hide dataKey="x" />
        <Line type="monotone" dataKey="y" stroke="#f26a3a" strokeWidth={2.4} dot={false} isAnimationActive animationDuration={900} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function MetricCard({ icon, label, value, unit }) {
  return (
    <div className={CARD + " p-5"}>
      <div className="mb-6 flex items-center justify-between">
        <span className="text-sm font-medium text-stone-600">{label}</span>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-orange-100 text-orange-500">{icon}</span>
      </div>
      <div className="text-stone-900">
        <span className="text-4xl font-semibold tracking-tight">{value}</span>
        <span className="ml-1.5 text-xl text-stone-400">{unit}</span>
      </div>
    </div>
  );
}

/* ───────────────────────── app ───────────────────────── */
export default function VeridianTwin() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [phase, setPhase] = useState("scanning");
  const [scanComplete, setScanComplete] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [result, setResult] = useState(null);
  const [healthy, setHealthy] = useState(false); // vitals flip to "good" on a passing combo

  useEffect(() => {
    const t = window.setTimeout(() => { setScanComplete(true); setPhase("ready"); }, SCAN_MS);
    return () => window.clearTimeout(t);
  }, []);

  const vitals = healthy ? VITALS.good : VITALS.base;
  const hrvData = useMemo(() => makeHrv(healthy), [healthy]);
  const ecgData = useMemo(() => makeEcg(healthy), [healthy]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CHEMICALS.slice(0, 6);
    return CHEMICALS.filter((c) => [c.name, c.code, c.className, c.note].join(" ").toLowerCase().includes(q));
  }, [query]);

  function addChemical(c) {
    setSelected((items) => (items.some((i) => i.id === c.id) || items.length >= 5 ? items : [...items, c]));
    setResult(null);
    if (phase === "passed" || phase === "failed") { setPhase("ready"); setHealthy(false); }
  }
  function removeChemical(id) {
    setSelected((items) => items.filter((i) => i.id !== id));
    setResult(null);
    if (phase === "passed" || phase === "failed") { setPhase("ready"); setHealthy(false); }
  }
  function clearCombo() {
    setSelected([]); setResult(null); setHealthy(false);
    if (scanComplete) setPhase("ready");
  }
  function resetScan() {
    setPhase("scanning"); setScanComplete(false); setResult(null); setHealthy(false);
    window.setTimeout(() => { setScanComplete(true); setPhase("ready"); }, SCAN_MS);
  }
  function runTest() {
    if (!scanComplete || selected.length === 0 || phase === "testing") return;
    setIsDragOver(false); setResult(null); setPhase("testing");
    const payload = [...selected];
    window.setTimeout(() => {
      const passed = isPassingCombo(payload);
      setResult({
        passed,
        message: passed
          ? "Aster-17 signal collapsed inside the simulated twin with acceptable virtual organ stress."
          : "The anomaly remained active or organ stress exceeded the simulated safety window.",
      });
      setHealthy(passed);
      setPhase(passed ? "passed" : "failed");
    }, TEST_MS);
  }
  function startDrag(e) {
    if (selected.length === 0) return;
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("application/veridian-combo", selected.map((i) => i.id).join(","));
  }
  function handleDragOver(e) {
    if (!scanComplete || selected.length === 0 || phase === "testing") return;
    e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setIsDragOver(true);
  }
  function handleDrop(e) {
    e.preventDefault();
    if (!e.dataTransfer.getData("application/veridian-combo")) return;
    runTest();
  }
  const canTest = scanComplete && selected.length > 0 && phase !== "testing";
  const stageLabel = phase === "scanning" ? "Scanning twin" : phase === "testing" ? "Administering" : phase === "passed" ? "Treatment effective" : phase === "failed" ? "No response" : "Ready";

  return (
    <div className="min-h-screen bg-[#efedea] px-4 py-5 text-stone-900 sm:px-6 lg:px-8" style={{ fontFeatureSettings: '"ss01"' }}>
      <div className="mx-auto max-w-[1500px]">

        {/* top bar */}
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-[0_8px_20px_-6px_rgba(242,106,58,0.7)]">
              <Heart className="h-5 w-5 text-white" fill="currentColor" />
            </div>
            <div>
              <div className="text-lg font-semibold leading-none tracking-tight">Veridian</div>
              <div className="mt-1 text-xs leading-none text-stone-500">Cardiac digital-twin lab</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-stone-600 shadow-sm">
              <span className={(phase === "scanning" || phase === "testing" ? "bg-orange-400 animate-pulse" : phase === "passed" ? "bg-emerald-500" : phase === "failed" ? "bg-rose-500" : "bg-stone-400") + " h-2 w-2 rounded-full"} />
              {stageLabel}
            </span>
            <span className="hidden rounded-full bg-white/70 px-3 py-1.5 text-[11px] text-stone-400 shadow-sm sm:inline">Research prototype · simulated data · not for clinical use</span>
          </div>
        </header>

        {/* main grid */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">

          {/* ── controls rail ── */}
          <div className="flex flex-col gap-5 xl:col-span-3">
            <section className={CARD + " p-5"}>
              <div className="mb-3 flex items-center gap-2">
                <Search className="h-4 w-4 text-orange-500" />
                <h2 className="text-sm font-semibold text-stone-700">Compound search</h2>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search NanoClear, immune…"
                  className="h-11 w-full rounded-2xl border border-stone-200/80 bg-white/70 pl-9 pr-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </div>
              <div className="mt-3 grid gap-2">
                {filtered.map((c) => {
                  const sel = selected.some((i) => i.id === c.id);
                  return (
                    <button key={c.id} type="button" onClick={() => addChemical(c)} disabled={sel}
                      className="group grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-stone-200/70 bg-white/60 p-3 text-left transition hover:border-orange-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-stone-800">{c.name}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-stone-400">{c.code} · {c.className}</span>
                      </span>
                      <span className={(sel ? "border-stone-200 bg-stone-100 text-stone-400" : colorClasses(c.color)) + " grid h-8 w-8 place-items-center rounded-xl border transition group-hover:scale-105"}>
                        {sel ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className={CARD + " p-5"}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-orange-500" />
                  <h2 className="text-sm font-semibold text-stone-700">Selected combination</h2>
                </div>
                <button type="button" onClick={clearCombo} className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-200/60 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100" aria-label="Clear"><RefreshCw className="h-4 w-4" /></button>
              </div>
              <div data-testid="combo-shelf" draggable={selected.length > 0} onDragStart={startDrag}
                className={(selected.length > 0 ? "cursor-grab border-orange-200 bg-orange-50/60" : "border-dashed border-stone-300/70 bg-white/40") + " min-h-[88px] rounded-2xl border p-3 transition active:cursor-grabbing"}>
                {selected.length === 0 ? (
                  <div className="grid h-[68px] place-items-center text-center text-xs leading-5 text-stone-400">Tap compounds to build a combination,<br />then drag onto the heart to administer.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selected.map((c) => (
                      <span key={c.id} className={colorClasses(c.color) + " inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold"}>
                        {c.name}
                        <button type="button" onClick={(e) => { e.stopPropagation(); removeChemical(c.id); }} className="rounded p-0.5 hover:bg-black/5" aria-label={`Remove ${c.name}`}><X className="h-3.5 w-3.5" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={runTest} disabled={!canTest}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 text-sm font-semibold text-white shadow-[0_10px_24px_-8px_rgba(242,106,58,0.8)] transition hover:shadow-[0_12px_28px_-6px_rgba(242,106,58,0.9)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-not-allowed disabled:from-stone-300 disabled:to-stone-300 disabled:text-stone-500 disabled:shadow-none">
                <Sparkles className="h-4 w-4" /> Administer & test
              </button>
              {result && (
                <div data-testid="test-result" className={(result.passed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700") + " mt-3 rounded-2xl border p-3"}>
                  <div className="flex items-center gap-1.5 text-sm font-bold">{result.passed ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}{result.passed ? "Treatment effective" : "No meaningful response"}</div>
                  <p className="mt-1 text-xs leading-5 text-stone-500">{result.message}</p>
                </div>
              )}
            </section>
          </div>

          {/* ── hero heart ── */}
          <div className="xl:col-span-5">
            <section className={CARD + " relative flex h-full min-h-[460px] flex-col overflow-hidden p-6"}>
              <div className="relative z-10 max-w-[55%]">
                <div className="text-lg font-medium text-stone-500">Hi, Clinician!</div>
                <h1 className="mt-1 text-3xl font-semibold leading-[1.1] tracking-tight text-stone-900">Let’s test<br />your treatment</h1>
              </div>
              {/* the heart fills the card */}
              <div className="absolute inset-0">
                <HeartTwin3D phase={phase} isDragOver={isDragOver} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={() => setIsDragOver(false)} />
              </div>
              {/* floating glass pills */}
              <div className="absolute bottom-6 left-6 z-10"><StatPill label="Anomaly" value={phase === "passed" ? "Cleared" : DISEASE.confidence + "%"} /></div>
              <div className="absolute right-6 top-1/2 z-10 -translate-y-1/2"><StatPill label="Ave. variability" value={vitals.hrv} unit="ms" /></div>
              <div className="absolute bottom-6 right-6 z-10"><StatPill label="Stress level" value={vitals.stress} /></div>
            </section>
          </div>

          {/* ── HRV chart ── */}
          <div className="xl:col-span-4">
            <section className={CARD + " flex h-full min-h-[460px] flex-col p-6"}>
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold tracking-tight text-stone-800">Heart Rate Variability</h2>
                <div className="text-stone-900"><span className="text-2xl font-semibold">{vitals.hrv}</span><span className="ml-1 text-base text-stone-400">ms</span></div>
              </div>
              <div className="mt-4 min-h-0 flex-1">
                <HrvBars data={hrvData} />
              </div>
            </section>
          </div>

          {/* ── ECG recording ── */}
          <div className="xl:col-span-7">
            <section className={CARD + " p-6"}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight text-stone-800">ECG Recording</h2>
                <span className="text-xs text-stone-400">live twin signal {phase === "testing" ? "· responding" : ""}</span>
              </div>
              <div className="h-40 w-full">
                <EcgLine data={ecgData} />
              </div>
            </section>
          </div>

          {/* ── metric cards ── */}
          <div className="grid grid-cols-2 gap-5 xl:col-span-5">
            <MetricCard icon={<Heart className="h-4 w-4" fill="currentColor" />} label="ECG" value={vitals.bpm} unit="bpm" />
            <MetricCard icon={<Activity className="h-4 w-4" />} label="Blood Pressure" value={`${vitals.sys}/${vitals.dia}`} unit="mmHg" />
            <div className={CARD + " col-span-2 flex items-center justify-between p-5"}>
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-orange-100 text-orange-500">{healthy ? <Zap className="h-4 w-4" /> : <Droplet className="h-4 w-4" />}</span>
                <div>
                  <div className="text-sm font-semibold text-stone-700">{DISEASE.name}</div>
                  <div className="text-xs text-stone-400">{DISEASE.site} · {healthy ? "responding to treatment" : DISEASE.severity}</div>
                </div>
              </div>
              <button type="button" onClick={resetScan} className="flex h-9 items-center gap-1.5 rounded-full bg-white/70 px-3 text-xs font-semibold text-stone-600 shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100"><RefreshCw className="h-3.5 w-3.5" />Rescan</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
