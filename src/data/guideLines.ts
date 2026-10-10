// Voice tour guide lines. Final copy: keep verbatim.
// A recorded file at public/audio/<id>.mp3 plays instead of speech when present.

export const GUIDE_LINES = {
  welcome:
    "Welcome to EmpowerED Careers. This is a quick tour of how we turn learning into industry-ready AI talent. Pick the line that fits you on the departure board, and I'll guide you along it.",
  howto:
    "To move, scroll or press the arrow keys, and the train goes to the next station. The map at the bottom shows where you are. Click any station to jump there, or press Change line to go back to the board.",
  "career-1":
    "This is the gap. A degree and certificates show what you studied, but employers want to see what you can do. This line builds the rail across.",
  "career-2":
    "Every journey starts with the Entry Assessment. It finds where you are today, so we can recommend the right track.",
  "career-3":
    "There are three tracks. Career Launch builds your foundation. Career Pro takes you deep into one role. Career Accelerate gives you industry experience. Your assessment lights up the right one.",
  "career-4":
    "Here's the big step. You join a POD, a small team building a real product for an industry problem. A mentor guides you, and you own the work, through six stages from Discover to Demo and Validate.",
  "career-5":
    "Everything you build becomes evidence. ETAF, our readiness framework, checks it and adds it to your Readiness Passport. Your proof travels with you.",
  "career-6":
    "And you're across. You arrive industry-ready, with a portfolio and verified readiness. Take the Entry Assessment to start, or explore the Factory.",
  "build-1":
    "This line is for startups and companies. It starts with your problem or your product idea, loaded onto the train.",
  "build-2":
    "A POD forms around it: product, AI, data, full stack, cloud and cyber, guided by industry architects.",
  "build-3":
    "Your product moves through the same six stages as every POD. One Factory, one way of building.",
  "build-4":
    "At Demo and Validate, you get a working product, prototype or solution.",
  "build-5":
    "And here's the difference. The people who built your product are verified and ready to keep working with you. That's Talent as a Service. Bring us a problem to get started.",
  "work-1":
    "This line is for governments, universities and organisations. Choose who you want to upskill: your team, your students, your region, or everyone.",
  "work-2":
    "For organisations, we upgrade the team you already have, from everyday AI skills to deep technical skills, through corporate academies.",
  "work-3":
    "For universities, we bring the Factory to your campus, with an AI Centre of Excellence, faculty development and student PODs on real industry problems.",
  "work-4":
    "For governments, we connect universities, industry and verified talent across a whole region.",
  "work-5":
    "And for everyone else, AI for Everyone brings practical AI skills to every profession. Pick yours on the globe.",
  factory:
    "Welcome inside the AI Talent Factory. Each hall is a step you've just seen: Develop, Engineer, Verify and Deploy. Drag to look around, and click any hall to visit it. Press Back to the station to try another line.",
} as const;

export type GuideLineId = keyof typeof GUIDE_LINES;
