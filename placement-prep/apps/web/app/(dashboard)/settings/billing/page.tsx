'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import Script from 'next/script';
import {
  Loader2, CreditCard, CheckCircle2, ArrowRight, Sparkles,
  Calendar, Shield, Zap, Clock
} from 'lucide-react';
import { getSubscriptionStatus, createOrder, verifyPayment } from '@/lib/api';

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';

const PLANS = [
  { id: 'monthly', label: 'Monthly', price: '₹499', period: '/month', saving: null },
  { id: 'quarterly', label: 'Quarterly', price: '₹1,299', period: '/quarter', saving: 'Save 13%' },
  { id: 'yearly', label: 'Yearly', price: '₹3,999', period: '/year', saving: 'Save 33%' },
];

export default function BillingSettingsPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subStatus, setSubStatus] = useState<any>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);

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

  const handleSubscribe = async (plan: string) => {
    setPurchasing(plan);
    try {
      const token = await getToken();
      if (!token) throw new Error('No token');

      const orderRes = await createOrder(token, plan);
      if (!orderRes.success) throw new Error('Failed to create order');

      const options = {
        key: RAZORPAY_KEY_ID,
        amount: orderRes.amount,
        currency: orderRes.currency,
        name: 'PrepAssist Premium',
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
              // Refresh subscription status
              const newStatus = await getSubscriptionStatus(token);
              if (newStatus.success) setSubStatus(newStatus.data);
            } else {
              alert('Payment verification failed. Please contact support.');
            }
          } catch {
            alert('Error verifying payment. Please contact support.');
          }
        },
        theme: { color: '#6366f1' },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (r: any) => alert('Payment failed: ' + r.error.description));
      rzp.open();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error initiating payment');
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // The API returns subscription_tier and subscription_expires_at from the users table
  const tier = subStatus?.subscription_tier ?? 'free';
  const isPremium = tier !== 'free';
  const expiresAt = subStatus?.subscription_expires_at;

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing &amp; Subscription</h1>
          <p className="text-muted mt-1">Manage your plan and billing details.</p>
        </div>

        {/* Current plan card */}
        <div className="glass-card p-6 md:p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl text-primary-light">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Current Plan</h3>
                <p className="text-muted text-sm capitalize">{tier} Plan</p>
              </div>
            </div>
            {isPremium ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/15 text-success text-xs font-semibold border border-success/30">
                <CheckCircle2 className="h-3.5 w-3.5" /> Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-elevated text-muted text-xs font-semibold border border-border">
                Free Tier
              </span>
            )}
          </div>

          {isPremium && expiresAt && (
            <div className="flex flex-col gap-3 border-t border-border/30 pt-6">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Renews / Expires</span>
                <span className="font-medium">{new Date(expiresAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> AI quota</span>
                <span className="font-medium text-success">Unlimited</span>
              </div>
            </div>
          )}
        </div>

        {/* Upgrade section — only show for free users */}
        {!isPremium && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary-light" />
              <h2 className="text-xl font-bold">Upgrade to Premium</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {PLANS.map((plan) => (
                <div key={plan.id}
                  className="glass-card p-6 flex flex-col border border-border/50 hover:border-primary/30 transition-colors relative">
                  {plan.saving && (
                    <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary-light border border-primary/30">
                      {plan.saving}
                    </span>
                  )}
                  <div className="mb-4">
                    <h3 className="font-semibold text-base">{plan.label}</h3>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-extrabold">{plan.price}</span>
                      <span className="text-muted text-xs">{plan.period}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={!!purchasing}
                    className="mt-auto w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary-light transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {purchasing === plan.id ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                    ) : (
                      <>Subscribe <ArrowRight className="h-3.5 w-3.5" /></>
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Premium features */}
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-4 text-sm text-muted uppercase tracking-wider">What you unlock</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: Zap, text: 'Unlimited AI explanations, hints & analysis' },
                  { icon: Shield, text: 'Level 3 near-pseudocode hints' },
                  { icon: Sparkles, text: 'AI-personalized study sheets' },
                  { icon: Clock, text: 'Priority support' },
                ].map((feat) => (
                  <div key={feat.text} className="flex items-center gap-2.5 text-sm">
                    <div className="p-1.5 bg-primary/10 rounded-md flex-shrink-0">
                      <feat.icon className="h-3.5 w-3.5 text-primary-light" />
                    </div>
                    {feat.text}
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
