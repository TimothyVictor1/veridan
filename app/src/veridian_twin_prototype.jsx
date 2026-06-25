import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, BarChart3, Check, FlaskConical, Gauge, HeartPulse, LayoutDashboard, Plus, RefreshCw, Search, ShieldCheck, Sparkles, TestTubeDiagonal, UserRound, X } from "lucide-react";
import HolographicBodyScene from "./HolographicBody";

const SCAN_MS = 3600;
const TEST_MS = 2700;
const PASSING_COMBO = ["nanoclear-x", "immunorin-b", "stabilin-7"];

const DISEASE = {
  name: "Aster-17 Cellular Drift",
  site: "Thoracic lymphatic cluster",
  severity: "Moderate simulated risk",
  confidence: 94,
};

const PATIENT = {
  id: "P04",
  name: "Mira R.",
  age: "71F",
  phenotype: "indolent Aster-17",
  cohort: "T-Lymph cluster",
  twinScore: 97,
  response: 96,
  delta: -78,
  scanId: "VX-0417",
};

const PATIENTS = [
  { id: "P01", meta: "62F newly detected", active: false },
  { id: "P02", meta: "57M prior line failed", active: false },
  { id: "P03", meta: "49F aggressive signal", active: false },
  { id: "P04", meta: "71F indolent disease", active: true },
];

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

const PHASE_META = {
  scanning: {
    kicker: "Nanobot sweep",
    title: "Body twin is forming",
    subtitle: "Live telemetry is mapping tissue regions and anomaly markers.",
  },
  ready: {
    kicker: "Twin ready",
    title: "Aster-17 detected",
    subtitle: "Assemble a medical combination and run a virtual trial.",
  },
  testing: {
    kicker: "Trial in progress",
    title: "Combination reacting",
    subtitle: "The digital twin is simulating organ stress and disease response.",
  },
  passed: {
    kicker: "Stabilized",
    title: "Combination passed",
    subtitle: "The anomaly signature collapsed inside the simulated twin.",
  },
  failed: {
    kicker: "Rejected",
    title: "Combination failed",
    subtitle: "The anomaly remained active or stress exceeded the virtual window.",
  },
};

const TREATMENT_OPTIONS = [
  { rank: 1, name: "NanoClear X + Immunorin B + Stabilin-7", score: 96, delta: -78, tag: "Pass profile", active: true },
  { rank: 2, name: "NanoClear X + Stabilin-7", score: 74, delta: -42, tag: "Partial response", active: false },
  { rank: 3, name: "Immunorin B + HepaGard", score: 51, delta: -18, tag: "Stress limited", active: false },
  { rank: 4, name: "NeuroFlux + OxyPherin", score: 12, delta: 8, tag: "Rejected", active: false },
];

const TRAJECTORY_DATA = [
  { day: 0, twin: 0, untreated: 0, confidence: 8 },
  { day: 10, twin: -31, untreated: 18, confidence: 15 },
  { day: 20, twin: -38, untreated: 34, confidence: 17 },
  { day: 30, twin: -52, untreated: 46, confidence: 21 },
  { day: 45, twin: -57, untreated: 58, confidence: 22 },
  { day: 60, twin: -63, untreated: 65, confidence: 24 },
  { day: 75, twin: -69, untreated: 70, confidence: 26 },
  { day: 90, twin: -78, untreated: 73, confidence: 28 },
  { day: 105, twin: -74, untreated: 74, confidence: 27 },
  { day: 120, twin: -71, untreated: 75, confidence: 26 },
];

const ORGAN_METRICS = [
  { label: "Immune sync", value: 94 },
  { label: "Liver stress", value: 18 },
  { label: "Signal noise", value: 9 },
  { label: "Twin fidelity", value: 97 },
];

function sortIds(ids) {
  return [...ids].sort().join("|");
}

function isPassingCombo(selected) {
  return sortIds(selected.map((item) => item.id)) === sortIds(PASSING_COMBO);
}

function tone(color) {
  const map = {
    amber: "chem-amber",
    blue: "chem-blue",
    cyan: "chem-cyan",
    emerald: "chem-emerald",
    lime: "chem-lime",
    orange: "chem-orange",
    rose: "chem-rose",
    sky: "chem-sky",
    teal: "chem-teal",
    violet: "chem-violet",
  };
  return map[color] || "chem-cyan";
}

