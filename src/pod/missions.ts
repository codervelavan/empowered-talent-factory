// The POD missions: illustrative industry projects a visitor can explore inside the company.
// Plain data, shared by the 3D scene (positions) and the story panel (text). Everything here is a
// prepared, labelled example: no live plant, no real candidate, no measured result.
//
// All missions use the same place on the engineering floor: one centrepiece, and five team spots, each
// with a work object (0 the bench, 1 the centrepiece's front, 2 its upper part, 3 the screen, 4 the
// operations box). Only the active mission's centrepiece is shown.

import type { P3 } from '../bridge';

/** Where the centrepiece stands, where each team member stands and the work object they look at. */
export const POD_PLACE = {
  centre: [14.5, 0, -33.3] as P3,
  at: [[20.0, 0, -29.7], [11.4, 0, -30.6], [12.9, 0, -30.0], [18.1, 0, -30.1], [17.8, 0, -28.4]] as P3[],
  art: [[19.7, 0.8, -30.9], [13.2, 1.2, -32.3], [14.1, 2.2, -33.1], [17.4, 1.6, -31.5], [18.3, 0.6, -27.6]] as P3[],
};

export interface PodPerson {
  id: string;
  /** What they do, said before the discipline name. */
  task: string;
  /** Proposed discipline (illustrative; roles can be combined in a real team). */
  role: string;
  /** The work you can inspect. */
  artifact: string;
  /** What review changed in their work. */
  review: string;
}

export interface MachineCondition {
  label: string;
  /** What the prepared example shows. */
  what: string;
  /** Outcome once the example has run (for the finding condition: the first version's outcome). */
  done: string;
  /** Outcome after the team's revision (finding condition only). */
  revised?: string;
}

export interface SampleReport { version: string; performance: string; observed: string; gaps: string }

export interface DevelopTask {
  title: string;
  intro: string;
  region: string;
  head: string[];
  rows: string[][];
  /** The row and column that are wrong, and the corrected value. */
  row: number; col: number; fix: string;
  check: string; gapTitle: string; gapText: string; fixLabel: string; fixedTitle: string; fixedText: string;
  note: string;
}

export interface Mission {
  id: 'maintenance' | 'inspection' | 'assistant';
  /** Short name on the project picker. */
  short: string;
  title: string;
  headline: string;
  problem: string;
  status: string;
  people: PodPerson[];
  /** Three prepared conditions; conditions[1] is the one with the finding. */
  conditions: MachineCondition[];
  finding: { title: string; text: string; revise: string; revisedTitle: string; by: number };
  goal: string;
  develop: DevelopTask;
  reports: Record<string, SampleReport>;
  employer: { demo: string; review: string; delivery: string };
  /** The six delivery stages as an about-12-second overview: who leads each one, what happens and what can be inspected. */
  stages: DeliveryStage[];
}

/** One delivery stage in the overview. `run` replays the prepared finding (first version or reviewed). */
export interface DeliveryStage { by: number; run?: 'first' | 'revised'; event: string; artifact: string }
export const STAGE_NAMES = ['Discover', 'Design', 'Build', 'Test & Secure', 'Deploy & Operate', 'Demo & Validate'];

/** Develop's other four areas (the project bench is the record task itself). Optional close-ups. */
export interface DevelopArea { name: string; see: string; act: string; result: string; at: P3 }
export const DEVELOP_AREAS: DevelopArea[] = [
  { name: 'Foundations', see: 'Paired practice: a notebook, a laptop and a sample table.', act: 'Inspect an example',
    result: 'The notebook observation now matches its table entry: same day, same machine, same reading.', at: [-11.2, 6, -44.6] },
  { name: 'AI practice', see: 'A learner checks a prepared AI draft against its source material.', act: 'Check the draft',
    result: 'One claim isn’t in the source. The reviewed correction removes it and cites the line the rest came from.', at: [-5.8, 6, -46.4] },
  { name: 'Collaboration', see: 'Two peers and a mentor compare the same piece of work.', act: 'Ask why it was revised',
    result: 'They pause on the changed record. The review note explains what was missing and who confirmed it.', at: [-2.8, 6, -43.8] },
  { name: 'Career readiness', see: 'A learner explains one piece of work to a peer.', act: 'See the explanation',
    result: 'The contribution, the feedback it received and one open question are highlighted. The captions work without sound.', at: [-3.4, 6, -39.4] },
];

