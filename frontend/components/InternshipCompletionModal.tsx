"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

const CONFETTI_COLORS = ["#734FA0", "#FC6607", "#212121", "#A78BC9", "#FFA35C"];

function Confetti() {
  const pieces = Array.from({ length: 28 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {pieces.map((i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const duration = 2.2 + Math.random() * 1.4;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const size = 6 + Math.random() * 6;
        const rotate = Math.random() * 360;
        return (
          <span
            key={i}
            style={{
              left: `${left}%`,
              width: size,
              height: size * 0.4,
              backgroundColor: color,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              transform: `rotate(${rotate}deg)`,
            }}
            className="confetti-piece absolute top-[-10%] rounded-sm"
          />
        );
      })}
    </div>
  );
}

export function InternshipCompletionModal() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!user || !user.needs_internship_feedback) {
      setVisible(false);
      return;
    }
    const key = `intern_completion_modal_dismissed_${user.id}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(key)) {
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setEntered(true), 20);
    return () => clearTimeout(t);
  }, [user]);

  function dismiss() {
    if (user && typeof window !== "undefined") {
      window.localStorage.setItem(`intern_completion_modal_dismissed_${user.id}`, "1");
    }
    setEntered(false);
    setTimeout(() => setVisible(false), 200);
  }

  if (!visible || !user) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 px-4 transition-opacity duration-200 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      onClick={dismiss}
    >
      <style jsx global>{`
        @keyframes confetti-fall {
          0% {
            top: -10%;
            opacity: 1;
          }
          100% {
            top: 110%;
            opacity: 0.9;
          }
        }
        .confetti-piece {
          animation-name: confetti-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes pop-check {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          60% {
            transform: scale(1.15);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .pop-check {
          animation: pop-check 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both;
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-sm overflow-hidden rounded-2xl bg-white p-8 text-center shadow-2xl transition-all duration-300 ${
          entered ? "scale-100 opacity-100" : "scale-90 opacity-0"
        }`}
      >
        <div
          className="absolute inset-x-0 top-0 h-24"
          style={{ background: "linear-gradient(135deg, #734FA0 0%, #FC6607 100%)" }}
        />
        <Confetti />

        <div className="relative mt-4 flex justify-center">
          <div
            className="pop-check flex h-16 w-16 items-center justify-center rounded-full shadow-lg"
            style={{ background: "linear-gradient(135deg, #734FA0 0%, #FC6607 100%)" }}
          >
            <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <p className="relative mt-5 font-display text-2xl font-extrabold text-ink-900">
          Internship completed, {user.name.split(" ")[0]}! 🎉
        </p>
        <p className="relative mt-2 text-sm leading-relaxed text-ink-600">
          Hope you had a good time at Penaxis. Wish you the best of luck for your future!
        </p>

        <button onClick={dismiss} className="btn-primary relative mt-6 w-full">
          Continue
        </button>
      </div>
    </div>
  );
}
