import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { Activity, FlaskConical, Sparkles, RefreshCw, User, Check, X, TrendingDown, ChevronRight } from "lucide-react";

/* ----------------------------------------------------------------------------
   VERIDIAN — treatment-response prediction engine (prototype)
     - Tumor burden follows Gompertz growth:  dV = r * V * ln(K/V) dt
     - Each drug clears with one-compartment PK:  C <- C * exp(-ke dt), + dose at each cycle
     - Drug kill is log-kill, scaled by the patient's hidden sensitivity:  dV -= sens * C * V dt
   The twin does NOT know the true biology: it runs a Monte-Carlo ensemble over
   parameter uncertainty to produce a predicted band. "Refine" reweights that
   ensemble against the first two weeks of observed response.
   --- MATH/ENGINE BELOW IS UNCHANGED. Only the presentation is the dashboard. ---
---------------------------------------------------------------------------- */

const DT = 0.5;
const T = 120;
const V0 = 100;
const KE = { A: 0.15, B: 0.12 };
const RESPONSE = 70;

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

const REGIMENS = [
  { id: "ctrl", label: "No treatment", drugs: [] },
  { id: "a_std", label: "Drug A — standard", drugs: [{ which: "A", dose: 1.0, interval: 21 }] },
  { id: "a_int", label: "Drug A — intensive", drugs: [{ which: "A", dose: 1.4, interval: 14 }] },
  { id: "b_std", label: "Drug B — standard", drugs: [{ which: "B", dose: 1.0, interval: 21 }] },
  { id: "combo", label: "Combination A + B", drugs: [{ which: "A", dose: 0.8, interval: 21 }, { which: "B", dose: 0.8, interval: 21 }] },
];
const STANDARD_OF_CARE = "a_std";

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
    truth: { r: 0.02 + rng() * 0.04, K: 160 + rng() * 30, sens: { A: 0.03 + rng() * 0.15, B: 0.03 + rng() * 0.15 } },
  };
}

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
  return series;
}

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
  const colDay = members.map((t) => t[90]);
  const totW = weights.reduce((s, w) => s + w, 0);
  const pResp = weights.reduce((s, w, i) => s + (colDay[i] <= RESPONSE ? w : 0), 0) / totW;
  return { lo, med, hi, pResp };
}

function actualTrajectory(patient, regimen) {
  const truth = simulate(patient.truth, regimen);
  const rng = mulberry32(patient.seed * 7 + REGIMENS.indexOf(regimen) * 13 + 1);
  return truth.map((v) => Math.min(Math.max(v * Math.exp(gauss(rng) * 0.04), 0.5), 200));
}

const fmtPct = (v) => (v - V0 >= 0 ? "+" : "−") + Math.abs(Math.round(v - V0)) + "%";

/* ───────── design tokens (cardiac dashboard skin) ───────── */
const CARD = "rounded-[26px] bg-[#edebe8] shadow-[0_18px_50px_-26px_rgba(20,15,10,0.4)]";
const GLASS = "rounded-2xl bg-white/65 backdrop-blur-md shadow-[0_8px_24px_-12px_rgba(20,15,10,0.3)]";
const EYEBROW = "text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400";
const C_ORANGE = "#f26a3a", C_ORANGE_SOFT = "#f7a06f", C_ACTUAL = "#334155", C_BASE = "#c9c6c2", C_GREEN = "#10b981";

