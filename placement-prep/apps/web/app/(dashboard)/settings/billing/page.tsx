"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import Script from "next/script";
import {
  Loader2,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Calendar,
  Shield,
  Zap,
  Clock,
  Check,
} from "lucide-react";
import { getSubscriptionStatus, createOrder, verifyPayment } from "@/lib/api";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import clsx from "clsx";

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";

const PLANS = [
  { id: "monthly", label: "Monthly Tier", price: "₹499", period: "/month", saving: null, description: "Flexible month-to-month access to PlacementPrep resources." },
  { id: "quarterly", label: "Quarterly Curation", price: "₹1,299", period: "/quarter", saving: "Save 13%", description: "Structured mid-term schedule for deep tech interviews." },
  { id: "yearly", label: "Yearly Monolith", price: "₹3,999", period: "/year", saving: "Save 33%", description: "Complete annual package for all placement cycles." },
];

export default function BillingSettingsPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subStatus, setSubStatus] = useState<any>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch subscription details
  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await getSubscriptionStatus(token);
        if (res.success) setSubStatus(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getToken]);

  // Razorpay payment trigger
  const handleSubscribe = async (plan: string) => {
    setPurchasing(plan);
    try {
      const token = await getToken();
      if (!token) throw new Error("Unauthenticated session");

      const orderRes = await createOrder(token, plan);
      if (!orderRes.success) throw new Error("Order creation failed");

      const options = {
        key: RAZORPAY_KEY_ID,
        amount: orderRes.amount,
        currency: orderRes.currency,
        name: "PrepAssist Premium",
        description: `${plan} plan subscription`,
        order_id: orderRes.order_id,
        handler: async function (response: any) {
          try {
            const verifyRes = await verifyPayment(token, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (verifyRes.success) {
              const newStatus = await getSubscriptionStatus(token);
              if (newStatus.success) setSubStatus(newStatus.data);
            } else {
              alert("Payment verification failed. Please contact support.");
            }
          } catch {
            alert("Error verifying payment. Please contact support.");
          }
        },
        theme: { color: "#000000" },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (r: any) => alert("Payment failed: " + r.error.description));
      rzp.open();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Error initiating payment");
    } finally {
      setPurchasing(null);
    }
  };

  // GSAP Animations
  useGSAP(() => {
    if (loading) return;

    // 1. Header fade-down
    gsap.fromTo(
      ".billing-header",
      { y: -10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }
    );

    // 2. Billing card slide-in
    gsap.fromTo(
      ".billing-card-anim",
      { y: 14, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: "power2.out", delay: 0.1 }
    );
  }, { scope: containerRef, dependencies: [loading] });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-light" />
      </div>
    );
  }

  const tier = subStatus?.subscription_tier ?? "free";
  const isPremium = tier !== "free";
  const expiresAt = subStatus?.subscription_expires_at;

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      <div ref={containerRef} className="max-w-4xl mx-auto space-y-6 text-foreground">
        {/* Header */}
        <div className="billing-header border-b border-border/40 pb-6 text-left">
          <h1 className="text-2xl font-bold tracking-tight">Billing &amp; Subscription</h1>
          <p className="text-sm text-muted font-light mt-1">
            Manage your subscription tier, billing cycles, and premium upgrades.
          </p>
        </div>

        {/* Current Plan Status Card */}
        <div className="glass-card p-6 border border-border/50 billing-card-anim text-left relative overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-[0.01] pointer-events-none" />
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary-light">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Current Tier</h3>
                <p className="text-muted text-xs capitalize mt-0.5">{tier} plan access</p>
              </div>
            </div>
            {isPremium ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 text-success text-xs font-semibold border border-success/20 animate-pulse">
                <CheckCircle2 className="h-3.5 w-3.5" /> Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-elevated text-muted text-xs font-semibold border border-border">
                Free Tier
              </span>
            )}
          </div>

          {isPremium && expiresAt && (
            <div className="flex flex-col gap-3 border-t border-border/30 pt-4 relative z-10">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted flex items-center gap-1.5 font-light">
                  <Calendar className="h-3.5 w-3.5" /> Renews / Expires
                </span>
                <span className="font-semibold font-mono">
                  {new Date(expiresAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs font-light">
                <span className="text-muted flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> AI Processing Quota
                </span>
                <span className="font-semibold text-success uppercase">Unlimited</span>
              </div>
            </div>
          )}
        </div>

        {/* Upgrade monolith plans */}
        {!isPremium && (
          <div className="space-y-6">
            <div className="text-left border-b border-border/30 pb-2 select-none flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-muted" />
              <h2 className="text-[13px] uppercase tracking-widest font-medium text-muted">
                Premium Upgrade Tiers
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className="glass-card p-6 flex flex-col border border-border/50 hover:border-foreground/20 hover:shadow-[0_0_20px_var(--glow-color)] transition-all duration-300 relative text-left billing-card-anim justify-between min-h-[240px] group"
                >
                  {plan.saving && (
                    <span className="absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full bg-foreground text-background font-mono uppercase tracking-wider">
                      {plan.saving}
                    </span>
                  )}
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-sm text-foreground/90">{plan.label}</h3>
                      <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-3xl font-extrabold font-mono text-foreground">{plan.price}</span>
                        <span className="text-muted text-xs font-light">{plan.period}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted font-light leading-relaxed">
                      {plan.description}
                    </p>
                  </div>

                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={!!purchasing}
                    className="mt-6 w-full py-2.5 rounded-xl text-xs font-semibold bg-foreground text-background hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {purchasing === plan.id ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Initiating...</>
                    ) : (
                      <>Subscribe <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" /></>
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Premium feature checklists comparison board */}
            <div className="glass-card p-6 border border-border/50 text-left billing-card-anim">
              <h3 className="text-xs uppercase tracking-widest font-semibold text-muted mb-4 border-b border-border/30 pb-2">
                What you unlock
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: Zap, text: "Unlimited AI descriptions, hints & diagnostics" },
                  { icon: Shield, text: "Level 3 near-pseudocode explanations" },
                  { icon: Sparkles, text: "AI personalized study templates & routes" },
                  { icon: Clock, text: "Priority servers & pipeline processing" },
                ].map((feat, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm font-light">
                    <div className="p-1.5 bg-foreground/5 text-foreground rounded-lg flex-shrink-0 border border-border">
                      <Check className="h-3.5 w-3.5 text-foreground" />
                    </div>
                    <span className="text-xs text-foreground/90">{feat.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
