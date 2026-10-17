// The POD missions: illustrative industry projects a visitor can explore inside the company.
// Plain data, shared by the 3D scene (positions) and the story panel (text). Everything here is a
// prepared, labelled example: no live plant, no real candidate, no measured result.

import type { P3 } from '../bridge';

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
  /** Where they stand, and the work object they look at. */
  at: P3;
  art: P3;
}

export interface MachineCondition {
  id: 'normal' | 'load' | 'wear';
  label: string;
  /** What the prepared example shows. */
  what: string;
}

export interface Mission {
  id: string;
  title: string;
  headline: string;
  problem: string;
  status: string;
  /** Where the hero machine stands. */
  machine: P3;
  people: PodPerson[];
  conditions: MachineCondition[];
}

export const MAINTENANCE: Mission = {
  id: 'maintenance',
  title: 'Predictive maintenance for a CNC machine',
  headline: 'From a machine signal to a maintenance decision.',
  problem: 'A CNC machine stops without warning when a spindle bearing wears out. The team turns its sensor readings into alerts a technician can trust.',
  status: 'Illustrative POD project',
  machine: [14.5, 0, -33.3],
  people: [
    { id: 'data', task: 'Organises the operating records, then prepares the readings and checks how the model performs',
      role: 'Data & AI', artifact: 'Source table of machine records, prepared readings, model version and its validation notes',
      review: 'Found that heavy cuts were missing from the records. Adding the job schedule stopped the false alerts.',
      at: [20.0, 0, -29.7], art: [19.7, 0.8, -30.9] },
    { id: 'mech', task: 'Defines what bearing failure looks like on this machine and when maintenance is worth doing',
      role: 'Mechanical / maintenance', artifact: 'Problem brief and the labelled bearing-wear events',
      review: 'Tightened the definition of a wear event after the first labels mixed in tool changes.',
      at: [11.4, 0, -30.6], art: [13.2, 1.2, -32.3] },
    { id: 'instr', task: 'Fits the vibration and temperature sensors and checks the readings can be trusted',
      role: 'Electrical / instrumentation', artifact: 'Sensor interface and the measurement-quality record',
      review: 'Moved the vibration sensor closer to the bearing after a noisy first mounting.',
      at: [12.9, 0, -30.0], art: [14.1, 2.2, -33.1] },
    { id: 'soft', task: 'Turns an alert into a screen a technician can act on',
      role: 'Software', artifact: 'Technician alert screen and its integration tests',
      review: 'Added the operating context beside every alert after technicians asked “why now?”.',
      at: [18.1, 0, -30.1], art: [17.4, 1.6, -31.5] },
    { id: 'ops', task: 'Deploys the service, watches it run and controls who can see the machine data',
      role: 'Cloud / MLOps & security', artifact: 'Deployment configuration, monitoring record and access tests',
      review: 'Closed an access test that let a shared account read raw sensor data.',
      at: [17.8, 0, -28.4], art: [18.3, 0.6, -27.6] },
  ],
  conditions: [
    { id: 'normal', label: 'Normal cycle', what: 'Steady vibration and temperature through a routine cut. No alert.' },
    { id: 'load', label: 'Heavy cut', what: 'A scheduled heavy cut makes the spindle work harder. Vibration and temperature rise, as expected.' },
    { id: 'wear', label: 'Bearing wear', what: 'Vibration slowly rises at the bearing over many cycles, with a gentle temperature creep.' },
  ],
};

/** Proposed validation goal (not a result). */
export const MAINTENANCE_GOAL = 'Proposed validation goal: useful warnings about six hours before a defined bearing-failure event, measured with false alerts and missed events.';

/** Develop: a week of machine records. Tuesday's job is missing, so its high vibration looks unexplained. */
export const RECORDS = {
  head: ['Day', 'Job', 'Tool', 'Spindle hours', 'Vibration'],
  rows: [
    ['Mon', 'Routine finishing', 'T12', '6.0', 'Normal'],
    ['Tue', '', 'T04', '7.5', 'High'],
    ['Wed', 'Routine finishing', 'T12', '5.5', 'Normal'],
    ['Thu', 'Routine finishing', 'T07', '6.5', 'Normal'],
    ['Fri', 'Heavy roughing cut (scheduled)', 'T04', '7.0', 'High'],
  ],
  missingRow: 1,
  fix: 'Heavy roughing cut (scheduled)',
};

/** Verify: what each person's sample ETAF report shows. Illustrative; no scores, tiers or decisions. */
export interface SampleReport { version: string; performance: string; observed: string; gaps: string }
export const REPORTS: Record<string, SampleReport> = {
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
};
