import { useState, useEffect, useCallback } from "react";
import { BlurFade } from "@/components/ui/blur-fade";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { WordRotate } from "@/components/ui/word-rotate";
import { Marquee } from "@/components/ui/marquee";
import {
  Mic,
  Brain,
  Users,
  GitBranch,
  Search,
  RefreshCw,
  CheckCircle,
  Copy,
  Shield,
  ArrowRight,
  Zap,
  CloudUpload,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  X,
} from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

const BASE = import.meta.env.BASE_URL;

function Hero() {
  return (
    <section className="relative overflow-hidden pt-24 pb-20 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <BlurFade delay={0.1}>
          <div className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full border border-border bg-muted/50">
            <AnimatedShinyText className="text-sm">
              Open Source — Free Forever
            </AnimatedShinyText>
          </div>
        </BlurFade>

        <BlurFade delay={0.2}>
          <img src={`${BASE}logo.svg`} alt="Seam" className="h-16 w-auto mx-auto mb-6" />
        </BlurFade>

        <BlurFade delay={0.3}>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Your Pocket AI,
            <br />
            <span className="text-muted-foreground">
              <WordRotate
                words={["Analyzed", "Organized", "Searchable", "Actionable"]}
                className="inline"
              />
            </span>
          </h1>
        </BlurFade>

        <BlurFade delay={0.4}>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Pull recordings from your{" "}
            <a
              href="https://heypocketai.com"
              className="underline underline-offset-4 hover:text-foreground transition-colors"
            >
              Pocket AI
            </a>{" "}
            device, analyze them with Claude, and browse everything in a local dashboard. No Pro
            subscription needed.
          </p>
        </BlurFade>

        <BlurFade delay={0.5}>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a href="https://github.com/yoaquim/seam">
              <ShimmerButton className="h-12 px-8">
                <GithubIcon className="h-5 w-5 mr-2" />
                <span className="text-base font-medium">View on GitHub</span>
              </ShimmerButton>
            </a>
            <a
              href="#quickstart"
              className="inline-flex items-center gap-2 h-12 px-6 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}

function ScreenshotShowcase() {
  return (
    <section className="py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <BlurFade delay={0.2}>
          <div className="rounded-xl border border-border shadow-2xl overflow-hidden">
            <img src={`${BASE}screenshots/home.png`} alt="Seam Dashboard" className="w-full" />
          </div>
        </BlurFade>
      </div>
    </section>
  );
}

const features = [
  {
    name: "AI Analysis",
    description:
      "Claude analyzes every recording — executive summaries, key takeaways, topic breakdowns, sentiment analysis, and key quotes with speaker attribution.",
    icon: Brain,
    screenshot: "detail-summary.png",
  },
  {
    name: "Action Items & Decisions",
    description:
      "Toggle action items as done, track decisions with rationale, surface open questions. Copy any section in structured format — paste into Slack, Notion, or email.",
    icon: CheckCircle,
    screenshot: "detail-actions.png",
  },
  {
    name: "Transcript & Speakers",
    description:
      "Full transcripts with speaker labels and timestamps. Filter by speaker, manually reassign who said what — all segments or just one block.",
    icon: Mic,
    screenshot: "detail-transcript.png",
  },
  {
    name: "Interactive Mind Maps",
    description:
      "Visual topic graphs with color-coded nodes for topics, decisions, actions, and questions. Zoom, pan, and explore how ideas connect.",
    icon: GitBranch,
    screenshot: "detail-mindmap.png",
  },
  {
    name: "People Management",
    description:
      "Create people with roles, aliases, and colored tags. Claude uses your people list to infer speakers. Confirm, merge, or dismiss detected speakers from a review queue.",
    icon: Users,
    screenshot: "people.png",
  },
];

function Lightbox({
  features: items,
  active: initialActive,
  onClose,
  onNavigate,
}: {
  features: typeof features;
  active: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const [current, setCurrent] = useState(initialActive);

  const goPrev = useCallback(() => {
    const next = (current - 1 + items.length) % items.length;
    setCurrent(next);
    onNavigate(next);
  }, [current, items.length, onNavigate]);

  const goNext = useCallback(() => {
    const next = (current + 1) % items.length;
    setCurrent(next);
    onNavigate(next);
  }, [current, items.length, onNavigate]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goPrev, goNext]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 bg-white/90 hover:bg-white rounded-full p-2 cursor-pointer transition-colors z-10"
      >
        <X className="h-5 w-5 text-[#2b2b2b]" />
      </button>

      {/* Prev */}
      <button
        onClick={goPrev}
        className="absolute left-4 md:left-8 bg-white/90 hover:bg-white rounded-full p-2 cursor-pointer transition-colors z-10"
      >
        <ChevronLeft className="h-6 w-6 text-[#2b2b2b]" />
      </button>

      {/* Image */}
      <div
        className="relative max-w-6xl w-full animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          key={items[current].screenshot}
          src={`${BASE}screenshots/${items[current].screenshot}`}
          alt={items[current].name}
          className="w-full rounded-xl shadow-2xl animate-in fade-in duration-300"
        />
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 rounded-full px-4 py-1.5 text-sm font-medium text-[#2b2b2b]">
          {items[current].name} — {current + 1}/{items.length}
        </div>
      </div>

      {/* Next */}
      <button
        onClick={goNext}
        className="absolute right-4 md:right-8 bg-white/90 hover:bg-white rounded-full p-2 cursor-pointer transition-colors z-10"
      >
        <ChevronRightIcon className="h-6 w-6 text-[#2b2b2b]" />
      </button>

      {/* Backdrop click to close */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}

function Features() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  const next = useCallback(() => {
    setActive((prev) => (prev + 1) % features.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [paused, next]);

  const current = features[active];
  const Icon = current.icon;

  return (
    <section className="py-20 px-6" id="features">
      <div className="max-w-6xl mx-auto">
        <BlurFade delay={0.1}>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Everything Pocket Pro does.
            <br />
            <span className="text-muted-foreground">And more.</span>
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Pull, analyze, search, and act on your recordings — all from a local dashboard you
            control.
          </p>
        </BlurFade>

        <div
          className="grid md:grid-cols-5 gap-8 items-start"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Left: feature list */}
          <div className="md:col-span-2 space-y-1">
            {features.map((feature, i) => {
              const FIcon = feature.icon;
              const isActive = i === active;
              return (
                <button
                  key={feature.name}
                  onClick={() => setActive(i)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#2b2b2b] text-white"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FIcon className={`h-5 w-5 shrink-0 ${isActive ? "text-white" : ""}`} />
                    <span className="text-sm font-medium">{feature.name}</span>
                  </div>
                </button>
              );
            })}

            {/* Active feature description */}
            <div className="pt-4 px-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-5 w-5" />
                <h3 className="text-lg font-semibold">{current.name}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {current.description}
              </p>
            </div>
          </div>

          {/* Right: screenshot */}
          <div className="md:col-span-3">
            <div
              className="rounded-xl border border-border shadow-lg overflow-hidden bg-muted/30 cursor-pointer hover:shadow-xl transition-shadow"
              onClick={() => setLightbox(true)}
            >
              <img
                key={current.screenshot}
                src={`${BASE}screenshots/${current.screenshot}`}
                alt={current.name}
                className="w-full animate-in fade-in duration-500"
              />
            </div>

            {/* Dots */}
            <div className="flex justify-center gap-2 mt-4">
              {features.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    i === active ? "w-6 bg-[#2b2b2b]" : "w-2 bg-border hover:bg-muted-foreground"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Lightbox */}
        {lightbox && (
          <Lightbox
            features={features}
            active={active}
            onClose={() => setLightbox(false)}
            onNavigate={setActive}
          />
        )}
      </div>
    </section>
  );
}

const capabilities = [
  { icon: Mic, text: "Automatic sync from Pocket API" },
  { icon: Brain, text: "5 parallel Claude analysis sessions" },
  { icon: Users, text: "Speaker inference with people management" },
  { icon: Search, text: "Full-text search across everything" },
  { icon: Copy, text: "Copy actions, decisions, quotes" },
  { icon: RefreshCw, text: "Real-time sync logs & history" },
  { icon: Shield, text: "File-based — your data stays local" },
  { icon: CloudUpload, text: "Optional S3 backup & sync" },
  { icon: Zap, text: "Colored tags, sort, filter, group" },
];

function Capabilities() {
  return (
    <section className="py-16 px-6 bg-muted/30">
      <div className="max-w-4xl mx-auto">
        <BlurFade delay={0.1}>
          <h2 className="text-2xl font-bold text-center mb-8">Built for power users</h2>
        </BlurFade>
        <Marquee pauseOnHover className="[--duration:30s]">
          {capabilities.map((cap) => (
            <div
              key={cap.text}
              className="flex items-center gap-3 px-6 py-3 rounded-lg border border-border bg-background mx-2"
            >
              <cap.icon className="h-5 w-5 text-muted-foreground shrink-0" />
              <span className="text-sm whitespace-nowrap">{cap.text}</span>
            </div>
          ))}
        </Marquee>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      step: "1",
      title: "Sync",
      description:
        "Connect your Pocket API key. Seam pulls all your recordings — transcripts, summaries, and metadata.",
      icon: RefreshCw,
    },
    {
      step: "2",
      title: "Analyze",
      description:
        "Claude processes each recording: executive summary, action items, decisions, mind maps, speaker inference.",
      icon: Brain,
    },
    {
      step: "3",
      title: "Browse",
      description:
        "Search, filter, and explore everything in a local dashboard. Copy actions, reassign speakers, track decisions.",
      icon: Search,
    },
  ];

  return (
    <section className="py-20 px-6" id="how-it-works">
      <div className="max-w-4xl mx-auto">
        <BlurFade delay={0.1}>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Three steps. That&apos;s it.
          </h2>
        </BlurFade>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <BlurFade key={step.title} delay={0.2 + i * 0.15}>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#2b2b2b] text-white text-xl font-bold mb-4">
                  {step.step}
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </BlurFade>
          ))}
        </div>
      </div>
    </section>
  );
}

function QuickStart() {
  return (
    <section className="py-20 px-6 bg-muted/30" id="quickstart">
      <div className="max-w-2xl mx-auto">
        <BlurFade delay={0.1}>
          <h2 className="text-3xl font-bold text-center mb-8">Quick Start</h2>
        </BlurFade>

        <BlurFade delay={0.2}>
          <div className="rounded-xl border border-border bg-[#1e1e1e] p-6 font-mono text-sm text-[#d4d4d4] overflow-x-auto">
            <div className="text-[#737373] mb-2"># Clone and install</div>
            <div>
              <span className="text-[#569cd6]">git</span> clone
              https://github.com/yoaquim/seam.git
            </div>
            <div>
              <span className="text-[#569cd6]">cd</span> seam
            </div>
            <div>
              <span className="text-[#569cd6]">npm</span> install
            </div>
            <div className="mt-4 text-[#737373]"># Add your Pocket API key</div>
            <div>
              <span className="text-[#569cd6]">cp</span> .env.example .env
            </div>
            <div className="text-[#6a9955]"># Edit .env → POCKET_API_KEY=pk_your_key</div>
            <div className="mt-4 text-[#737373]"># Start the dashboard</div>
            <div>
              <span className="text-[#569cd6]">npm</span> run dev
            </div>
            <div className="text-[#6a9955]"># Open http://localhost:5173</div>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}

function TechStack() {
  const tech = [
    "React",
    "TypeScript",
    "Tailwind CSS",
    "shadcn/ui",
    "React Flow",
    "Express",
    "Python",
    "Claude Code",
  ];

  return (
    <section className="py-16 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <BlurFade delay={0.1}>
          <h2 className="text-2xl font-bold mb-6">Built with</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {tech.map((t) => (
              <span
                key={t}
                className="px-4 py-2 rounded-full border border-border text-sm font-medium bg-background"
              >
                {t}
              </span>
            ))}
          </div>
        </BlurFade>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-border">
      <div className="max-w-4xl mx-auto text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <img src={`${BASE}logo.svg`} alt="Seam" className="h-5 w-auto" />
          <span className="font-bold">Seam</span>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Open-source companion for Pocket AI. MIT License.
        </p>
        <div className="flex items-center justify-center gap-6">
          <a
            href="https://github.com/yoaquim/seam"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <GithubIcon className="h-4 w-4" />
            GitHub
          </a>
          <a
            href="https://heypocketai.com"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Pocket AI
          </a>
          <a
            href="https://app.heypocket.com/app/settings/api-keys"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Get API Key
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={`${BASE}logo.svg`} alt="Seam" className="h-5 w-auto" />
            <span className="font-bold">Seam</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block"
            >
              How it works
            </a>
            <a
              href="https://github.com/yoaquim/seam"
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-[#2b2b2b] text-white hover:bg-[#3b3b3b] transition-colors"
            >
              <GithubIcon className="h-4 w-4" />
              GitHub
            </a>
          </div>
        </div>
      </nav>

      <Hero />
      <ScreenshotShowcase />
      <Features />
      <Capabilities />
      <HowItWorks />
      <QuickStart />
      <TechStack />
      <Footer />
    </div>
  );
}
