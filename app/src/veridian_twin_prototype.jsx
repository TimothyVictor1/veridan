import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, BarChart3, Check, FlaskConical, Gauge, HeartPulse, LayoutDashboard, Plus, RefreshCw, Search, ShieldCheck, TestTubeDiagonal, UserRound, X } from "lucide-react";
import HolographicBodyScene from "./HolographicBody";

const SCAN_MS = 3600;
const TEST_MS = 2700;
const DEFAULT_PATIENT_ID = "P04";

const DEFAULT_DISEASE = {
  name: "Lymphoma Tumor Signal",
  site: "Thoracic lymph-node region",
  locus: "Tumor / lymph node",
  severity: "Moderate simulated risk",
  confidence: 94,
};

const PATIENTS = [
  {
    id: "P01",
    name: "Neha Rao",
    age: "34F",
    meta: "34F early breast tumor",
    phenotype: "early breast tumor signal",
    cohort: "Breast oncology twin",
    status: "New baseline",
    disease: {
      name: "Early Breast Tumor Signal",
      site: "Left thoracic tissue",
      locus: "Breast tissue",
      severity: "Early simulated risk",
      confidence: 91,
      marker: [-0.18, 2.23, 0.24],
    },
    twinScore: 93,
    untreated: 62,
    scanId: "VX-0211",
    passCombo: ["pembrolizumab", "paclitaxel", "ondansetron"],
    highlight: "Early tumor signature with high simulated response plasticity.",
    organMetrics: [
      { label: "Immune sync", value: 91 },
      { label: "Liver stress", value: 14 },
      { label: "Signal noise", value: 12 },
      { label: "Twin fidelity", value: 93 },
    ],
    treatments: [
      { id: "p01-t1", rank: 1, name: "Pembrolizumab + Paclitaxel + Ondansetron", score: 89, delta: -58, tag: "Best option", confidence: 18, volatility: 5 },
      { id: "p01-t2", rank: 2, name: "Paclitaxel + Ondansetron", score: 78, delta: -43, tag: "Lower intensity", confidence: 21, volatility: 6 },
      { id: "p01-t3", rank: 3, name: "Paracetamol + Vitamin D3", score: 35, delta: -9, tag: "Support only", confidence: 27, volatility: 8 },
      { id: "p01-t4", rank: 4, name: "Dolo-650 + Saline Support", score: 18, delta: 4, tag: "Rejected", confidence: 30, volatility: 9 },
    ],
  },
  {
    id: "P02",
    name: "Arjun K.",
    age: "57M",
    meta: "57M lung tumor",
    phenotype: "lung tumor response risk",
    cohort: "Thoracic oncology twin",
    status: "Prior line failed",
    disease: {
      name: "Lung Tumor Response Risk",
      site: "Right upper lung region",
      locus: "Lung / thoracic",
      severity: "Elevated simulated risk",
      confidence: 89,
      marker: [0.2, 2.34, 0.23],
    },
    twinScore: 88,
    untreated: 84,
    scanId: "VX-0308",
    passCombo: ["cisplatin", "paclitaxel", "saline-support"],
    highlight: "Prior therapy failure raises uncertainty and organ-stress penalties.",
    organMetrics: [
      { label: "Immune sync", value: 78 },
      { label: "Kidney stress", value: 34 },
      { label: "Signal noise", value: 22 },
      { label: "Twin fidelity", value: 88 },
    ],
    treatments: [
      { id: "p02-t1", rank: 1, name: "Cisplatin + Paclitaxel + Saline Support", score: 71, delta: -36, tag: "Best option", confidence: 25, volatility: 9 },
      { id: "p02-t2", rank: 2, name: "Paclitaxel + Ondansetron", score: 63, delta: -24, tag: "Stress watch", confidence: 29, volatility: 11 },
      { id: "p02-t3", rank: 3, name: "Pembrolizumab + Vitamin D3", score: 38, delta: -8, tag: "Unstable", confidence: 34, volatility: 13 },
      { id: "p02-t4", rank: 4, name: "Dolo-650 + Paracetamol", score: 7, delta: 18, tag: "Rejected", confidence: 38, volatility: 14 },
    ],
  },
  {
    id: "P03",
    name: "Isha Varma",
    age: "49F",
    meta: "49F lymphoma signal",
    phenotype: "aggressive lymphoma signal",
    cohort: "Lymphatic oncology twin",
    status: "Fast progression",
    disease: {
      name: "Aggressive Lymphoma Signal",
      site: "Central lymphatic chain",
      locus: "Lymphatic system",
      severity: "High simulated risk",
      confidence: 92,
      marker: [0.08, 2.1, 0.25],
    },
    twinScore: 91,
    untreated: 108,
    scanId: "VX-0394",
    passCombo: ["rituximab", "pembrolizumab", "paracetamol"],
    highlight: "Aggressive signal needs the strongest simulated immune-response profile.",
    organMetrics: [
      { label: "Immune sync", value: 86 },
      { label: "Liver stress", value: 27 },
      { label: "Signal noise", value: 31 },
      { label: "Twin fidelity", value: 91 },
    ],
    treatments: [
      { id: "p03-t1", rank: 1, name: "Rituximab + Pembrolizumab + Paracetamol", score: 84, delta: -52, tag: "Best option", confidence: 27, volatility: 10 },
      { id: "p03-t2", rank: 2, name: "Rituximab + Ondansetron", score: 69, delta: -35, tag: "Partial", confidence: 31, volatility: 12 },
      { id: "p03-t3", rank: 3, name: "Paclitaxel + Saline Support", score: 44, delta: -11, tag: "Insufficient", confidence: 35, volatility: 15 },
      { id: "p03-t4", rank: 4, name: "Dolo-650 + Vitamin D3", score: 16, delta: 22, tag: "Rejected", confidence: 39, volatility: 16 },
    ],
  },
  {
    id: "P04",
    name: "Mira R.",
    age: "71F",
    meta: "71F slow tumor",
    phenotype: "slow-growing tumor cluster",
    cohort: "Lymph-node oncology twin",
    status: "High confidence",
    disease: {
      name: "Slow-Growing Tumor Cluster",
      site: "Thoracic lymph-node region",
      locus: "Tumor / lymph node",
      severity: "Moderate simulated risk",
      confidence: 94,
      marker: [0.09, 2.2, 0.22],
    },
    twinScore: 97,
    untreated: 75,
    scanId: "VX-0417",
    passCombo: ["imatinib", "vitamin-d3", "ondansetron"],
    highlight: "Indolent signature shows a narrow but strong predicted response window.",
    organMetrics: [
      { label: "Immune sync", value: 94 },
      { label: "Liver stress", value: 18 },
      { label: "Signal noise", value: 9 },
      { label: "Twin fidelity", value: 97 },
    ],
    treatments: [
      { id: "p04-t1", rank: 1, name: "Imatinib + Vitamin D3 + Ondansetron", score: 96, delta: -78, tag: "Pass profile", confidence: 22, volatility: 6 },
      { id: "p04-t2", rank: 2, name: "Imatinib + Ondansetron", score: 74, delta: -42, tag: "Partial response", confidence: 25, volatility: 8 },
      { id: "p04-t3", rank: 3, name: "Paracetamol + Saline Support", score: 51, delta: -18, tag: "Supportive", confidence: 29, volatility: 10 },
      { id: "p04-t4", rank: 4, name: "Dolo-650 + Vitamin D3", score: 12, delta: 8, tag: "Rejected", confidence: 34, volatility: 12 },
    ],
  },
  {
    id: "P05",
    name: "Kiran S.",
    age: "63M",
    meta: "63M recurrent tumor",
    phenotype: "recurrent solid tumor signal",
    cohort: "Advanced oncology twin",
    status: "Recurrent marker",
    disease: {
      name: "Recurrent Solid Tumor Signal",
      site: "Lower abdominal tissue",
      locus: "Solid tumor / abdomen",
      severity: "High simulated risk",
      confidence: 90,
      marker: [-0.08, 1.55, 0.25],
    },
    twinScore: 90,
    untreated: 96,
    scanId: "VX-0526",
    passCombo: ["doxorubicin", "cisplatin", "saline-support"],
    highlight: "Recurrent marker requires a higher-intensity simulated treatment path.",
    organMetrics: [
      { label: "Immune sync", value: 82 },
      { label: "Heart stress", value: 29 },
      { label: "Signal noise", value: 26 },
      { label: "Twin fidelity", value: 90 },
    ],
    treatments: [
      { id: "p05-t1", rank: 1, name: "Doxorubicin + Cisplatin + Saline Support", score: 80, delta: -47, tag: "Best option", confidence: 28, volatility: 12 },
      { id: "p05-t2", rank: 2, name: "Cisplatin + Ondansetron", score: 62, delta: -28, tag: "Stress watch", confidence: 31, volatility: 13 },
      { id: "p05-t3", rank: 3, name: "Paclitaxel + Vitamin D3", score: 46, delta: -12, tag: "Weak response", confidence: 35, volatility: 14 },
      { id: "p05-t4", rank: 4, name: "Paracetamol + Dolo-650", score: 10, delta: 16, tag: "Rejected", confidence: 39, volatility: 15 },
    ],
  },
];

