// The five guided routes, from the EmpowerED guided tour improvement plan (15 October 2026)
// and the stage B review. Each stop recognises one concern, answers it in one or two
// sentences, shows an illustrative example board, offers optional questions and says why the
// next room matters. Keep lines short: they share one panel. Never state timelines, prices,
// terms or outcomes the owner has not approved.
import { INDS } from '../data/content';
import type { Ask, Profession, StoryCtx, StoryPath } from './guide';
import { board, chips, flow, note, rows, STAGES, table } from './exhibits';

/** Worked examples for each profession with finished copy (illustrative; owner to approve). */
export interface ProfessionDemo {
  /** A task people in the profession already do. */
  task: string;
  /** What AI can help with in that task, and what stays with the person. */
  helps: string;
  decides: string;
  /** Sample input, AI draft and the human review step. */
  demo: [string, string, string];
  /** Task-specific answers for each of the profession's uses (same order as INDS uses). */
  uses: string[];
}
export const DEMOS: Record<string, ProfessionDemo> = {
  'Business & Finance': {
    task: 'Preparing the monthly management report',
    helps: 'Drafting variance commentary and pulling figures into the template.',
    decides: 'Which explanations are true, and what goes to the board.',
    demo: ['Sample month-end figures and last month’s commentary', 'A draft explaining which lines moved and likely reasons', 'You check each reason against the ledger and remove anything you can’t confirm'],
    uses: [
      'AI pulls figures into a report template and drafts the commentary. You confirm the numbers and the story before it is shared.',
      'AI fits a trend to past sales and flags unusual months. You add what it can’t know, like a planned promotion, before the forecast is used.',
      'AI can route invoices or extract expense details into a form. You approve exceptions and anything outside your limits.',
    ],
  },
  Healthcare: {
    task: 'Writing up notes after a consultation',
    helps: 'Turning notes into a structured summary.',
    decides: 'Every clinical detail, and what enters the record.',
    demo: ['Sample consultation notes for a fictional patient', 'A structured summary: history, findings and plan', 'The clinician checks every line against the notes before it is saved'],
    uses: [
      'AI can surface guideline reminders or possible interactions. The clinician decides; it never replaces clinical judgement.',
      'AI drafts summaries from notes or letters. The clinician corrects and signs them off.',
      'AI can help find patterns across de-identified data. Researchers check the findings, within your data governance.',
    ],
  },
  Education: {
    task: 'Planning next week’s lessons',
    helps: 'Drafting a lesson outline, an activity and check questions.',
    decides: 'What suits your class, and whether the content is accurate.',
    demo: ['Your syllabus topic and the class level', 'A lesson outline with one activity and three check questions', 'You adapt it to your class and check facts and level'],
    uses: [
      'AI drafts outlines and resources from your topic. You shape them for your class.',
      'AI can draft questions and a marking guide. You check fairness and level, and you decide the marks.',
      'AI can suggest practice by topic for each student. You review the suggestions against what you know about them.',
    ],
  },
  'Hospitality & Tourism': {
    task: 'Replying to guest messages',
    helps: 'Drafting a clear, friendly reply with the right details.',
    decides: 'Availability, policy and the final wording.',
    demo: ['A sample guest email asking to change dates and add a cot', 'A draft reply with the new dates and the options', 'You confirm availability and policy before sending'],
    uses: [
      'AI drafts replies to guest messages. You check facts and tone before sending.',
      'AI suggests itineraries from a guest’s preferences. Staff check opening times and suitability.',
      'AI can help forecast busy periods across properties. Managers decide staffing.',
    ],
  },
  'Manufacturing & Supply Chain': {
    task: 'Reviewing the weekly maintenance log',
    helps: 'Spotting machines whose readings are drifting.',
    decides: 'Whether to inspect, and what work order to raise.',
    demo: ['Sample sensor readings and the maintenance log', 'Two machines flagged as drifting, with the readings behind each flag', 'An engineer inspects them before any work order is raised'],
    uses: [
      'AI flags equipment whose readings suggest wear. Engineers inspect before acting.',
      'Vision models flag possible defects on the line. Inspectors confirm before parts are rejected.',
      'AI forecasts demand from orders and seasonality. Planners adjust for what it can’t see, like a new contract.',
    ],
  },
};

