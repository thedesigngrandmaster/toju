import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CloudOff,
  Database,
  HeartPulse,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  Zap,
} from 'lucide-react'

const stats = [
  { value: '1 in 5', label: 'patients readmitted within 30 days', icon: HeartPulse },
  { value: '20 pages', label: 'of discharge instructions never read', icon: Stethoscope },
  { value: '0', label: 'proactive warning systems at home', icon: Smartphone },
]

const steps = [
  {
    icon: Zap,
    step: '01',
    title: 'Extract the signal',
    desc: 'Paste raw EMR notes. AI extracts medications, red flags, and a plain-language care plan in seconds.',
  },
  {
    icon: Activity,
    step: '02',
    title: 'Monitor daily',
    desc: 'A conversational bot checks in with your patient every morning — via WhatsApp, in their own language.',
  },
  {
    icon: Bell,
    step: '03',
    title: 'Intervene early',
    desc: 'Your triage dashboard surfaces only what matters: who is at risk, why, and what to do about it.',
  },
]

const flowSteps = [
  "Doctor's EMR notes",
  'AI signal extraction',
  'Patient check-in',
  'AI risk analysis',
  'Provider triage',
  'Doctor intervenes',
]

const offlinePoints = [
  { icon: Database, title: 'IndexedDB first', desc: 'Every patient, alert and note is readable with zero bars.' },
  { icon: CloudOff, title: 'Queued automatically', desc: 'Edits, AI requests and WhatsApp messages survive dropped connections.' },
  { icon: ShieldCheck, title: 'RED alerts never lost', desc: 'Critical alerts escalate locally and retry aggressively.' },
]

export default function LandingView() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <section className="px-4 pb-16 pt-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 flex items-center justify-between">
            <img src="/Image/toju-logo.png" alt="Toju" width={80} height={30} />
            <Link
              to="/auth/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Provider login
              <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground animate-fade-up">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
              Offline-first · AI-powered post-discharge monitoring
            </div>

            <h1 className="font-display text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl animate-fade-up">
              Close the black hole of <span className="text-primary">post-discharge care.</span>
            </h1>

            <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground animate-fade-up">
              Toju turns messy discharge notes into a proactive monitoring system — alerting you to patient risk{' '}
              <span className="font-medium text-foreground">before the ER visit</span>, not after. Built to keep
              working when the network does not.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/auth/login"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                Open provider portal
                <ArrowRight className="size-3.5" />
              </Link>
              <a href="#how-it-works" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                How it works
              </a>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border p-4">
                <stat.icon className="mb-3 size-5 text-muted-foreground" />
                <p className="text-2xl font-semibold tracking-tight text-foreground">{stat.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">Built for the field</p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Online is an enhancement. Never a requirement.
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {offlinePoints.map((point) => (
              <div key={point.title} className="rounded-xl border p-4">
                <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-secondary">
                  <point.icon className="size-4 text-primary" />
                </div>
                <h3 className="text-sm font-medium text-foreground">{point.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{point.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-t px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">The closed loop</p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">How Toju works</h2>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.step}
                className="relative rounded-xl border p-4 transition-colors hover:border-primary/40"
              >
                <span className="absolute right-4 top-3 select-none font-display text-4xl font-semibold text-muted-foreground/10">
                  {step.step}
                </span>
                <div className="mb-4 flex size-9 items-center justify-center rounded-lg bg-secondary">
                  <step.icon className="size-4 text-primary" />
                </div>
                <h3 className="mb-1 text-sm font-medium text-foreground">{step.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-xl border p-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground">The closed-loop data flow</p>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              {flowSteps.map((label, index) => (
                <span key={label} className="flex items-center gap-2">
                  <span className={index === flowSteps.length - 1 ? 'font-medium text-primary' : 'text-muted-foreground'}>
                    {label}
                  </span>
                  {index < flowSteps.length - 1 && <ArrowRight className="size-3 text-muted-foreground/40" />}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border bg-secondary/50 p-10 text-center sm:p-14">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Ready to close the loop?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-muted-foreground">
              Sign in to manage patients, extract care signals, and monitor risk — online or offline.
            </p>
            <Link
              to="/auth/login"
              className="mt-7 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-xs font-medium text-white transition-opacity hover:opacity-90"
            >
              Sign in as provider
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t px-4 py-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 sm:flex-row">
          <img src="/Image/toju-logo.png" alt="Toju" width={48} height={18} className="opacity-60" />
          <p className="text-xs text-muted-foreground">Built for healthcare. Built for impact.</p>
        </div>
      </footer>
    </div>
  )
}
