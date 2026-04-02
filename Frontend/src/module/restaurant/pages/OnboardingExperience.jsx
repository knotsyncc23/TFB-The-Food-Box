import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChefHat,
  CircleHelp,
  Clock3,
  FileText,
  Landmark,
  LocateFixed,
  MapPin,
  PartyPopper,
  Phone,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Store,
  TimerReset,
  UtensilsCrossed,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "restaurant_onboarding_experience_v1"
const screenMeta = [
  { id: "quick", label: "Quick Start" },
  { id: "dashboard", label: "Checklist" },
  { id: "golive", label: "Go Live" },
]
const cuisineOptions = ["North Indian", "South Indian", "Biryani", "Pizza", "Cafe", "Chinese", "Bakery", "Burgers"]
const cityOptions = ["Bengaluru", "Hyderabad", "Mumbai", "Delhi", "Pune"]
const initialChecklist = [
  {
    id: "menu",
    title: "Add your first menu item",
    description: "Create one hero dish to start accepting orders faster.",
    action: "Add item",
    reward: "+10% discoverability",
    done: true,
    icon: UtensilsCrossed,
  },
  {
    id: "photo",
    title: "Upload restaurant photo",
    description: "A bright cover photo improves trust and conversion.",
    action: "Upload",
    reward: "Skip for now",
    done: false,
    icon: Camera,
  },
  {
    id: "hours",
    title: "Set opening hours",
    description: "We suggested 10:00 AM to 11:00 PM based on nearby kitchens.",
    action: "Review hours",
    reward: "Smart default ready",
    done: false,
    icon: Clock3,
  },
]
const MotionDiv = motion.div

const readStoredState = () => {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : null
  } catch (error) {
    console.error("Failed to load onboarding experience draft:", error)
    return null
  }
}

function ProgressBar({ value, success = false }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-red-100">
      <MotionDiv
        className={cn(
          "h-full rounded-full bg-gradient-to-r",
          success ? "from-emerald-500 to-emerald-400" : "from-red-600 to-orange-400"
        )}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
    </div>
  )
}

function TinyTip({ text }) {
  return (
    <span
      title={text}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-neutral-500"
    >
      <CircleHelp className="h-3.5 w-3.5" />
    </span>
  )
}

function SegmentedControl({ active, onChange }) {
  return (
    <div className="inline-flex w-full rounded-full border border-red-100 bg-white/90 p-1 shadow-sm sm:w-auto">
      {screenMeta.map((screen) => (
        <button
          key={screen.id}
          type="button"
          onClick={() => onChange(screen.id)}
          className={cn(
            "flex-1 rounded-full px-4 py-2 text-sm font-medium transition sm:flex-none",
            active === screen.id
              ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-200"
              : "text-neutral-600 hover:text-neutral-900"
          )}
        >
          {screen.label}
        </button>
      ))}
    </div>
  )
}

