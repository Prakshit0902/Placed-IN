"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { Check, Sparkles, Loader2 } from "lucide-react";
import { createOrder, verifyPayment } from "@/lib/api";

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";

export default function PricingPage() {
  const { getToken, isSignedIn } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (plan: string) => {
    if (!isSignedIn) {
      router.push("/sign-up");
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("No token");

      // 1. Create order
      const orderRes = await createOrder(token, plan);
      if (!orderRes.success) throw new Error("Failed to create order");

      // 2. Open Razorpay Checkout
      const options = {
        key: RAZORPAY_KEY_ID,
        amount: orderRes.amount,
        currency: orderRes.currency,
        name: "PrepAssist Premium",
        description: `Subscribe to ${plan} plan`,
        order_id: orderRes.order_id,
        handler: async function (response: any) {
          try {
            // 3. Verify payment
            const verifyRes = await verifyPayment(token, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyRes.success) {
              alert("Payment successful! You are now premium.");
              router.push("/dashboard");
            } else {
              alert("Payment verification failed.");
            }
          } catch (error) {
            console.error(error);
            alert("Error verifying payment.");
          }
        },
        prefill: {
          name: "PrepAssist User",
          email: "user@example.com",
        },
        theme: {
          color: "#6366f1", // primary color
        },
      };

      const rzp1 = new (window as any).Razorpay(options);
      rzp1.on("payment.failed", function (response: any) {
        alert("Payment Failed: " + response.error.description);
      });
      rzp1.open();
    } catch (error) {
      console.error(error);
      alert("Error initiating payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <div className="flex-1 flex flex-col items-center justify-center py-20 px-6 max-w-5xl mx-auto w-full animate-fade-in">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Simple, transparent <span className="gradient-text">pricing</span>
          </h1>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            Choose the plan that fits your prep timeline. Start for free and upgrade when you need AI personalization.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {/* Free Tier */}
          <div className="glass-card p-8 flex flex-col border border-border/50 relative">
            <h3 className="text-2xl font-bold mb-2">Basic</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-extrabold">₹0</span>
              <span className="text-muted text-sm">/forever</span>
            </div>
            <p className="text-muted text-sm mb-6 pb-6 border-b border-border/50">
              Perfect for getting started with standard prep sheets.
            </p>
            <ul className="flex flex-col gap-4 mb-8 flex-1">
              <li className="flex items-center gap-3 text-sm">
                <Check className="h-5 w-5 text-success flex-shrink-0" />
                <span>Access to 25+ company generic sheets</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="h-5 w-5 text-success flex-shrink-0" />
                <span>Basic progress tracking</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="h-5 w-5 text-success flex-shrink-0" />
                <span>30, 60, and 90-day durations</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted">
                <Check className="h-5 w-5 text-muted/30 flex-shrink-0" />
                <span className="line-through">AI Personalization</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted">
                <Check className="h-5 w-5 text-muted/30 flex-shrink-0" />
                <span className="line-through">Semantic Search</span>
              </li>
            </ul>
            <button
              onClick={() => router.push(isSignedIn ? "/dashboard" : "/sign-up")}
              className="w-full py-3 px-4 rounded-lg font-medium text-sm border border-border hover:bg-surface-elevated transition-colors"
            >
              Get Started
            </button>
          </div>

          {/* Premium Tier */}
          <div className="glass-card p-8 flex flex-col border border-primary/50 relative overflow-hidden">
            {/* Glow effect */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
            
            <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
              RECOMMENDED
            </div>

            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-primary-light" />
              <h3 className="text-2xl font-bold text-primary-light">Premium</h3>
            </div>
            
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-extrabold">₹499</span>
              <span className="text-muted text-sm">/month</span>
            </div>
            <p className="text-muted text-sm mb-6 pb-6 border-b border-border/50">
              Everything you need to crack top tech interviews.
            </p>
            <ul className="flex flex-col gap-4 mb-8 flex-1">
              <li className="flex items-center gap-3 text-sm">
                <Check className="h-5 w-5 text-primary-light flex-shrink-0" />
                <span className="font-medium">Everything in Basic</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="h-5 w-5 text-primary-light flex-shrink-0" />
                <span>AI personalized sheets based on LeetCode</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="h-5 w-5 text-primary-light flex-shrink-0" />
                <span>Semantic Natural Language Search</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="h-5 w-5 text-primary-light flex-shrink-0" />
                <span>Advanced analytics and weakness detection</span>
              </li>
            </ul>
            <button
              onClick={() => handleSubscribe("premium")}
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg font-semibold text-sm bg-primary text-white hover:bg-primary-light transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
              ) : (
                "Subscribe Now"
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
