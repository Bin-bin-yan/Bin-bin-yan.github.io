function bindMediaChange(mediaQueryList, listener) {
  if (typeof mediaQueryList.addEventListener === "function") {
    mediaQueryList.addEventListener("change", listener);
    return () => mediaQueryList.removeEventListener("change", listener);
  }

  mediaQueryList.addListener(listener);
  return () => mediaQueryList.removeListener(listener);
}

function markVisible(element) {
  element.classList.add("is-visible");
  element.classList.remove("reveal-ready");
}

function isWithinRevealRange(element, ratio = 0.12) {
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const revealLine = viewportHeight - Math.min(viewportHeight * ratio, 120);
  const bounds = element.getBoundingClientRect();

  return bounds.top <= revealLine && bounds.bottom >= 0;
}

export function setupReveal(elements) {
  if (!elements.length) {
    return () => {};
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compactViewport = window.matchMedia("(max-width: 959px)");
  let observer = null;
  let detachViewportListeners = () => {};

  const getRevealRatio = () => (compactViewport.matches ? 0.08 : 0.12);
  const getObserverOptions = () => ({
    threshold: compactViewport.matches ? [0.08, 0.16] : [0.12, 0.24],
    rootMargin: compactViewport.matches ? "0px 0px -6%" : "0px 0px -10%",
  });

  const revealVisibleElements = () => {
    elements.forEach((element) => {
      if (!element.classList.contains("is-visible") && isWithinRevealRange(element, getRevealRatio())) {
        markVisible(element);
        observer?.unobserve(element);
      }
    });
  };

  const stopRevealObserver = () => {
    observer?.disconnect();
    observer = null;
    detachViewportListeners();
    detachViewportListeners = () => {};
  };

  const showAllElements = () => {
    elements.forEach(markVisible);
  };

  const shouldEnhanceReveal = () => !reducedMotion.matches && "IntersectionObserver" in window;

  const startRevealObserver = () => {
    stopRevealObserver();
    let fallbackFrame = 0;

    elements.forEach((element, index) => {
      element.style.setProperty("--reveal-delay", `${Math.min(index * 70, 280)}ms`);

      if (!element.classList.contains("is-visible")) {
        element.classList.add("reveal-ready");
      }
    });

    revealVisibleElements();

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting && entry.intersectionRatio < 0.12) {
            return;
          }

          markVisible(entry.target);
          observer?.unobserve(entry.target);
        });
      },
      getObserverOptions()
    );

    elements
      .filter((element) => !element.classList.contains("is-visible"))
      .forEach((element) => observer.observe(element));

    const syncVisibleElements = () => {
      fallbackFrame = 0;

      if (!shouldEnhanceReveal()) {
        showAllElements();
        stopRevealObserver();
        return;
      }

      revealVisibleElements();

      if (elements.every((element) => element.classList.contains("is-visible"))) {
        stopRevealObserver();
      }
    };

    const requestVisibleSync = () => {
      if (fallbackFrame) {
        return;
      }

      fallbackFrame = window.requestAnimationFrame(syncVisibleElements);
    };

    window.addEventListener("scroll", requestVisibleSync, { passive: true });
    window.addEventListener("resize", requestVisibleSync, { passive: true });
    window.addEventListener("orientationchange", requestVisibleSync);
    window.addEventListener("pageshow", requestVisibleSync);

    detachViewportListeners = () => {
      if (fallbackFrame) {
        window.cancelAnimationFrame(fallbackFrame);
        fallbackFrame = 0;
      }

      window.removeEventListener("scroll", requestVisibleSync);
      window.removeEventListener("resize", requestVisibleSync);
      window.removeEventListener("orientationchange", requestVisibleSync);
      window.removeEventListener("pageshow", requestVisibleSync);
    };
  };

  // Reveal is progressive enhancement: if anything is shaky, keep the content visible.
  const syncRevealMode = () => {
    if (!shouldEnhanceReveal()) {
      stopRevealObserver();
      showAllElements();
      return;
    }

    startRevealObserver();
  };

  const cleanupMediaListeners = [
    bindMediaChange(reducedMotion, syncRevealMode),
    bindMediaChange(compactViewport, syncRevealMode),
  ];

  syncRevealMode();

  return () => {
    stopRevealObserver();
    cleanupMediaListeners.forEach((cleanup) => cleanup());
  };
}
