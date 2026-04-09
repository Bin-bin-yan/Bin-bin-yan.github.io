import { galleryManifest } from "./data/gallery.generated.js";
import { weddingData } from "./data/wedding.js";
import { startCountdown } from "./utils/countdown.js";
import { setupReveal } from "./utils/reveal.js";

const elements = {
  openingScreen: document.querySelector("#opening-screen"),
  openingMusicHint: document.querySelector("#opening-music-hint"),
  openInvitation: document.querySelector("#open-invitation"),
  heroScroll: document.querySelector("#hero-scroll"),
  calendarButton: document.querySelector("#calendar-button"),
  mapLink: document.querySelector("#map-link"),
  copyVenueButton: document.querySelector("#copy-venue"),
  copyLinkButton: document.querySelector("#copy-link"),
  heroImage: document.querySelector("#hero-image"),
  invitationCopy: document.querySelector("#invitation-copy"),
  highlightGrid: document.querySelector("#highlight-grid"),
  galleryGrid: document.querySelector("#gallery-grid"),
  tipsList: document.querySelector("#tips-list"),
  statusToast: document.querySelector("#status-toast"),
  musicPlayer: document.querySelector("#music-player"),
  musicToggle: document.querySelector("#music-toggle"),
  musicTitle: document.querySelector("#music-title"),
  musicArtist: document.querySelector("#music-artist"),
  bgmAudio: document.querySelector("#bgm-audio"),
  countdown: {
    days: document.querySelector("#days-value"),
    hours: document.querySelector("#hours-value"),
    minutes: document.querySelector("#minutes-value"),
    seconds: document.querySelector("#seconds-value"),
    hint: document.querySelector("#countdown-hint"),
  },
};

const formatters = {
  weekday: new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }),
};

const runtime = {
  isWeChat: /MicroMessenger/i.test(window.navigator.userAgent),
  heroReady: false,
  audioReady: false,
  audioPlaybackConfirmed: false,
  wechatBridgeReady: typeof window.WeixinJSBridge !== "undefined",
  playAttemptPromise: null,
  heroWarmupPromise: Promise.resolve(),
  audioWarmupPromise: null,
  galleryStreamStarted: false,
  galleryStartScheduled: false,
};

let statusTimer = 0;
const TRANSPARENT_PLACEHOLDER =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const MUSIC_PLAYER_COMPACT_SCROLL_Y = 112;

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function getFullNames() {
  return `${weddingData.couple.groom} · ${weddingData.couple.bride}`;
}

function createMapUrl(query) {
  return `https://uri.amap.com/search?query=${encodeURIComponent(query)}`;
}

function createWeChatMapUrl(query) {
  return `https://map.qq.com/search/index.html?query=${encodeURIComponent(query)}`;
}

function getEventSummaryText() {
  return [
    `${getFullNames()} 婚礼邀请`,
    `日期：${weddingData.event.displayDate}`,
    `地点：${weddingData.event.venueName}`,
    `地址：${weddingData.event.venueAddress}`,
  ].join("\n");
}

function showStatus(message) {
  window.clearTimeout(statusTimer);
  elements.statusToast.textContent = message;
  elements.statusToast.classList.add("is-visible");

  statusTimer = window.setTimeout(() => {
    elements.statusToast.classList.remove("is-visible");
  }, 2200);
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    showStatus(successMessage);
  } catch (error) {
    const fallbackInput = document.createElement("textarea");
    fallbackInput.value = text;
    fallbackInput.setAttribute("readonly", "true");
    fallbackInput.style.position = "absolute";
    fallbackInput.style.left = "-9999px";
    document.body.append(fallbackInput);
    fallbackInput.select();
    document.execCommand("copy");
    fallbackInput.remove();
    showStatus(successMessage);
    console.error(error);
  }
}

