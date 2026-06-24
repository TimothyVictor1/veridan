import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Activity, Check, FlaskConical, Plus, RefreshCw, Search, Sparkles, X } from "lucide-react";

const SCAN_MS = 3600;
const TEST_MS = 2700;
const PASSING_COMBO = ["nanoclear-x", "immunorin-b", "stabilin-7"];

const DISEASE = {
  name: "Aster-17 Cellular Drift",
  site: "thoracic lymphatic cluster",
  severity: "moderate simulated risk",
  confidence: 94,
};

const CHEMICALS = [
  { id: "nanoclear-x", name: "NanoClear X", code: "NCX-41", className: "nanobot solvent", color: "cyan", note: "clears synthetic signal residue" },
  { id: "immunorin-b", name: "Immunorin B", code: "IMB-22", className: "immune modulator", color: "emerald", note: "boosts virtual immune response" },
  { id: "stabilin-7", name: "Stabilin-7", code: "STB-07", className: "metabolic stabilizer", color: "amber", note: "reduces organ stress in the twin" },
  { id: "hepagard", name: "HepaGard", code: "HPG-18", className: "liver shield", color: "lime", note: "protective but not curative" },
  { id: "myocline", name: "MyoCline", code: "MYC-03", className: "muscle pathway agent", color: "blue", note: "low anomaly effect" },
  { id: "neuroflux", name: "NeuroFlux", code: "NFX-12", className: "neural signal tuner", color: "violet", note: "wrong target system" },
  { id: "oxypherin", name: "OxyPherin", code: "OXP-90", className: "oxygen carrier", color: "sky", note: "raises signal noise" },
  { id: "cardiostat", name: "CardioStat", code: "CDS-11", className: "cardiac stabilizer", color: "rose", note: "stabilizes rhythm only" },
  { id: "inflamase", name: "Inflamase", code: "IFM-28", className: "inflammation blocker", color: "orange", note: "partial suppression" },
  { id: "lymphorin", name: "Lymphorin", code: "LYM-04", className: "lymphatic tracer", color: "teal", note: "diagnostic signal only" },
];

function sortIds(ids) {
  return [...ids].sort().join("|");
}

function isPassingCombo(selected) {
  return sortIds(selected.map((item) => item.id)) === sortIds(PASSING_COMBO);
}

function colorClasses(color) {
  const map = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    lime: "border-lime-200 bg-lime-50 text-lime-800",
    orange: "border-orange-200 bg-orange-50 text-orange-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    teal: "border-teal-200 bg-teal-50 text-teal-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
  };
  return map[color] || "border-slate-200 bg-slate-50 text-slate-800";
}

