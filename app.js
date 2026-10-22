/* ============================================================
   PART 1: HELPERS – popups, validated forms, toast, image gallery
   ============================================================ */
/* Shared helpers used by every demo site: DOM shortcuts, storage, toast, modal forms, image gallery. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (t) =>
  String(t).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const store = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};

// ---------- Toast message ----------
let toastTimer;
function toast(message, isError) {
  let box = $("#toast");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast";
    box.setAttribute("role", "status");
    document.body.append(box);
  }
  box.textContent = message;
  box.className = "on" + (isError ? " bad" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.className = ""), 3200);
}

// ---------- Modal dialog (Esc closes automatically) ----------
function modal(html) {
  let dlg = $("#dlg");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "dlg";
    document.body.append(dlg);
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) dlg.close();
    });
  }
  dlg.innerHTML = `<button class="x" aria-label="Close" onclick="this.closest('dialog').close()">✕</button>${html}`;
  if (!dlg.open) dlg.showModal();
  return dlg;
}

// ---------- Validated form in a modal (mock only: nothing is sent anywhere) ----------
// fields: [{name,label,type,options,min,max}]  check(values) may return an error string.  done(values) returns a success message.
function formModal({
  title,
  intro = "Demo only. Do not enter real credentials or personal data.",
  fields,
  button = "Submit",
  check,
  done,
}) {
  const dlg = modal(`<h2>${title}</h2><p class="hint">${intro}</p><form novalidate>${fields
    .map(
      (f) => `
    <label>${f.label}${
      f.options
        ? `<select name="${f.name}">${f.options.map((o) => `<option>${o}</option>`).join("")}</select>`
        : `<input name="${f.name}" type="${f.type || "text"}" ${f.min !== undefined ? `min="${f.min}"` : ""} ${f.max !== undefined ? `max="${f.max}"` : ""}>`
    }
      <span class="err" data-for="${f.name}"></span></label>`,
    )
    .join("")}
    <p class="err" data-form></p><button class="primary">${button}</button></form>`);
  $("form", dlg).onsubmit = (e) => {
    e.preventDefault();
    const values = {};
    let ok = true;
    fields.forEach((f) => {
      const v = e.target.elements[f.name].value.trim();
      values[f.name] = v;
      let msg = "";
      if (!v) msg = "This field is required.";
      else if (f.type === "email" && !/^\S+@\S+\.\S+$/.test(v)) msg = "Enter a valid email address.";
      else if (f.type === "password" && v.length < 6) msg = "Use at least 6 characters.";
      else if (f.type === "number" && (+v < f.min || +v > f.max))
        msg = `Enter a number from ${f.min} to ${f.max}.`;
      $(`[data-for="${f.name}"]`, dlg).textContent = msg;
      if (msg) ok = false;
    });
    const problem = ok && check ? check(values) : "";
    $("[data-form]", dlg).textContent = problem || "";
    if (!ok || problem) return;
    const message = done ? done(values) : "Done.";
    dlg.innerHTML = `<button class="x" aria-label="Close" onclick="this.closest('dialog').close()">✕</button><p class="ok" role="status">${message}</p><button class="primary" onclick="this.closest('dialog').close()">Close</button>`;
  };
}

// ---------- Image gallery: multi-upload, preview, replace, remove (saved in this browser only) ----------
function Gallery({ mount, key }) {
  const root = $(mount),
    TYPES = ["image/jpeg", "image/png", "image/webp"];
  let items = store.get(key, []);
  root.innerHTML = `<div class="g-bar"><label class="g-btn">＋ Add images<input type="file" multiple accept=".jpg,.jpeg,.png,.webp" hidden></label>
    <button class="g-btn" data-clear>Remove all</button><span class="g-msg" role="status"></span></div><div class="g-grid"></div>`;
  const grid = $(".g-grid", root),
    msg = $(".g-msg", root);
  const say = (m, bad) => {
    msg.textContent = m;
    msg.className = "g-msg" + (bad ? " bad" : "");
  };

  // Shrink large photos in the browser so they fit in storage
  const shrink = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, 700 / Math.max(img.width, img.height)),
            c = document.createElement("canvas");
          c.width = img.width * k;
          c.height = img.height * k;
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = () => reject(new Error(file.name + " could not be read."));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error(file.name + " could not be read."));
      reader.readAsDataURL(file);
    });
  function save() {
    if (!store.set(key, items)) say("Storage is full: images last for this visit only.", true);
  }
  function render() {
    grid.innerHTML = items.length
      ? items
          .map(
            (it, i) => `<figure class="g-tile"><img src="${it.src}" alt="Uploaded image ${i + 1}">
      <figcaption><label class="g-mini">Replace<input type="file" accept=".jpg,.jpeg,.png,.webp" hidden data-replace="${it.id}"></label>
      <button class="g-mini" data-del="${it.id}">Remove</button></figcaption></figure>`,
          )
          .join("")
      : `<p class="g-empty">No images yet. Add JPG, PNG or WebP files and they appear here.</p>`;
  }
  async function add(files, replaceId) {
    const good = [...files].filter((f) => TYPES.includes(f.type)),
      bad = files.length - good.length;
    if (!good.length) return say("Only JPG, PNG and WebP images are supported.", true);
    say(`Processing ${good.length} image${good.length > 1 ? "s" : ""}…`);
    try {
      const done = await Promise.all(good.map(shrink));
      if (replaceId) items = items.map((it) => (it.id === replaceId ? { id: it.id, src: done[0] } : it));
      else done.forEach((src, n) => items.push({ id: Date.now() + n, src }));
      save();
      render();
      say(
        bad
          ? `Added ${done.length}. ${bad} file(s) skipped (unsupported type).`
          : `${replaceId ? "Replaced" : "Added"} ${done.length} image(s).`,
        !!bad,
      );
    } catch (e) {
      say(e.message, true);
    }
  }
  root.addEventListener("change", (e) => {
    if (!e.target.files || !e.target.files.length) return;
    add(e.target.files, e.target.dataset.replace ? +e.target.dataset.replace : 0);
    e.target.value = "";
  });
  root.addEventListener("click", (e) => {
    if (e.target.dataset.del) {
      items = items.filter((it) => it.id !== +e.target.dataset.del);
      save();
      render();
      say("Image removed.");
    }
    if (e.target.dataset.clear !== undefined) {
      if (!items.length) return say("Nothing to remove.", true);
      items = [];
      save();
      render();
      say("All images removed.");
    }
  });
  render();
}

// ---------- Mobile menu: any #burger toggles #menu ----------
document.addEventListener("click", (e) => {
  if (e.target.closest("#burger")) $("#menu").classList.toggle("open");
  else if (e.target.closest("#menu a")) $("#menu")?.classList.remove("open");
});


/* ============================================================
   PART 2: SITE CODE – data and features of this website
   ============================================================ */
