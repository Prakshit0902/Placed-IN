import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { Sparkles, Target, Brain, TrendingUp, ChevronRight, ArrowRight } from "lucide-react";

const features = [
  {
    icon: Target,
    title: "Company-Targeted Sheets",
    description: "Get prep sheets built from real interview data for 25+ top tech companies.",
  },
  {
    icon: Brain,
    title: "AI Personalization",
    description: "Your LeetCode profile + AI = a study plan that focuses exactly where you need it.",
  },
  {
    icon: TrendingUp,
    title: "Progress Tracking",
    description: "Track your daily streaks, per-topic mastery, and overall readiness score.",
  },
  {
    icon: Sparkles,
    title: "Semantic Search",
    description: "Search problems in natural language — 'hard graph questions asked at Google'.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <Link href="/" className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold tracking-tight">PrepAssist</span>
        </Link>
        <div className="flex items-center gap-4">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground transition">
                Sign In
              </button>
            </SignInButton>
            <Link
              href="/sign-up"
              className="px-5 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary-light transition"
            >
              Get Started Free
            </Link>
          </Show>
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="px-5 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary-light transition flex items-center gap-1"
            >
              Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </Show>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="animate-slide-up max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-primary/30 bg-primary/5 text-sm text-primary-light">
            <Sparkles className="h-3.5 w-3.5" />
            Powered by real company interview data
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]">
            Crack your next
            <br />
            <span className="gradient-text">coding interview</span>
          </h1>
          <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            AI-generated, day-by-day study plans customized for your target company,
            your skill level, and your timeline. Built from 4,000+ real interview questions.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Show when="signed-out">
              <Link
                href="/sign-up"
                className="px-8 py-3.5 bg-primary text-white font-semibold text-base rounded-xl shadow-lg hover:bg-primary-light hover:shadow-xl transition-all flex items-center gap-2"
              >
                Start Preparing <ChevronRight className="h-5 w-5" />
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/sheets/new"
                className="px-8 py-3.5 bg-primary text-white font-semibold text-base rounded-xl shadow-lg hover:bg-primary-light hover:shadow-xl transition-all flex items-center gap-2"
              >
                Create My Study Plan <ChevronRight className="h-5 w-5" />
              </Link>
            </Show>
            <Link
              href="/sheets/new"
              className="px-8 py-3.5 border border-border text-foreground/80 font-medium text-base rounded-xl hover:bg-surface-elevated transition-all"
            >
              Preview a Sheet
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 border-t border-border/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Built for serious prep</h2>
          <p className="text-muted text-center mb-16 max-w-lg mx-auto">
            Everything you need to go from zero to offer-ready, in one place.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 stagger-children">
            {features.map((f) => (
              <div
                key={f.title}
                className="glass-card p-6 hover-glow transition-all duration-300 hover:border-primary/20"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <f.icon className="h-5 w-5 text-primary-light" />
                  </div>
                  <h3 className="font-semibold text-lg">{f.title}</h3>
                </div>
                <p className="text-muted text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-border/30 text-center text-xs text-muted">
        © {new Date().getFullYear()} PrepAssist. Built with ❤️ for placement season.
      </footer>
    </div>
  );
}
