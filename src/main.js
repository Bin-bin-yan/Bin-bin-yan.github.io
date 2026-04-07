import { galleryManifest } from "./data/gallery.generated.js";
import { weddingData } from "./data/wedding.js";
import { startCountdown } from "./utils/countdown.js";
import { setupLightbox } from "./utils/lightbox.js";
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
  dialog: document.querySelector("#photo-dialog"),
  dialogImage: document.querySelector("#dialog-image"),
  dialogCaption: document.querySelector("#photo-dialog-title"),
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
  heroWarmupPromise: Promise.resolve(),
  audioWarmupPromise: null,
  galleryStreamStarted: false,
};

let statusTimer = 0;
const WHITE_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 10'%3E%3Crect width='16' height='10' fill='%23fffaf8'/%3E%3C/svg%3E";

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
  if (runtime.audioWarmupPromise) {
    return runtime.audioWarmupPromise;
  }

  runtime.audioWarmupPromise = new Promise((resolve) => {
    const finish = () => {
      runtime.audioReady = elements.bgmAudio.readyState >= 3;
      resolve();
    };

    if (elements.bgmAudio.readyState >= 3) {
      finish();
      return;
    }

    const cleanup = () => {
      elements.bgmAudio.removeEventListener("canplaythrough", handleReady);
      elements.bgmAudio.removeEventListener("loadeddata", handleReady);
      elements.bgmAudio.removeEventListener("error", handleReady);
    };

    const handleReady = () => {
      cleanup();
      finish();
    };

    elements.bgmAudio.addEventListener("canplaythrough", handleReady, { once: true });
    elements.bgmAudio.addEventListener("loadeddata", handleReady, { once: true });
    elements.bgmAudio.addEventListener("error", handleReady, { once: true });
    elements.bgmAudio.preload = "auto";
    elements.bgmAudio.load();
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

function loadGalleryImage(imageElement) {
  return new Promise((resolve) => {
    if (!imageElement || imageElement.dataset.loaded === "true") {
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

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      imageElement.dataset.loaded = "true";
      imageElement.classList.add("is-loaded");
      parentCard?.classList.remove("gallery-card--loading");
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

async function streamGalleryImages() {
  if (runtime.galleryStreamStarted) {
    return;
  }

  runtime.galleryStreamStarted = true;

  const galleryImages = [...elements.galleryGrid.querySelectorAll("[data-gallery-src]")];

  for (const [index, imageElement] of galleryImages.entries()) {
    await loadGalleryImage(imageElement);

    if (index < galleryImages.length - 1) {
      await wait(90);
    }
  }
}

function syncMusicState() {
  const isPlaying = !elements.bgmAudio.paused;

  document.body.classList.toggle("music-playing", isPlaying);
  elements.musicPlayer.classList.toggle("is-playing", isPlaying);
  elements.musicToggle.setAttribute("aria-pressed", String(isPlaying));
  elements.musicToggle.setAttribute("aria-label", isPlaying ? "暂停背景音乐" : "播放背景音乐");
}

async function playMusic({ announceFailure = false } = {}) {
  try {
    if (!runtime.audioReady) {
      await Promise.race([primeAudioPlayback(), wait(680)]);
    }

    await elements.bgmAudio.play();
    syncMusicState();
    return true;
  } catch (error) {
    syncMusicState();

    if (announceFailure) {
      showStatus("点一下右上角的 BGM 按钮就能播放音乐。");
    }

    console.error(error);
    return false;
  }
}

function pauseMusic({ announce = false } = {}) {
  elements.bgmAudio.pause();
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
  const galleryItems = galleryManifest.map((item, index) => ({
    ...item,
    caption: `${getFullNames()} · 婚纱照 ${String(index + 1).padStart(2, "0")}`,
  }));

  const coverImage = galleryItems.find((item) => item.isCover) || galleryItems[0];

  if (coverImage) {
    elements.heroImage.src = coverImage.src;
    elements.heroImage.alt = `${getFullNames()} 的婚礼封面照`;
    primeHeroImage(coverImage.src).finally(() => {
      scheduleAudioWarmup();
      void streamGalleryImages();
    });
  } else {
    runtime.heroReady = true;
    scheduleAudioWarmup();
    void streamGalleryImages();
  }

  elements.galleryGrid.innerHTML = galleryItems
    .map(
      (item, index) => `
        <article
          class="gallery-card gallery-card--loading"
          style="--item-index:${index % 6};"
          tabindex="0"
          aria-label="${item.caption}"
          data-gallery-trigger
          data-image="${item.src}"
          data-caption="${item.caption}"
        >
          <img
            class="gallery-card__image"
            src="${WHITE_PLACEHOLDER}"
            alt="${item.caption}"
            data-gallery-src="${item.src}"
            loading="lazy"
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
    await playMusic({ announceFailure: true });

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
    if (elements.bgmAudio.paused) {
      const played = await playMusic({ announceFailure: true });

      if (played) {
        showStatus(`背景音乐已播放：${weddingData.soundtrack.title}。`);
      }

      return;
    }

    pauseMusic({ announce: true });
  });

  elements.bgmAudio.addEventListener("play", syncMusicState);
  elements.bgmAudio.addEventListener("pause", syncMusicState);
  elements.bgmAudio.addEventListener("error", () => {
    runtime.audioReady = false;
    runtime.audioWarmupPromise = null;
    syncMusicState();
    showStatus("音乐资源加载出了点岔子，稍后再试一下。");
  });

  setupLightbox({
    dialog: elements.dialog,
    imageElement: elements.dialogImage,
    captionElement: elements.dialogCaption,
    triggerSelector: "[data-gallery-trigger]",
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

  window.addEventListener(
    "pagehide",
    () => {
      stopCountdown();
      stopReveal();
      pauseMusic();
    },
    { once: true }
  );
}

boot();
