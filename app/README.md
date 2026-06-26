# Veridian Pitch Guide

Veridian is a speculative prototype for a future where treatment decisions are tested on a patient-specific digital twin before they are tested on the patient.

The product shown here is simulated. The patients, tumor signals, medicines, outcomes, and body telemetry are fictional demo data. The medicine names are recognizable labels for storytelling only; this prototype is not medical advice and does not recommend any real treatment.

## One-Line Pitch

Before medicine touches the body, it should fail safely in software.

## The Big Idea

Today, treatment selection is still too much trial-and-error. A patient can receive a therapy, wait weeks or months, and only then learn whether it helped, failed, or caused stress elsewhere in the body.

Veridian imagines a different workflow:

1. Enter patient details and generate a living digital twin.
2. Detect a simulated tumor signal inside that twin.
3. Assemble medicine plans and test them virtually.
4. Watch the digital twin react before the real patient does.
5. Rank the option most likely to work for this specific person.

The long-term vision uses continuous body telemetry, including future nanobot-like sensors. The near-term wedge should sound realistic: start with labs, imaging, EHR data, wearables, genomics, and clinician feedback, then improve the twin as better sensing becomes possible.

## YC Video Strategy

YC-style pitches work best when they are clear, concrete, and fast. Do not sound like a sci-fi movie. Sound like a founder who has seen a broken system and built the first visual proof of a better workflow.

Use this order:

1. Problem: treatment is still slow, risky, and average-patient based.
2. Insight: every patient needs a simulation layer, not only a medical record.
3. Demo: generate the twin, detect tumor signal, run a virtual medicine trial, show the ranked dashboard.
4. Wedge: start with high-cost, high-uncertainty oncology decisions.
5. Vision: continuously updated patient twins that safely test interventions before reality.

## 60-Second Script

Hi, I am building Veridian.

Medicine still treats too many patients by trial and error. A doctor chooses a treatment, the patient takes it, and only later do we discover whether it worked for that specific body.

Veridian asks a simple question: what if the first trial happened on software, not on the patient?

Our prototype generates a digital twin for a patient, detects a simulated tumor signal, lets you assemble medicine plans, and runs virtual trials on the twin. The dashboard shows the predicted response curve, untreated drift, stress, uncertainty, and the best-ranked treatment path.

The long-term vision is a continuously updated human digital twin powered by real clinical data today and richer sensor telemetry tomorrow. Nanobot-like sensing is the future data layer, but the core product is the simulation engine: predict treatment response before treatment is given.

We are starting with a visual prototype because the idea is hard to understand in a spreadsheet. Once people see the twin react before the patient does, the future becomes obvious.

Veridian is not replacing doctors. It is giving doctors a safer simulation environment for the highest-stakes decisions in medicine.

## 2-Minute Demo Flow

Use this flow while recording your screen.

1. Start on the patient generator.
   Say: "First, we create a patient-specific digital twin. I can choose a demo patient or enter a new patient name."

2. Generate the twin and let the scan finish.
   Say: "The scan creates the virtual body model and detects a simulated tumor signal. In a real system this would come from labs, imaging, EHR, genomics, and sensor data."

3. Assemble the working medicine plan for the selected patient.
   Say: "Instead of immediately giving a medicine plan to the patient, I test it digitally first."

4. Run the digital twin trial or drag the plan onto the body.
   Say: "The twin reacts in simulation. The goal is to fail unsafe or weak plans in software before they touch the body."

5. Open Dashboard.
   Say: "Now I can compare patients. Each one has a different best plan, response probability, tumor-load delta, stress profile, and uncertainty."

6. Hover over the trajectory graph.
   Say: "This graph is the core product. It shows how the simulated body changes over time: twin response, no-treatment drift, stress, and uncertainty at each day."

7. End with the vision.
   Say: "The future of medicine is not one-size-fits-all treatment. It is patient-specific simulation before intervention."

## Demo Patients And Working Medicine Plans

Use these exact combinations in the testing tab. Every other combination intentionally fails in the prototype.

| Patient | Simulated disease signal | Working simulated medicine plan |
| --- | --- | --- |
| P01 Neha Rao | Early Breast Tumor Signal | Pembrolizumab + Paclitaxel + Ondansetron |
| P02 Arjun K. | Lung Tumor Response Risk | Cisplatin + Paclitaxel + Saline Support |
| P03 Isha Varma | Aggressive Lymphoma Signal | Rituximab + Pembrolizumab + Paracetamol |
| P04 Mira R. | Slow-Growing Tumor Cluster | Imatinib + Vitamin D3 + Ondansetron |
| P05 Kiran S. | Recurrent Solid Tumor Signal | Doxorubicin + Cisplatin + Saline Support |

These are demo labels, not recommendations. They are included so the prototype is easier to explain live.

## What To Emphasize