export const MAINTENANCE: Mission = {
  id: 'maintenance',
  short: 'Predictive maintenance',
  title: 'Predictive maintenance for a CNC machine',
  headline: 'From a machine signal to a maintenance decision.',
  problem: 'A CNC machine stops without warning when a spindle bearing wears out. The team turns its sensor readings into alerts a technician can trust.',
  status: 'Illustrative POD project',
  people: [
    { id: 'data', task: 'Organises the operating records, then prepares the readings and checks how the model performs',
      role: 'Data & AI', artifact: 'Source table of machine records, prepared readings, model version and its validation notes',
      review: 'Found that heavy cuts were missing from the records. Adding the job schedule stopped the false alerts.' },
    { id: 'mech', task: 'Defines what bearing failure looks like on this machine and when maintenance is worth doing',
      role: 'Mechanical / maintenance', artifact: 'Problem brief and the labelled bearing-wear events',
      review: 'Tightened the definition of a wear event after the first labels mixed in tool changes.' },
    { id: 'instr', task: 'Fits the vibration and temperature sensors and checks the readings can be trusted',
      role: 'Electrical / instrumentation', artifact: 'Sensor interface and the measurement-quality record',
      review: 'Moved the vibration sensor closer to the bearing after a noisy first mounting.' },
    { id: 'soft', task: 'Turns an alert into a screen a technician can act on',
      role: 'Software', artifact: 'Technician alert screen and its integration tests',
      review: 'Added the operating context beside every alert after technicians asked “why now?”.' },
    { id: 'ops', task: 'Deploys the service, watches it run and controls who can see the machine data',
      role: 'Cloud / MLOps & security', artifact: 'Deployment configuration, monitoring record and access tests',
      review: 'Closed an access test that let a shared account read raw sensor data.' },
  ],
  conditions: [
    { label: 'Normal cycle', what: 'Steady vibration and temperature through a routine cut. No alert.', done: 'No alert. This is the baseline the team compares against.' },
    { label: 'Heavy cut', what: 'A scheduled heavy cut makes the spindle work harder. Vibration and temperature rise, as expected.',
      done: 'The first version raised an alert.', revised: 'No alert: the reading is expected during a scheduled heavy cut.' },
    { label: 'Bearing wear', what: 'Vibration slowly rises at the bearing over many cycles, with a gentle temperature creep.',
      done: 'Alert: early wear signs, shown with the operating context. A technician decides when to inspect.' },
  ],
  finding: { title: 'Finding: a false alert.', text: 'The heavy cut was planned, so the high reading was expected. An alert here would teach technicians to ignore the screen.',
    revise: 'See the team’s revision', revisedTitle: 'Revised.', by: 0 },
  goal: 'Proposed validation goal: useful warnings about six hours before a defined bearing-failure event, measured with false alerts and missed events.',
  develop: {
    title: 'Make the records useful.',
    intro: 'The maintenance POD starts with a week of machine records. Careful records are a real contribution: the alerts later depend on them.',
    region: 'Machine records, example week',
    head: ['Day', 'Job', 'Tool', 'Spindle hours', 'Vibration'],
    rows: [['Mon', 'Routine finishing', 'T12', '6.0', 'Normal'], ['Tue', '', 'T04', '7.5', 'High'], ['Wed', 'Routine finishing', 'T12', '5.5', 'Normal'],
      ['Thu', 'Routine finishing', 'T07', '6.5', 'Normal'], ['Fri', 'Heavy roughing cut (scheduled)', 'T04', '7.0', 'High']],
    row: 1, col: 1, fix: 'Heavy roughing cut (scheduled)',
    check: 'Check the records', gapTitle: 'Tuesday’s job is missing.', gapText: 'Its vibration was high, but nothing says why. Without the job, the reading looks like a fault.',
    fixLabel: 'Add the job schedule', fixedTitle: 'Fixed: a scheduled heavy cut.', fixedText: 'Now the high reading has a reason. This same change later stops a false alert at the POD.',
    note: 'Example records · not a real machine',
  },
  reports: {
    data: { version: 'Source table v1 → v2: job schedule added after review',
      performance: 'Validation notes: the false alert on scheduled heavy cuts is gone in v2 (example)',
      observed: 'Asked the machinist about Tuesday’s missing entry, then revised the table after review',
      gaps: 'Evaluating the model on more machines is still to do' },
    mech: { version: 'Wear-event definition v1 → v2: tool changes separated from bearing events',
      performance: 'Labelled events checked against maintenance logs (example)',
      observed: 'Reworked the labels when the team questioned two events',
      gaps: 'Needs a longer history of real bearing failures' },
    instr: { version: 'Sensor mounting v1 → v2: vibration sensor moved closer to the bearing',
      performance: 'Measurement-quality record: noise before and after remounting (example)',
      observed: 'Remounted the sensor after teammates flagged noisy readings',
      gaps: 'Temperature sensor calibration still to confirm' },
    soft: { version: 'Alert screen v1 → v2: operating context added beside each alert',
      performance: 'Technician walkthrough notes (example)',
      observed: 'Changed the screen after technicians asked “why now?”',
      gaps: 'Usability check with more technicians' },
    ops: { version: 'Deployment configuration v1 → v2: shared-account access closed',
      performance: 'Monitoring record and access-test results (example)',
      observed: 'Reported and fixed an access path found in testing',
      gaps: 'Load test at full shift volume still to run' },
  },
  employer: { demo: 'The alert screen, run on example data with the technician’s view.', review: 'The false alert on a heavy cut, and the change that fixed it.',
    delivery: 'Team demo of the alert service (team-level evidence, not individual)' },
  stages: [
    { by: 1, event: 'The technician describes unexpected downtime; the team agrees what must be understood.', artifact: 'Problem brief, operating need and open questions' },
    { by: 2, event: 'Sensor, context, detection and technician-response connections are planned.', artifact: 'System flow and design choices' },
    { by: 0, event: 'Individual contributions join into the working example.', artifact: 'Organised records, prepared readings and integration work' },
    { by: 0, run: 'first', event: 'A heavy cut triggers the prepared false alert; context and review expose it. Access tests run as a separate responsibility.', artifact: 'Validation finding, review note and security tests' },
    { by: 4, event: 'The prepared service reaches its demonstration environment; monitoring and handoff become visible.', artifact: 'Deployment, monitoring and operating instructions' },
    { by: 3, run: 'revised', event: 'The technician and the team check the result against the original need.', artifact: 'Demo record, limitations and reviewed delivery' },
  ],
};

