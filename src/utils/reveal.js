export function setupReveal(elements) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobileViewport = window.matchMedia("(max-width: 959px)");

  // Mobile browsers were leaving sections stuck at opacity:0, so narrow viewports skip reveal gating entirely.
  if (reducedMotion.matches || mobileViewport.matches || !("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.2,
      rootMargin: "0px 0px -8%",
    }
  );

  elements.forEach((element) => observer.observe(element));
}
