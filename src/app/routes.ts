// Every shareable place in the EmpowerED world, as plain data. The site uses it to open the
// 3D at the right spot and keep the address bar in step; the build uses it to write a real,
// readable HTML page for each path (title, description and text for search engines and
// visitors without 3D). Paths are relative to the site's base path and end with "/".

export type Journey = 'career' | 'workforce' | 'ai';

/** Where a route takes the visitor. */
export type Dest =
  | { k: 'home' }
  /** The lobby, with a journey already chosen (Career starts its guided route; Workforce asks who it's for). */
  | { k: 'journey'; j: Journey }
  /** A room on the guided student route (career journey). */
  | { k: 'career'; room: 'intake' | 'develop' | 'pro' | 'engineer' | 'verify' | 'deploy'; panel?: string }
  /** A workforce bay on the free workforce tour (stop id from the controller's workforce tour). */
  | { k: 'bay'; stop: 'talent' | 'pods' | 'teams' | 'campus' | 'region' }
  | { k: 'globe' }
  /** The Evidence & Impact gallery on the plaza. */
  | { k: 'evidence' }
  /** A section of the standard page. */
  | { k: 'page'; anchor: string };

export interface RouteDef {
  path: string;
  dest: Dest;
  /** Browser tab title. */
  title: string;
  /** Meta description (about 150 characters). */
  description: string;
  /** Readable text for the route's HTML page. */
  heading: string;
  body: string[];
}

const SITE = 'EmpowerED Careers';