const CHEMICALS = [
  { id: "cisplatin", name: "Cisplatin", code: "CIS-01", className: "oncology drug", color: "cyan", note: "recognizable chemotherapy label for demo" },
  { id: "paclitaxel", name: "Paclitaxel", code: "PAX-02", className: "oncology drug", color: "emerald", note: "simulated tumor-response agent" },
  { id: "pembrolizumab", name: "Pembrolizumab", code: "PMB-03", className: "immunotherapy", color: "blue", note: "checkpoint-therapy label for demo" },
  { id: "rituximab", name: "Rituximab", code: "RTX-04", className: "antibody therapy", color: "violet", note: "lymphoma-response label for demo" },
  { id: "imatinib", name: "Imatinib", code: "IMA-05", className: "targeted therapy", color: "teal", note: "targeted oncology label" },
  { id: "doxorubicin", name: "Doxorubicin", code: "DOX-06", className: "oncology drug", color: "rose", note: "high-intensity simulated therapy" },
  { id: "paracetamol", name: "Paracetamol", code: "PCM-07", className: "support medicine", color: "orange", note: "recognizable supportive medicine" },
  { id: "dolo-650", name: "Dolo-650", code: "DLO-08", className: "support medicine", color: "amber", note: "recognizable fever/pain label" },
  { id: "ondansetron", name: "Ondansetron", code: "OND-09", className: "support medicine", color: "lime", note: "supportive anti-nausea label" },
  { id: "vitamin-d3", name: "Vitamin D3", code: "VD3-10", className: "support medicine", color: "sky", note: "baseline support label" },
  { id: "saline-support", name: "Saline Support", code: "SAL-11", className: "support protocol", color: "teal", note: "hydration and stress support" },
];
const PHASE_META = {
  scanning: {
    kicker: "Twin generation",
    title: "Digital twin is forming",
    subtitle: "Patient details are being converted into a simulated body model.",
  },
  ready: {
    kicker: "Twin ready",
    title: "Tumor signal detected",
    subtitle: "Assemble a medication plan and run a virtual trial.",
  },
  testing: {
    kicker: "Trial in progress",
    title: "Medication plan reacting",
    subtitle: "The digital twin is simulating response, drift, and organ stress.",
  },
  passed: {
    kicker: "Stabilized",
    title: "Medication plan passed",
    subtitle: "The tumor signal decreased inside the simulated twin.",
  },
  failed: {
    kicker: "Rejected",
    title: "Medication plan failed",
    subtitle: "The tumor signal remained active or stress exceeded the virtual window.",
  },
};