function ScannerStage({ phase, scanComplete, selected, result, isDragOver, onDrop, onDragOver, onDragLeave }) {
  const meta = PHASE_META[phase] || PHASE_META.ready;

  return (
    <section
      data-testid="body-drop-target"
      className={`scanner-stage scanner-${phase} ${isDragOver ? "scanner-stage-hot" : ""}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <div className="scanner-grid" />
      <div className="stage-glass-column" />
      <div className="stage-scan-glass" />
      <div className="stage-floor-glow" />
      <div className="scanner-rail scanner-rail-left" />
      <div className="scanner-rail scanner-rail-right" />
      <div className="stage-corner stage-corner-tl" />
      <div className="stage-corner stage-corner-tr" />
      <div className="stage-corner stage-corner-bl" />
      <div className="stage-corner stage-corner-br" />
      <div className="stage-orbit stage-orbit-a" />
      <div className="stage-orbit stage-orbit-b" />
      {phase === "testing" && <div className="stage-reaction-sheet" />}
      {phase === "passed" && <div className="stage-success-sheet" />}
      {phase === "failed" && <div className="stage-failure-sheet" />}
      {isDragOver && <div className="stage-drop-ring" />}

      <div className="stage-canvas-layer">
        <HolographicBodyScene phase={phase} />
      </div>

      <div className="stage-badge stage-badge-left">
        <span>{meta.kicker}</span>
        <strong>{meta.title}</strong>
        <small>{meta.subtitle}</small>
      </div>

      <div className="stage-badge stage-badge-right">
        <span>Detected locus</span>
        <strong>Aster-17 / T-Lymph</strong>
        <small>Confidence {DISEASE.confidence}%</small>
      </div>

      <div className="stage-metrics">
        <Metric label="Scan state" value={scanComplete ? "locked" : "sweeping"} />
        <Metric label="Medical combo" value={selected.length ? `${selected.length} compounds` : "empty"} />
        <Metric label="Outcome" value={result ? (result.passed ? "passed" : "failed") : "pending"} />
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SearchPanel({ query, setQuery, selected, addChemical }) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CHEMICALS.slice(0, 7);
    return CHEMICALS.filter((chemical) => [chemical.name, chemical.code, chemical.className, chemical.note].join(" ").toLowerCase().includes(q));
  }, [query]);

  return (
    <section className="control-panel compact-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Search className="panel-icon" />
          <span>Treatment library</span>
        </div>
        <span className="panel-count">{filtered.length} shown</span>
      </div>

      <div className="search-field">
        <Search className="search-icon" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search compounds..."
          className="lab-input"
        />
      </div>

      <div className="compound-list">
        {filtered.map((chemical) => {
          const alreadySelected = selected.some((item) => item.id === chemical.id);
          return (
            <button
              key={chemical.id}
              type="button"
              onClick={() => addChemical(chemical)}
              disabled={alreadySelected}
              className="compound-row"
            >
              <span className="compound-copy">
                <span className="compound-name">{chemical.name}</span>
                <span className="compound-meta">{chemical.code} / {chemical.className}</span>
              </span>
              <span className={`${alreadySelected ? "chem-muted" : tone(chemical.color)} compound-dot`}>
                {alreadySelected ? <Check className="dot-icon" /> : <Plus className="dot-icon" />}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ComboPanel({ selected, removeChemical, clearCombo, startDrag, canTest, runTest }) {
  return (
    <section className="control-panel compact-panel">
      <div className="panel-header">
        <div className="panel-title">
          <FlaskConical className="panel-icon panel-icon-amber" />
          <span>Medical combination</span>
        </div>
        <button type="button" onClick={clearCombo} className="icon-button" aria-label="Clear selected chemicals">
          <RefreshCw className="button-icon" />
        </button>
      </div>

      <div
        data-testid="combo-shelf"
        draggable={selected.length > 0}
        onDragStart={startDrag}
        className={`formula-tray ${selected.length ? "formula-tray-active" : ""}`}
      >
        {selected.length === 0 ? (
          <div className="formula-empty">Select compounds to assemble a medical combination</div>
        ) : (
          <div className="formula-chip-list">
            {selected.map((chemical) => (
              <span key={chemical.id} className={`${tone(chemical.color)} formula-chip`}>
                <span>{chemical.name}</span>
                <button type="button" onClick={(event) => { event.stopPropagation(); removeChemical(chemical.id); }} aria-label={`Remove ${chemical.name}`}>
                  <X className="chip-icon" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="formula-footer">
        <span>{selected.length}/5 compounds</span>
        <span>Drop combination on twin</span>
      </div>

      <button type="button" onClick={runTest} disabled={!canTest} className="primary-action">
        <Sparkles className="button-icon" />
        Run Virtual Trial
      </button>
    </section>
  );
}

function StatusPanel({ scanComplete, phase, result, selected, resetScan }) {
  const payload = selected.map((item) => item.name).join(" + ") || "No combination loaded";

  return (
    <section className="control-panel status-panel compact-panel">
      <div className="panel-header">
        <div className="panel-title">
          <ShieldCheck className="panel-icon panel-icon-emerald" />
          <span>Twin diagnosis</span>
        </div>
        <span className={`phase-pill phase-${phase}`}>{phase}</span>
      </div>

      <div className="status-stack">
        <StatusBar label="Nanobot sweep" value={scanComplete ? 100 : 68} active={!scanComplete} />
        <StatusBar label="Twin alignment" value={scanComplete ? 97 : 52} active={!scanComplete} />
        <StatusBar label="Disease lock" value={scanComplete ? 94 : 34} active={!scanComplete} />
      </div>

      <div className={`diagnosis-card ${scanComplete ? "diagnosis-card-on" : ""}`}>
        <span className="section-kicker">Disease found</span>
        {scanComplete ? (
          <>
            <strong className="diagnosis-name">{DISEASE.name}</strong>
            <span className="diagnosis-site">{DISEASE.site}</span>
            <div className="mini-grid">
              <div className="mini-cell"><span>Severity</span><strong>{DISEASE.severity}</strong></div>
              <div className="mini-cell"><span>Confidence</span><strong>{DISEASE.confidence}%</strong></div>
            </div>
          </>
        ) : (
          <span className="diagnosis-pending">Scanning body twin...</span>
        )}
      </div>

      <div className="payload-card">
        <span className="section-kicker">Medical combination</span>
        <strong>{payload}</strong>
      </div>

      {phase === "testing" && <div className="result-card result-testing">Testing medical combination on digital twin...</div>}
      {result && (
        <div data-testid="test-result" className={`result-card ${result.passed ? "result-pass" : "result-fail"}`}>
          <div className="result-heading">
            {result.passed ? <Check className="button-icon" /> : <X className="button-icon" />}
            {result.passed ? "Combination passed" : "Combination failed"}
          </div>
          <p>{result.message}</p>
        </div>
      )}

      <button type="button" onClick={resetScan} className="secondary-action">
        <RefreshCw className="button-icon" />
        Restart Scan
      </button>
    </section>
  );
}

function StatusBar({ label, value, active }) {
  return (
    <div className="status-row">
      <div className="status-label">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="status-track">
        <div className={`status-fill ${active ? "status-fill-active" : ""}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function TestingWorkspace(props) {
  return (
    <div className="workspace-content testing-workspace">
      <SearchPanel query={props.query} setQuery={props.setQuery} selected={props.selected} addChemical={props.addChemical} />
      <ComboPanel
        selected={props.selected}
        removeChemical={props.removeChemical}
        clearCombo={props.clearCombo}
        startDrag={props.startDrag}
        canTest={props.canTest}
        runTest={props.runTest}
      />
      <StatusPanel scanComplete={props.scanComplete} phase={props.phase} result={props.result} selected={props.selected} resetScan={props.resetScan} />
    </div>
  );
}

function DashboardWorkspace({ scanComplete, phase, selected, result }) {
  const payload = selected.map((item) => item.name).join(" + ") || "NanoClear X + Immunorin B + Stabilin-7";
  const response = result?.passed ? 100 : PATIENT.response;
  const bestDelta = result?.passed ? -86 : PATIENT.delta;

  return (
    <div className="workspace-content dashboard-workspace">
      <section className="dashboard-hero">
        <div className="dashboard-chip">Research prototype / simulated data</div>
        <div className="patient-lockup">
          <div className="patient-avatar"><UserRound className="button-icon" /></div>
          <div>
            <span className="section-kicker">Digital twin patient</span>
            <h2>{PATIENT.id} / {PATIENT.name}</h2>
            <p>{PATIENT.age} / {PATIENT.phenotype} / {PATIENT.cohort}</p>
          </div>
        </div>
        <div className="patient-strip">
          {PATIENTS.map((patient) => (
            <div key={patient.id} className={`patient-pill ${patient.active ? "patient-pill-active" : ""}`}>
              <UserRound className="chip-icon" />
              <strong>{patient.id}</strong>
              <span>{patient.meta}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="dashboard-stat-grid">
        <StatCard icon={<Sparkles className="button-icon" />} label="Best option" value="Medical combination" detail={payload} accent />
        <StatCard icon={<Gauge className="button-icon" />} label="Response probability" value={`${response}%`} detail="Predicted digital response" />
        <StatCard icon={<HeartPulse className="button-icon" />} label="Predicted delta" value={`${bestDelta}%`} detail="Day 90 anomaly load" />
      </div>

      <section className="control-panel compact-panel dashboard-section">
        <div className="panel-header">
          <div className="panel-title">
            <TestTubeDiagonal className="panel-icon panel-icon-amber" />
            <span>Treatments ranked</span>
          </div>
          <span className={`phase-pill phase-${phase}`}>{scanComplete ? "ready" : "scanning"}</span>
        </div>
        <div className="rank-list">
          {TREATMENT_OPTIONS.map((option) => (
            <div key={option.rank} className={`rank-row ${option.active ? "rank-row-active" : ""}`}>
              <div className="rank-head">
                <span className="rank-number">{option.rank}</span>
                <strong>{option.name}</strong>
                <em>{option.tag}</em>
              </div>
              <div className="rank-meter">
                <span style={{ width: `${option.score}%` }} />
              </div>
              <div className="rank-foot">
                <span>{option.score}% predicted response</span>
                <strong>{option.delta}% load</strong>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="control-panel compact-panel dashboard-section">
        <div className="panel-header">
          <div className="panel-title">
            <BarChart3 className="panel-icon" />
            <span>Predicted trajectory</span>
          </div>
          <span className="panel-count">120 days</span>
        </div>
        <TrajectoryChart />
      </section>

      <section className="control-panel compact-panel dashboard-section">
        <div className="panel-header">
          <div className="panel-title">
            <Activity className="panel-icon panel-icon-emerald" />
            <span>Patient state</span>
          </div>
          <span className="panel-count">Twin {PATIENT.twinScore}%</span>
        </div>
        <div className="organ-grid">
          {ORGAN_METRICS.map((metric) => (
            <div key={metric.label} className="organ-card">
              <span>{metric.label}</span>
              <strong>{metric.value}%</strong>
              <div className="organ-track"><i style={{ width: `${metric.value}%` }} /></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, detail, accent }) {
  return (
    <div className={`stat-card ${accent ? "stat-card-accent" : ""}`}>
      <div className="stat-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function TrajectoryChart() {
  const width = 520;
  const height = 230;
  const padding = { top: 18, right: 22, bottom: 28, left: 34 };
  const minY = -95;
  const maxY = 82;

  function point(day, value) {
    const x = padding.left + (day / 120) * (width - padding.left - padding.right);
    const y = padding.top + ((maxY - value) / (maxY - minY)) * (height - padding.top - padding.bottom);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))];
  }

  function pathFor(data, valueFor) {
    return data.map((item, index) => {
      const [x, y] = point(item.day, valueFor(item));
      return `${index === 0 ? "M" : "L"}${x} ${y}`;
    }).join(" ");
  }

  const twinPath = pathFor(TRAJECTORY_DATA, (item) => item.twin);
  const untreatedPath = pathFor(TRAJECTORY_DATA, (item) => item.untreated);
  const upperPath = pathFor(TRAJECTORY_DATA, (item) => item.twin + item.confidence);
  const lowerPath = TRAJECTORY_DATA.slice().reverse().map((item) => {
    const [x, y] = point(item.day, item.twin - item.confidence);
    return `L${x} ${y}`;
  }).join(" ");
  const areaPath = `${upperPath} ${lowerPath} Z`;
  const threshold = point(0, -45)[1];

  return (
    <div className="trajectory-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Predicted patient response over 120 days">
        <defs>
          <linearGradient id="trajectoryFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#fb923c" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        {[0, 30, 60, 90, 120].map((day) => {
          const [x] = point(day, 0);
          return <line key={day} x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} className="chart-grid-line" />;
        })}
        {[-80, -40, 0, 40, 80].map((value) => {
          const [, y] = point(0, value);
          return <line key={value} x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="chart-grid-line" />;
        })}
        <path d={areaPath} className="chart-band" />
        <line x1={padding.left} y1={threshold} x2={width - padding.right} y2={threshold} className="chart-threshold" />
        <path d={untreatedPath} className="chart-line chart-line-muted" />
        <path d={twinPath} className="chart-line chart-line-main" />
        {[0, 30, 60, 90, 120].map((day) => {
          const [x] = point(day, 0);
          return <text key={day} x={x} y={height - 8} textAnchor="middle" className="chart-axis-label">{day}d</text>;
        })}
        <text x={width - padding.right} y={threshold - 6} textAnchor="end" className="chart-threshold-label">response threshold</text>
      </svg>
      <div className="chart-legend">
        <span><i className="legend-main" />Twin prediction</span>
        <span><i className="legend-muted" />Untreated</span>
        <span><i className="legend-band" />Uncertainty</span>
      </div>
    </div>
  );
}

function WorkspacePanel({ activeWorkspace, setActiveWorkspace, children }) {
  return (
    <aside className="workspace-panel">
      <div className="workspace-tabbar" role="tablist" aria-label="Veridian workspace">
        <button
          type="button"
          role="tab"
          aria-selected={activeWorkspace === "testing"}
          onClick={() => setActiveWorkspace("testing")}
          className={`workspace-tab ${activeWorkspace === "testing" ? "workspace-tab-active" : ""}`}
        >
          <FlaskConical className="button-icon" />
          Testing
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeWorkspace === "dashboard"}
          onClick={() => setActiveWorkspace("dashboard")}
          className={`workspace-tab ${activeWorkspace === "dashboard" ? "workspace-tab-active" : ""}`}
        >
          <LayoutDashboard className="button-icon" />
          Dashboard
        </button>
      </div>
      {children}
    </aside>
  );
}

export default function VeridianTwin() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [phase, setPhase] = useState("scanning");
  const [scanComplete, setScanComplete] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [result, setResult] = useState(null);
  const [activeWorkspace, setActiveWorkspace] = useState("testing");
  const scanTimerRef = useRef(null);
  const trialTimerRef = useRef(null);

  useEffect(() => {
    scanTimerRef.current = window.setTimeout(() => {
      setScanComplete(true);
      setPhase("ready");
    }, SCAN_MS);

    return () => {
      window.clearTimeout(scanTimerRef.current);
      window.clearTimeout(trialTimerRef.current);
    };
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
    window.clearTimeout(scanTimerRef.current);
    window.clearTimeout(trialTimerRef.current);
    setPhase("scanning");
    setScanComplete(false);
    setResult(null);
    setIsDragOver(false);
    scanTimerRef.current = window.setTimeout(() => {
      setScanComplete(true);
      setPhase("ready");
    }, SCAN_MS);
  }

  function runTest() {
    if (!scanComplete || selected.length === 0 || phase === "testing") return;
    window.clearTimeout(trialTimerRef.current);
    setIsDragOver(false);
    setResult(null);
    setPhase("testing");
    const payload = [...selected];
    trialTimerRef.current = window.setTimeout(() => {
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
    setIsDragOver(false);
    if (!event.dataTransfer.getData("application/veridian-combo")) return;
    runTest();
  }

  const canTest = scanComplete && selected.length > 0 && phase !== "testing";

  return (
    <div className="app-shell min-h-screen">
      <div className="app-frame mx-auto grid min-h-screen w-full max-w-[1840px] grid-rows-[auto_1fr] gap-4 p-4 sm:p-5">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark"><Activity className="brand-icon" /></div>
            <div>
              <div className="brand-name">Veridian</div>
              <div className="brand-subtitle">interactive digital twin trial lab</div>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="topbar-pill">Speculative prototype</span>
            <span className="topbar-pill topbar-pill-accent">Pass: NanoClear X + Immunorin B + Stabilin-7</span>
          </div>
        </header>

        <main className="main-grid twin-layout grid min-h-0 gap-4">
          <ScannerStage
            phase={phase}
            scanComplete={scanComplete}
            selected={selected}
            result={result}
            isDragOver={isDragOver}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={() => setIsDragOver(false)}
          />

          <WorkspacePanel activeWorkspace={activeWorkspace} setActiveWorkspace={setActiveWorkspace}>
            {activeWorkspace === "testing" ? (
              <TestingWorkspace
                query={query}
                setQuery={setQuery}
                selected={selected}
                addChemical={addChemical}
                removeChemical={removeChemical}
                clearCombo={clearCombo}
                startDrag={startDrag}
                canTest={canTest}
                runTest={runTest}
                scanComplete={scanComplete}
                phase={phase}
                result={result}
                resetScan={resetScan}
              />
            ) : (
              <DashboardWorkspace scanComplete={scanComplete} phase={phase} selected={selected} result={result} />
            )}
          </WorkspacePanel>
        </main>
      </div>
    </div>
  );
}