- This is a vision prototype, not a clinical product.
- The interface makes a complex idea instantly understandable.
- The first real product should focus on one narrow, expensive decision where treatment uncertainty is painful.
- The digital twin improves as new data arrives.
- The first customer is likely a research team, specialty clinic, pharma simulation team, or hospital innovation group.

## What Not To Say

Avoid saying:

- "We already diagnose disease."
- "Nanobots are ready."
- "This can replace doctors."
- "This proves which medicine works."
- "The prototype is medically accurate."

Say instead:

- "This is a simulated prototype of the workflow."
- "The long-term sensing layer could include nanobot-style telemetry."
- "The near-term product can start from existing patient data."
- "The goal is clinician-supervised decision support."
- "The hard technical problem is calibrated prediction, safety, and validation."

## The Pitch In One Sentence

Veridian turns a patient's medical data into a digital twin so treatment options can be simulated, compared, and ranked before real-world intervention.

## The Shocking Version

The first patient for every treatment should be a digital twin.

## Why Now

- Medical data is becoming more continuous: labs, imaging, genomics, wearables, remote monitoring, and EHR history.
- AI and simulation models are becoming good enough to model patient trajectories, uncertainty, and counterfactual outcomes.
- Healthcare costs are rising, and failed treatment paths are expensive.
- Clinicians need tools that explain uncertainty, not black boxes that simply output an answer.

## MVP Wedge

Do not start with "full-body nanobot medicine." Start narrower.

Possible wedge:

- One disease area.
- One treatment decision.
- One measurable outcome curve.
- One clinician-supervised simulation workflow.

Example pitchable wedge:

"We start with oncology treatment planning, where response uncertainty is high, treatment is expensive, and every failed line costs time the patient may not have."

## Demo Data Notes

Current prototype state:

- Disease signals: five patient-specific fictional tumor signals, each with its own visible twin locus.
- Patients: P01 through P05, all simulated.
- Medicines: recognizable demo labels used only for explanation.
- Graph: simulated 120-day trajectory with twin response, untreated drift, stress index, and uncertainty.
- Pass rule: each patient has one exact working simulated medicine plan listed above.

## Likely YC Questions And Answers

### Is this real?

The prototype is simulated. The real company would start by building patient-specific predictive models from existing clinical data. The prototype exists to make the workflow visible.

### Why will this work now?

Because medicine is moving from static records to continuous data, and AI simulation can now model trajectories instead of only classifying snapshots.

### Who pays?

Start with organizations that already pay for high-cost treatment decisions: specialty clinics, oncology groups, pharma teams, research hospitals, or clinical trial optimization teams.

### What is the wedge?

One disease, one high-value decision, one measurable predicted response curve.

### What is the moat?

The moat is calibrated longitudinal patient-response data, validated simulation loops, clinician trust, and outcome feedback that improves the twin over time.

### What is the risk?

The risk is clinical validation. That is why the first version must be positioned as research/prototype decision support, not autonomous diagnosis or treatment.

## Recording Checklist

Before recording:

- Open the app on the patient generator screen.
- Pick one patient and know their working medicine plan.
- Practice the 60-second script three times.
- Show the body scan, testing interaction, dashboard switch, and graph hover.
- Keep the voice confident and calm.
- Do not over-explain every UI element.
- End with the one-line vision.

Tone:

- Clear.
- Ambitious.
- Honest.
- Not hype-only.
- Not too technical.

## Product README

### Prototype Flow

1. The app opens with a digital twin generator.
2. Enter a patient name or choose one of the five demo patients.
3. Click Generate Digital Twin.
4. The twin scans, then reveals a simulated tumor signal.
5. Search medicines and add them to the medication plan.
6. Drag the plan onto the 3D body, or use the Run Digital Twin Trial button.
7. The body runs a virtual testing animation and returns pass or fail.
8. The dashboard shows patient-specific rankings and an interactive trajectory graph.

### Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173/`.

### Scripts

- `npm run dev` starts the Vite development server.
- `npm run build` creates the production build.
- `npm run lint` runs Oxlint.

## Research Basis

These references shaped the pitch framing:

- YC apply page: current YC application context and startup framing: https://www.ycombinator.com/apply
- Wired profile of YC: YC interviews and Demo Day reward fast clarity, strong founders, and proof that investors should care quickly: https://www.wired.com/2011/05/ff-ycombinator
- Digital twin treatment-response research: clinical decision support can combine treatment-effect estimation, patient digital twins, safety rules, and clinician review: https://arxiv.org/abs/2606.17405
- Patient digital twins for personalized treatment computation: in silico clinical trials can search for patient-specific treatment strategies: https://arxiv.org/abs/2106.10684
- In silico clinical trials systematic review: computational trials are promising in drug development, but validation and reproducibility are key challenges: https://arxiv.org/abs/2503.08746

## Final Reminder

For YC, clarity beats decoration. The prototype should make them feel the future, but the words should make them trust the founder.

Say this clearly:

"We are not claiming this is medically real today. We are showing the workflow medicine is moving toward: a patient-specific simulation layer before treatment decisions."