function sortIds(ids) {
  return [...ids].sort().join("|");
}

function isPassingCombo(selected, patient) {
  return sortIds(selected.map((item) => item.id)) === sortIds(patient.passCombo);
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



function patientById(id) {
  return PATIENTS.find((patient) => patient.id === id) || PATIENTS[0];
}

function diseaseFor(patient) {
  return patient?.disease || DEFAULT_DISEASE;
}
function getBestTreatment(patient) {
  return patient.treatments[0];
}

function getTreatment(patient, treatmentId) {
  return patient.treatments.find((treatment) => treatment.id === treatmentId) || getBestTreatment(patient);
}

function buildTrajectory(patient, treatment) {
  const days = [0, 7, 14, 21, 30, 45, 60, 75, 90, 105, 120];
  return days.map((day, index) => {
    const progress = day === 0 ? 0 : 1 - Math.exp(-day / 34);
    const rebound = day > 72 ? (day - 72) * 0.11 : 0;
    const patientSeed = Number(patient.id.replace("P", ""));
    const wave = Math.sin(day / 9 + patientSeed * 0.73) * treatment.volatility;
    const twin = Math.round(treatment.delta * progress + wave * (0.32 + progress * 0.38) + rebound);
    const untreated = Math.round(patient.untreated * progress + Math.sin(day / 21 + index) * 4);
    const confidence = Math.round(8 + treatment.confidence * progress + (day > 75 ? 3 : 0));
    const stress = Math.max(6, Math.round(18 + (100 - treatment.score) * 0.42 + Math.sin(day / 16) * 5));
    return { day, twin, untreated, confidence, stress };
  });
}
function ScannerStage({ phase, scanComplete, selected, result, patient, isMaterializing, isDragOver, onDrop, onDragOver, onDragLeave }) {
  const meta = PHASE_META[phase] || PHASE_META.ready;
  const disease = diseaseFor(patient);
  return (
    <section
      data-testid="body-drop-target"
      className={`scanner-stage scanner-${phase} ${isDragOver ? "scanner-stage-hot" : ""} ${isMaterializing ? "scanner-materializing" : ""}`}
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
      {phase === "testing" && <div className="stage-reaction-sheet" />}
      {phase === "passed" && <div className="stage-success-sheet" />}
      {phase === "failed" && <div className="stage-failure-sheet" />}
      {isDragOver && <div className="stage-drop-ring" />}
      {isMaterializing && (
        <div className="materialize-overlay" aria-live="polite">
          <span>Digital twin materializing</span>
          <strong>{patient?.name || "Selected patient"}</strong>
          <i />
        </div>
      )}

      <div className="stage-canvas-layer">
        <HolographicBodyScene phase={phase} patient={patient} />
      </div>

      <div className="stage-badge stage-badge-left">
        <span>{meta.kicker}</span>
        <strong>{meta.title}</strong>
        <small>{meta.subtitle}</small>
      </div>

      <div className="stage-badge stage-badge-right">
        <span>Detected locus</span>
        <strong>{disease.locus}</strong>
        <small>Confidence {disease.confidence}%</small>
      </div>

      <div className="stage-metrics">
        <Metric label="Scan state" value={scanComplete ? "locked" : "sweeping"} />
        <Metric label="Medication plan" value={selected.length ? `${selected.length} medicines` : "empty"} />
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
          <span>Medicine library</span>
        </div>
        <span className="panel-count">{filtered.length} shown</span>
      </div>

      <div className="search-field">
        <Search className="search-icon" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search medicines..."
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
          <span>Medication plan</span>
        </div>
        <button type="button" onClick={clearCombo} className="icon-button" aria-label="Clear selected medicines">
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
          <div className="formula-empty">Select medicines to assemble a patient-specific plan</div>
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
        <span>{selected.length}/5 medicines</span>
        <span>Drop medication plan on twin</span>
      </div>

      <button type="button" onClick={runTest} disabled={!canTest} className="primary-action">
        <TestTubeDiagonal className="button-icon" />
        <span className="primary-action-copy">
          <strong>Run Digital Twin Trial</strong>
          <small>simulate response before real treatment</small>
        </span>
      </button>
    </section>
  );
}

function StatusPanel({ scanComplete, phase, result, selected, patient, resetScan }) {
  const payload = selected.map((item) => item.name).join(" + ") || "No medication plan loaded";
  const disease = diseaseFor(patient);
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
        <StatusBar label="Twin generation" value={scanComplete ? 100 : 68} active={!scanComplete} />
        <StatusBar label="Twin alignment" value={scanComplete ? 97 : 52} active={!scanComplete} />
        <StatusBar label="Tumor lock" value={scanComplete ? 94 : 34} active={!scanComplete} />
      </div>

      <div className={`diagnosis-card ${scanComplete ? "diagnosis-card-on" : ""}`}>
        <span className="section-kicker">Tumor signal found</span>
        {scanComplete ? (
          <>
            <strong className="diagnosis-name">{disease.name}</strong>
            <span className="diagnosis-site">{disease.site}</span>
            <div className="mini-grid">
              <div className="mini-cell"><span>Severity</span><strong>{disease.severity}</strong></div>
              <div className="mini-cell"><span>Confidence</span><strong>{disease.confidence}%</strong></div>
            </div>
          </>
        ) : (
          <span className="diagnosis-pending">Generating body twin...</span>
        )}
      </div>

      <div className="payload-card">
        <span className="section-kicker">Medication plan</span>
        <strong>{payload}</strong>
      </div>

      {phase === "testing" && <div className="result-card result-testing">Testing medication plan on digital twin...</div>}
      {result && (
        <div data-testid="test-result" className={`result-card ${result.passed ? "result-pass" : "result-fail"}`}>
          <div className="result-heading">
            {result.passed ? <Check className="button-icon" /> : <X className="button-icon" />}
            {result.passed ? "Medication plan passed" : "Medication plan failed"}
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
      <StatusPanel scanComplete={props.scanComplete} phase={props.phase} result={props.result} selected={props.selected} patient={props.patient} resetScan={props.resetScan} />
    </div>
  );
}

function DashboardWorkspace({ scanComplete, phase, selected, result, patient, selectedTreatment, selectedTreatmentId, setSelectedTreatmentId, activePatientId, setActivePatientId }) {
  const payload = selected.map((item) => item.name).join(" + ") || selectedTreatment.name;
  const response = result?.passed ? Math.max(98, selectedTreatment.score) : selectedTreatment.score;
  const bestDelta = result?.passed ? Math.min(selectedTreatment.delta, -86) : selectedTreatment.delta;
  const trajectory = useMemo(() => buildTrajectory(patient, selectedTreatment), [patient, selectedTreatment]);

  return (
    <div className="workspace-content dashboard-workspace">
      <section className="dashboard-hero dashboard-hero-live">
        <div className="dashboard-chip">Research prototype / simulated data</div>
        <div className="patient-lockup">
          <div className="patient-avatar"><UserRound className="button-icon" /></div>
          <div>
            <span className="section-kicker">Digital twin patient</span>
            <h2>{patient.id} / {patient.name}</h2>
            <p>{patient.age} / {patient.phenotype} / {patient.cohort}</p>
          </div>
        </div>
        <div className="patient-strip" aria-label="Digital twin patients">
          {PATIENTS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActivePatientId(item.id)}
              className={`patient-pill ${item.id === activePatientId ? "patient-pill-active" : ""}`}
              aria-pressed={item.id === activePatientId}
            >
              <UserRound className="chip-icon" />
              <strong>{item.id}</strong>
              <span>{item.meta}</span>
            </button>
          ))}
        </div>
        <div className="patient-insight">
          <span>Scan {patient.scanId} / {patient.status}</span>
          <strong>{patient.highlight}</strong>
        </div>
      </section>

      <div className="dashboard-stat-grid">
        <StatCard icon={<ShieldCheck className="button-icon" />} label="Best option" value={selectedTreatment.rank === 1 ? "Best patient option" : "Selected option"} detail={payload} accent />
        <StatCard icon={<Gauge className="button-icon" />} label="Response probability" value={`${response}%`} detail="Predicted digital response" />
        <StatCard icon={<HeartPulse className="button-icon" />} label="Predicted delta" value={`${bestDelta}%`} detail="Day 90 tumor load" />
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
          {patient.treatments.map((option) => {
            const isActive = option.id === selectedTreatmentId;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedTreatmentId(option.id)}
                className={`rank-row ${isActive ? "rank-row-active" : ""}`}
                aria-pressed={isActive}
              >
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
              </button>
            );
          })}
        </div>
      </section>

      <section className="control-panel compact-panel dashboard-section trajectory-panel">
        <div className="panel-header">
          <div className="panel-title">
            <BarChart3 className="panel-icon" />
            <span>Predicted trajectory</span>
          </div>
          <span className="panel-count">120 days</span>
        </div>
        <TrajectoryChart data={trajectory} treatment={selectedTreatment} patient={patient} />
      </section>

      <section className="control-panel compact-panel dashboard-section">
        <div className="panel-header">
          <div className="panel-title">
            <Activity className="panel-icon panel-icon-emerald" />
            <span>Patient state</span>
          </div>
          <span className="panel-count">Twin {patient.twinScore}%</span>
        </div>
        <div className="organ-grid">
          {patient.organMetrics.map((metric) => (
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

function TrajectoryChart({ data, treatment, patient }) {
  const width = 660;
  const height = 310;
  const padding = { top: 24, right: 30, bottom: 34, left: 42 };
  const allValues = data.flatMap((item) => [item.twin + item.confidence, item.twin - item.confidence, item.untreated, item.stress]);
  const minY = Math.min(-105, ...allValues) - 4;
  const maxY = Math.max(118, ...allValues) + 6;
  const fillId = `trajectoryFill-${patient.id}-${treatment.id}`;
  const glowId = `trajectoryGlow-${patient.id}-${treatment.id}`;
  const day90 = data.reduce((closest, item) => Math.abs(item.day - 90) < Math.abs(closest.day - 90) ? item : closest, data[0]);
  const [activeDay, setActiveDay] = useState(day90.day);
  const activeItem = data.find((item) => item.day === activeDay) || day90;

  useEffect(() => {
    setActiveDay(day90.day);
  }, [day90.day, patient.id, treatment.id]);

  function point(day, value) {
    const x = padding.left + (day / 120) * (width - padding.left - padding.right);
    const y = padding.top + ((maxY - value) / (maxY - minY)) * (height - padding.top - padding.bottom);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))];
  }

  function pathFor(items, valueFor) {
    return items.map((item, index) => {
      const [x, y] = point(item.day, valueFor(item));
      return `${index === 0 ? "M" : "L"}${x} ${y}`;
    }).join(" ");
  }

  function insightFor(item) {
    if (item.twin <= -45 && item.stress < 42) return "Below the response threshold with manageable simulated stress.";
    if (item.twin <= -45) return "Response is strong, but the twin is watching organ stress closely.";
    if (item.twin < item.untreated - 35) return "The twin is improving against untreated drift, but has not crossed the threshold yet.";
    if (item.stress > 55) return "Stress is high; this path would need clinician review before escalation.";
    return "Limited modeled response at this point in the virtual trial.";
  }

  const twinPath = pathFor(data, (item) => item.twin);
  const untreatedPath = pathFor(data, (item) => item.untreated);
  const stressPath = pathFor(data, (item) => item.stress);
  const upperPath = pathFor(data, (item) => item.twin + item.confidence);
  const lowerPath = data.slice().reverse().map((item) => {
    const [x, y] = point(item.day, item.twin - item.confidence);
    return `L${x} ${y}`;
  }).join(" ");
  const areaPath = `${upperPath} ${lowerPath} Z`;
  const threshold = point(0, -45)[1];
  const [markerX, markerY] = point(activeItem.day, activeItem.twin);
  const [, untreatedY] = point(activeItem.day, activeItem.untreated);
  const [, stressY] = point(activeItem.day, activeItem.stress);
  const tooltipX = Math.min(width - 258, Math.max(padding.left + 8, markerX + (markerX > width - 250 ? -270 : 20)));
  const tooltipY = Math.min(height - 136, Math.max(padding.top + 8, markerY - 92));
  const tooltipStyle = {
    left: `${(tooltipX / width) * 100}%`,
    top: `${(tooltipY / height) * 100}%`,
  };

  return (
    <div className="trajectory-chart trajectory-chart-advanced">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${patient.id} predicted response for ${treatment.name}`}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.28" />
            <stop offset="52%" stopColor="#38bdf8" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
          </linearGradient>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[0, 30, 60, 90, 120].map((day) => {
          const [x] = point(day, 0);
          return <line key={day} x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} className="chart-grid-line" />;
        })}
        {[-100, -50, 0, 50, 100].map((value) => {
          const [, y] = point(0, value);
          return (
            <g key={value}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className={value === 0 ? "chart-zero-line" : "chart-grid-line"} />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" className="chart-axis-label">{value}%</text>
            </g>
          );
        })}
        <path d={areaPath} className="chart-band" style={{ fill: `url(#${fillId})` }} />
        <line x1={padding.left} y1={threshold} x2={width - padding.right} y2={threshold} className="chart-threshold" />
        <path d={stressPath} className="chart-line-stress" />
        <path d={untreatedPath} className="chart-line chart-line-muted" />
        <path d={twinPath} className="chart-line chart-line-main" filter={`url(#${glowId})`} />
        <line x1={markerX} y1={padding.top} x2={markerX} y2={height - padding.bottom} className="chart-day-marker" />
        <circle cx={markerX} cy={markerY} r="9.2" className="chart-active-ring" />
        <circle cx={markerX} cy={markerY} r="5.8" className="chart-dot-main" />
        <circle cx={markerX} cy={untreatedY} r="4.6" className="chart-dot-muted" />
        <circle cx={markerX} cy={stressY} r="4.2" className="chart-dot-stress" />
        {data.map((item) => {
          const [x, y] = point(item.day, item.twin);
          const isActive = item.day === activeItem.day;
          return (
            <g key={item.day}>
              <circle cx={x} cy={y} r={isActive ? "5.2" : "3.8"} className={isActive ? "chart-hover-point chart-hover-point-active" : "chart-hover-point"} />
              <circle
                cx={x}
                cy={y}
                r="15"
                className="chart-hit-target"
                tabIndex="0"
                role="button"
                aria-label={`Day ${item.day}: twin ${item.twin} percent, untreated drift ${item.untreated} percent, stress ${item.stress} percent`}
                onPointerEnter={() => setActiveDay(item.day)}
                onPointerMove={() => setActiveDay(item.day)}
                onFocus={() => setActiveDay(item.day)}
              />
            </g>
          );
        })}
        {[0, 30, 60, 90, 120].map((day) => {
          const [x] = point(day, 0);
          return <text key={day} x={x} y={height - 10} textAnchor="middle" className="chart-axis-label">{day}d</text>;
        })}
        <text x={width - padding.right} y={threshold - 7} textAnchor="end" className="chart-threshold-label">response threshold</text>
        <text x={width - padding.right} y={padding.top + 13} textAnchor="end" className="chart-axis-label">tumor load</text>
      </svg>

      <div className="chart-tooltip" style={tooltipStyle} aria-live="polite">
        <span>Day {activeItem.day} / {patient.id}</span>
        <strong>{activeItem.twin}% twin prediction</strong>
        <div className="chart-tooltip-grid">
          <small>Twin <b>{activeItem.twin}%</b></small>
          <small>Untreated <b>{activeItem.untreated}%</b></small>
          <small>Stress <b>{activeItem.stress}%</b></small>
          <small>Uncertainty <b>+/-{activeItem.confidence}%</b></small>
        </div>
        <p>{insightFor(activeItem)}</p>
      </div>

      <div className="chart-legend">
        <span><i className="legend-main" />Twin prediction</span>
        <span><i className="legend-muted" />Untreated drift</span>
        <span><i className="legend-stress" />Stress index</span>
        <span><i className="legend-band" />Uncertainty</span>
      </div>
      <div className="chart-summary-grid">
        <span><strong>{activeItem.twin}%</strong> twin prediction on day {activeItem.day}</span>
        <span><strong>{activeItem.untreated}%</strong> untreated drift on day {activeItem.day}</span>
        <span><strong>{activeItem.stress}%</strong> simulated stress index</span>
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

function LabMaterializingOverlay({ patient }) {
  return (
    <div className="lab-materializing-overlay" aria-live="polite">
      <div className="lab-materializing-core">
        <span className="lab-materializing-ring lab-materializing-ring-a" />
        <span className="lab-materializing-ring lab-materializing-ring-b" />
        <span className="lab-materializing-scan" />
        <strong>{patient?.name || "Patient"} digital twin</strong>
        <small>generating scan chamber</small>
        <i />
      </div>
    </div>
  );
}

function PatientSetup({ patientName, setPatientName, activePatientId, selectPatientProfile, startSimulation }) {
  const activeProfile = patientById(activePatientId);
  const activeDisease = diseaseFor(activeProfile);
  const passPlan = activeProfile.passCombo.map((id) => CHEMICALS.find((item) => item.id === id)?.name || id).join(" + ");

  return (
    <div className="setup-shell min-h-screen">
      <div className="setup-ambient setup-ambient-a" />
      <div className="setup-ambient setup-ambient-b" />
      <div className="setup-grid">
        <section className="setup-panel">
          <div className="setup-status-strip">
            <span>Veridian OS</span>
            <span>Clinical simulation lab</span>
            <span>Research mode</span>
          </div>

          <div className="brand-lockup setup-brand">
            <div className="brand-mark"><Activity className="brand-icon" /></div>
            <div>
              <div className="brand-name">Veridian</div>
              <div className="brand-subtitle">patient-specific treatment simulation</div>
            </div>
          </div>

          <div className="setup-copy">
            <span className="section-kicker">Patient twin generator</span>
            <h1>Build the twin before the treatment.</h1>
            <p>Choose a patient, generate a simulated body model, detect the tumor signal, and test medicine plans digitally before anything touches the real body.</p>
          </div>

          <div className="setup-micro-grid" aria-label="Prototype capabilities">
            <span><strong>5</strong> demo patients</span>
            <span><strong>120d</strong> response curve</span>
            <span><strong>live</strong> twin trial</span>
          </div>

          <form onSubmit={startSimulation} className="setup-form">
            <label className="setup-label" htmlFor="patient-name">Patient identity</label>
            <div className="setup-input-row">
              <UserRound className="setup-input-icon" />
              <input
                id="patient-name"
                value={patientName}
                onChange={(event) => setPatientName(event.target.value)}
                placeholder="Enter patient name"
                className="setup-input"
              />
            </div>
            <button type="submit" className="setup-action setup-action-primary">
              <span className="setup-action-icon"><Activity className="button-icon" /></span>
              <span className="setup-action-copy">
                <strong>Generate patient twin</strong>
                <small>{activeProfile.id} / {activeDisease.name}</small>
              </span>
              <i aria-hidden="true" />
            </button>

            <div className="setup-patient-grid" aria-label="Demo patient profiles">
              {PATIENTS.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => selectPatientProfile(patient.id)}
                  className={`setup-patient ${patient.id === activePatientId ? "setup-patient-active" : ""}`}
                  aria-pressed={patient.id === activePatientId}
                >
                  <span>{patient.id}</span>
                  <strong>{patient.name}</strong>
                  <small>{patient.meta}</small>
                </button>
              ))}
            </div>

            <div className="setup-preview-card">
              <span>Selected twin profile</span>
              <strong>{activeDisease.name}</strong>
              <small>{activeDisease.site} / working simulated plan: {passPlan}</small>
            </div>

          </form>
        </section>

        <section className="setup-visual-panel" aria-label="Digital twin preview">
          <div className="setup-visual-copy">
            <span>Selected signal</span>
            <strong>{activeDisease.name}</strong>
          </div>
          <div className="setup-visual-stats" aria-label="Selected patient preview metrics">
            <span><strong>{activeProfile.twinScore}%</strong>Twin fidelity</span>
            <span><strong>{activeDisease.confidence}%</strong>Signal confidence</span>
            <span><strong>{activeProfile.passCombo.length}</strong>Plan agents</span>
          </div>
          <div className="setup-body-preview setup-build-preview">
            <div className="setup-build-core" aria-hidden="true">
              <span className="setup-core-ring setup-core-ring-a" />
              <span className="setup-core-ring setup-core-ring-b" />
              <span className="setup-core-ring setup-core-ring-c" />
              <span className="setup-core-scan" />
              <span className="setup-core-node setup-core-node-a" />
              <span className="setup-core-node setup-core-node-b" />
              <span className="setup-core-node setup-core-node-c" />
              <span className="setup-core-beam" />
            </div>
          </div>
          <div className="setup-orbit setup-orbit-a" />
          <div className="setup-orbit setup-orbit-b" />
          <div className="setup-scan-caption">preview chamber / drag to rotate in main lab</div>
        </section>
      </div>
    </div>
  );
}
export default function VeridianTwin() {
  const defaultPatient = patientById(DEFAULT_PATIENT_ID);
  const [isStarted, setIsStarted] = useState(false);
  const [isMaterializing, setIsMaterializing] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [phase, setPhase] = useState("scanning");
  const [scanComplete, setScanComplete] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [result, setResult] = useState(null);
  const [activeWorkspace, setActiveWorkspace] = useState("testing");
  const [activePatientId, setActivePatientIdState] = useState(DEFAULT_PATIENT_ID);
  const [patientName, setPatientName] = useState(defaultPatient.name);
  const [selectedTreatmentId, setSelectedTreatmentId] = useState(getBestTreatment(defaultPatient).id);
  const activePatient = useMemo(() => {
    const basePatient = patientById(activePatientId);
    return { ...basePatient, name: patientName.trim() || basePatient.name };
  }, [activePatientId, patientName]);
  const selectedTreatment = useMemo(() => getTreatment(activePatient, selectedTreatmentId), [activePatient, selectedTreatmentId]);
  const scanTimerRef = useRef(null);
  const trialTimerRef = useRef(null);

  useEffect(() => {
    if (!isStarted) return undefined;

    scanTimerRef.current = window.setTimeout(() => {
      setScanComplete(true);
      setPhase("ready");
    }, SCAN_MS);

    return () => {
      window.clearTimeout(scanTimerRef.current);
      window.clearTimeout(trialTimerRef.current);
    };
  }, [isStarted]);

  useEffect(() => {
    if (!isMaterializing) return undefined;
    const materializeTimer = window.setTimeout(() => setIsMaterializing(false), 2200);
    return () => window.clearTimeout(materializeTimer);
  }, [isMaterializing]);
  function selectPatientProfile(id) {
    const nextPatient = patientById(id);
    setActivePatientIdState(id);
    setPatientName(nextPatient.name);
    setSelectedTreatmentId(getBestTreatment(nextPatient).id);
    setSelected([]);
    setResult(null);
    if (scanComplete && phase !== "testing") setPhase("ready");
  }

  function startSimulation(event) {
    event.preventDefault();
    const selectedProfile = patientById(activePatientId);
    setPatientName(patientName.trim() || selectedProfile.name);
    setSelected([]);
    setResult(null);
    setIsDragOver(false);
    setActiveWorkspace("testing");
    setScanComplete(false);
    setPhase("scanning");
    setIsMaterializing(true);
    setIsStarted(true);
  }

  function selectPatient(id) {
    selectPatientProfile(id);
  }

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
      const passed = isPassingCombo(payload, activePatient);
      setResult({
        passed,
        message: passed
          ? `${activePatient.name} shows a strong simulated tumor-response curve with acceptable virtual organ stress.`
          : `${activePatient.name} did not reach the simulated response threshold or exceeded the stress window.`,
      });
      setPhase(passed ? "passed" : "failed");
    }, TEST_MS);
  }

  function startDrag(event) {
    if (selected.length === 0) return;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/veridian-medication-plan", selected.map((item) => item.id).join(","));
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
    if (!event.dataTransfer.getData("application/veridian-medication-plan")) return;
    runTest();
  }

  const canTest = scanComplete && selected.length > 0 && phase !== "testing";

  if (!isStarted) {
    return (
      <PatientSetup
        patientName={patientName}
        setPatientName={setPatientName}
        activePatientId={activePatientId}
        selectPatientProfile={selectPatientProfile}
        startSimulation={startSimulation}
      />
    );
  }

  return (
    <div className={`app-shell min-h-screen ${isMaterializing ? "app-shell-materializing" : ""}`}>
      <div className="app-frame mx-auto grid min-h-screen w-full max-w-[1840px] grid-rows-[auto_1fr] gap-4 p-4 sm:p-5">
        <header className="topbar topbar-clean">
          <div className="brand-lockup">
            <div className="brand-mark"><Activity className="brand-icon" /></div>
            <div>
              <div className="brand-name">Veridian</div>
              <div className="brand-subtitle">interactive digital twin trial lab</div>
            </div>
          </div>
        </header>

        <main className="main-grid twin-layout grid min-h-0 gap-4">
          <ScannerStage
            phase={phase}
            scanComplete={scanComplete}
            selected={selected}
            result={result}
            patient={activePatient}
            isMaterializing={isMaterializing}
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
                patient={activePatient}
                resetScan={resetScan}
              />
            ) : (
              <DashboardWorkspace
                scanComplete={scanComplete}
                phase={phase}
                selected={selected}
                result={result}
                patient={activePatient}
                selectedTreatment={selectedTreatment}
                selectedTreatmentId={selectedTreatment.id}
                setSelectedTreatmentId={setSelectedTreatmentId}
                activePatientId={activePatientId}
                setActivePatientId={selectPatient}
              />
            )}
          </WorkspacePanel>
        </main>
      </div>
      {isMaterializing && <LabMaterializingOverlay patient={activePatient} />}
    </div>
  );
}