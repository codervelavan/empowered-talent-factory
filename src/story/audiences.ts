// The founder, HR / L&D, university and professional stories: what each visitor asks walking
// through EmpowerED, and how the guide answers. Draft copy for review; keep lines short.
import type { Beat } from './guide';

export const FOUNDER: Beat[] = [
  // Dock: what EmpowerED produces.
  { room: 'dock',
    you: "I've got a product idea, but no team to build it. Hiring takes months.",
    guide: 'Then bring us the problem instead. This is the dock, where companies choose what they need EmpowerED to produce.' },
  { room: 'dock', point: true,
    you: 'What can you produce?',
    guide: 'Verified talent, product PODs, workforce capability, campus programmes and regional ecosystems. For your idea, a product POD.' },

  // PODs: the team and the build.
  { room: 'engineer',
    you: 'What exactly do I get?',
    guide: 'A cross-functional POD forms around your problem: product, AI/ML, data, full stack, cloud and cyber, guided by industry architects.' },
  { room: 'engineer',
    guide: 'What would you like to know?',
    choices: [
      { id: 'time', label: 'How long does it take?', you: 'How long does it take?',
        guide: 'It depends on the problem. Every POD follows the same six stages, so you always know where your product is.' },
      { id: 'cost', label: 'What does it cost?', you: 'What does it cost?',
        guide: 'That depends on the problem and the team it needs. We scope every POD with you before it starts.' },
    ] },
  { room: 'engineer', point: true,
    you: "How do I know it's being built properly?",
    guide: 'You watch it move through Discover, Design, Build, Test & Secure, Deploy & Operate, and Demo & Validate. Nothing skips a stage.' },

  // Verify: trusting the builders.
  { room: 'verify', point: true,
    you: 'Can I trust the people building it?',
    guide: 'Every person on your POD is checked through ETAF™: assessments, project work and reviewed delivery. Each carries a Readiness Passport you can see.' },

  // Talent shelf: keep the team.
  { room: 'talent', point: true,
    you: 'Once it is built, does the team just leave?',
    guide: "You can keep them. The people who built your product are verified and ready to keep working with you. That's Talent as a Service." },
  { room: 'talent', end: true,
    you: 'How do I get started?',
    guide: "Bring us your problem. We'll shape the POD around it." },
];

export const HR: Beat[] = [
  // Teams: the reskilling line.
  { room: 'teams',
    you: "My teams need AI skills, and we can't hire fast enough to cover the gap.",
    guide: "Then let's build that capability inside the team you already have." },
  { room: 'teams',
    you: "We've tried online courses. People finish them and nothing changes.",
    guide: "That's why teams join the reskilling line in the roles they hold today, and apply AI to their real work: Baseline, Reskill, Apply." },
  { room: 'teams', point: true,
    guide: 'What matters most to you?',
    choices: [
      { id: 'start', label: 'How do we know where to start?', you: 'How do we know where to start?',
        guide: 'The capability lens maps each function against the outcome you want, so you can see which modules matter for which team.' },
      { id: 'academy', label: 'Can you run this as our academy?', you: 'Can you run this as our academy?',
        guide: 'Yes. A corporate academy, L&D as a service, or a Human + AI workforce programme.' },
    ] },

  // Talent: specialists now.
  { room: 'talent', point: true,
    you: 'And if we need specialists right now?',
    guide: 'Draw on verified talent: individuals, a dedicated POD, or experts on demand. Built before demand, verified before deployment.' },

  // Verify: proving it worked.
  { room: 'verify', point: true,
    you: 'How do I show the board it worked?',
    guide: 'ETAF™ checks demonstrated capability, not attendance, so you can see readiness move, team by team.' },

  // Dock: compare and start.
  { room: 'dock',
    you: 'Which option fits us?',
    guide: 'Each bay here is one way to work with us. Compare them side by side.' },
  { room: 'dock', end: true,
    you: 'Where do we begin?',
    guide: 'Start with an assessment of your workforce. It shows where AI capability will make the biggest difference.' },
];

export const UNIVERSITY: Beat[] = [
  // Campus: the extension slides in.
  { room: 'campus',
    you: 'Our students learn the syllabus, but industry has already moved on to AI.',
    guide: 'Then bring EmpowerED to your campus. A Campus Talent Factory plugs your university into the company as an extension.' },
  { room: 'campus', point: true,
    guide: 'Where would you like to start?',
    choices: [
      { id: 'setup', label: 'What do we actually set up?', you: 'What do we actually set up?',
        guide: 'An AI Centre of Excellence, labs and a curriculum pathway, co-owned with your university.' },
      { id: 'faculty', label: 'What about our faculty?', you: 'What about our faculty?',
        guide: 'Faculty development is part of it, so your teachers build AI capability alongside your students.' },
    ] },

  // Region: the wider network.
  { room: 'region',
    you: 'Can we link with other campuses and employers?',
    guide: 'Yes. A regional hub links campuses, industry and government around a sector priority.' },

  // Student PODs.
  { room: 'engineer', point: true,
    you: 'Will our students work with real companies?',
    guide: 'Yes. Student PODs take real industry problem statements through the same six stages as every POD here.' },

  // Verify: placements.
  { room: 'verify', point: true,
    you: 'How does that help placements?',
    guide: 'Every graduate leaves with ETAF™-validated evidence and a Readiness Passport employers can trust, not just a transcript.' },
  { room: 'verify', end: true,
    you: "What's the first step?",
    guide: "Let's design your Campus Talent Factory together." },
];

export const PROFESSIONAL: Beat[] = [
  { room: 'plaza',
    you: "I'm not an engineer. Will AI replace my job?",
    guide: 'Not everyone needs to be an engineer. Everyone needs AI. It changes how the work gets done, and people who use it well lead that change.' },
  { room: 'plaza', point: true,
    you: 'What does AI actually do in my field?',
    guide: 'Practical things: forecasting in finance, documentation in healthcare, lesson planning in teaching. The globe up there maps them by profession.' },
  { room: 'plaza',
    you: 'Where would someone like me start?',
    guide: 'At the level that fits you: AI Awareness, AI Productivity, AI for your profession, then applied projects and career readiness.' },
  { room: 'plaza', end: true,
    you: 'Show me my path.',
    guide: "Hold on tight. Let's fly up to the globe and find your profession." },
];