export const ROUTES: RouteDef[] = [
  { path: '', dest: { k: 'home' }, title: `${SITE} — The AI Talent Company`,
    description: 'EmpowerED Careers turns learning into industry-ready AI talent: develop capability, engineer real products, verify readiness and deploy with confidence.',
    heading: 'EmpowerED Careers, home of the AI Talent Factory',
    body: ['Learning is not the same as getting hired. EmpowerED helps people find out what they can actually do: develop capability, engineer real products in PODs, verify readiness with ETAF™, and deploy with confidence.',
      'Explore three journeys: build your career, build your workforce, or discover AI for your profession.'] },

  { path: 'career/', dest: { k: 'journey', j: 'career' }, title: `Build My Career · ${SITE}`,
    description: 'Find out what you are capable of: start at the Entry Assessment, grow on Career Launch, Pro or Accelerate, build in a POD and prove it with a Readiness Passport.',
    heading: 'Build My Career',
    body: ['A guided route through six stops: Intake, Develop, Specialise, Engineer, Verify and Deploy. Each one shows you something new about what you can do.',
      'Every career path starts with the Entry Assessment. A job is not guaranteed; placement support depends on your track.'] },
  { path: 'career/assessment/', dest: { k: 'career', room: 'intake' }, title: `Entry Assessment · ${SITE}`,
    description: 'The Entry Assessment shows where you stand today, your strengths, the gaps worth closing and the roles they point to.',
    heading: 'Entry Assessment',
    body: ['A short assessment shows your starting point: what you can already do, your strengths, what to grow next and the roles that fit.', 'It is a starting point, not a test you pass or fail. It shapes the track that fits you.'] },
  { path: 'career/launch/', dest: { k: 'career', room: 'develop' }, title: `Career Launch · Foundation Hall · ${SITE}`,
    description: 'Career Launch builds your foundations in Foundation Hall. Everything you make collects in your Evidence Passport.',
    heading: 'Career Launch and Foundation Hall',
    body: ['Career Launch builds foundations, Career Pro develops depth in a role and Career Accelerate adds product engineering experience.', 'Everything you make collects in your Evidence Passport, so you can see your progress.'] },
  { path: 'career/specialisation/', dest: { k: 'career', room: 'pro' }, title: `Career Pro · Specialisation pods · ${SITE}`,
    description: 'Career Pro builds depth in one role through specialisation pods.',
    heading: 'Career Pro specialisation pods',
    body: ['On Career Pro you work in a specialisation pod, building depth in one role with work that’s specific to it, reviewed by a mentor.', 'The final list of specialisations is being confirmed.'] },
  { path: 'career/accelerate/', dest: { k: 'career', room: 'engineer' }, title: `Career Accelerate · Engineering floor · ${SITE}`,
    description: 'On Career Pro and Career Accelerate you join a POD: a small team taking on a real industry problem with a mentor beside you.',
    heading: 'Career Accelerate and the engineering floor',
    body: ['A POD is a small cross-functional team: product, AI/ML, data, full stack, cloud and cyber. Everyone has a real role, and a mentor guides the team.', 'PODs follow six stages: Discover, Design, Build, Test & Secure, Deploy & Operate, and Demo & Validate.'] },
  { path: 'career/assurance/', dest: { k: 'career', room: 'verify' }, title: `ETAF™ assurance · ${SITE}`,
    description: 'ETAF™ reviews assessments, project work and reviewed delivery. After review, your Evidence Passport becomes your Readiness Passport.',
    heading: 'ETAF™ assurance and the Readiness Passport',
    body: ['ETAF™ reviews your assessments, your project work and your reviewed delivery.', 'After that review, your Evidence Passport becomes your Readiness Passport: proof of what you can do that employers can check.'] },
  { path: 'career/opportunities/', dest: { k: 'career', room: 'deploy' }, title: `Opportunities · ${SITE}`,
    description: 'Placement support matched to your track: assistance on Career Launch, role-aligned support on Career Pro, premium-role opportunities on Career Accelerate.',
    heading: 'Opportunities and placement support',
    body: ['Career Launch: placement assistance. Career Pro: role-aligned support. Career Accelerate: premium-role opportunities.', 'A job is not guaranteed.'] },

  { path: 'workforce/', dest: { k: 'journey', j: 'workforce' }, title: `Build My Workforce · ${SITE}`,
    description: 'Five ways to work with EmpowerED: verified talent, product engineering PODs, workforce capability, campus talent factories and ecosystems at scale.',
    heading: 'Build My Workforce',
    body: ['Choose who you are building for: your company’s teams, a university, a product or startup, or a region.', 'Five bays: Verified Talent, Product Engineering PODs, Workforce Capability, Campus Talent Factory and Ecosystem at Scale.'] },
  { path: 'workforce/verified-talent/', dest: { k: 'bay', stop: 'talent' }, title: `Verified Talent · ${SITE}`,
    description: 'Verified capability, on demand. Talent is built before demand and verified before deployment.',
    heading: 'Verified Talent (Talent as a Service)',
    body: ['Talent is built before demand and verified before deployment: individuals, a dedicated POD or experts on demand, subject to availability and your requirements.'] },
  { path: 'workforce/product-engineering/', dest: { k: 'bay', stop: 'pods' }, title: `Product Engineering PODs · ${SITE}`,
    description: 'Bring us a problem. A cross-functional POD forms around it and takes it through six stages, guided by industry architects.',
    heading: 'Product Engineering PODs',
    body: ['A cross-functional POD forms around your problem and takes it through Discover, Design, Build, Test & Secure, Deploy & Operate, and Demo & Validate.', 'Deliverables, review points, timing and terms are agreed for your engagement.'] },
  { path: 'workforce/capability/', dest: { k: 'bay', stop: 'teams' }, title: `Workforce Capability · ${SITE}`,
    description: 'Upgrade the team you already have: teams join the reskilling line in the roles they hold today and apply AI to their real work.',
    heading: 'Workforce Capability',
    body: ['Teams join the reskilling line in the roles they hold today: Baseline, Reskill, Apply. A corporate academy, L&D as a service or a Human + AI workforce programme.'] },
  { path: 'workforce/campus/', dest: { k: 'bay', stop: 'campus' }, title: `Campus Talent Factory · ${SITE}`,
    description: 'A campus plugs into EmpowerED as an extension: an AI centre, labs, a curriculum pathway, faculty development and Student PODs.',
    heading: 'Campus Talent Factory',
    body: ['A Campus Talent Factory connects your institution with capability development and industry problem work. Scope is agreed with your university.'] },
  { path: 'workforce/ecosystem/', dest: { k: 'bay', stop: 'region' }, title: `Ecosystem at Scale · ${SITE}`,
    description: 'One pilot POD or regional hub links campuses, industry and government around a sector priority.',
    heading: 'Ecosystem at Scale',
    body: ['A regional hub links campuses, industry and government around a sector priority, once an initial scope is working.'] },

  { path: 'ai-for-everyone/', dest: { k: 'globe' }, title: `AI for Everyone · ${SITE}`,
    description: 'AI for every profession: explore how AI is reshaping the work people already do, level by level.',
    heading: 'AI for Everyone',
    body: ['Choose your profession and see where AI can support the work you already do: AI Awareness, AI Productivity, AI for your profession, applied projects and career readiness.'] },
  { path: 'ai-for-everyone/guide/', dest: { k: 'journey', j: 'ai' }, title: `AI for your profession · guided · ${SITE}`,
    description: 'A guided route for working professionals: a familiar task, a practical AI example with human review, and a learning path.',
    heading: 'AI for your profession',
    body: ['Choose your profession, see a familiar task, follow a practical example from input to AI draft to human review, then explore the learning path.'] },
  { path: 'evidence-impact/', dest: { k: 'evidence' }, title: `Evidence & Impact · ${SITE}`,
    description: 'How EmpowerED work becomes evidence: career passports, product POD delivery, workforce and campus programmes, and case studies once approved.',
    heading: 'Evidence & Impact',
    body: ['A gallery of how EmpowerED work becomes evidence: a sample Evidence and Readiness Passport, a product POD taken through six stages, a capability lens report, a campus partnership map and the regional hub model.',
      'Every example is labelled as illustrative. Case studies, including Malaysia, appear only once the organisations involved have approved them.'] },
];

/** Old hash links and where they live now. */
export const LEGACY_HASH: Record<string, string> = {
  career: 'career/', workforce: 'workforce/', 'ai-for-everyone': 'ai-for-everyone/', globe: 'ai-for-everyone/', evidence: 'evidence-impact/',
};

export const routeFor = (path: string): RouteDef | undefined => ROUTES.find((r) => r.path === path);