function BodyTwin3D({ phase, isDragOver, onDrop, onDragOver, onDragLeave }) {
  const mountRef = useRef(null);
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.25, 6.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const body = new THREE.Group();
    scene.add(body);

    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x5eead4,
      emissive: 0x0e7490,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.42,
      roughness: 0.28,
      metalness: 0.08,
      transmission: 0.12,
    });
    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.9 });
    const anomalyMaterial = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.82 });
    const boneMaterial = new THREE.MeshBasicMaterial({ color: 0xecfeff, transparent: true, opacity: 0.2 });

    function addMesh(geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.scale.set(...scale);
      mesh.rotation.set(...rotation);
      body.add(mesh);
      return mesh;
    }

    addMesh(new THREE.SphereGeometry(0.34, 36, 24), bodyMaterial, [0, 2.45, 0], [0.9, 1.08, 0.9]);
    addMesh(new THREE.CapsuleGeometry(0.52, 1.25, 20, 36), bodyMaterial, [0, 1.25, 0], [0.92, 1, 0.48]);
    addMesh(new THREE.SphereGeometry(0.5, 36, 18), bodyMaterial, [0, 0.28, 0], [0.92, 0.45, 0.5]);
    addMesh(new THREE.CapsuleGeometry(0.1, 0.46, 12, 20), bodyMaterial, [0, 1.93, 0], [1, 1, 0.9]);
    addMesh(new THREE.CapsuleGeometry(0.12, 1.38, 14, 24), bodyMaterial, [-0.72, 1.1, 0], [0.9, 1, 0.9], [0, 0, -0.2]);
    addMesh(new THREE.CapsuleGeometry(0.12, 1.38, 14, 24), bodyMaterial, [0.72, 1.1, 0], [0.9, 1, 0.9], [0, 0, 0.2]);
    addMesh(new THREE.SphereGeometry(0.14, 18, 14), bodyMaterial, [-0.86, 0.33, 0], [0.9, 0.9, 0.9]);
    addMesh(new THREE.SphereGeometry(0.14, 18, 14), bodyMaterial, [0.86, 0.33, 0], [0.9, 0.9, 0.9]);
    addMesh(new THREE.CapsuleGeometry(0.15, 1.55, 16, 28), bodyMaterial, [-0.24, -0.82, 0], [0.9, 1, 0.85], [0, 0, 0.08]);
    addMesh(new THREE.CapsuleGeometry(0.15, 1.55, 16, 28), bodyMaterial, [0.24, -0.82, 0], [0.9, 1, 0.85], [0, 0, -0.08]);
    addMesh(new THREE.BoxGeometry(0.38, 0.12, 0.58), bodyMaterial, [-0.28, -1.72, 0.08], [1, 1, 1], [0, 0.08, 0]);
    addMesh(new THREE.BoxGeometry(0.38, 0.12, 0.58), bodyMaterial, [0.28, -1.72, 0.08], [1, 1, 1], [0, -0.08, 0]);

    addMesh(new THREE.CapsuleGeometry(0.028, 2.28, 8, 12), boneMaterial, [0, 0.94, 0.06]);
    addMesh(new THREE.TorusGeometry(0.44, 0.014, 8, 80), coreMaterial, [0, 1.42, 0.02], [1, 0.35, 0.18], [Math.PI / 2, 0, 0]);
    addMesh(new THREE.TorusGeometry(0.34, 0.012, 8, 80), coreMaterial, [0, 0.84, 0.02], [1, 0.28, 0.18], [Math.PI / 2, 0, 0]);

    const anomaly = addMesh(new THREE.SphereGeometry(0.18, 32, 20), anomalyMaterial, [0.24, 1.08, 0.2]);
    const anomalyHalo = addMesh(new THREE.SphereGeometry(0.32, 32, 20), anomalyMaterial, [0.24, 1.08, 0.2]);
    anomalyHalo.material = anomalyMaterial.clone();
    anomalyHalo.material.opacity = 0.18;

    const rings = [];
    for (let i = 0; i < 5; i += 1) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.06 + i * 0.025, 0.008, 8, 120), mat);
      ring.rotation.x = Math.PI / 2;
      body.add(ring);
      rings.push(ring);
    }

    const stream = new THREE.Group();
    scene.add(stream);
    const streamDots = [];
    for (let i = 0; i < 34; i += 1) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.022 + (i % 3) * 0.004, 10, 10), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x67e8f9 : 0xfacc15, transparent: true, opacity: 0.9 }));
      stream.add(dot);
      streamDots.push(dot);
    }

    const ambient = new THREE.AmbientLight(0x88ffff, 1.2);
    scene.add(ambient);
    const key = new THREE.PointLight(0x67e8f9, 5, 9);
    key.position.set(2.7, 2.8, 3.2);
    scene.add(key);
    const rim = new THREE.PointLight(0xfbbf24, 2.2, 7);
    rim.position.set(-2.2, 0.8, 2.4);
    scene.add(rim);

    const clock = new THREE.Clock();
    let frameId = 0;

    function resize() {
      const width = mount.clientWidth || 640;
      const height = mount.clientHeight || 640;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    function render() {
      const elapsed = clock.getElapsedTime();
      const currentPhase = phaseRef.current;
      body.rotation.y = elapsed * 0.38;
      body.rotation.x = Math.sin(elapsed * 0.45) * 0.03;

      const isScanning = currentPhase === "scanning";
      const isTesting = currentPhase === "testing";
      const isPassed = currentPhase === "passed";
      const isFailed = currentPhase === "failed";

      bodyMaterial.emissiveIntensity = isTesting ? 0.95 : isPassed ? 0.78 : isFailed ? 0.38 : 0.48;
      bodyMaterial.color.set(isFailed ? 0x93a4b7 : isPassed ? 0x6ee7b7 : 0x5eead4);
      anomalyMaterial.color.set(isPassed ? 0x22c55e : isFailed ? 0xef4444 : 0xf59e0b);
      anomalyMaterial.opacity = isPassed ? 0.28 : 0.82;
      anomaly.scale.setScalar(1 + Math.sin(elapsed * (isTesting ? 12 : 4)) * (isTesting ? 0.24 : 0.12));
      anomalyHalo.scale.setScalar(1.1 + Math.sin(elapsed * 3.2) * 0.25);
      anomalyHalo.visible = !isPassed;

      rings.forEach((ring, index) => {
        ring.visible = isScanning || isTesting;
        ring.position.y = -1.75 + ((elapsed * (isTesting ? 1.3 : 0.8) + index * 0.58) % 4.45);
        ring.material.opacity = isTesting ? 0.58 : 0.34;
        ring.scale.setScalar(1 + Math.sin(elapsed * 2 + index) * 0.03);
      });

      stream.visible = isTesting;
      streamDots.forEach((dot, index) => {
        const p = (elapsed * 0.72 + index * 0.037) % 1;
        dot.position.x = -2.8 + p * 3.05;
        dot.position.y = 1.85 - p * 0.82 + Math.sin(elapsed * 4 + index) * 0.1;
        dot.position.z = 0.58 + Math.cos(index * 2.4 + elapsed) * 0.22;
        dot.material.opacity = 0.25 + p * 0.75;
      });

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    }

    resize();
    render();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        }
      });
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      data-testid="body-drop-target"
      className={(isDragOver ? "border-cyan-200 bg-cyan-300/10" : "border-white/10 bg-black/20") + " relative min-h-[640px] overflow-hidden rounded-lg border transition"}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <div className="stage-grid absolute inset-0 opacity-60" />
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 p-4">
        <div className="rounded-md border border-cyan-200/25 bg-slate-950/70 px-3 py-2 text-white backdrop-blur">
          <div className="text-xs text-cyan-200">3D body twin</div>
          <div className="font-mono text-sm">{phase === "scanning" ? "scanning" : phase === "testing" ? "compound trial" : "ready"}</div>
        </div>
        <div className="rounded-md border border-white/10 bg-slate-950/70 px-3 py-2 text-right text-white backdrop-blur">
          <div className="text-xs text-slate-400">drop target</div>
          <div className="font-mono text-sm">thoracic anomaly</div>
        </div>
      </div>
      {phase === "scanning" && <div className="scan-sweep absolute inset-x-8 top-10 z-20 h-1 rounded-full bg-cyan-200 shadow-[0_0_28px_rgba(103,232,249,0.95)]" />}
      {isDragOver && <div className="absolute inset-4 z-20 rounded-lg border border-cyan-200 bg-cyan-200/10 shadow-[0_0_40px_rgba(103,232,249,0.35)]" />}
      <div ref={mountRef} className="absolute inset-0 z-0" />
    </div>
  );
}

