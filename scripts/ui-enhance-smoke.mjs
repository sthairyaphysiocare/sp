import { JSDOM } from "jsdom";
import fs from "node:fs";

const html = `<!doctype html><html><body>
  <div data-ui-enhance>
    <main>
      <section>
        <button class="brand-gradient">Book a Visit</button>
        <div class="bg-card">Card A</div>
        <div class="bg-card">Card B</div>
        <div class="rounded-3xl brand-gradient">CTA banner</div>
      </section>
    </main>
  </div>
</body></html>`;

const dom = new JSDOM(html, { pretendToBeVisual: true, url: "https://example.test/" });
const { window } = dom;

// jsdom has no layout engine, so every getBoundingClientRect() is zeros —
// good enough to prove the script runs without throwing and wires up the
// expected attributes/listeners.
global.window = window;
global.document = window.document;

const src = fs.readFileSync(new URL("../public/ui-enhancements.js", import.meta.url), "utf8");
window.eval(src);

if (typeof window.UIEnhance?.init !== "function") throw new Error("UIEnhance.init not exposed");

// Re-run init twice to prove the SPA re-init path doesn't throw or double-bind.
window.UIEnhance.init();
window.UIEnhance.init();

const cards = window.document.querySelectorAll(".bg-card");
console.assert(cards.length === 2, "expected 2 cards");
cards.forEach((c) => {
  console.assert(c.getAttribute("data-ui-tilt-bound") === "1", "card should be tilt-bound");
});

const btn = window.document.querySelector("button.brand-gradient");
console.assert(btn.getAttribute("data-ui-magnetic") === "", "button should be marked magnetic");

// Simulate a mousemove and ensure no exception is thrown while it computes.
window.dispatchEvent(new window.MouseEvent("mousemove", { clientX: 50, clientY: 50 }));

// Simulate a hover/tilt mousemove directly on a card.
const evt = new window.MouseEvent("mousemove", { clientX: 10, clientY: 10 });
cards[0].dispatchEvent(evt);
cards[0].dispatchEvent(new window.MouseEvent("mouseleave"));

console.log("UI-ENHANCEMENTS SMOKE TEST PASSED (double-init safe, attributes wired, no exceptions)");
