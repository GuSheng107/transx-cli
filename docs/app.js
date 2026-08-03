const platformCurrent = document.querySelector(".platform-current");
const platformMenu = document.querySelector(".platform-menu");
const platformOptions = [...document.querySelectorAll(".platform-menu button")];
const installCode = document.getElementById("install-code");
const toast = document.querySelector(".toast");
const navLinks = [...document.querySelectorAll(".docs-nav a")];
const docSections = [...document.querySelectorAll(".doc-section[id]")];
let toastTimer;
const copyRestoreTimers = new WeakMap();

function detectPlatform() {
  const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "";
  if (/Win/i.test(platform)) return "windows";
  if (/Mac/i.test(platform)) return "macos";
  if (/Linux/i.test(platform)) return "linux";
  return "macos";
}

function setPlatform(name) {
  if (!platformCurrent) return;
  const glyphs = { macos: "MAC", windows: "WIN", linux: "LNX" };
  const labels = { macos: "macOS", windows: "Windows", linux: "Linux" };
  platformCurrent.querySelector(".platform-icon").textContent = glyphs[name];
  platformCurrent.querySelector(".platform-label").textContent = labels[name];
  platformCurrent.dataset.platform = name;
  platformOptions.forEach((option) => option.setAttribute("aria-selected", String(option.dataset.platform === name)));
  if (installCode) installCode.textContent = "npx transx-cli@latest install";
}

if (platformCurrent && platformMenu) {
  platformCurrent.addEventListener("click", (event) => {
    event.stopPropagation();
    const expanded = platformCurrent.getAttribute("aria-expanded") === "true";
    platformCurrent.setAttribute("aria-expanded", String(!expanded));
    platformMenu.classList.toggle("open", !expanded);
  });

  platformOptions.forEach((option) => {
    option.addEventListener("click", () => {
      setPlatform(option.dataset.platform);
      platformCurrent.setAttribute("aria-expanded", "false");
      platformMenu.classList.remove("open");
    });
  });

  document.addEventListener("click", () => {
    platformCurrent.setAttribute("aria-expanded", "false");
    platformMenu.classList.remove("open");
  });
  setPlatform(detectPlatform());
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 1800);
}

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const target = document.getElementById(button.dataset.copy);
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target.textContent.trim());
      showToast("已复制");
      if (button.closest(".cmd-block, .command-syntax")) {
        const previousTimer = copyRestoreTimers.get(button);
        if (previousTimer) window.clearTimeout(previousTimer);
        button.textContent = "已复制";
        button.classList.add("copied");
        const restoreTimer = window.setTimeout(() => {
          button.textContent = "复制";
          button.classList.remove("copied");
          copyRestoreTimers.delete(button);
        }, 1800);
        copyRestoreTimers.set(button, restoreTimer);
      }
    } catch {
      showToast("复制失败，请手动选择");
    }
  });
});

if (docSections.length > 0) {
  let scrollFrame;
  const updateActiveSection = () => {
    const atPageEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    const activationLine = Math.min(180, window.innerHeight * 0.28);
    let activeSection = docSections[0];
    for (const section of docSections) {
      if (section.getBoundingClientRect().top <= activationLine) activeSection = section;
    }
    if (atPageEnd) activeSection = docSections[docSections.length - 1];
    navLinks.forEach((link) => link.classList.toggle("active", link.hash === `#${activeSection.id}`));
  };
  const scheduleActiveSectionUpdate = () => {
    window.cancelAnimationFrame(scrollFrame);
    scrollFrame = window.requestAnimationFrame(updateActiveSection);
  };
  window.addEventListener("scroll", scheduleActiveSectionUpdate, { passive: true });
  window.addEventListener("resize", scheduleActiveSectionUpdate);
  updateActiveSection();
}