function ChemicalSearch({ query, setQuery, selected, addChemical }) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CHEMICALS.slice(0, 6);
    return CHEMICALS.filter((chemical) => [chemical.name, chemical.code, chemical.className, chemical.note].join(" ").toLowerCase().includes(q));
  }, [query]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Search className="h-4 w-4 text-cyan-700" />
        <h2 className="text-sm font-semibold text-slate-800">Chemical search</h2>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search NanoClear, immune, stabilizer..."
          className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
        />
      </div>
      <div className="mt-3 grid gap-2">
        {filtered.map((chemical) => {
          const alreadySelected = selected.some((item) => item.id === chemical.id);
          return (
            <button
              key={chemical.id}
              type="button"
              onClick={() => addChemical(chemical)}
              disabled={alreadySelected}
              className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-cyan-200 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900">{chemical.name}</span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">{chemical.code} / {chemical.className}</span>
              </span>
              <span className={(alreadySelected ? "border-slate-200 bg-slate-100 text-slate-400" : colorClasses(chemical.color)) + " grid h-8 w-8 place-items-center rounded-md border"}>
                {alreadySelected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ComboShelf({ selected, removeChemical, clearCombo, startDrag, canTest, onQuickTest }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-cyan-700" />
          <h2 className="text-sm font-semibold text-slate-800">Selected combination</h2>
        </div>
        <button type="button" onClick={clearCombo} className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Clear selected chemicals"><RefreshCw className="h-4 w-4" /></button>
      </div>

      <div
        data-testid="combo-shelf"
        draggable={selected.length > 0}
        onDragStart={startDrag}
        className={(selected.length > 0 ? "cursor-grab border-cyan-200 bg-cyan-50" : "border-dashed border-slate-200 bg-slate-50") + " min-h-32 rounded-md border p-3 transition active:cursor-grabbing"}
      >
        {selected.length === 0 ? (
          <div className="grid h-24 place-items-center text-center text-sm text-slate-400">No chemicals selected</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selected.map((chemical) => (
              <span key={chemical.id} className={(colorClasses(chemical.color)) + " inline-flex max-w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-semibold"}>
                <span className="truncate">{chemical.name}</span>
                <button type="button" onClick={(event) => { event.stopPropagation(); removeChemical(chemical.id); }} className="rounded-sm p-0.5 hover:bg-white/70" aria-label={`Remove ${chemical.name}`}><X className="h-3.5 w-3.5" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onQuickTest}
        disabled={!canTest}
        className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Sparkles className="h-4 w-4" />
        Test selected combo
      </button>
    </section>
  );
}

function StatusPanel({ scanComplete, phase, result, selected, resetScan }) {
  const selectedNames = selected.map((item) => item.name).join(" + ") || "none";
  return (
    <aside className="grid gap-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-700" />
          <h2 className="text-sm font-semibold text-slate-800">Scan status</h2>
        </div>
        <div className="space-y-3">
          <ProgressRow label="Nanobot sweep" value={scanComplete ? 100 : 64} active={!scanComplete} />
          <ProgressRow label="Twin alignment" value={scanComplete ? 96 : 58} active={!scanComplete} />
          <ProgressRow label="Anomaly lock" value={scanComplete ? 94 : 31} active={!scanComplete} />
        </div>
        <button type="button" onClick={resetScan} className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><RefreshCw className="h-4 w-4" />Restart scan</button>
      </section>

      <section className={(scanComplete ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white") + " rounded-lg border p-4 shadow-sm"}>
        <div className="text-xs text-slate-500">Disease found</div>
        {scanComplete ? (
          <div className="mt-2">
            <div className="text-lg font-bold text-slate-950">{DISEASE.name}</div>
            <div className="mt-1 text-sm text-slate-700">{DISEASE.site}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-white/70 p-2"><span className="block text-slate-500">Severity</span><span className="font-semibold text-amber-800">{DISEASE.severity}</span></div>
              <div className="rounded-md bg-white/70 p-2"><span className="block text-slate-500">Confidence</span><span className="font-mono font-semibold text-slate-900">{DISEASE.confidence}%</span></div>
            </div>
          </div>
        ) : (
          <div className="mt-2 text-sm text-slate-500">Scanning body twin...</div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-xs text-slate-500">Current payload</div>
        <div className="min-h-10 rounded-md bg-slate-50 p-3 text-sm font-semibold text-slate-800">{selectedNames}</div>
        {phase === "testing" && <div className="mt-3 rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm font-semibold text-cyan-800">Testing on digital twin...</div>}
        {result && (
          <div data-testid="test-result" className={(result.passed ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800") + " mt-3 rounded-md border p-3"}>
            <div className="flex items-center gap-2 text-sm font-bold">{result.passed ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}{result.passed ? "Combination passed" : "Combination failed"}</div>
            <p className="mt-1 text-xs leading-5">{result.message}</p>
          </div>
        )}
      </section>
    </aside>
  );
}

function ProgressRow({ label, value, active }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs"><span className="text-slate-500">{label}</span><span className="font-mono text-slate-800">{value}%</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={(active ? "scan-progress" : "bg-cyan-500") + " h-full rounded-full"} style={{ width: `${value}%` }} /></div>
    </div>
  );
}

export default function VeridianTwin() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [phase, setPhase] = useState("scanning");
  const [scanComplete, setScanComplete] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setScanComplete(true);
      setPhase("ready");
    }, SCAN_MS);
    return () => window.clearTimeout(timer);
  }, []);

  function addChemical(chemical) {
    setSelected((items) => {
      if (items.some((item) => item.id === chemical.id) || items.length >= 5) return items;
      return [...items, chemical];
    });
    setResult(null);
    if (phase === "passed" || phase === "failed") setPhase("ready");
  }

  function removeChemical(id) {
    setSelected((items) => items.filter((item) => item.id !== id));
    setResult(null);
    if (phase === "passed" || phase === "failed") setPhase("ready");
  }

  function clearCombo() {
    setSelected([]);
    setResult(null);
    if (scanComplete) setPhase("ready");
  }

  function resetScan() {
    setPhase("scanning");
    setScanComplete(false);
    setResult(null);
    window.setTimeout(() => {
      setScanComplete(true);
      setPhase("ready");
    }, SCAN_MS);
  }

  function runTest() {
    if (!scanComplete || selected.length === 0 || phase === "testing") return;
    setIsDragOver(false);
    setResult(null);
    setPhase("testing");
    const payload = [...selected];
    window.setTimeout(() => {
      const passed = isPassingCombo(payload);
      setResult({
        passed,
        message: passed
          ? "Aster-17 signal collapsed inside the simulated twin with acceptable virtual organ stress."
          : "The anomaly remained active or organ stress exceeded the simulated safety window.",
      });
      setPhase(passed ? "passed" : "failed");
    }, TEST_MS);
  }

  function startDrag(event) {
    if (selected.length === 0) return;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/veridian-combo", selected.map((item) => item.id).join(","));
  }

  function handleDragOver(event) {
    if (!scanComplete || selected.length === 0 || phase === "testing") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }

  function handleDrop(event) {
    event.preventDefault();
    if (!event.dataTransfer.getData("application/veridian-combo")) return;
    runTest();
  }

  const canTest = scanComplete && selected.length > 0 && phase !== "testing";

  return (
    <div className="min-h-screen bg-[#f3f7f8] text-slate-900">
      <div className="mx-auto grid w-full max-w-[1600px] gap-5 p-4 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950"><Activity className="h-5 w-5 text-cyan-200" /></div>
            <div><div className="text-xl font-bold leading-none text-slate-950">Veridian</div><div className="mt-1 text-xs leading-none text-slate-500">interactive digital twin testing prototype</div></div>
          </div>
          <span className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 shadow-sm">Fictional demo / simulated disease / fake chemicals</span>
        </header>

        <main className="grid gap-5 xl:grid-cols-[360px_minmax(520px,1fr)_360px]">
          <div className="grid content-start gap-4">
            <ChemicalSearch query={query} setQuery={setQuery} selected={selected} addChemical={addChemical} />
            <ComboShelf selected={selected} removeChemical={removeChemical} clearCombo={clearCombo} startDrag={startDrag} canTest={canTest} onQuickTest={runTest} />
          </div>

          <section className="rounded-lg border border-slate-900 bg-[#071014] p-3 shadow-2xl">
            <BodyTwin3D phase={phase} isDragOver={isDragOver} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={() => setIsDragOver(false)} />
          </section>

          <StatusPanel scanComplete={scanComplete} phase={phase} result={result} selected={selected} resetScan={resetScan} />
        </main>
      </div>
    </div>
  );
}