export const INSPECTION: Mission = {
  id: 'inspection',
  short: 'Chip inspection',
  title: 'Visual inspection for packaged chips',
  headline: 'A defect is one part of the problem. The team builds the inspection system.',
  problem: 'Packaged chips pass under a camera on a conveyor. The team connects imaging, an edge model, the sorting arm and a human review lane, so visible defects are caught consistently.',
  status: 'Illustrative POD project',
  people: [
    { id: 'img', task: 'Organises and checks the reference images the model learns from',
      role: 'Data / annotation', artifact: 'Image catalogue, source checks and the relabelled examples',
      review: 'Found reflections labelled as scratches and relabelled them after review.' },
    { id: 'iot', task: 'Connects the camera and lighting to the conveyor and the sorting arm',
      role: 'IoT / hardware', artifact: 'Camera interface, control integration and the handling test',
      review: 'Made the conveyor pause under the camera after the first captures were blurred.' },
    { id: 'ai', task: 'Trains the edge model and measures it on the actual device',
      role: 'AI engineer', artifact: 'Model version, evaluation plan and the on-device latency test',
      review: 'Sends low-confidence parts to human review instead of rejecting them automatically.' },
    { id: 'app', task: 'Builds the review lane screen inspectors use',
      role: 'Software / integration', artifact: 'Review lane screen and its integration tests',
      review: 'Shows the image region behind each decision after inspectors asked to see it.' },
    { id: 'ops', task: 'Packages model updates and protects which devices can connect',
      role: 'Cloud / deployment & security', artifact: 'Deployment configuration, model-update record and access tests',
      review: 'Replaced a shared device key found in testing and added a rollback step.' },
  ],
  conditions: [
    { label: 'Clear sample', what: 'A clean chip passes under the camera.', done: 'Passed: no visible anomaly. The chip carries on.' },
    { label: 'Ambiguous sample', what: 'A chip with a faint mark that could be a scratch or a reflection.',
      done: 'The first version rejected it automatically.', revised: 'Sent to the human review lane: the model isn’t confident, so a person decides.' },
    { label: 'Visible defect', what: 'A chip with clear damage at one edge.', done: 'Rejected, with the image region that shows the damage.' },
  ],
  finding: { title: 'Finding: an uncertain part was rejected.', text: 'The model wasn’t sure, but the first version rejected the chip anyway. Good parts would be thrown away, and no one would know why.',
    revise: 'See the team’s revision', revisedTitle: 'Revised.', by: 2 },
  goal: 'Proposed target: model inference under 100 ms on specified edge hardware, measured separately from capture and sorting. Not a measured result.',
  develop: {
    title: 'Check the reference images.',
    intro: 'The inspection POD starts with labelled reference images. Careful labels are a real contribution: the model learns from them.',
    region: 'Reference images, example set',
    head: ['Image', 'Part', 'Label', 'Checked by'],
    rows: [['IMG-01', 'QFN-32', 'Clean', 'Lead'], ['IMG-02', 'QFN-32', 'Scratch', '—'], ['IMG-03', 'SOIC-8', 'Edge chip', 'Lead'],
      ['IMG-04', 'SOIC-8', 'Clean', 'Lead'], ['IMG-05', 'QFN-32', 'Clean (reflection)', 'Lead']],
    row: 1, col: 2, fix: 'Clean (reflection)',
    check: 'Check the labels', gapTitle: 'IMG-02 looks wrong.', gapText: 'It’s labelled a scratch, but it matches IMG-05: light reflecting off the package. Nobody has checked it yet.',
    fixLabel: 'Relabel after review', fixedTitle: 'Fixed: a reflection, not a scratch.', fixedText: 'Wrong labels teach the model to reject good parts. This same care later sends uncertain parts to a person.',
    note: 'Example images · not real production data',
  },
  reports: {
    img: { version: 'Image catalogue v1 → v2: reflections relabelled after review', performance: 'Label check: disagreements found and resolved (example)',
      observed: 'Compared doubtful images with a teammate before relabelling', gaps: 'More examples of rare defects are still needed' },
    iot: { version: 'Handling v1 → v2: conveyor pauses under the camera', performance: 'Handling test: sharp captures at line speed (example)',
      observed: 'Re-timed the conveyor after the AI engineer reported blurred images', gaps: 'Lighting test across shifts still to run' },
    ai: { version: 'Decision rule v1 → v2: low confidence goes to human review', performance: 'Evaluation plan and on-device latency test (example; target, not a result)',
      observed: 'Raised the uncertain-part problem with the team and changed the rule', gaps: 'Evaluation on a second chip type is still to do' },
    app: { version: 'Review screen v1 → v2: image region shown beside each decision', performance: 'Inspector walkthrough notes (example)',
      observed: 'Changed the screen after inspectors asked why a part was flagged', gaps: 'Check with more inspectors on a full shift' },
    ops: { version: 'Device access v1 → v2: shared key replaced, rollback added', performance: 'Model-update and access-test record (example)',
      observed: 'Reported the shared key and fixed it with the team', gaps: 'Update test across several devices still to run' },
  },
  employer: { demo: 'The inspection cell, run on example images with the review lane.', review: 'The uncertain part that was rejected, and the change that sends it to a person.',
    delivery: 'Team demo of the inspection cell (team-level evidence, not individual)' },
  stages: [
    { by: 0, event: 'The line lead explains which defects matter and what a missed one costs.', artifact: 'Problem brief, defect definitions and open questions' },
    { by: 1, event: 'Camera, lighting, edge device and the review lane are planned together.', artifact: 'System flow and handling design' },
    { by: 2, event: 'The model, camera interface and review screen join into the working example.', artifact: 'Model version, camera integration and review-lane build' },
    { by: 2, run: 'first', event: 'An uncertain part is run; the first version rejects it instead of sending it to review. Update and access tests run separately.', artifact: 'Validation finding, threshold review and security tests' },
    { by: 4, event: 'The prepared service reaches the demonstration line; model updates and monitoring are recorded.', artifact: 'Deployment, model-update record and monitoring' },
    { by: 3, run: 'revised', event: 'The line lead checks the review lane against the original need.', artifact: 'Demo record, limitations and reviewed delivery' },
  ],
};