function QuickStartScreen({ quickStart, setQuickStart, verified, setVerified, onContinue }) {
  const toggleCuisine = (cuisine) => {
    setQuickStart((current) => ({
      ...current,
      cuisines: current.cuisines.includes(cuisine)
        ? current.cuisines.filter((item) => item !== cuisine)
        : [...current.cuisines, cuisine],
    }))
  }

  return (
    <MotionDiv key="quick" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-red-100 bg-white/95 shadow-[0_20px_60px_rgba(220,38,38,0.10)]">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-red-600">
                  <Sparkles className="h-3.5 w-3.5" />
                  Step 1 of 2
                </div>
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">Launch your restaurant in under 2 minutes</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600 sm:text-base">
                    Only the essentials appear first. Legal and finance details move to a guided post-login checklist.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-red-100 bg-red-50/80 px-4 py-3 text-right">
                <div className="text-xs uppercase tracking-[0.2em] text-red-500">Microcopy</div>
                <div className="mt-1 text-sm font-semibold text-neutral-900">Takes less than 2 minutes</div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-2">
                <span className="flex items-center gap-2 text-sm font-medium text-neutral-800">
                  <Phone className="h-4 w-4 text-red-500" />
                  Phone number
                </span>
                <div className="flex gap-3">
                  <Input
                    value={quickStart.phone}
                    onChange={(event) => setQuickStart((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="+91 98765 43210"
                    className="h-12 rounded-2xl border-red-100 bg-red-50/30 text-base"
                  />
                  <Button type="button" onClick={() => setVerified(true)} className="h-12 rounded-2xl bg-neutral-950 px-5 text-white hover:bg-neutral-800">
                    {verified ? "Verified" : "Send OTP"}
                  </Button>
                </div>
                {verified ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    OTP verified. We will use this as your primary contact.
                  </div>
                ) : (
                  <div className="grid grid-cols-6 gap-2">
                    {["1", "2", "3", "4", "5", "6"].map((digit) => (
                      <div key={digit} className="flex h-11 items-center justify-center rounded-2xl border border-dashed border-red-200 bg-white text-sm font-semibold text-neutral-700">
                        {digit}
                      </div>
                    ))}
                  </div>
                )}
              </label>

              <label className="space-y-2">
                <span className="flex items-center gap-2 text-sm font-medium text-neutral-800">
                  <Store className="h-4 w-4 text-red-500" />
                  Restaurant name
                </span>
                <Input
                  value={quickStart.restaurantName}
                  onChange={(event) => setQuickStart((current) => ({ ...current, restaurantName: event.target.value }))}
                  placeholder="Tandoor Theory"
                  className="h-12 rounded-2xl border-red-100 bg-red-50/30"
                />
              </label>

              <div className="space-y-2">
                <span className="flex items-center gap-2 text-sm font-medium text-neutral-800">
                  <MapPin className="h-4 w-4 text-red-500" />
                  City / location
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickStart((current) => ({ ...current, city: "Bengaluru" }))}
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white px-3 text-sm font-medium text-neutral-700"
                  >
                    <LocateFixed className="h-4 w-4" />
                    Auto-detect
                  </button>
                  <select
                    value={quickStart.city}
                    onChange={(event) => setQuickStart((current) => ({ ...current, city: event.target.value }))}
                    className="h-12 flex-1 rounded-2xl border border-red-100 bg-red-50/30 px-4 text-sm font-medium text-neutral-700 outline-none focus:border-red-300"
                  >
                    <option value="">Choose city</option>
                    {cityOptions.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3 sm:col-span-2">
                <div className="flex items-center gap-2 text-sm font-medium text-neutral-800">
                  <ChefHat className="h-4 w-4 text-red-500" />
                  Cuisine selection
                  <TinyTip text="Choose a few core cuisines now. Refine the rest later from the dashboard." />
                </div>
                <div className="flex flex-wrap gap-2">
                  {cuisineOptions.map((item) => {
                    const active = quickStart.cuisines.includes(item)
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleCuisine(item)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm font-medium transition",
                          active ? "border-red-600 bg-red-600 text-white shadow-lg shadow-red-200" : "border-red-100 bg-white text-neutral-700"
                        )}
                      >
                        {item}
                      </button>
                    )
                  })}
                </div>
                <div className="text-sm text-neutral-500">{quickStart.cuisines.length} cuisines selected. Multi-select personalizes discovery.</div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-red-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <TimerReset className="h-4 w-4 text-red-500" />
                Auto-saved as you type
              </div>
              <Button
                type="button"
                onClick={onContinue}
                className="h-12 rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 px-6 text-base font-semibold text-white"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-red-100 bg-neutral-950 text-white">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-white/70">Why this converts better</div>
                <ShieldCheck className="h-5 w-5 text-orange-300" />
              </div>
              {[
                "OTP-first trust signal with no bulky signup form",
                "Only four inputs upfront: phone, name, city, cuisines",
                "Remaining setup moved into guided post-login tasks",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-white/10 p-1">
                    <Check className="h-3.5 w-3.5 text-orange-300" />
                  </div>
                  <p className="text-sm leading-6 text-white/84">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </MotionDiv>
  )
}

function DashboardScreen({ checklist, setChecklist, onOpenGoLive }) {
  const completedCount = checklist.filter((item) => item.done).length
  const completion = Math.round((completedCount / checklist.length) * 100)

  const toggleTask = (id) => {
    setChecklist((current) => current.map((item) => (item.id === id ? { ...item, done: !item.done } : item)))
  }

  return (
    <MotionDiv key="dashboard" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-red-100 bg-white/95 shadow-[0_20px_60px_rgba(220,38,38,0.10)]">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-red-600">
                  <Sparkles className="h-3.5 w-3.5" />
                  Step 2 of 2
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950">Your restaurant is {completion}% ready</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600 sm:text-base">
                  Replace long forms with clear, clickable actions and completion states.
                </p>
              </div>
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-right">
                <div className="text-xs uppercase tracking-[0.2em] text-red-500">Progress</div>
                <div className="mt-1 text-lg font-semibold text-neutral-900">{completedCount}/{checklist.length} tasks done</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-neutral-700">30% completed</span>
                <span className="text-neutral-500">Checklist progress</span>
              </div>
              <ProgressBar value={completion} />
            </div>

            <div className="grid gap-4">
              {checklist.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleTask(item.id)}
                    className="group rounded-[28px] border border-red-100 bg-gradient-to-r from-white to-red-50/80 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-100"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-4">
                        <div className={cn("rounded-2xl p-3", item.done ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600")}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-neutral-900">{item.title}</h3>
                            <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", item.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                              {item.done ? "Done" : "Pending"}
                            </span>
                          </div>
                          <p className="text-sm leading-6 text-neutral-600">{item.description}</p>
                          <div className="flex flex-wrap items-center gap-3 text-sm">
                            <span className="rounded-full bg-white px-3 py-1 text-neutral-600 shadow-sm">{item.reward}</span>
                            <span className="font-medium text-red-600">
                              {item.action} <ArrowRight className="ml-1 inline h-4 w-4" />
                            </span>
                          </div>
                        </div>
                      </div>
                      {item.done ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <div className="h-6 w-6 rounded-full border-2 border-dashed border-red-300" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-red-100 bg-neutral-950 text-white">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white/70">Next milestone</div>
                  <div className="mt-1 text-2xl font-semibold">Go live today</div>
                </div>
                <PartyPopper className="h-6 w-6 text-orange-300" />
              </div>
              <p className="text-sm leading-6 text-white/80">
                Keep compliance until the last responsible moment, then complete only essentials inside a focused modal.
              </p>
              <Button type="button" onClick={onOpenGoLive} className="h-12 w-full rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 text-base font-semibold text-white">
                Go Live
              </Button>
            </CardContent>
          </Card>

          <Card className="border-red-100 bg-white/90">
            <CardContent className="space-y-3 p-6 text-sm text-neutral-600">
              <div className="rounded-2xl bg-red-50/80 px-4 py-3">Tooltips replace dense descriptions.</div>
              <div className="rounded-2xl bg-red-50/80 px-4 py-3">Smart defaults reduce decision fatigue.</div>
              <div className="rounded-2xl bg-red-50/80 px-4 py-3">Skip for now keeps momentum high.</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MotionDiv>
  )
}

function GoLiveScreen({ onOpenGoLive }) {
  return (
    <MotionDiv key="golive" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
        <Card className="border-red-100 bg-white/95 shadow-[0_20px_60px_rgba(220,38,38,0.10)]">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-red-600">
                  <Sparkles className="h-3.5 w-3.5" />
                  Launch gate
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950">Focused go-live flow</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600 sm:text-base">
                  Only the essentials appear here: bank details, FSSAI with Add later, and PAN only if required.
                </p>
              </div>
              <Button type="button" onClick={onOpenGoLive} className="h-12 rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 px-6 text-base font-semibold text-white">
                Open Go Live Flow
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                { icon: Landmark, title: "Bank account details", copy: "Required for settlements and payouts.", tone: "bg-red-50 text-red-600" },
                { icon: ReceiptText, title: "FSSAI", copy: "Optional for now with a clear Add later path.", tone: "bg-amber-50 text-amber-600" },
                { icon: FileText, title: "PAN", copy: "Only requested when payout rules need it.", tone: "bg-neutral-100 text-neutral-700" },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.title} className="rounded-[28px] border border-red-100 bg-gradient-to-br from-white to-red-50/70 p-5">
                    <div className={cn("mb-4 inline-flex rounded-2xl p-3", item.tone)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-neutral-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">{item.copy}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-100 bg-neutral-950 text-white">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-white/70">Why it feels frictionless</div>
              <ShieldCheck className="h-5 w-5 text-orange-300" />
            </div>
            {[
              "No compliance wall before the operator sees value",
              "A single modal keeps launch intent focused",
              "Optional documents do not block activation momentum",
            ].map((item) => (
              <div key={item} className="flex gap-3">
                <div className="mt-0.5 rounded-full bg-white/10 p-1">
                  <Check className="h-3.5 w-3.5 text-orange-300" />
                </div>
                <p className="text-sm leading-6 text-white/84">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </MotionDiv>
  )
}

function GoLiveModal({ open, onOpenChange, goLive, setGoLive }) {
  const progress = useMemo(() => {
    let score = 25
    if (goLive.accountHolder) score += 25
    if (goLive.accountNumber && goLive.ifsc) score += 30
    if (!goLive.panRequired || goLive.pan) score += 10
    if (goLive.fssai || goLive.addLater) score += 10
    return score
  }, [goLive])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-[32px] border-red-100 p-0">
        <div className="bg-gradient-to-br from-white via-red-50 to-orange-50 p-6 sm:p-7">
          <DialogHeader className="space-y-3 text-left">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-red-600">
              <PartyPopper className="h-3.5 w-3.5" />
              Go Live
            </div>
            <DialogTitle className="text-2xl font-semibold tracking-tight text-neutral-950">Complete launch essentials only</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-neutral-600">
              Minimum inputs, clear progress, and no dead-end validation walls.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-neutral-700">Launch readiness</span>
              <span className="text-neutral-500">{progress}% completed</span>
            </div>
            <ProgressBar value={progress} success={progress >= 100} />
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-[28px] border border-red-100 bg-white/90 p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl bg-red-50 p-3 text-red-600">
                  <Landmark className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-neutral-900">Bank account details</div>
                  <div className="text-sm text-neutral-500">Required</div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={goLive.accountHolder}
                  onChange={(event) => setGoLive((current) => ({ ...current, accountHolder: event.target.value }))}
                  placeholder="Account holder name"
                  className="h-12 rounded-2xl border-red-100 bg-red-50/30"
                />
                <Input
                  value={goLive.accountNumber}
                  onChange={(event) => setGoLive((current) => ({ ...current, accountNumber: event.target.value }))}
                  placeholder="Account number"
                  className="h-12 rounded-2xl border-red-100 bg-red-50/30"
                />
                <Input
                  value={goLive.ifsc}
                  onChange={(event) => setGoLive((current) => ({ ...current, ifsc: event.target.value.toUpperCase() }))}
                  placeholder="IFSC"
                  className="h-12 rounded-2xl border-red-100 bg-red-50/30"
                />
                <div className="flex items-center rounded-2xl border border-emerald-100 bg-emerald-50 px-4 text-sm font-medium text-emerald-700">
                  Daily payouts unlock after review
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-red-100 bg-white/90 p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                  <ReceiptText className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-neutral-900">FSSAI</div>
                  <div className="text-sm text-neutral-500">Optional for now</div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Input
                  value={goLive.fssai}
                  onChange={(event) => setGoLive((current) => ({ ...current, fssai: event.target.value, addLater: false }))}
                  placeholder="Enter FSSAI number"
                  className="h-12 rounded-2xl border-red-100 bg-red-50/30"
                />
                <Button type="button" variant="outline" onClick={() => setGoLive((current) => ({ ...current, fssai: "", addLater: true }))} className="h-12 rounded-2xl border-red-200 px-5 text-neutral-700">
                  Add later
                </Button>
              </div>
            </div>

            <div className="rounded-[28px] border border-red-100 bg-white/90 p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-neutral-100 p-3 text-neutral-700">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-neutral-900">PAN</div>
                    <div className="text-sm text-neutral-500">Only if required</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGoLive((current) => ({ ...current, panRequired: !current.panRequired, pan: current.panRequired ? "" : current.pan }))}
                  className={cn("rounded-full px-3 py-2 text-sm font-semibold", goLive.panRequired ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-600")}
                >
                  {goLive.panRequired ? "Required" : "Not required"}
                </button>
              </div>
              {goLive.panRequired ? (
                <Input
                  value={goLive.pan}
                  onChange={(event) => setGoLive((current) => ({ ...current, pan: event.target.value.toUpperCase() }))}
                  placeholder="Enter PAN"
                  className="h-12 rounded-2xl border-red-100 bg-red-50/30"
                />
              ) : (
                <div className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-600">PAN stays hidden until payout policy needs it.</div>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-neutral-500">Subtle success cues replace complex validation errors.</div>
            <Button type="button" onClick={() => onOpenChange(false)} className="h-12 rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 px-6 text-base font-semibold text-white">
              {progress >= 100 ? "Ready to go live" : "Save and continue"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function RestaurantOnboardingExperience() {
  const storedState = readStoredState()
  const [activeScreen, setActiveScreen] = useState(storedState?.activeScreen || "quick")
  const [verified, setVerified] = useState(Boolean(storedState?.verified))
  const [goLiveOpen, setGoLiveOpen] = useState(false)
  const [quickStart, setQuickStart] = useState(storedState?.quickStart || {
    phone: "",
    restaurantName: "",
    city: "Bengaluru",
    cuisines: ["North Indian", "Biryani"],
  })
  const [checklist, setChecklist] = useState(storedState?.checklist || initialChecklist)
  const [goLive, setGoLive] = useState(storedState?.goLive || {
    accountHolder: "Tandoor Theory LLP",
    accountNumber: "",
    ifsc: "HDFC0000123",
    fssai: "",
    addLater: true,
    panRequired: false,
    pan: "",
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeScreen, verified, quickStart, checklist, goLive }))
    } catch (error) {
      console.error("Failed to save onboarding experience draft:", error)
    }
  }, [activeScreen, checklist, goLive, quickStart, verified])

  const activeView = useMemo(() => {
    if (activeScreen === "dashboard") {
      return <DashboardScreen checklist={checklist} setChecklist={setChecklist} onOpenGoLive={() => setGoLiveOpen(true)} />
    }
    if (activeScreen === "golive") {
      return <GoLiveScreen onOpenGoLive={() => setGoLiveOpen(true)} />
    }
    return <QuickStartScreen quickStart={quickStart} setQuickStart={setQuickStart} verified={verified} setVerified={setVerified} onContinue={() => setActiveScreen("dashboard")} />
  }, [activeScreen, checklist, quickStart, verified])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(254,226,226,0.95),_transparent_38%),linear-gradient(180deg,_#fffdfd_0%,_#fff5f2_48%,_#fffdfd_100%)] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-red-600 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Restaurant onboarding concept
            </div>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl">Modern, frictionless onboarding for food delivery partners</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600 sm:text-base">
                Two-step onboarding, progressive disclosure, and a checklist-driven dashboard built to maximize conversion.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <SegmentedControl active={activeScreen} onChange={setActiveScreen} />
            <div className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm text-neutral-600 shadow-sm">
              <TimerReset className="h-4 w-4 text-red-500" />
              Auto-save enabled
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">{activeView}</AnimatePresence>
      </div>

      <GoLiveModal open={goLiveOpen} onOpenChange={setGoLiveOpen} goLive={goLive} setGoLive={setGoLive} />
    </div>
  )
}