/* ───────── 3D body twin — interactive, heat-map glow ───────── */
function BodyTwin3D({ med90 }) {
  const mountRef = useRef(null);
  const burdenRef = useRef(med90);
  useEffect(() => { burdenRef.current = med90; }, [med90]);

  // zoom state accessible inside animation loop
  const zoomRef = useRef(6.4);
  const [zoom, setZoom] = useState(6.4);

  const changeZoom = (delta) => {
    const next = Math.min(10, Math.max(3.5, zoomRef.current + delta));
    zoomRef.current = next;
    setZoom(next);
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.3, zoomRef.current);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);

    // silver-blue body material — PBR, slight metallic sheen
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xc8d8e0, roughness: 0.38, metalness: 0.12,
      transparent: true, opacity: 0.82,
      clearcoat: 0.9, clearcoatRoughness: 0.25,
      emissive: 0x6fa8bc, emissiveIntensity: 0.06,
    });

    function mesh(geo, pos, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
      const m = new THREE.Mesh(geo, bodyMat);
      m.position.set(...pos); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz);
      m.castShadow = true; root.add(m); return m;
    }

    // head
    mesh(new THREE.SphereGeometry(0.32, 40, 28), [0, 2.54, 0], 0.96, 1.04, 0.94);
    // neck
    mesh(new THREE.CapsuleGeometry(0.10, 0.28, 12, 20), [0, 2.12, 0], 1, 1, 0.88);
    // upper chest — wide
    mesh(new THREE.CapsuleGeometry(0.50, 0.70, 20, 36), [0, 1.60, 0], 1.06, 1, 0.52);
    // shoulder caps
    mesh(new THREE.SphereGeometry(0.20, 24, 18), [-0.72, 1.72, 0]);
    mesh(new THREE.SphereGeometry(0.20, 24, 18), [0.72, 1.72, 0]);
    // lower torso / abdomen
    mesh(new THREE.CapsuleGeometry(0.44, 0.50, 18, 32), [0, 0.92, 0], 1.02, 1, 0.56);
    // pelvis
    mesh(new THREE.SphereGeometry(0.44, 32, 22), [0, 0.30, 0], 1.06, 0.50, 0.70);
    // upper arms
    mesh(new THREE.CapsuleGeometry(0.11, 0.78, 14, 22), [-0.82, 1.28, 0], 1, 1, 0.96, 0, 0, -0.22);
    mesh(new THREE.CapsuleGeometry(0.11, 0.78, 14, 22), [0.82, 1.28, 0], 1, 1, 0.96, 0, 0, 0.22);
    // elbow bumps
    mesh(new THREE.SphereGeometry(0.12, 18, 14), [-0.96, 0.72, 0]);
    mesh(new THREE.SphereGeometry(0.12, 18, 14), [0.96, 0.72, 0]);
    // lower arms
    mesh(new THREE.CapsuleGeometry(0.09, 0.68, 12, 20), [-1.04, 0.18, 0], 1, 1, 0.92, 0, 0, 0.12);
    mesh(new THREE.CapsuleGeometry(0.09, 0.68, 12, 20), [1.04, 0.18, 0], 1, 1, 0.92, 0, 0, -0.12);
    // hands
    mesh(new THREE.SphereGeometry(0.10, 16, 12), [-1.06, -0.22, 0], 1.1, 0.8, 0.6);
    mesh(new THREE.SphereGeometry(0.10, 16, 12), [1.06, -0.22, 0], 1.1, 0.8, 0.6);
    // upper legs
    mesh(new THREE.CapsuleGeometry(0.165, 1.10, 16, 28), [-0.26, -0.86, 0], 0.95, 1, 0.90, 0, 0, 0.06);
    mesh(new THREE.CapsuleGeometry(0.165, 1.10, 16, 28), [0.26, -0.86, 0], 0.95, 1, 0.90, 0, 0, -0.06);
    // knee bumps
    mesh(new THREE.SphereGeometry(0.16, 20, 16), [-0.28, -1.56, 0], 0.9, 0.8, 0.75);
    mesh(new THREE.SphereGeometry(0.16, 20, 16), [0.28, -1.56, 0], 0.9, 0.8, 0.75);
    // lower legs
    mesh(new THREE.CapsuleGeometry(0.12, 1.02, 14, 24), [-0.26, -2.24, 0], 0.92, 1, 0.82);
    mesh(new THREE.CapsuleGeometry(0.12, 1.02, 14, 24), [0.26, -2.24, 0], 0.92, 1, 0.82);
    // feet
    mesh(new THREE.BoxGeometry(0.30, 0.11, 0.54), [-0.28, -2.84, 0.08]);
    mesh(new THREE.BoxGeometry(0.30, 0.11, 0.54), [0.28, -2.84, 0.08]);

    // tumor site — heat-map layers (no floating blob, glows from inside body surface)
    const tumorPos = new THREE.Vector3(0.14, 1.12, 0.32);
    const glowMats = [
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.0, depthWrite: false }),
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.0, depthWrite: false }),
    ];
    const glowOuter = new THREE.Mesh(new THREE.SphereGeometry(0.52, 32, 24), glowMats[0]);
    glowOuter.position.copy(tumorPos); root.add(glowOuter);
    const glowCore = new THREE.Mesh(new THREE.SphereGeometry(0.26, 28, 20), glowMats[1]);
    glowCore.position.copy(tumorPos); root.add(glowCore);

    // warm point light at tumor site to illuminate body surface
    const tumorLight = new THREE.PointLight(0xf97316, 0, 3.5);
    tumorLight.position.copy(tumorPos); root.add(tumorLight);

    // scene lighting
    scene.add(new THREE.AmbientLight(0xe8f0f4, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(2.2, 4, 4); key.castShadow = true; scene.add(key);
    const fill = new THREE.DirectionalLight(0xbbd4e0, 1.0);
    fill.position.set(-3, 1, 2); scene.add(fill);
    const rim = new THREE.DirectionalLight(0x7aafc0, 0.7);
    rim.position.set(0, -2, -3); scene.add(rim);

    // drag-to-rotate state
    let isDragging = false, lastX = 0, lastY = 0;
    let rotY = 0, rotX = 0, velY = 0, velX = 0;
    let autoRotate = true, idleTimer = null;

    const resumeAutoRotate = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { autoRotate = true; }, 2200);
    };

    const onPointerDown = (e) => {
      isDragging = true; autoRotate = false;
      lastX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      lastY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      velY = 0; velX = 0;
      e.preventDefault();
    };
    const onPointerMove = (e) => {
      if (!isDragging) return;
      const cx = e.clientX ?? e.touches?.[0]?.clientX ?? lastX;
      const cy = e.clientY ?? e.touches?.[0]?.clientY ?? lastY;
      velY = (cx - lastX) * 0.012; velX = (cy - lastY) * 0.010;
      rotY += velY; rotX = Math.max(-0.65, Math.min(0.65, rotX + velX));
      lastX = cx; lastY = cy;
    };
    const onPointerUp = () => { isDragging = false; resumeAutoRotate(); };
    const onWheel = (e) => {
      e.preventDefault();
      autoRotate = false;
      zoomRef.current = Math.min(10, Math.max(3.5, zoomRef.current + e.deltaY * 0.008));
      setZoom(zoomRef.current);
      resumeAutoRotate();
    };

    const canvas = renderer.domElement;
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);
    canvas.addEventListener("touchstart", onPointerDown, { passive: false });
    canvas.addEventListener("touchmove", onPointerMove, { passive: false });
    canvas.addEventListener("touchend", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const clock = new THREE.Clock();
    let frameId = 0;
    function resize() {
      const w = mount.clientWidth || 340, h = mount.clientHeight || 480;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }

    function render() {
      const t = clock.getElapsedTime();

      // smooth zoom
      const tz = zoomRef.current;
      camera.position.z += (tz - camera.position.z) * 0.08;
      camera.updateProjectionMatrix();

      // rotation
      if (autoRotate) {
        rotY += 0.005;
        rotX += (0 - rotX) * 0.03;
      } else if (!isDragging) {
        velY *= 0.88; velX *= 0.88;
        rotY += velY; rotX += velX;
        rotX = Math.max(-0.65, Math.min(0.65, rotX));
      }
      root.rotation.y = rotY;
      root.rotation.x = rotX;
      root.position.y = Math.sin(t * 0.8) * 0.03;

      // heat-map glow intensity driven by tumor burden
      const b = burdenRef.current;
      const respond = b <= RESPONSE;
      const intensity = respond ? Math.max(0.05, (b / 70) * 0.35) : Math.min(1.0, (b / 100) * 0.8);
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.5);
      const outerOpacity = intensity * (0.18 + pulse * 0.08);
      const coreOpacity = intensity * (0.38 + pulse * 0.12);
      const lightInt = intensity * (1.8 + pulse * 0.5);

      glowMats[0].color.setHex(respond ? 0xf59e0b : 0xef4444);
      glowMats[1].color.setHex(respond ? 0xfcd34d : 0xf97316);
      glowMats[0].opacity = outerOpacity;
      glowMats[1].opacity = coreOpacity;
      tumorLight.color.setHex(respond ? 0xf59e0b : 0xef4444);
      tumorLight.intensity = lightInt;

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    }
    resize(); render();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    return () => {
      cancelAnimationFrame(frameId); clearTimeout(idleTimer); ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerUp);
      canvas.removeEventListener("touchstart", onPointerDown);
      canvas.removeEventListener("touchmove", onPointerMove);
      canvas.removeEventListener("touchend", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      renderer.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  const b = med90;
  const respond = b <= RESPONSE;

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* ambient background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[20px]">
        <div className="absolute left-1/2 top-1/2 h-[55%] w-[55%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{ background: respond ? "radial-gradient(circle,rgba(245,158,11,0.13),transparent 70%)" : "radial-gradient(circle,rgba(239,68,68,0.17),transparent 70%)" }} />
      </div>

      {/* canvas */}
      <div ref={mountRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" style={{ touchAction: "none" }} />

      {/* zoom controls */}
      <div className="pointer-events-auto absolute bottom-16 right-3 z-20 flex flex-col gap-1">
        <button onClick={() => changeZoom(-0.8)}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/80 text-sm font-bold text-stone-600 shadow backdrop-blur-sm transition hover:bg-white hover:shadow-md">+</button>
        <button onClick={() => changeZoom(0.8)}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/80 text-sm font-bold text-stone-600 shadow backdrop-blur-sm transition hover:bg-white hover:shadow-md">−</button>
      </div>

      {/* drag hint */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
        <span className="rounded-full bg-white/60 px-2.5 py-1 text-[10px] text-stone-400 backdrop-blur-sm">drag to rotate · scroll to zoom</span>
      </div>
    </div>
  );
}

/* ───────── chart tooltip (light) ───────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const rows = payload.filter((p) => p.value != null && (p.dataKey === "med" || p.dataKey === "control" || p.dataKey === "actual"));
  if (!rows.length) return null;
  const meta = {
    med: ["Twin prediction", C_ORANGE],
    control: ["No treatment", "#9a9a9a"],
    actual: ["Actual outcome", C_ACTUAL],
  };
  return (
    <div className="rounded-xl bg-white px-3 py-2.5 text-xs shadow-[0_10px_30px_-8px_rgba(0,0,0,0.25)]">
      <div className="mb-1 font-semibold uppercase tracking-wider text-stone-400">Day {label}</div>
      {rows.map((r) => (
        <div key={r.dataKey} className="flex items-center gap-2 leading-5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: meta[r.dataKey][1] }} />
          <span className="w-24 text-stone-500">{meta[r.dataKey][0]}</span>
          <span className="font-semibold text-stone-800">{Math.round(r.value)}%</span>
        </div>
      ))}
    </div>
  );
}

function LegendRow({ revealed }) {
  const items = [
    { c: C_ORANGE, label: "Twin prediction", dash: false },
    { c: C_BASE, label: "No treatment", dash: true },
    ...(revealed ? [{ c: C_ACTUAL, label: "Actual outcome", dash: false }] : []),
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-[11px] text-stone-500">
          <svg width="18" height="8">{i.dash
            ? <line x1="0" y1="4" x2="18" y2="4" stroke={i.c} strokeWidth="2" strokeDasharray="4 3" />
            : <line x1="0" y1="4" x2="18" y2="4" stroke={i.c} strokeWidth="2.5" />}</svg>
          {i.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5 text-[11px] text-stone-500">
        <span className="h-3 w-4 rounded-sm" style={{ background: C_ORANGE_SOFT, opacity: 0.4 }} /> 90% uncertainty
      </span>
    </div>
  );
}

/* ───────── app ───────── */
export default function VeridianTwin() {
  const [patient, setPatient] = useState(PRESETS[1]);
  const [regimenId, setRegimenId] = useState("a_std");
  const [revealed, setRevealed] = useState(false);
  const [calibrated, setCalibrated] = useState(false);

  const regimen = REGIMENS.find((r) => r.id === regimenId);
  const actual = useMemo(() => actualTrajectory(patient, regimen), [patient, regimen]);
  const ens = useMemo(() => buildEnsemble(patient, regimen, 160, calibrated, actual), [patient, regimen, calibrated, actual]);
  const control = useMemo(() => simulate(patient.truth, REGIMENS[0]), [patient]);

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
    <div className="min-h-screen bg-[#efedea] px-4 py-5 text-stone-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">

        {/* top bar */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-[0_8px_20px_-6px_rgba(242,106,58,0.7)]">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-lg font-semibold leading-none tracking-tight">Veridian</div>
              <div className="mt-1 text-xs leading-none text-stone-500">Treatment-response prediction</div>
            </div>
          </div>
          <span className="rounded-full bg-white/70 px-3 py-1.5 text-[11px] text-stone-500 shadow-sm">Research prototype · simulated data · not for clinical use</span>
        </header>

        {/* core idea */}
        <div className="mb-5 max-w-3xl">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-stone-900 sm:text-[28px]">
            Predict how a patient responds — before the treatment is given.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            The same drug helps some people and fails others, yet medicine is dosed for the average patient. Veridian
            builds a digital twin of one individual and simulates each treatment on that twin to predict their response,
            with calibrated uncertainty — so the right option is chosen for this person, not the average, and without
            trial and error on the real patient.
          </p>
        </div>

        <div className="flex flex-col gap-5 xl:flex-row">

          {/* ── controls rail ── */}
          <aside className="flex shrink-0 flex-col gap-5 xl:w-[320px]">
            <section className={CARD + " p-5"}>
              <div className="mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-orange-500" />
                <h2 className="text-sm font-semibold text-stone-700">1 · The patient</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p) => (
                  <button key={p.id} onClick={() => resetPatient(p)}
                    className={"rounded-2xl p-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100 " +
                      (patient.id === p.id ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md" : "bg-white/70 text-stone-700 hover:bg-white")}>
                    <div className="font-mono text-sm font-semibold">{p.id}</div>
                    <div className={"mt-0.5 text-[11px] leading-tight " + (patient.id === p.id ? "text-orange-50" : "text-stone-400")}>{p.profile}</div>
                  </button>
                ))}
              </div>
              <button onClick={() => resetPatient(randomPatient())}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-stone-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-stone-300">
                <RefreshCw className="h-3.5 w-3.5" /> New patient
              </button>
              <p className="mt-3 text-[11px] leading-relaxed text-stone-400">
                Veridian builds a digital twin of this individual. The twin is never told the patient's true drug
                sensitivity — it predicts the response, the way it would for a real new patient.
              </p>
            </section>

            <section className={CARD + " p-5"}>
              <div className="mb-3 flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-orange-500" />
                <h2 className="text-sm font-semibold text-stone-700">2 · Treatment to simulate</h2>
              </div>
              <div className="flex flex-col gap-1.5">
                {REGIMENS.filter((r) => r.id !== "ctrl").map((r) => (
                  <button key={r.id} onClick={() => { setRegimenId(r.id); setRevealed(false); }}
                    className={"group flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100 " +
                      (regimenId === r.id ? "bg-orange-50 text-orange-900 ring-1 ring-orange-200" : "bg-white/60 text-stone-700 hover:bg-white")}>
                    <span className={regimenId === r.id ? "font-semibold" : "font-medium"}>{r.label}</span>
                    <span className="flex items-center gap-1.5">
                      {r.id === STANDARD_OF_CARE && <span className="rounded bg-stone-200/70 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-stone-500">SOC</span>}
                      <ChevronRight className={"h-3.5 w-3.5 " + (regimenId === r.id ? "text-orange-500" : "text-stone-300")} />
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className={CARD + " p-5"}>
              <h2 className="text-sm font-semibold text-stone-700">3 · Check the prediction</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-stone-400">
                The point: predict on the twin first, treat second. Reveal what actually happened to this patient to
                see whether the prediction held.
              </p>
              <button onClick={() => setRevealed(true)} disabled={revealed}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 text-sm font-semibold text-white shadow-[0_10px_24px_-8px_rgba(242,106,58,0.8)] transition hover:shadow-[0_12px_28px_-6px_rgba(242,106,58,0.9)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-not-allowed disabled:from-stone-300 disabled:to-stone-300 disabled:text-stone-500 disabled:shadow-none">
                <TrendingDown className="h-4 w-4" /> {revealed ? "Actual outcome revealed" : "Reveal the actual outcome"}
              </button>
              <label className="mt-2.5 flex cursor-pointer select-none items-center gap-2.5 px-1 text-xs text-stone-600">
                <input type="checkbox" checked={calibrated} onChange={(e) => setCalibrated(e.target.checked)} className="h-4 w-4 rounded accent-orange-500" />
                Refine the twin using the first 2 weeks of response
              </label>
            </section>
          </aside>

          {/* ── main stage ── */}
          <main className="flex min-w-0 flex-1 flex-col gap-5">

            {/* hero: prediction chart + twin */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <section className={CARD + " relative lg:col-span-2 p-5 sm:p-6"}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={EYEBROW}>Predicted response · this patient</div>
                    <h2 className="mt-1 text-lg font-semibold tracking-tight text-stone-800">
                      {regimen.label} <span className="font-mono text-sm font-normal text-stone-400">· {patient.id}</span>
                    </h2>
                  </div>
                  <LegendRow revealed={revealed} />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-stone-400">
                  Simulated on the twin before treatment. Line = most likely path; shaded band = 90% uncertainty.
                </p>
                <div className="mt-3 h-72 w-full sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 8, right: 10, bottom: 4, left: -12 }}>
                      <defs>
                        <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C_ORANGE_SOFT} stopOpacity={0.5} />
                          <stop offset="100%" stopColor={C_ORANGE_SOFT} stopOpacity={0.18} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#e3e0dc" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#a8a29e", fontFamily: "ui-monospace, monospace" }} tickLine={false}
                        axisLine={{ stroke: "#dcd8d3" }} ticks={[0, 30, 60, 90, 120]} tickFormatter={(v) => v + "d"} />
                      <YAxis domain={[0, 195]} tick={{ fontSize: 11, fill: "#a8a29e", fontFamily: "ui-monospace, monospace" }} tickLine={false}
                        axisLine={false} ticks={[0, 50, 100, 150]} tickFormatter={(v) => v + "%"} width={40} />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={100} stroke="#d6d3ce" strokeDasharray="2 2" />
                      <ReferenceLine y={RESPONSE} stroke={C_GREEN} strokeDasharray="4 3"
                        label={{ value: "response threshold", position: "insideTopRight", fontSize: 10, fill: "#059669" }} />
                      <Area type="monotone" dataKey="lo" stackId="band" stroke="none" fill="none" isAnimationActive={false} />
                      <Area type="monotone" dataKey="bandW" stackId="band" stroke="none" fill="url(#band)" isAnimationActive={false} />
                      <Line type="monotone" dataKey="control" stroke={C_BASE} strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="med" stroke={C_ORANGE} strokeWidth={2.75} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="actual" stroke={C_ACTUAL} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive animationDuration={1100} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* floating glass stat-pills */}
                <div className="pointer-events-none absolute right-7 top-28 hidden sm:block">
                  <div className={GLASS + " px-4 py-2.5"}>
                    <div className="text-[11px] font-medium text-stone-500">Predicted Δ · day 90</div>
                    <div className="mt-0.5 font-mono text-2xl font-semibold tracking-tight text-stone-900">{fmtPct(med90)}</div>
                  </div>
                </div>
              </section>

              {/* 3D twin */}
              <section className={CARD + " relative flex flex-col overflow-hidden p-5"}>
                <div className="relative z-10">
                  <div className={EYEBROW}>Digital twin</div>
                  <div className="mt-0.5 font-mono text-sm text-stone-500">{patient.id} · {patient.profile}</div>
                </div>
                <div className="relative min-h-[300px] flex-1">
                  <BodyTwin3D med90={med90} />
                </div>
                <div className="relative z-10">
                  <div className={GLASS + " flex items-center justify-between px-4 py-2.5"}>
                    <div>
                      <div className="text-[11px] font-medium text-stone-500">Tumor burden · day 90</div>
                      <div className="font-mono text-lg font-semibold text-stone-900">{Math.round(med90)}%</div>
                    </div>
                    <span className={"rounded-full px-2.5 py-1 text-[11px] font-semibold " + (med90 <= RESPONSE ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-600")}>
                      {med90 <= RESPONSE ? "Responding" : "Limited response"}
                    </span>
                  </div>
                </div>
              </section>
            </div>

            {/* metric cards */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="rounded-[26px] bg-gradient-to-br from-orange-500 to-orange-600 p-5 text-white shadow-[0_18px_40px_-18px_rgba(242,106,58,0.8)]">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-100">
                  <Sparkles className="h-3.5 w-3.5" /> Best option for this patient
                </div>
                <div className="mt-2 text-xl font-semibold leading-tight">{best.label}</div>
                <div className="mt-1 font-mono text-sm text-orange-100">{Math.round(best.pResp * 100)}% predicted response probability</div>
              </div>

              <div className={CARD + " p-5"}>
                <div className={EYEBROW}>Predicted response probability</div>
                <div className="mt-1 font-mono text-4xl font-semibold tracking-tight text-stone-900">{Math.round(ens.pResp * 100)}%</div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-200/70">
                  <div className="h-full rounded-full bg-orange-500 transition-all duration-500" style={{ width: Math.round(ens.pResp * 100) + "%" }} />
                </div>
                <div className="mt-1.5 font-mono text-[11px] text-stone-400">≥30% reduction · 90% range {fmtPct(lo90)} to {fmtPct(hi90)}</div>
              </div>

              {revealed ? (
                <div className={"rounded-[26px] p-5 shadow-[0_18px_40px_-22px_rgba(20,15,10,0.4)] " + (covered ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-rose-50 ring-1 ring-rose-200")}>
                  <div className={EYEBROW}>Actual outcome · day 90</div>
                  <div className="mt-1 font-mono text-4xl font-semibold tracking-tight text-stone-900">{fmtPct(act90)}</div>
                  <div className={"mt-1.5 flex items-center gap-1 text-xs font-semibold " + (covered ? "text-emerald-700" : "text-rose-700")}>
                    {covered ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    {covered ? "Within the predicted range" : "Outside the predicted range"}
                  </div>
                </div>
              ) : (
                <div className={CARD + " flex flex-col justify-center p-5"}>
                  <div className={EYEBROW}>Actual outcome · day 90</div>
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-500">
                    Hidden until you reveal it. Predict on the twin first — then check whether the real patient landed
                    inside the predicted range.
                  </p>
                </div>
              )}
            </div>

            {/* ranked treatments */}
            <section className={CARD + " p-5 sm:p-6"}>
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-stone-700">4 · Every treatment, ranked for this patient</h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-stone-400">Ranked by predicted probability of response for this individual. Tap any option to simulate it.</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2.5">
                {compare.map((c, rank) => {
                  const pct = Math.round(c.pResp * 100);
                  const isBest = c.id === best.id;
                  const isActive = c.id === regimenId;
                  return (
                    <button key={c.id} onClick={() => { setRegimenId(c.id); setRevealed(false); }}
                      className="group flex items-center gap-3 rounded-xl px-1 py-1 text-left transition hover:bg-white/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100">
                      <div className={"w-5 shrink-0 text-right font-mono text-[11px] " + (isBest ? "font-bold text-orange-600" : "text-stone-400")}>{rank + 1}</div>
                      <div className={"flex w-36 shrink-0 items-center gap-1.5 text-sm leading-tight sm:w-48 " + (isActive ? "font-semibold text-orange-800" : "text-stone-700")}>
                        {c.label}
                        {c.id === STANDARD_OF_CARE && <span className="rounded bg-stone-200/70 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-stone-500">SOC</span>}
                      </div>
                      <div className="h-5 flex-1 overflow-hidden rounded-full bg-stone-200/60">
                        <div className={"h-full rounded-full transition-all duration-500 " + (isBest ? "bg-gradient-to-r from-orange-400 to-orange-600" : "bg-stone-300 group-hover:bg-stone-400")}
                          style={{ width: Math.max(pct, 3) + "%" }} />
                      </div>
                      <div className={"w-11 shrink-0 text-right font-mono text-sm font-bold " + (isBest ? "text-orange-600" : "text-stone-600")}>{pct}%</div>
                    </button>
                  );
                })}
              </div>
              {best.id !== STANDARD_OF_CARE && (
                <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-orange-50 px-4 py-3 ring-1 ring-orange-100">
                  <div className="mt-0.5 h-full min-h-[1.5rem] w-1 shrink-0 rounded-full bg-orange-400" />
                  <p className="text-xs leading-relaxed text-orange-800">
                    For this patient, the twin's best option ({best.label}) is not the standard of care. Predicting per
                    patient can find a better treatment than the one that works best on average.
                  </p>
                </div>
              )}
            </section>

            <p className="max-w-3xl text-[11px] leading-relaxed text-stone-400">
              How it works: Veridian fits a model — a digital twin — to each patient, then runs a 160-sample Monte-Carlo
              ensemble of that twin under parameter uncertainty to predict the response to each treatment (Gompertz
              tumor growth with one-compartment pharmacokinetics and a log-kill drug effect). “Refine” updates the twin
              against the patient's first two weeks of real response. This is a prediction tool, shown with its
              uncertainty — not a cure, and nothing physical inside the body. Research prototype · simulated data · not
              for clinical use.
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}
