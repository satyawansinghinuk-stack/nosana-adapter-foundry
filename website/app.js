// Set this after the public repository is created.
const GITHUB_URL = "";

// --- Pure logic -------------------------------------------------------
// Exported so the same functions this page runs in the browser can be
// imported and tested from Node (see test/inspector.test.ts at the project
// root). Nothing below this point touches the DOM.

export async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const buffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function utf8ByteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

export function buildEvidence({ digest, byteLength }) {
  const evidence = {
    demonstration: "browser-sha256",
    executionMode: "local-browser",
    inputBytes: byteLength,
    digestAlgorithm: "sha256",
    digest,
    nosanaJobExecuted: false
  };
  if (byteLength === 0) evidence.note = "empty payload: this is the real SHA-256 of zero bytes, not a project artifact hash";
  return evidence;
}

// --- Browser wiring -----------------------------------------------------
// Everything below only runs when a DOM is present, so this file stays
// importable from Node for the pure-logic test above.

if (typeof document !== "undefined") {
  activateGithubLinks();
  wireInspector();
  wireScrollReveal();
}

function activateGithubLinks() {
  if (!GITHUB_URL) return;
  document.querySelectorAll("[data-github]").forEach((link) => {
    link.href = GITHUB_URL;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.classList.remove("disabled");
    link.removeAttribute("aria-disabled");
    const arrow = link.querySelector(".link-arrow");
    if (arrow) arrow.textContent = "↗";
    const labelEl = link.querySelector(".link-label");
    if (labelEl && link.dataset.liveLabel) labelEl.textContent = link.dataset.liveLabel;
  });
}

function wireInspector() {
  const workloadInput = document.querySelector("#workload-input");
  const computedHash = document.querySelector("#computed-hash");
  const evidencePreview = document.querySelector("#evidence-preview");
  const copyHash = document.querySelector("#copy-hash");
  const presets = document.querySelectorAll("[data-payload]");
  if (!workloadInput || !computedHash || !evidencePreview) return;

  async function updateInspector() {
    const payload = workloadInput.value;
    const byteLength = utf8ByteLength(payload);
    const digest = await sha256(payload);
    computedHash.textContent = digest;
    evidencePreview.textContent = JSON.stringify(buildEvidence({ digest, byteLength }), null, 2);
  }

  // Sequence guard: only the most recently scheduled update is allowed to
  // write to the DOM, so fast typing never leaves a stale hash on screen.
  let updateSequence = 0;
  workloadInput.addEventListener("input", () => {
    const sequence = ++updateSequence;
    window.setTimeout(() => {
      if (sequence === updateSequence) updateInspector();
    }, 80);
  });

  presets.forEach((preset) => {
    preset.addEventListener("click", () => {
      workloadInput.value = preset.dataset.payload;
      presets.forEach((item) => item.classList.toggle("active", item === preset));
      updateInspector();
    });
  });

  const copyHashDefaultLabel = copyHash?.getAttribute("aria-label") ?? "Copy computed SHA-256 digest";
  copyHash?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(computedHash.textContent);
      copyHash.textContent = "COPIED";
      copyHash.setAttribute("aria-label", "Copied SHA-256 digest to clipboard");
    } catch {
      copyHash.textContent = "COPY FAILED";
      copyHash.setAttribute("aria-label", "Copy to clipboard failed");
    } finally {
      window.setTimeout(() => {
        copyHash.textContent = "COPY";
        copyHash.setAttribute("aria-label", copyHashDefaultLabel);
      }, 1200);
    }
  });

  updateInspector();
}

function wireScrollReveal() {
  const targets = document.querySelectorAll("[data-reveal]");
  if (!targets.length) return;
  if (!("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          el.classList.add("is-visible");
          observer.unobserve(el);
          // reveal-pending only needs to exist long enough to play the entrance
          // transition; removing it afterward restores each element's normal
          // (e.g. hover) transitions instead of permanently overriding them.
          window.setTimeout(() => el.classList.remove("reveal-pending", "is-visible"), 600);
        }
      });
    },
    { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
  );
  targets.forEach((el, index) => {
    el.classList.add("reveal-pending");
    el.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 60}ms`);
    observer.observe(el);
  });
}