function createCalendarFile() {
  const startDate = weddingData.event.isoDate.slice(0, 10).replaceAll("-", "");
  const dateObject = new Date(`${weddingData.event.isoDate.slice(0, 10)}T00:00:00+08:00`);
  dateObject.setDate(dateObject.getDate() + 1);
  const nextDate = `${dateObject.getFullYear()}${String(dateObject.getMonth() + 1).padStart(2, "0")}${String(
    dateObject.getDate()
  ).padStart(2, "0")}`;
  const title = `${weddingData.couple.groom} & ${weddingData.couple.bride} 婚礼`;
  const description = `${weddingData.event.venueName} | ${window.location.href}`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Codex//Wedding Invitation//CN",
    "BEGIN:VEVENT",
    `UID:${startDate}-${weddingData.couple.signature.replaceAll(" ", "").toLowerCase()}@wedding`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `DTSTART;VALUE=DATE:${startDate}`,
    `DTEND;VALUE=DATE:${nextDate}`,
    `LOCATION:${weddingData.event.venueName}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadCalendarFile() {
  const calendarBlob = new Blob([createCalendarFile()], {
    type: "text/calendar;charset=utf-8",
  });
  const downloadUrl = URL.createObjectURL(calendarBlob);
  const anchor = document.createElement("a");

  anchor.href = downloadUrl;
  anchor.download = "wedding-invitation.ics";
  anchor.click();

  URL.revokeObjectURL(downloadUrl);
}

function primeHeroImage(src) {
  runtime.heroReady = false;

  runtime.heroWarmupPromise = new Promise((resolve) => {
    if (!src) {
      runtime.heroReady = true;
      resolve();
      return;
    }

    const preloadImage = new Image();
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      runtime.heroReady = true;
      resolve();
    };

    preloadImage.fetchPriority = "high";
    preloadImage.decoding = "async";
    preloadImage.src = src;

    if (preloadImage.complete) {
      finish();
      return;
    }

    preloadImage.addEventListener("load", finish, { once: true });
    preloadImage.addEventListener("error", finish, { once: true });

    if (typeof preloadImage.decode === "function") {
      preloadImage.decode().then(finish).catch(() => {});
    }
  });

  return runtime.heroWarmupPromise;
}

function primeAudioPlayback() {
  if (runtime.audioReady || elements.bgmAudio.readyState >= 2) {
    runtime.audioReady = true;
    return Promise.resolve(true);
  }

  if (runtime.audioWarmupPromise) {
    return runtime.audioWarmupPromise;
  }

  // Warmup should only hint the browser to fetch more data. Calling load() here
  // would abort an in-flight play() promise and make the first tap race itself.
  runtime.audioWarmupPromise = new Promise((resolve) => {
    let settled = false;
    let timeoutTimer = 0;
    let handleReady;
    let handleError;

    const cleanup = () => {
      window.clearTimeout(timeoutTimer);
      elements.bgmAudio.removeEventListener("canplay", handleReady);
      elements.bgmAudio.removeEventListener("loadeddata", handleReady);
      elements.bgmAudio.removeEventListener("canplaythrough", handleReady);
      elements.bgmAudio.removeEventListener("error", handleError);
    };

    const finish = (isReady) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      runtime.audioReady = isReady;
      runtime.audioWarmupPromise = null;
      resolve(isReady);
    };

    if (elements.bgmAudio.readyState >= 2) {
      finish(true);
      return;
    }

    handleReady = () => finish(elements.bgmAudio.readyState >= 2);
    handleError = () => finish(false);
    timeoutTimer = window.setTimeout(
      () => finish(elements.bgmAudio.readyState >= 2),
      1200
    );

    elements.bgmAudio.preload = "auto";
    elements.bgmAudio.addEventListener("canplay", handleReady, { once: true });
    elements.bgmAudio.addEventListener("loadeddata", handleReady, { once: true });
    elements.bgmAudio.addEventListener("canplaythrough", handleReady, { once: true });
    elements.bgmAudio.addEventListener("error", handleError, { once: true });
  });

  return runtime.audioWarmupPromise;
}

function scheduleAudioWarmup() {
  const startWarmup = () => {
    void primeAudioPlayback();
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(startWarmup, { timeout: 1200 });
    return;
  }

  window.setTimeout(startWarmup, 260);
}

// `playing` fires when the stream actually starts or resumes, so it is a safer
// first-play confirmation than guessing from a short `timeupdate` timeout.
function waitForPlaybackStart(timeout = 2400) {
  return new Promise((resolve) => {
    const hasStartedPlayback = () =>
      !elements.bgmAudio.paused &&
      (elements.bgmAudio.currentTime > 0 || elements.bgmAudio.readyState >= 3);
    let settled = false;

    const finish = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutTimer);
      elements.bgmAudio.removeEventListener("playing", handlePlaying);
      elements.bgmAudio.removeEventListener("error", handleFailure);
      resolve(result);
    };

    const handlePlaying = () => {
      if (hasStartedPlayback()) {
        finish(true);
      }
    };

    const handleFailure = () => finish(false);
    const timeoutTimer = window.setTimeout(() => finish(hasStartedPlayback()), timeout);

    elements.bgmAudio.addEventListener("playing", handlePlaying, { once: true });
    elements.bgmAudio.addEventListener("error", handleFailure, { once: true });
    handlePlaying();
  });
}

async function playMusicWithWeChatBridge() {
  if (!runtime.wechatBridgeReady || typeof window.WeixinJSBridge?.invoke !== "function") {
    return false;
  }

  return new Promise((resolve) => {
    window.WeixinJSBridge.invoke("getNetworkType", {}, async () => {
      try {
        resolve(await attemptDirectAudioPlay());
      } catch (error) {
        console.error(error);
        resolve(false);
      }
    });
  });
}

async function attemptDirectAudioPlay() {
  await elements.bgmAudio.play();
  runtime.audioReady = true;
  return waitForPlaybackStart();
}

function loadGalleryImage(imageElement) {
  return new Promise((resolve) => {
    if (
      !imageElement ||
      imageElement.dataset.loaded === "true" ||
      imageElement.dataset.loading === "true"
    ) {
      resolve();
      return;
    }

    const source = imageElement.dataset.gallerySrc || imageElement.getAttribute("data-gallery-src");

    if (!source) {
      resolve();
      return;
    }

    const parentCard = imageElement.closest(".gallery-card");
    let settled = false;
    imageElement.dataset.loading = "true";

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      imageElement.dataset.loading = "false";
      imageElement.dataset.loaded = "true";
      imageElement.classList.add("is-loaded");
      parentCard?.classList.remove("gallery-card--loading");
      parentCard?.classList.add("gallery-card--loaded");
      resolve();
    };

    imageElement.addEventListener("load", finish, { once: true });
    imageElement.addEventListener("error", finish, { once: true });
    imageElement.src = source;

    if (imageElement.complete) {
      finish();
    }
  });
}

function startGalleryLoading() {
  if (runtime.galleryStreamStarted) {
    return;
  }

  runtime.galleryStreamStarted = true;

  // The user prefers the gallery to wake up right after BGM is stable, instead
  // of waiting on scroll. We still keep the images lightweight so this burst stays manageable.
  const galleryImages = [...elements.galleryGrid.querySelectorAll("[data-gallery-src]")];

  galleryImages.forEach((imageElement) => {
    void loadGalleryImage(imageElement);
  });
}

function scheduleGalleryLoading({ deferUntilPlayback = false } = {}) {
  if (runtime.galleryStreamStarted || runtime.galleryStartScheduled) {
    return;
  }

  const startLoading = () => {
    runtime.galleryStartScheduled = false;
    startGalleryLoading();
  };

  runtime.galleryStartScheduled = true;

  // The first visible interaction should serve audio first. Gallery requests can
  // wait a beat so they don't compete with the very first music buffer.
  if (deferUntilPlayback && !runtime.audioPlaybackConfirmed) {
    const handlePlaying = () => {
      cleanup();
      startLoading();
    };

    const cleanup = () => {
      window.clearTimeout(timer);
      elements.bgmAudio.removeEventListener("playing", handlePlaying);
    };

    const timer = window.setTimeout(() => {
      cleanup();
      startLoading();
    }, 1600);

    elements.bgmAudio.addEventListener("playing", handlePlaying, { once: true });
    return;
  }

  window.setTimeout(startLoading, 320);
}

function syncMusicState() {
  const isPlaying = runtime.audioPlaybackConfirmed && !elements.bgmAudio.paused;

  document.body.classList.toggle("music-playing", isPlaying);
  elements.musicPlayer.classList.toggle("is-playing", isPlaying);
  elements.musicToggle.setAttribute("aria-pressed", String(isPlaying));
  elements.musicToggle.setAttribute("aria-label", isPlaying ? "暂停背景音乐" : "播放背景音乐");
}

function syncMusicPlayerLayout() {
  const shouldCompact =
    document.body.classList.contains("is-unsealed") &&
    window.matchMedia("(max-width: 767px)").matches &&
    window.scrollY > MUSIC_PLAYER_COMPACT_SCROLL_Y;

  document.body.classList.toggle("music-player-compact", shouldCompact);
}

async function playMusic({ announceFailure = false } = {}) {
  // Mobile browsers can deliver one tap as pointer + click. Funnel every
  // audible play request through one promise so the first visit doesn't race itself.
  if (runtime.playAttemptPromise) {
    return runtime.playAttemptPromise;
  }

  runtime.playAttemptPromise = (async () => {
    try {
      if (!runtime.audioReady) {
        await Promise.race([primeAudioPlayback(), wait(680)]);
      }

      if (runtime.audioPlaybackConfirmed && !elements.bgmAudio.paused) {
        syncMusicState();
        return true;
      }

      runtime.audioPlaybackConfirmed = false;
      syncMusicState();
      let started = false;

      if (runtime.isWeChat) {
        started = await playMusicWithWeChatBridge();

        if (!started) {
          started = await attemptDirectAudioPlay();
        }
      } else {
        started = await attemptDirectAudioPlay();
      }

      runtime.audioPlaybackConfirmed = started;
      syncMusicState();

      if (!started && announceFailure) {
        showStatus("点一下右上角的 BGM 按钮就能播放音乐。");
      }

      return started;
    } catch (error) {
      console.error(error);

      if (announceFailure) {
        showStatus("点一下右上角的 BGM 按钮就能播放音乐。");
      }

      runtime.audioPlaybackConfirmed = false;
      syncMusicState();
      return false;
    } finally {
      runtime.playAttemptPromise = null;
    }
  })();

  return runtime.playAttemptPromise;
}

function pauseMusic({ announce = false } = {}) {
  elements.bgmAudio.pause();
  runtime.audioPlaybackConfirmed = false;
  syncMusicState();

  if (announce) {
    showStatus("背景音乐已暂停。");
  }
}

function applyWeddingData() {
  document.title = `${getFullNames()} | 婚礼邀请函`;

  document.querySelector("#opening-groom").textContent = weddingData.couple.groom;
  document.querySelector("#opening-bride").textContent = weddingData.couple.bride;
  document.querySelector("#opening-date").textContent = weddingData.event.displayDate;
  elements.openingMusicHint.textContent = weddingData.soundtrack.hint;
  document.querySelector("#hero-eyebrow").textContent = weddingData.hero.eyebrow;
  document.querySelector("#hero-title").textContent = weddingData.hero.title;
  document.querySelector("#hero-names").textContent = getFullNames();
  document.querySelector("#hero-date").textContent = `${weddingData.event.displayDate} · ${formatters.weekday.format(
    new Date(weddingData.event.isoDate)
  )}`;
  document.querySelector("#hero-lead").textContent = weddingData.hero.lead;
  document.querySelector("#hero-stamp").textContent = "05 / 03";
  document.querySelector("#venue-city").textContent = weddingData.event.city;
  document.querySelector("#venue-name").textContent = weddingData.event.venueName;
  document.querySelector("#venue-note").textContent = weddingData.event.venueNote;
  document.querySelector("#closing-title").textContent = weddingData.closing.title;
  document.querySelector("#closing-note").textContent = weddingData.closing.note;
  elements.musicTitle.textContent = weddingData.soundtrack.title;
  elements.musicArtist.textContent = weddingData.soundtrack.artist;
  elements.bgmAudio.src = weddingData.soundtrack.src;
  elements.bgmAudio.volume = 0.72;

  elements.invitationCopy.innerHTML = weddingData.invitationLines
    .map((line, index) => `<p style="--item-index:${index};">${line}</p>`)
    .join("");

  elements.highlightGrid.innerHTML = weddingData.highlights
    .map(
      (item, index) => `
        <article class="highlight-item" style="--item-index:${index};">
          <p class="highlight-item__label">${item.label}</p>
          <p class="highlight-item__value">${item.value}</p>
        </article>
      `
    )
    .join("");

  elements.tipsList.innerHTML = weddingData.tips
    .map(
      (tip, index) => `
        <li class="reminder-list__item" style="--item-index:${index};">
          <span class="reminder-list__mark" aria-hidden="true"></span>
          <span>${tip}</span>
        </li>
      `
    )
    .join("");

  elements.mapLink.href = runtime.isWeChat
    ? createWeChatMapUrl(weddingData.event.mapQuery)
    : createMapUrl(weddingData.event.mapQuery);

  if (runtime.isWeChat && elements.calendarButton) {
    elements.calendarButton.textContent = "复制婚礼行程";
    elements.mapLink.textContent = "打开地图搜索";
  }
}

function buildGallery() {
  const coverImage = galleryManifest.find((item) => item.isCover) || galleryManifest[0];
  const preferredGalleryFirstImage = "./assets/images/gallery/wedding-10.jpg";
  const heroImageSource = weddingData.hero.imageSrc
    ? {
        src: weddingData.hero.imageSrc,
        alt: weddingData.hero.imageAlt || `${getFullNames()} 的婚礼封面照`,
      }
    : coverImage
      ? {
          src: coverImage.src,
          alt: `${getFullNames()} 的婚礼封面照`,
        }
      : null;
  const galleryItems = galleryManifest
    .filter((item) => !item.isCover && item.src !== heroImageSource?.src)
    .map((item, index) => ({
      ...item,
      caption: `${getFullNames()} · 婚纱照 ${String(index + 1).padStart(2, "0")}`,
      aspectRatio: item.width && item.height ? `${item.width} / ${item.height}` : "4 / 5",
    }))
    .sort((leftItem, rightItem) => {
      if (leftItem.src === preferredGalleryFirstImage) {
        return -1;
      }

      if (rightItem.src === preferredGalleryFirstImage) {
        return 1;
      }

      return 0;
    });

  if (heroImageSource) {
    elements.heroImage.src = heroImageSource.src;
    elements.heroImage.alt = heroImageSource.alt;
    primeHeroImage(heroImageSource.src).finally(() => {
      scheduleAudioWarmup();
    });
  } else {
    runtime.heroReady = true;
    scheduleAudioWarmup();
  }

  // Once preview is removed, gallery cards only need to look good in the grid.
  // That lets us downsize the source files and reserve exact space up front.
  elements.galleryGrid.innerHTML = galleryItems
    .map(
      (item, index) => `
        <article
          class="gallery-card gallery-card--loading"
          style="--item-index:${index % 6}; aspect-ratio:${item.aspectRatio};"
        >
          <img
            class="gallery-card__image"
            src="${TRANSPARENT_PLACEHOLDER}"
            alt="${item.caption}"
            data-gallery-src="${item.src}"
            width="${item.width || ""}"
            height="${item.height || ""}"
            loading="eager"
            fetchpriority="${index < 3 ? "high" : "auto"}"
            decoding="async"
          />
        </article>
      `
    )
    .join("");
}

function wireInteractions() {
  const warmAudioOnIntent = () => {
    void primeAudioPlayback();
  };

  if (runtime.isWeChat) {
    document.addEventListener(
      "WeixinJSBridgeReady",
      () => {
        runtime.wechatBridgeReady = true;
        void primeAudioPlayback();
      },
      { once: true }
    );
  }

  elements.openInvitation.addEventListener("pointerdown", warmAudioOnIntent, {
    once: true,
    passive: true,
  });
  elements.musicToggle.addEventListener("pointerdown", warmAudioOnIntent, {
    once: true,
    passive: true,
  });

  elements.openInvitation.addEventListener("click", async () => {
    if (!runtime.heroReady) {
      await Promise.race([runtime.heroWarmupPromise, wait(240)]);
    }

    document.body.classList.remove("is-locked");
    document.body.classList.add("is-unsealed");
    elements.openingScreen.setAttribute("aria-hidden", "true");
    syncMusicPlayerLayout();
    const played = runtime.audioPlaybackConfirmed ? true : await playMusic({ announceFailure: true });
    scheduleGalleryLoading({ deferUntilPlayback: !played });

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    window.setTimeout(
      () => document.querySelector("#hero-scroll").focus(),
      prefersReducedMotion ? 0 : 280
    );
  });

  elements.heroScroll.addEventListener("click", () => {
    document.querySelector("#details").scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  });

  if (elements.calendarButton) {
    elements.calendarButton.addEventListener("click", () => {
      if (runtime.isWeChat) {
        copyText(
          getEventSummaryText(),
          "婚礼信息已复制，请在微信里粘贴到日历或聊天。"
        );
        return;
      }

      downloadCalendarFile();
      showStatus("已生成日历文件。");
    });
  }

  elements.mapLink.addEventListener("click", async (event) => {
    if (!runtime.isWeChat) {
      return;
    }

    event.preventDefault();
    await copyText(
      weddingData.event.venueAddress,
      "地址已复制，若地图页没跳转，可直接粘贴搜索。"
    );
    window.setTimeout(() => {
      window.location.href = createWeChatMapUrl(weddingData.event.mapQuery);
    }, 120);
  });

  elements.copyVenueButton.addEventListener("click", () => {
    copyText(weddingData.event.venueAddress, "地点已复制。");
  });

  if (elements.copyLinkButton) {
    elements.copyLinkButton.addEventListener("click", () => {
      copyText(window.location.href, "喜帖链接已复制。");
    });
  }

  elements.musicToggle.addEventListener("click", async () => {
    if (elements.bgmAudio.paused || !runtime.audioPlaybackConfirmed) {
      const played = await playMusic({ announceFailure: true });

      if (played) {
        showStatus(`背景音乐已播放：${weddingData.soundtrack.title}。`);
      }

      return;
    }

    pauseMusic({ announce: true });
  });

  elements.bgmAudio.addEventListener("play", syncMusicState);
  elements.bgmAudio.addEventListener("playing", () => {
    runtime.audioPlaybackConfirmed = true;
    runtime.audioReady = true;
    syncMusicState();
  });
  elements.bgmAudio.addEventListener("pause", () => {
    runtime.audioPlaybackConfirmed = false;
    syncMusicState();
  });
  elements.bgmAudio.addEventListener("error", () => {
    runtime.audioReady = false;
    runtime.audioWarmupPromise = null;
    runtime.audioPlaybackConfirmed = false;
    syncMusicState();
    showStatus("音乐资源加载出了点岔子，稍后再试一下。");
  });
}

function wireCountdown() {
  return startCountdown(weddingData.event.isoDate, ({ days, hours, minutes, seconds, completed }) => {
    elements.countdown.days.textContent = String(days);
    elements.countdown.hours.textContent = String(hours).padStart(2, "0");
    elements.countdown.minutes.textContent = String(minutes).padStart(2, "0");
    elements.countdown.seconds.textContent = String(seconds).padStart(2, "0");
    elements.countdown.hint.textContent = completed
      ? "今天就是属于我们的好日子。"
      : "每一次倒数，都是离相聚更近一点。";
  });
}

function boot() {
  applyWeddingData();
  buildGallery();
  wireInteractions();
  const stopCountdown = wireCountdown();
  const stopReveal = setupReveal([...document.querySelectorAll(".reveal")]);

  syncMusicPlayerLayout();
  window.addEventListener("scroll", syncMusicPlayerLayout, { passive: true });
  window.addEventListener("resize", syncMusicPlayerLayout);

  window.addEventListener(
    "pagehide",
    () => {
      stopCountdown();
      stopReveal();
      pauseMusic();
      document.body.classList.remove("music-player-compact");
    },
    { once: true }
  );
}

boot();