export const ASSISTANT: Mission = {
  id: 'assistant',
  short: 'Supply-chain assistant',
  title: 'A source-checked assistant for supply chain and compliance',
  headline: 'A useful answer needs the right sources, and the right permissions.',
  problem: 'People need answers from customs papers, bills of materials and export-rule summaries. The assistant first retrieves the sources a person is allowed to see, then drafts an answer that cites them, for a person to review.',
  status: 'Illustrative POD project',
  people: [
    { id: 'src', task: 'Organises the source documents and checks their versions',
      role: 'Data engineer', artifact: 'Source catalogue, ingestion work and the version fix',
      review: 'Found an out-of-date export-rule summary in the pack and replaced it with the current one.' },
    { id: 'dom', task: 'Checks what an answer can actually support',
      role: 'Supply-chain / compliance reviewer', artifact: 'Source interpretation and review notes',
      review: 'Flagged a draft that went beyond its sources; it now asks for evidence instead.' },
    { id: 'rag', task: 'Finds the relevant passages and tests that answers stay grounded',
      role: 'AI / retrieval engineer', artifact: 'Retrieval tests, citations and the unsupported-question cases',
      review: 'Added a check that every line of a draft points to a source.' },
    { id: 'app', task: 'Builds the screen where people ask and check answers',
      role: 'Application engineer', artifact: 'Interface, API integration and the latency test plan',
      review: 'Added a “show its source” link after reviewers asked where a line came from.' },
    { id: 'sec', task: 'Decides who may see which document and tests for leaks',
      role: 'Security specialist', artifact: 'Permission rules, access-denial tests and findings',
      review: 'Moved the permission check before retrieval after a restricted document reached a draft.' },
  ],
  conditions: [
    { label: 'Ask the example question', what: '“What information is missing from this shipment pack?” asked by a logistics coordinator.',
      done: 'A draft that cites the customs form, the bill of materials and the export-rule summary, for a person to review.' },
    { label: 'Switch user role', what: 'The same question from a planner who may not see the supplier contract.',
      done: 'The first version used the restricted contract in the draft.', revised: 'The contract is excluded before retrieval. The draft says one document isn’t available to this role.' },
    { label: 'Ask an unsupported question', what: '“Is this shipment fully compliant?” — something the sources can’t settle.',
      done: 'Not enough support in the approved sources. The assistant asks for evidence instead of guessing.' },
  ],
  finding: { title: 'Finding: a restricted document reached the draft.', text: 'The planner isn’t allowed to see the supplier contract, but the first version retrieved it anyway. Access has to be checked before anything is retrieved.',
    revise: 'See the team’s revision', revisedTitle: 'Revised.', by: 4 },
  goal: 'Proposed checks: retrieval quality, latency, access-denial and grounding tests. No promise of zero leaks or zero errors; a person reviews every answer.',
  develop: {
    title: 'Check the source pack.',
    intro: 'The assistant POD starts with the documents it may draw on. A careful source catalogue is a real contribution: every answer depends on it.',
    region: 'Source pack, example shipment',
    head: ['Document', 'Version', 'Owner', 'Access'],
    rows: [['Customs declaration', 'v2', 'Logistics', 'All staff'], ['Bill of materials', 'v5', 'Engineering', 'All staff'], ['Export-rule summary', 'v1 (superseded)', 'Compliance', 'All staff'],
      ['Supplier contract', 'v3', 'Procurement', 'Restricted'], ['Packing list', 'v1', 'Warehouse', 'All staff']],
    row: 2, col: 1, fix: 'v3 (current)',
    check: 'Check the versions', gapTitle: 'The export-rule summary is out of date.', gapText: 'Version 1 was replaced, but it’s still in the pack. An answer could quote rules that no longer apply.',
    fixLabel: 'Use the current version', fixedTitle: 'Fixed: the current summary.', fixedText: 'Answers now draw on the right version. This same care later keeps restricted documents out of drafts.',
    note: 'Example documents · not real shipment data',
  },
  reports: {
    src: { version: 'Source catalogue v1 → v2: superseded export-rule summary replaced', performance: 'Catalogue check: versions and owners confirmed (example)',
      observed: 'Asked the compliance owner which version was current before changing it', gaps: 'Automatic version checks are still to build' },
    dom: { version: 'Review notes v1 → v2: “ask for evidence” rule added', performance: 'Review of example answers against their sources (example)',
      observed: 'Explained to the team why one answer overreached', gaps: 'Review with a second compliance specialist' },
    rag: { version: 'Grounding test v1 → v2: every line must cite a source', performance: 'Retrieval and unsupported-question tests (example)',
      observed: 'Added test cases after the reviewer’s finding', gaps: 'Latency test on the full document set still to run' },
    app: { version: 'Answer screen v1 → v2: “show its source” link added', performance: 'Reviewer walkthrough notes (example)',
      observed: 'Changed the screen after reviewers asked where lines came from', gaps: 'Accessibility check still to do' },
    sec: { version: 'Access rule v1 → v2: permission check moved before retrieval', performance: 'Access-denial tests by role (example)',
      observed: 'Reported the restricted-document leak and fixed it with the retrieval engineer', gaps: 'Testing with more roles and documents' },
  },
  employer: { demo: 'The assistant, run on example documents, with each answer’s sources shown.', review: 'The restricted document that reached a draft, and the change that keeps it out.',
    delivery: 'Team demo of the assistant (team-level evidence, not individual)' },
  stages: [
    { by: 1, event: 'A planner explains the questions they need answered and what they are allowed to see.', artifact: 'Problem brief, approved sources and open questions' },
    { by: 4, event: 'Permissions, retrieval, citations and human review are planned before any drafting.', artifact: 'Permission model and system flow' },
    { by: 0, event: 'Sources, retrieval and the interface join into the working example.', artifact: 'Source catalogue, retrieval build and interface' },
    { by: 4, run: 'first', event: 'A planner’s question pulls a restricted contract into the first version; permission tests expose it.', artifact: 'Validation finding and access-denial tests' },
    { by: 3, event: 'The prepared assistant reaches its demonstration environment with monitoring and an audit trail.', artifact: 'Deployment, monitoring and audit record' },
    { by: 1, run: 'revised', event: 'The reviewer checks cited drafts against the sources and the original need.', artifact: 'Demo record, limitations and reviewed delivery' },
  ],
};

export const MISSIONS: Mission[] = [MAINTENANCE, INSPECTION, ASSISTANT];
