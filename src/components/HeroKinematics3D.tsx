/**
 * HeroKinematics3D — purely decorative 3D layer for the public Home hero.
 *
 * Abstract vertebral column rotating in 3D perspective with a kinematic
 * articulation wave, plus three floating orbs representing the clinic
 * tagline: Resilience • Firmness • Balance.
 *
 * Safety guarantees:
 * - Zero dependencies (pure CSS 3D transforms, GPU-composited).
 * - `pointer-events-none` on the root: can never intercept clicks.
 * - `absolute` positioned: zero layout shift, no DOM/flow impact on parents.
 * - `hidden md:block`: fully removed on small mobile screens.
 * - `aria-hidden`: invisible to assistive tech.
 * - Respects `prefers-reduced-motion` (animations pause).
 * - Uses existing `--brand` CSS variable (light/dark theme aware).
 */

import type { CSSProperties } from "react";

const VERTEBRAE = 9;

export function HeroKinematics3D() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden select-none overflow-visible md:block"
    >
      <div className="sp3d-scene absolute right-2 top-1/2 h-[26rem] w-56 -translate-y-1/2 lg:right-6">
        {/* Rotating column */}
        <div className="sp3d-column">
          {Array.from({ length: VERTEBRAE }).map((_, i) => {
            // Gentle 3D S-curve: lateral + depth offsets per vertebra
            const x = Math.sin(i * 0.62) * 10;
            const z = Math.cos(i * 0.62) * 9;
            return (
              <div
                key={i}
                className="sp3d-vertebra"
                style={
                  {
                    "--sp3d-x": `${x}px`,
                    "--sp3d-z": `${z}px`,
                    animationDelay: `${i * 0.28}s`,
                  } as CSSProperties
                }
              >
                <span className="sp3d-process sp3d-process-l" />
                <span className="sp3d-body" />
                <span className="sp3d-process sp3d-process-r" />
                {i < VERTEBRAE - 1 && <span className="sp3d-disc" />}
              </div>
            );
          })}
        </div>

        {/* Floating balance orbs: Resilience • Firmness • Balance */}
        <span className="sp3d-orb sp3d-orb-a" />
        <span className="sp3d-orb sp3d-orb-b" />
        <span className="sp3d-orb sp3d-orb-c" />
      </div>

      <style>{`
        .sp3d-scene {
          perspective: 1100px;
          perspective-origin: 50% 45%;
        }
        .sp3d-column {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          transform-style: preserve-3d;
          animation: sp3d-rotate 28s linear infinite;
          will-change: transform;
        }
        .sp3d-vertebra {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          transform-style: preserve-3d;
          transform: translate3d(var(--sp3d-x, 0px), 0, var(--sp3d-z, 0px));
          animation: sp3d-sway 5.5s ease-in-out infinite;
        }
        .sp3d-body {
          width: 58px;
          height: 26px;
          border-radius: 14px;
          background:
            radial-gradient(ellipse at 32% 28%,
              color-mix(in oklab, var(--brand, #0284c7) 18%, white) 0%,
              color-mix(in oklab, var(--brand, #0284c7) 55%, transparent) 58%,
              color-mix(in oklab, var(--brand, #0284c7) 78%, transparent) 100%);
          box-shadow:
            0 6px 18px -6px color-mix(in oklab, var(--brand, #0284c7) 45%, transparent),
            inset 0 -3px 6px color-mix(in oklab, var(--brand, #0284c7) 40%, transparent);
          opacity: 0.85;
        }
        .sp3d-process {
          position: absolute;
          top: 50%;
          width: 22px;
          height: 10px;
          border-radius: 999px;
          background: color-mix(in oklab, var(--brand, #0284c7) 55%, transparent);
          opacity: 0.7;
        }
        .sp3d-process-l {
          left: -14px;
          transform: translateY(-50%) rotateY(58deg) rotateZ(-14deg);
        }
        .sp3d-process-r {
          right: -14px;
          transform: translateY(-50%) rotateY(-58deg) rotateZ(14deg);
        }
        .sp3d-disc {
          position: absolute;
          bottom: -8px;
          left: 50%;
          width: 34px;
          height: 8px;
          border-radius: 999px;
          transform: translateX(-50%);
          background: color-mix(in oklab, var(--brand, #0284c7) 28%, transparent);
          opacity: 0.8;
        }
        .sp3d-orb {
          position: absolute;
          border-radius: 999px;
          background:
            radial-gradient(circle at 30% 28%,
              color-mix(in oklab, var(--brand, #0284c7) 12%, white) 0%,
              color-mix(in oklab, var(--brand, #0284c7) 60%, transparent) 70%);
          box-shadow: 0 10px 24px -10px color-mix(in oklab, var(--brand, #0284c7) 50%, transparent);
          will-change: transform;
        }
        .sp3d-orb-a { /* Resilience */
          width: 26px; height: 26px;
          left: 2%; top: 16%;
          opacity: 0.75;
          animation: sp3d-float 7s ease-in-out infinite;
        }
        .sp3d-orb-b { /* Firmness */
          width: 16px; height: 16px;
          right: 4%; top: 34%;
          opacity: 0.6;
          animation: sp3d-float 9s ease-in-out -2.5s infinite reverse;
        }
        .sp3d-orb-c { /* Balance */
          width: 20px; height: 20px;
          left: 10%; bottom: 12%;
          opacity: 0.65;
          animation: sp3d-float 8s ease-in-out -4s infinite;
        }
        @keyframes sp3d-rotate {
          from { transform: rotateX(6deg) rotateY(0deg); }
          to   { transform: rotateX(6deg) rotateY(360deg); }
        }
        @keyframes sp3d-sway {
          0%, 100% { transform: translate3d(var(--sp3d-x, 0), 0, var(--sp3d-z, 0)) rotateZ(0deg); }
          50%      { transform: translate3d(var(--sp3d-x, 0), 0, var(--sp3d-z, 0)) rotateZ(2.5deg); }
        }
        @keyframes sp3d-float {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50%      { transform: translate3d(6px, -14px, 20px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sp3d-column, .sp3d-vertebra, .sp3d-orb { animation: none; }
        }
      `}</style>
    </div>
  );
}
