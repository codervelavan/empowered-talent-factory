// The student story (Build my career): what a student asks walking through EmpowerED,
// and how the guide answers. Draft copy for review; keep lines short (speech bubbles).
import type { Beat } from './guide';

export const STUDENT: Beat[] = [
  // Intake: the gap, and where to start.
  { room: 'intake',
    you: 'I have a degree and a few certificates, but every job asks for experience. Where do I even start?',
    guide: "You're not alone. Learning and getting hired have drifted apart. We start by finding where you really are." },
  { room: 'intake',
    you: 'So… another exam?',
    guide: 'Not an exam. The Entry Assessment maps your baseline skills, your gaps, the role direction that fits you, and how ready you are today.' },
  { room: 'intake', point: true,
    you: 'And what happens with the result?',
    guide: 'It recommends the track that fits you. Tap the glowing marker to see how the assessment works.' },

  // Develop: tracks and evidence.
  { room: 'develop',
    you: 'This floor is busy. What is everyone doing up here?',
    guide: 'This is Develop. Everyone here is building capability on the track their assessment recommended.' },
  { room: 'develop',
    guide: "Go on, ask me what's on your mind.",
    choices: [
      { id: 'fit', label: 'Which track fits me?', you: 'Which track fits me?',
        guide: 'Career Launch builds your foundation. Career Pro takes you deep into one role. Career Accelerate puts you on real industry products. Your assessment points you to one.' },
      { id: 'working', label: "I'm already working. Is this for me?", you: "I'm already working. Is this still for me?",
        guide: 'Yes. Professionals usually go into Career Pro to specialise, or Career Accelerate to gain product experience in a POD.' },
    ] },
  { room: 'develop', point: true,
    you: "But how do I show what I've learned?",
    guide: 'Every station you complete adds evidence to your Evidence Passport, like the one on that screen. Tap it to look closer.' },

  // Engineer: PODs and real products.
  { room: 'engineer',
    you: "Whoa. What's happening down here?",
    guide: 'This is Engineer. Real industry problems arrive here, and small teams turn them into working products.' },
  { room: 'engineer',
    guide: 'Ask away.',
    choices: [
      { id: 'pod', label: "What's a POD?", you: "What's a POD?",
        guide: 'A small cross-functional team: product, AI/ML, data, full stack, cloud and cyber. Everyone has a real role, and a mentor guides the team.' },
      { id: 'real', label: 'Will I work on real projects?', you: 'Will I work on real projects?',
        guide: 'Yes. The problems come from real companies. Your POD takes one from Discover to Demo & Validate: six stages, like a real product team.' },
      { id: 'mentor', label: 'Who mentors me?', you: 'Who mentors me?',
        guide: 'Industry mentors and architects. They guide you; you own the engineering.' },
    ] },
  { room: 'engineer', point: true,
    you: 'Is this just another course with a certificate at the end?',
    guide: 'No. A certificate says what you studied. A POD shows what you built. Tap the hologram to follow the six stages.' },

  // Verify: ETAF and the Readiness Passport.
  { room: 'verify',
    you: 'Okay, but how will employers know I am actually ready?',
    guide: "That's what Verify is for. Meet ETAF™, our readiness framework." },
  { room: 'verify',
    you: 'What does ETAF check?',
    guide: 'Your assessments, your project work and your reviewed delivery. A gate only lights up when its evidence arrives.' },
  { room: 'verify', point: true,
    you: 'And what do I get out of it?',
    guide: 'A Readiness Passport: a verified record of what you can do. It travels with you, and employers can trust it.' },

  // Deploy: getting placed.
  { room: 'deploy',
    you: 'So this is the way out?',
    guide: 'This is Deploy. Verified talent walks through the ETAF gate and into industry.' },
  { room: 'deploy',
    you: 'Will you get me a job?',
    guide: 'Every track ends with placement support matched to your path. Launch gets placement assistance, Pro gets role-aligned support, Accelerate gets premium-role opportunities. We never promise a guaranteed job.' },
  { room: 'deploy', end: true,
    you: "Okay, I'm in. What's my first step?",
    guide: "Take the Entry Assessment. It's where every career at EmpowerED begins." },
];
