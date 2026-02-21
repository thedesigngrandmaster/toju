'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import {
  ArrowRight,
  Activity,
  Bell,
  Zap,
  ArrowUpRight,
  HeartPulse,
  Stethoscope,
  Smartphone,
} from 'lucide-react'

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: i * 0.1, ease: [0.25, 0.1, 0.25, 1] },
  }),
}

const stats = [
  {
    value: '1 in 5',
    label: 'patients readmitted within 30 days',
    icon: HeartPulse,
  },
  {
    value: '20 pages',
    label: 'of discharge instructions never read',
    icon: Stethoscope,
  },
  {
    value: '0',
    label: 'proactive warning systems at home',
    icon: Smartphone,
  },
]

const steps = [
  {
    icon: Zap,
    step: '01',
    title: 'Extract the Signal',
    desc: 'Paste raw EMR notes. AI extracts medications, red flags, and a plain-language care plan in seconds.',
  },
  {
    icon: Activity,
    step: '02',
    title: 'Monitor Daily',
    desc: 'A conversational bot checks in with your patient every morning — via WhatsApp, in their own language.',
  },
  {
    icon: Bell,
    step: '03',
    title: 'Intervene Early',
    desc: 'Your triage dashboard surfaces only what matters: who is at risk, why, and what to do about it.',
  },
]

const flowSteps = [
  "Doctor's EMR Notes",
  'AI Signal Extraction',
  'Patient Check-in Bot',
  'AI Risk Analysis',
  'Provider Triage',
  'Doctor Intervenes',
]

export default function LandingView() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="pt-6 pb-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-16">
            <Image src="/Image/toju-logo.png" alt="Toju" width={80} height={30} />
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Provider Login
              <ArrowRight className="size-3" />
            </Link>
          </div>

        <div className="max-w-2xl">
            <motion.div
              custom={0}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium text-muted-foreground mb-6"
            >
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              AI-Powered Post-Discharge Monitoring
            </motion.div>

            <motion.h1
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-foreground leading-[1.1] mb-5"
            >
              Close the Black Hole of{' '}
              <span className="text-primary">Post-Discharge Care.</span>
            </motion.h1>

            <motion.p
              custom={2}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-lg"
            >
              Toju turns messy discharge notes into a proactive monitoring
              system — alerting you to patient risk{' '}
              <span className="text-foreground font-medium">before the ER visit</span>, not after.
            </motion.p>

            <motion.div
              custom={3}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="flex items-center gap-4"
            >
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-xs font-medium text-white hover:opacity-90 transition-opacity"
              >
                Open Provider Portal
                <ArrowRight className="size-3.5" />
              </Link>
              <a
                href="#how-it-works"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                How it works
              </a>
            </motion.div>
          </div>

          <motion.div
            custom={4}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16"
          >
            {stats.map((s, i) => (
              <div
                key={i}
                className="border rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <s.icon className="size-5 text-muted-foreground" />
                </div>
                <p className="text-2xl font-semibold tracking-tight text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 px-4 border-t">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="mb-10"
          >
            <p className="text-xs font-semibold tracking-widest text-primary uppercase mb-1">
              The Closed Loop
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              How Toju Works
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {steps.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="relative border rounded-xl p-4 group hover:border-[hsl(var(--primary)/0.4)] transition-colors"
              >
                <span className="absolute top-4 right-4 text-4xl font-semibold text-muted-foreground/10 select-none font-display">
                  {s.step}
                </span>
                <div className="size-9 rounded-lg bg-secondary flex items-center justify-center mb-4">
                  <s.icon className="size-4 text-primary" />
                </div>
                <h3 className="text-sm font-medium text-foreground mb-1">{s.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-10 border rounded-xl p-4"
          >
            <p className="text-xs font-medium text-muted-foreground mb-3">The closed-loop data flow</p>
            <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
              {flowSteps.map((label, i) => (
                <span key={i} className="flex items-center gap-2">
                  <span
                    className={
                      i === flowSteps.length - 1
                        ? 'text-primary font-medium'
                        : 'text-muted-foreground'
                    }
                  >
                    {label}
                  </span>
                  {i < flowSteps.length - 1 && (
                    <ArrowRight className="size-3 text-muted-foreground/40" />
                  )}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl border bg-secondary/50 p-10 sm:p-14 text-center"
          >
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground mb-3">
              Ready to close the loop?
            </h2>
            <p className="text-xs text-muted-foreground mb-7 max-w-md mx-auto leading-relaxed">
              Sign in to manage your patients, extract care signals, and monitor risk in real time.
            </p>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-xs font-medium text-white hover:opacity-90 transition-opacity"
            >
              Sign In as Provider
              <ArrowUpRight className="size-3.5" />
            </Link>
          </motion.div>
        </div>
      </section>

      <footer className="border-t py-6 px-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Image src="/Image/toju-logo.png" alt="Toju" width={48} height={18} className="opacity-60" />
          <p className="text-xs text-muted-foreground">Built for healthcare. Built for impact.</p>
        </div>
      </footer>
    </div>
  )
}
