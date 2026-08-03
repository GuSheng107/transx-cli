const osNotes = {
  windows: "安装入口：%LOCALAPPDATA%\\.transx\\bin\\transx.cmd",
  macos: "安装入口：~/.transx/bin/transx · 支持 Apple Silicon 与 Intel",
  linux: "安装入口：~/.transx/bin/transx · 支持 x64 与 arm64",
};

const tabs = [...document.querySelectorAll("[data-os]")];
const osNote = document.querySelector("#os-note");
const toast = document.querySelector(".copy-toast");
let toastTimer;

function setOperatingSystem(os) {
  tabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.os === os)));
  if (osNote) osNote.textContent = osNotes[os];
}

function detectOperatingSystem() {
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  if (/mac/i.test(platform)) return "macos";
  if (/linux/i.test(platform)) return "linux";
  return "windows";
}

tabs.forEach((tab) => tab.addEventListener("click", () => setOperatingSystem(tab.dataset.os)));
setOperatingSystem(detectOperatingSystem());

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 1800);
}

document.querySelectorAll("[data-copy-target]").forEach((button) => {
  button.addEventListener("click", async () => {
    const target = document.getElementById(button.dataset.copyTarget);
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target.textContent.trim());
      showToast("命令已复制");
    } catch {
      showToast("复制失败，请手动选择");
    }
  });
});

const sections = [...document.querySelectorAll(".doc-section[id]")];
const navLinks = [...document.querySelectorAll(".docs-nav a")];

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((link) => link.classList.toggle("active", link.hash === `#${visible.target.id}`));
    },
    { rootMargin: "-20% 0px -65%", threshold: [0, 0.25, 0.5] },
  );
  sections.forEach((section) => observer.observe(section));
}
