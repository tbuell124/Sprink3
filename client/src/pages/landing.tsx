import { useMemo } from "react";
import { ArrowUpRight, Cpu, Radio, Sparkles, Waves, Zap, Satellite, Music4, Disc3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Define the primary navigation structure for the marketing experience
const navigation = [
  { label: "Platforms", href: "#platform" },
  { label: "Technology", href: "#technology" },
  { label: "Studios", href: "#studios" },
  { label: "Work", href: "#work" },
  { label: "Contact", href: "#contact" },
];

// Feature cards describing the signature capabilities of the audio company
const featureHighlights = [
  {
    title: "Adaptive Spatial Mixing",
    description:
      "Realtime object-based audio that adapts to every device, from cinema arrays to AR glasses.",
    icon: Waves,
  },
  {
    title: "Neural Enhancement Chain",
    description:
      "Neural mastering transforms stems into release-ready masters with surgical detail and warmth.",
    icon: Cpu,
  },
  {
    title: "Hyper Low-Latency Streaming",
    description:
      "Encrypted delivery network engineered for sub-15ms latency without compromising fidelity.",
    icon: Zap,
  },
];

// Technology stack callouts used to highlight the innovation narrative
const technologyStack = [
  "Adaptive Binaural DSP",
  "Dolby Atmos & MPEG-H",
  "WebGPU Accelerated Visualizers",
  "24-bit Cloud Rendering",
  "GenAI Composition Assistants",
  "Edge-Deployed Ambisonics",
];

// Studio showcase data to display the type of work delivered by the company
const studioShowcase = [
  {
    name: "Aurora Labs",
    focus: "Immersive installations",
    detail: "3D sound sculptures and responsive light for experiential retail.",
  },
  {
    name: "Circuit Forge",
    focus: "Interactive performance",
    detail: "Audio-reactive motion graphics built for arena-scale productions.",
  },
  {
    name: "Noir Vault",
    focus: "Boutique mastering",
    detail: "Analog mastering meets machine precision for high-impact releases.",
  },
];

// Selected project wins to mirror the case study grid on the reference site
const caseStudies = [
  {
    title: "Pulse // Audioweb Summit",
    description:
      "Delivered an adaptive broadcast stack that blended livestream, XR lobby, and on-site surround.",
    metric: "6.2M viewers in sync",
  },
  {
    title: "Nebula Rooms",
    description:
      "Built persistent sonic worlds that morph with visitor proximity and biometric signals.",
    metric: "73% longer dwell time",
  },
  {
    title: "Volt Mobility",
    description:
      "Designed vehicle acoustics, safety chimes, and tactile feedback for their flagship EV.",
    metric: "ISO 532-1 certified",
  },
];

// Testimonials to add credibility and match the tone of the inspirational site
const testimonials = [
  {
    quote:
      "They understand that audio is an interface. Our launch event sounded like a living organism.",
    person: "Nova Ramirez",
    role: "Creative Director, Pulse",
  },
  {
    quote:
      "From concept to touring rig, they architected a system that's rock solid and mind bending.",
    person: "Julian Knox",
    role: "Production Designer, Flux",
  },
  {
    quote:
      "Their mastering pipeline feels like cheating — warmth, punch, and zero compromise on detail.",
    person: "Imani Rivers",
    role: "Founder, Noir Vault",
  },
];

// Key operating metrics presented in the hero area for quick proof points
const metrics = [
  { label: "Studios", value: "3" },
  { label: "Global installs", value: "58" },
  { label: "Latency benchmark", value: "12ms" },
  { label: "Artists mastered", value: "420+" },
];

export default function LandingPage() {
  // Memoize the gradient background layers to keep the render tree clean
  const gradients = useMemo(
    () => [
      "bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_55%)]",
      "bg-[radial-gradient(circle_at_bottom_left,_rgba(250,204,21,0.12),_transparent_60%)]",
      "bg-[radial-gradient(circle_at_bottom_right,_rgba(147,51,234,0.14),_transparent_60%)]",
    ],
    [],
  );

  return (
    <div className="relative overflow-hidden">
      {/* Layered gradient backdrop inspired by the reference site */}
      <div className="pointer-events-none absolute inset-0 -z-20 opacity-80">
        {gradients.map((gradientClass, index) => (
          <div key={index} className={`absolute inset-0 ${gradientClass}`} />
        ))}
        <div className="absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(15,23,42,0.4)_45%,rgba(15,23,42,0.9)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[length:120px_100%]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[length:100%_120px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 pb-24 pt-10 sm:px-10">
        <header className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 backdrop-blur">
              <Disc3 className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-semibold tracking-[0.2em] text-white/80">TECHWAVE AUDIO</span>
          </div>

          <nav className="hidden items-center gap-8 text-sm uppercase tracking-[0.35em] text-white/60 md:flex">
            {navigation.map((item) => (
              <a key={item.label} href={item.href} className="transition hover:text-white">
                {item.label}
              </a>
            ))}
          </nav>

          <Button variant="ghost" className="group hidden items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-white/70 backdrop-blur hover:bg-white/10 md:flex">
            Inquiries
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Button>
        </header>

        {/* Hero Section */}
        <main className="mt-28 flex flex-1 flex-col gap-24">
          <section id="platform" className="grid gap-12 md:grid-cols-[2.5fr_1fr] md:items-end">
            <div className="space-y-8">
              <Badge className="border border-white/20 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.45em] text-white/70">
                Audio systems for radical brands
              </Badge>

              <h1 className="text-4xl font-semibold leading-none tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[5.2rem]">
                Immersive technology studios crafting sonic identities that feel like the future.
              </h1>

              <p className="max-w-xl text-lg text-white/70">
                We are a collective of engineers, composers, and scenographers building full-stack audio pipelines — from adaptive streaming infrastructure to generative sound installations.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <Button size="lg" className="rounded-full bg-primary px-10 py-6 text-sm font-semibold uppercase tracking-[0.4em] text-primary-foreground shadow-[0_0_40px_rgba(16,185,129,0.35)] hover:shadow-[0_0_45px_rgba(16,185,129,0.45)]">
                  Start a project
                </Button>
                <Button variant="ghost" size="lg" className="group rounded-full border border-white/20 px-10 py-6 text-sm font-semibold uppercase tracking-[0.4em] text-white/70 backdrop-blur hover:bg-white/10">
                  Listen to portfolio
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Button>
              </div>
            </div>

            <div className="grid gap-6 text-white/70">
              {metrics.map((metric) => (
                <div key={metric.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-6 py-5 backdrop-blur">
                  <span className="text-xs uppercase tracking-[0.3em] text-white/50">{metric.label}</span>
                  <span className="text-2xl font-semibold text-white">{metric.value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Feature highlight grid */}
          <section className="grid gap-6 md:grid-cols-3" id="technology">
            {featureHighlights.map((feature) => (
              <article
                key={feature.title}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10"
              >
                <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-primary/20 blur-3xl transition-all duration-500 group-hover:scale-125 group-hover:bg-primary/30" />
                <feature.icon className="h-8 w-8 text-primary" />
                <h3 className="mt-6 text-2xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-white/70">{feature.description}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.4em] text-white/60">
                  Explore capability
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </article>
            ))}
          </section>

          {/* Technology stack ribbons */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 text-white/60">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-xs uppercase tracking-[0.45em]">Full-stack innovation</span>
            </div>
            <div className="flex flex-wrap gap-4">
              {technologyStack.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xs uppercase tracking-[0.35em] text-white/60 backdrop-blur hover:border-white/30 hover:text-white"
                >
                  {item}
                </span>
              ))}
            </div>
          </section>

          {/* Studio showcase cards */}
          <section id="studios" className="grid gap-6 md:grid-cols-3">
            {studioShowcase.map((studio) => (
              <article key={studio.name} className="relative flex flex-col gap-6 rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 via-white/5 to-transparent p-8 backdrop-blur">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10">
                    <Radio className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{studio.name}</h3>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/50">{studio.focus}</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-white/70">{studio.detail}</p>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
                  Visit studio
                  <ArrowUpRight className="h-4 w-4" />
                </div>
              </article>
            ))}
          </section>

          {/* Case studies section */}
          <section id="work" className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Satellite className="h-5 w-5 text-primary" />
                <span className="text-xs uppercase tracking-[0.45em] text-white/50">Selected projects</span>
              </div>
              <h2 className="text-3xl font-semibold text-white md:text-4xl">
                Deploying bespoke audio ecosystems for culture-defining launches.
              </h2>
              <p className="text-sm leading-relaxed text-white/70">
                From generative retail soundtracks to low-latency broadcast stacks, we ship experiential systems that blend technology, narrative, and acoustic craft.
              </p>
            </div>
            <div className="grid gap-6">
              {caseStudies.map((project) => (
                <article key={project.title} className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:border-white/20">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">{project.title}</h3>
                    <span className="text-xs uppercase tracking-[0.4em] text-primary">{project.metric}</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-white/70">{project.description}</p>
                </article>
              ))}
            </div>
          </section>

          {/* Testimonials */}
          <section className="grid gap-6 md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <article key={testimonial.person} className="relative rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
                <div className="absolute -top-10 left-6 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-primary/20 text-white">
                  <Music4 className="h-6 w-6" />
                </div>
                <p className="pt-6 text-sm leading-relaxed text-white/80">“{testimonial.quote}”</p>
                <div className="mt-6 text-xs uppercase tracking-[0.35em] text-white/60">
                  {testimonial.person} · {testimonial.role}
                </div>
              </article>
            ))}
          </section>

          {/* Contact CTA */}
          <section id="contact" className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent p-10 backdrop-blur">
            <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle,_rgba(16,185,129,0.35),_transparent_60%)] blur-3xl md:block" />
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-4">
                <span className="text-xs uppercase tracking-[0.4em] text-white/60">Collaborate</span>
                <h3 className="text-3xl font-semibold text-white md:text-4xl">
                  Let’s engineer the future sound of your product ecosystem.
                </h3>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" className="rounded-full bg-white/90 px-10 py-6 text-sm font-semibold uppercase tracking-[0.4em] text-black hover:bg-white">
                  Book discovery call
                </Button>
                <Button variant="ghost" size="lg" className="rounded-full border border-white/20 px-10 py-6 text-sm font-semibold uppercase tracking-[0.4em] text-white/80 hover:bg-white/10">
                  Download deck
                </Button>
              </div>
            </div>
          </section>
        </main>

        <footer className="mt-24 flex flex-col gap-6 border-t border-white/10 pt-10 text-xs uppercase tracking-[0.35em] text-white/40 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 text-white/50">
            <Disc3 className="h-4 w-4" />
            <span>© {new Date().getFullYear()} Techwave Audio. All frequencies reserved.</span>
          </div>
          <div className="flex gap-4">
            <span>Licensing</span>
            <span>Privacy</span>
            <span>Careers</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