/* Kimaro demo – sample data and interactions. */

// ============================================================ 1. SAMPLE DATA (fictional product)
const BASE_PRICE = 250;
const FINISHES = [
  ["Graphite", "#1d1d1d", 0],
  ["Stone", "#5b5b57", 10],
  ["Forest", "#23402f", 15],
  ["Sand", "#8d7f64", 15],
]; // name, color, extra price
const RINGS = [
  ["Lime", "#7cf06a", 0],
  ["Ice", "#6bd2ff", 5],
  ["Orange", "#ff8a3d", 5],
];
const SLIDES = [
  ["Smoothest focus", "Phase-detect style autofocus keeps your face sharp while you move.", 92],
  ["Low-light clarity", "A large sensor keeps calls clear in dim rooms (sample claim).", 78],
  ["Wide view", "A 90° lens fits more of the room, or crop in with a tap.", 85],
  ["Clean audio", "A dual-mic array reduces keyboard and room noise.", 70],
];
const SPECS = [
  ["1080p / 60", "Video resolution"],
  ["90°", "Field of view"],
  ["USB-C", "Connection"],
  ["Aluminum", "Body (sample spec)"],
];

let finish = 0,
  ring = 0;

// ============================================================ 2. CUSTOMIZER (live preview + price)
const total = () => BASE_PRICE + FINISHES[finish][2] + RINGS[ring][2];
function renderCustom() {
  document.documentElement.style.setProperty("--finish", FINISHES[finish][1]);
  document.documentElement.style.setProperty("--ring", RINGS[ring][1]);
  $("#finishes").innerHTML = FINISHES.map(
    (f, i) =>
      `<button class="sw ${i === finish ? "on" : ""}" style="background:${f[1]}" data-finish="${i}" aria-label="${f[0]} finish"></button>`,
  ).join("");
  $("#rings").innerHTML = RINGS.map(
    (r, i) =>
      `<button class="sw ${i === ring ? "on" : ""}" style="background:${r[1]}" data-ring="${i}" aria-label="${r[0]} lens ring"></button>`,
  ).join("");
  $("#summary").textContent = `${FINISHES[finish][0]} + ${RINGS[ring][0]} ring: $${total()}`;
  $("#price").textContent = "$" + total();
}
$("#customize").onclick = (e) => {
  if (e.target.dataset.finish !== undefined) finish = +e.target.dataset.finish;
  if (e.target.dataset.ring !== undefined) ring = +e.target.dataset.ring;
  renderCustom();
};

// ============================================================ 3. FEATURE TABS
let slide = 0;
function renderSlides() {
  $("#tabs").innerHTML = SLIDES.map(
    (s, i) => `<button role="tab" class="${i === slide ? "on" : ""}" data-slide="${i}">${s[0]}</button>`,
  ).join("");
  const s = SLIDES[slide];
  $("#slide").innerHTML =
    `<h3>${s[0]}</h3><p>${s[1]}</p><div class="meter" role="img" aria-label="Sample score ${s[2]}"><i style="width:${s[2]}%"></i></div><small>Sample score: ${s[2]} / 100</small>`;
}
$("#tabs").onclick = (e) => {
  if (e.target.dataset.slide !== undefined) {
    slide = +e.target.dataset.slide;
    renderSlides();
  }
};
$("#specList").innerHTML = SPECS.map(([v, l]) => `<li><b>${v}</b>${l}</li>`).join("");

// ============================================================ 4. PREORDER (demo: no payment is taken)
function preorder() {
  formModal({
    title: "Preorder Kimaro (demo)",
    button: "Place demo preorder",
    intro: `${FINISHES[finish][0]} + ${RINGS[ring][0]} ring · $${total()} each. No payment is taken.`,
    fields: [
      { name: "name", label: "Name" },
      { name: "email", label: "Email", type: "email" },
      { name: "qty", label: "Quantity", type: "number", min: 1, max: 5 },
    ],
    done: (v) =>
      `Thanks ${esc(v.name)}! Demo preorder: ${v.qty} × $${total()} = $${v.qty * total()}. Nothing was charged or sent.`,
  });
}
$("#buyNow").onclick = preorder;
$("#preorderTop").onclick = preorder;
$("#newsForm").onsubmit = (e) => {
  e.preventDefault();
  const ok = /^\S+@\S+\.\S+$/.test($("#newsEmail").value);
  $("#newsOut").textContent = ok
    ? "You're on the list (demo). Nothing was sent."
    : "Enter a valid email address.";
  if (ok) $("#newsEmail").value = "";
};
Gallery({ mount: "#gallery", key: "km-gallery" });
renderCustom();
renderSlides();