/** Professions with finished copy and a worked example (placeholder industries stay hidden). */
export const PROFESSIONS: Profession[] = INDS.filter((d) => !d.ph && DEMOS[d.name]).map((d) => ({ name: d.name, line: d.line, uses: d.uses }));
/** Index of each of those professions in INDS (the globe's node order). */
export const PROFESSION_NODE: number[] = PROFESSIONS.map((p) => INDS.findIndex((d) => d.name === p.name));
const LEVELS: [string, string][] = [
  ['AI Awareness', 'What AI is, what it can and cannot do, and how to use it safely.'],
  ['AI Productivity', 'Everyday AI tools for writing, research, analysis and planning.'],
  ['For Your Profession', 'AI applied to the workflows of your profession.'],
  ['Applied Projects', 'Real projects that produce work you can show.'],
  ['Career Readiness', 'Evidence of capability that employers can check.'],
];
const prof = (c: StoryCtx) => PROFESSIONS[Math.max(0, c.profession)];
const demo = (c: StoryCtx) => DEMOS[prof(c).name];
/** Lower-case the first letter for use mid-sentence, leaving acronyms (HR, AI) alone. */
const lower = (s: string) => (/^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

/** What the routes' final buttons do; supplied by the controller. */
export interface RouteActions {
  openStop(route: 'career' | 'workforce', i: number): void;
  talk(title: string, subject: string): void;
  freeTour(route: 'career' | 'workforce'): void;
  campusForm(title: string): void;
  globe(professionNode: number): void;
}

export function makeRoutes(x: RouteActions): Record<'student' | 'founder' | 'hr' | 'university' | 'professional', StoryPath> {
  return {
    student: {
      goal: 'Start my career',
      preview: { from: 'Not sure what you’re capable of yet', to: 'Knowing your strengths, with work to show for them',
        lines: ['Find out where you stand, and what you’re already good at.', 'Discover the strengths worth growing, and the track that fits.', 'Go deep in one role, if you know where you’re heading.', 'See what you can build with a real product team.', 'Prove it, with evidence anyone can check.', 'Step into your next role, with support.'] },
      stops: [
        { room: 'intake', title: 'Intake',
          concern: 'I don’t really know what I’m good at yet. Where do I start?',
          guide: 'Right here. A short assessment shows where you stand today, which strengths you already have, and the roles they point to. It’s a starting point, not a test you pass or fail.',
          exhibit: () => board('What you find out', rows([['Where you stand', 'What you can already do'], ['Your strengths', 'What comes naturally to you'], ['What to grow next', 'The gaps worth closing'], ['Roles that fit', 'Where your strengths point']]), note('It shapes the track that fits you.')),
          show: { label: 'What the assessment covers', open: 'career:1' },
          asks: [
            { q: 'Do I have to take it before the tour?', a: 'No. The whole tour stays open to you before you take the assessment.' },
            { q: 'What if I’m drawn to two different roles?', a: 'That’s common. The assessment shows which one fits your strengths today, and what it would take to grow toward the other.' },
          ],
          bridge: 'You’ve seen where you’d start. Let’s find out what you can grow into.' },
        { room: 'develop', title: 'Develop',
          concern: 'How do I find out what I’m actually good at?',
          guide: 'By doing it. Each track grows a different side of you: Career Launch your foundations, Career Pro depth in one role, Career Accelerate real product experience. Everything you make collects in your Evidence Passport, so you can see your progress.',
          exhibit: () => board('Three ways to grow', table(['Track', 'You discover', 'Example of the work'], [['Career Launch', 'Your foundations', 'Build and explain a small data app'], ['Career Pro', 'Your depth in one role', 'A role-specific piece of work in a pod'], ['Career Accelerate', 'What you can do on a product', 'Contribute to an industry product in a POD']])),
          activity: 'records',
          show: { label: 'Compare the three tracks', open: 'career:2' },
          asks: [
            { q: 'I’m already working. Is this for me?', a: 'Yes. A working analyst might use Career Pro to find out how far they can take AI in their role, or Career Accelerate to try product work in a POD.' },
            { q: 'What is the Evidence Passport?', a: 'Where everything you make collects as you go. After ETAF™ review it becomes your Readiness Passport.' },
          ],
          bridge: 'You’ve found the strengths worth growing. Let’s see how to go deep in one role.' },
        { room: 'pro', title: 'Specialise',
          concern: 'What if I already know which role I want?',
          guide: 'Then you can go deep. On Career Pro you work in a specialisation pod, building depth in one role with work that’s specific to it. The final list of specialisations is being confirmed.',
          exhibit: () => board('Career Pro pods', rows([['Focus', 'Depth in one role'], ['The work', 'Role-specific pieces, reviewed by a mentor'], ['Evidence', 'Collects in your Evidence Passport'], ['Specialisations', 'Final list being confirmed']])),
          activity: 'tasks',
          show: { label: 'Specialisation pods', open: 'career:4' },
          asks: [{ q: 'How do I know which role is mine?', a: 'The Entry Assessment points to the roles that fit your strengths today, and the gaps show what it would take to move toward another.' }],
          bridge: 'You’ve seen how to go deep in one role. Let’s see a full product team at work.' },
        { room: 'engineer', title: 'Engineer',
          concern: 'Could I really build something real, with a team?',
          guide: 'On Career Accelerate, you join a product POD. Here, five people take on one industry problem together. Pick someone to see their work, or try the machine.',
          activity: 'pod',
          show: { label: 'Team roles and the six stages', open: 'career:5' },
          asks: [
            { q: 'What’s a POD?', a: 'A small team where everyone has a real role: product, AI/ML, data, full stack, cloud or cyber. A mentor guides the team.' },
            { q: 'Who mentors me?', a: 'Industry mentors and architects. They guide you; the work you build is yours.' },
            { q: 'How is a POD different from a course?', a: 'A course tells you what you studied. A POD shows you what you can make, with work your mentor has reviewed.' },
          ],
          bridge: 'You’ve seen what you can build. Let’s turn it into proof.' },
        { room: 'verify', title: 'Verify', go: 'Verify the work',
          concern: 'How do I show other people what I can do?',
          guide: 'ETAF™ reviews your assessments, your project work and your reviewed delivery. After that review, your Evidence Passport becomes your Readiness Passport: proof of what you can do that employers can check.',
          exhibit: () => board('From what you made to proof', flow([['Evidence Passport', 'Everything you make, as you go'], ['ETAF™ review', 'Assessments, project work, reviewed delivery'], ['Readiness Passport', 'Proof employers can check']]), rows([['One contribution', 'Organised the machine records · reviewed · linked to the Build stage']])),
          activity: 'report',
          show: { label: 'See an example passport', open: 'career:6' },
          extra: { label: 'Play an example review', open: 'etaf:demo' },
          asks: [{ q: 'What does ETAF™ check?', a: 'Your assessments, your project work and your reviewed delivery. Each gate lights only when its evidence has been reviewed; nothing here shows a real result.' }],
          bridge: 'You’ve seen how your work becomes proof. Let’s look at where it can take you.' },
        { room: 'deploy', title: 'Deploy',
          concern: 'Will this get me a job?',
          guide: 'A job is not guaranteed. What you’ll have is a clear picture of what you can do, proof of it, and placement support matched to your track to help you take the next step.',
          exhibit: () => board('Support for your next step', rows([['Career Launch', 'Placement assistance'], ['Career Pro', 'Role-aligned support'], ['Career Accelerate', 'Premium-role opportunities']]), note('A job is not guaranteed.')),
          activity: 'employer',
          show: { label: 'Support by track', open: 'career:7' },
          asks: [{ q: 'What does placement assistance involve?', a: 'Help preparing for applications and interviews, and introductions where they fit your track. We explain exactly what applies to you before you start.' }] },
      ],
      primary: { label: 'Start Entry Assessment', run: () => x.openStop('career', 1) },
      more: [
        { label: 'Ask about the process', run: () => x.talk('Talk to the Career Team', 'Build My Career') },
        { label: 'Keep exploring', run: () => x.freeTour('career') },
      ],
    },

    founder: {
      goal: 'Build a product or find a team',
      preview: { from: 'A problem brief', to: 'A working product, built and reviewed',
        lines: ['What a product brief covers.', 'Who builds it, and who guides them.', 'How you follow progress.', 'The evidence behind the people building it.', 'What happens after delivery.'] },
      stops: [
        { room: 'dock', title: 'Dock',
          concern: 'Do I have to hire everyone before I start?',
          guide: 'No. Bring us the problem you want to solve, and we’ll discuss whether a product POD is a suitable way to deliver it.',
          exhibit: () => board('A product brief', rows([['Users', 'Who the product is for'], ['Goal', 'What it should achieve'], ['Constraints', 'Budget, timing and systems it must fit'], ['Success', 'How you’ll judge that it works']])),
          show: { label: 'Shape a product brief', open: 'workforce:2' },
          asks: [{ q: 'What if my idea is still rough?', a: 'That’s fine. A brief can start as a problem and a user, for example “clinic staff lose time rescheduling missed appointments”. Discover is where it gets sharper.' }],
          bridge: 'Next, who would actually do the work.' },
        { room: 'engineer', title: 'Product POD',
          concern: 'Who builds it, and who guides them?',
          guide: 'The POD brings together the roles your problem needs, guided by mentors and industry architects. Here is one at work on a maintenance problem.',
          activity: 'pod',
          show: { label: 'See a sample POD team', open: 'career:5' },
          asks: [{ q: 'Who owns what gets built?', a: 'Ownership and confidentiality are part of your engagement terms. We go through them with you before any work starts.' }],
          bridge: 'Let’s look at the delivery board.' },
        { room: 'delivery', title: 'Delivery', nextLabel: 'Look at the delivery board',
          concern: 'How do I know the build is progressing?',
          guide: 'The team follows Discover, Design, Build, Test & Secure, Deploy & Operate, and Demo & Validate. Deliverables and review points are agreed for your engagement.',
          exhibit: () => board('The delivery board', flow(STAGES, 2), note('You see a working demo at agreed review points.')),
          show: { label: 'Follow the six stages', open: 'career:5' },
          asks: [
            { q: 'How long does it take?', a: 'It depends on the problem. Timing, deliverables and review points are agreed with you for your engagement.' },
            { q: 'What does it cost?', a: 'That depends on the problem and the team it needs. We scope it with you before work starts.' },
          ],
          bridge: 'Next, the evidence behind the people building it.' },
        { room: 'verify', title: 'Verification',
          concern: 'Can I judge the team beyond their CVs?',
          guide: 'Readiness evidence from ETAF™ shows demonstrated capability. Acceptance criteria for your project are still agreed with you.',
          activity: 'report',
          show: { label: 'How evidence is reviewed', open: 'career:6' },
          bridge: 'Last, what happens after delivery.' },
        { room: 'talent', title: 'Ongoing team',
          concern: 'Does everyone leave after delivery?',
          guide: 'Not necessarily. We can discuss ongoing talent support, and whether people from your POD can continue, subject to availability and agreed terms.',
          exhibit: () => board('After delivery', rows([['Continue with the team', 'Subject to availability and agreed terms'], ['Verified talent', 'Individuals or a dedicated POD'], ['Handover', 'A working product and its documentation']])),
          show: { label: 'Ongoing talent options', open: 'workforce:1' } },
      ],
      primary: { label: 'Discuss my product brief', run: () => x.openStop('workforce', 2) },
      more: [{ label: 'Keep exploring', run: () => x.freeTour('workforce') }],
    },

    hr: {
      goal: 'Upskill my workforce',
      preview: { from: 'A task your team does today', to: 'Applied capability you can review',
        lines: ['Where your teams’ gaps are.', 'How gaps turn into a plan.', 'How people use what they learn.', 'How you can show it’s working.', 'Which model fits your workforce.'] },
      stops: [
        { room: 'intake', title: 'Team challenge',
          concern: 'Where do we start across different functions?',
          guide: 'Start with the work your teams need to do and the capability they have today. Then map the gaps against the outcomes you want.',
          exhibit: () => board('A capability map', table(['Role', 'Task', 'Gap'], [['Finance analyst', 'Month-end commentary', 'Drafting with AI'], ['Customer service', 'Email replies', 'Faster, on-policy drafts'], ['Operations lead', 'Weekly summary', 'Pulling data together']])),
          show: { label: 'A sample capability map', open: 'workforce:3' },
          bridge: 'Next, how those gaps turn into a plan.' },
        { room: 'teams', title: 'Capability plan',
          concern: 'Will this be another generic course?',
          guide: 'No. Learning connects to people’s roles and tasks. We’ll discuss an academy, a learning service or a workforce programme that fits the need.',
          exhibit: () => board('From task to practice', flow([['Business task', 'Answer customer emails faster'], ['Practice', 'Draft replies with AI on anonymised tickets'], ['Review criterion', 'Accurate, on-policy replies a lead signs off']])),
          show: { label: 'Compare programme models', open: 'workforce:6' },
          asks: [
            { q: 'Can you run our academy?', a: 'Yes. A corporate academy, L&D as a service, or a Human + AI workforce programme.' },
            { q: 'Can non-technical teams join?', a: 'Yes. A finance team, for example, starts by drafting month-end commentary with AI and checking it against the ledger. No coding needed.' },
          ],
          bridge: 'Let’s see how people use what they learn.' },
        { room: 'apply', title: 'Applied work',
          concern: 'Will people use the skills afterwards?',
          guide: 'People practise on workflows that matter to your business and produce work that can be reviewed. Suitable tasks and constraints are agreed with your organisation.',
          exhibit: () => board('A sample workflow', flow([['Pick a real task', 'The weekly operations summary'], ['Practise with AI', 'On your own anonymised data'], ['Produce the work', 'A summary ready to send'], ['Lead review', 'Checked before it is used']]), rows([['Work product', 'A reviewed weekly operations summary']])),
          asks: [{ q: 'How are our tools and data handled?', a: 'That’s agreed with your organisation before the programme starts, including which tools are used and what data people can practise on.' }],
          bridge: 'Next, how you can show it’s working.' },
        { room: 'verify', title: 'Evidence review',
          concern: 'How can I show that it worked?',
          guide: 'Capability is reviewed against the starting point and the outcome you agreed. The reporting format and measures are confirmed before the programme begins.',
          exhibit: () => board('A report outline', rows([['Starting point', 'The capability map you began with'], ['Agreed outcome', 'What success means for each team'], ['What changed', 'Reviewed work, team by team'], ['Next steps', 'Where to build next']]), note('Measures are confirmed before the programme starts.')),
          show: { label: 'How readiness is reviewed', open: 'career:6' },
          bridge: 'Last, choosing the right model.' },
        { room: 'dock', title: 'Engagement options',
          concern: 'Which model fits our workforce?',
          guide: 'Choose around your team, your scope and the outcomes you need. If you have a specialist gap right now, we can discuss verified talent separately.',
          exhibit: () => board('Which model fits', table(['Model', 'Best when'], [['Corporate academy', 'You want a lasting in-house programme'], ['L&D as a service', 'You want us to run learning for you'], ['Workforce programme', 'Specific teams need Human + AI capability'], ['Verified talent', 'You have a specialist gap now']])),
          show: { label: 'Compare models', open: 'workforce:6' },
          asks: [{ q: 'Can we get specialists now?', a: 'We can discuss suitable verified talent, subject to availability and your requirements.' }] },
      ],
      primary: { label: 'Discuss my workforce needs', run: () => x.talk('Talk to the Workforce Team', 'Discuss my workforce needs') },
      more: [{ label: 'Keep exploring', run: () => x.freeTour('workforce') }],
    },

    university: {
      goal: 'Build industry readiness at my university',
      preview: { from: 'A course module', to: 'An industry project with evidence of readiness',
        lines: ['How your campus connects to industry.', 'What you would set up.', 'What your students would do.', 'How their work becomes evidence.', 'How to start at a manageable scale.'] },
      stops: [
        { room: 'campus', title: 'Campus challenge',
          concern: 'How do we connect learning to industry?',
          guide: 'With a Campus Talent Factory: your institution connects with capability development and industry problem work.',
          exhibit: () => board('Who connects to what', rows([['Students', 'Work on real industry problems'], ['Faculty', 'Build AI capability and co-mentor'], ['EmpowerED', 'Programmes, mentors and ETAF™ review'], ['Industry', 'Problem statements and feedback']])),
          show: { label: 'Who connects to what', open: 'workforce:4' },
          bridge: 'Next, what you’d actually set up.' },
        { room: 'scope', title: 'Partnership scope',
          concern: 'What are we setting up?',
          guide: 'We agree the scope with your university. It can include an AI centre, labs, a curriculum pathway and faculty development.',
          exhibit: () => board('A sample scope', table(['Element', 'Responsibility'], [['AI centre', 'To agree'], ['Labs', 'To agree'], ['Curriculum pathway', 'Joint, to agree'], ['Faculty development', 'EmpowerED with your faculty']])),
          show: { label: 'Campus scope options', open: 'workforce:4' },
          asks: [{ q: 'What about our faculty?', a: 'Faculty build AI capability alongside students. A lecturer, for example, can co-mentor a Student POD with an industry mentor.' }],
          bridge: 'Let’s see what your students would do.' },
        { room: 'engineer', title: 'Student PODs',
          concern: 'Do students work on real problems?',
          guide: 'Student PODs follow the same delivery stages around an industry problem. The work creates evidence of contribution and capability.',
          exhibit: () => board('A Student POD', rows([['Brief', 'Help a local manufacturer predict machine downtime']]), chips(['Product', 'Data', 'AI/ML', 'Full stack', 'Faculty co-mentor']), flow(STAGES, 0), note('Example brief; partner projects are confirmed separately.')),
          show: { label: 'Roles and the six stages', open: 'career:5' },
          bridge: 'Next, how that work becomes evidence.' },
        { room: 'verify', title: 'Readiness evidence',
          concern: 'How does this show readiness?',
          guide: 'ETAF™ reviews assessment, project and delivery evidence. Each student’s Evidence Passport becomes a Readiness Passport, visible alongside academic achievement.',
          exhibit: () => board('Evidence alongside grades', flow([['Evidence Passport', 'Work collects during the POD'], ['ETAF™ review', 'Assessment, project and delivery'], ['Readiness Passport', 'Shown with the transcript']]), rows([['Cohort summary', 'Students, projects and reviewed contributions; verified outcomes only']])),
          show: { label: 'See an example passport', open: 'career:6' },
          bridge: 'Last, starting at a manageable scale.' },
        { room: 'dock', title: 'Pilot discussion',
          concern: 'Can we start at a manageable scale?',
          guide: 'Yes. We can discuss an initial scope with clear responsibilities, review points and success measures. Wider rollout can follow.',
          exhibit: () => board('A pilot outline', rows([['Participants', 'One cohort or department'], ['Faculty', 'Who co-mentors, and how'], ['Projects', 'Industry problems to agree'], ['Review points', 'When we check progress together'], ['Success measures', 'Agreed before the pilot starts']])),
          asks: [{ q: 'Could this grow into a regional programme?', a: 'It can. A regional hub links campuses, industry and government around a sector priority, once an initial scope is working.' }] },
      ],
      primary: { label: 'Discuss a campus pilot', run: () => x.campusForm('Discuss a campus pilot') },
      more: [{ label: 'Ask about faculty development', run: () => x.talk('Talk to the Campus Team', 'Faculty development') }],
    },

    professional: {
      goal: 'Use AI in my profession',
      preview: { from: 'A task you already do', to: 'An AI-assisted result you’ve reviewed',
        lines: ['Choose your profession.', 'A task you’ll recognise.', 'That task worked through with AI.', 'What to learn first.', 'Your next step.'] },
      stops: [
        { room: 'plaza', title: 'Profession', pick: 'profession',
          concern: 'Is this relevant if I am not an engineer?',
          guide: 'Yes. Choose your profession and I’ll show you where AI can support the work you already do.',
          exhibit: (c) => board(prof(c).name, rows([['Where AI helps', prof(c).line]]), chips(prof(c).uses)),
          bridge: 'Let’s start with a task you’ll recognise.' },
        { room: 'pTask', title: 'A familiar task', nextLabel: 'Look at a familiar task',
          concern: 'What would AI actually do in my job?',
          guide: (c) => `Take a task you know in ${prof(c).name}: ${lower(demo(c).task)}. AI can help with parts of it, and your judgement still decides what’s right.`,
          exhibit: (c) => board(demo(c).task, rows([['AI can help with', demo(c).helps], ['You still decide', demo(c).decides]])),
          asks: (c): Ask[] => prof(c).uses.map((u, i) => ({ q: `What about ${lower(u)}?`, a: demo(c).uses[i] })),
          bridge: 'Now let’s work through it.' },
        { room: 'pDemo', title: 'Practical example', nextLabel: 'See a practical example',
          concern: 'How does it work in practice?',
          guide: 'Follow the task from a sample input to a draft, then to your review. You check whether the result is suitable before you use it.',
          exhibit: (c) => board('Input, draft, review', flow([['Sample input', demo(c).demo[0]], ['AI draft', demo(c).demo[1]], ['Your review', demo(c).demo[2]]])),
          show: { label: 'See it at work in 3D', open: 'globe:work' },
          bridge: 'Next, where to begin learning.' },
        { room: 'pPath', title: 'Learning path', nextLabel: 'See your learning path',
          concern: 'What should I learn first?',
          guide: 'Start with AI Awareness, build everyday productivity skills, then explore AI in your profession. Advanced project work depends on your goals and starting point.',
          exhibit: (c) => board('Your learning path', flow(LEVELS.map(([n, d], i) => [n, i === 2 ? prof(c).uses.join(' · ') : d] as [string, string]), 0)),
          asks: LEVELS.map(([n, d]) => ({ q: `What is ${n}?`, a: d })),
          bridge: 'Last, your next step.' },
        { room: 'pNext', title: 'Next step', nextLabel: 'Find your next step',
          concern: 'How do I start?',
          guide: (c) => `Explore the pathway for ${prof(c).name}, or ask which starting point fits your work.`,
          exhibit: (c) => board('Your next step', rows([['Explore', `The ${prof(c).name} pathway, level by level`], ['Ask', 'Which starting point fits your work']])) },
      ],
      primary: { label: 'Explore my profession pathway', run: (c) => x.globe(PROFESSION_NODE[Math.max(0, c.profession)]) },
      more: [{ label: 'Ask about AI for my profession', run: (c) => x.talk('Talk to us', 'AI for ' + prof(c).name) }],
    },
  };
}
