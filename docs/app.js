const platformCurrent = document.querySelector(".platform-current");
const platformMenu = document.querySelector(".platform-menu");
const platformOptions = [...document.querySelectorAll(".platform-menu button")];
const installCode = document.getElementById("install-code");
const toast = document.querySelector(".toast");
const navLinks = [...document.querySelectorAll(".docs-nav a")];
const docSections = [...document.querySelectorAll(".doc-section[id]")];
let toastTimer;

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
  if (installCode) installCode.textContent = "npx transx-cli install";
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
    } catch {
      showToast("复制失败，请手动选择");
    }
  });
});

if ("IntersectionObserver" in window && docSections.length > 0) {
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((link) => link.classList.toggle("active", link.hash === `#${visible.target.id}`));
    },
    { rootMargin: "-15% 0px -70%", threshold: [0, 0.25, 0.5] },
  );
  docSections.forEach((section) => observer.observe(section));
}
