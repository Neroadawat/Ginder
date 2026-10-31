/* Admin credentials stay in an HttpOnly cookie; the CSRF token stays in memory. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const state = {
    csrf: "",
    page: 1,
    total: 0,
    row: null,
    dirty: false,
    photo: null,
    removePhoto: false,
    saveError: "",
    saveProgress: "",
    busy: false,
    storage: false,
    listRequest: 0,
  };
  const days = [
    "อาทิตย์",
    "จันทร์",
    "อังคาร",
    "พุธ",
    "พฤหัสบดี",
    "ศุกร์",
    "เสาร์",
  ];
  const labels = {
    Thai: "อาหารไทย",
    Japanese: "ญี่ปุ่น",
    Korean: "เกาหลี",
    Chinese: "จีน",
    Italian: "อิตาเลียน",
    Indian: "อินเดีย",
    "Fast Food": "ฟาสต์ฟู้ด",
    Cafe: "คาเฟ่",
    Dessert: "ของหวาน",
    "Food Court": "ศูนย์อาหาร",
    Steak: "สเต๊ก",
    "Hot Pot": "ชาบู / หม้อไฟ",
    Other: "ยังไม่จัดหมวด",
  };
  const form = $("restaurant-form");
  const field = (name) => form.elements.namedItem(name);
  const { cropRectangle, weeklyPeriods, missingFields, requestError } =
    window.GinderAdminTools;
  let photoBitmap = null,
    photoLoadRequest = 0;
  state.items = [];
  state.queue = [];
  state.queueIndex = -1;
  state.photoLoading = false;
  state.sessionExpired = false;
  state.userId = null;
  state.editorRequest = 0;
  const fieldErrors = new Map();
  let errorSequence = 0;
  const iconPaths = {
    search: ["M21 21l-5-5", "M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0"],
    image: ["M3 4h18v16H3z", "M3 16l6-6 5 5 3-3 4 4", "M16 8h.01"],
    store: ["M4 10v11h16V10", "M3 3h18l1 7H2z", "M9 21v-7h6v7"],
    logout: ["M9 3H4v18h5", "M9 12h13m-5-5 5 5-5 5"],
    login: ["M15 3h5v18h-5", "M2 12h13m-5-5 5 5-5 5"],
    refresh: ["M20 8a8 8 0 1 0 0 8", "M20 3v5h-5"],
    right: ["M5 12h14m-6-6 6 6-6 6"],
    left: ["M19 12H5m6-6-6 6 6 6"],
    close: ["m6 6 12 12M6 18 18 6"],
    check: ["m5 12 4 4L19 6"],
    pin: [
      "M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0",
      "M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    ],
    history: ["M3 10a9 9 0 1 1 1 7", "M3 4v6h6", "M12 7v6l4 2"],
    undo: ["M4 9h10a6 6 0 0 1 0 12", "m9 4-5 5 5 5"],
    external: ["M14 3h7v7", "M21 3 11 13", "M10 3H3v18h18v-7"],
    plus: ["M12 5v14M5 12h14"],
    trash: ["M3 6h18M9 6V3h6v3", "m5 6 1 15h12l1-15M10 10v7m4-7v7"],
    save: ["M3 3h15l3 3v15H3z", "M7 3v6h10V3M7 21v-8h10v8"],
    edit: ["M3 21l4-1L20 7l-4-4L3 16z", "m13 6 4 4"],
    info: ["M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0", "M12 11v6m0-10h.01"],
  };
  const hasChanges = () =>
    Boolean(state.dirty || state.photo || state.removePhoto);
  let locationMap = null,
    locationMarker = null;
  let previewURL = "",
    toastTimer,
    searchTimer,
    previousFocus;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [key, value] of Object.entries({
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.8",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
      focusable: "false",
      class: "ui-icon",
    }))
      svg.setAttribute(key, value);
    for (const d of iconPaths[name] || iconPaths.info) {
      const path = document.createElementNS(svg.namespaceURI, "path");
      path.setAttribute("d", d);
      svg.append(path);
    }
    return svg;
  }
  function buttonLabel(button, text, name) {
    button.replaceChildren(icon(name), element("span", "", text));
  }
  document.querySelectorAll("[data-icon]").forEach((node) => {
    node.replaceChildren(icon(node.dataset.icon));
    node.setAttribute("aria-hidden", "true");
  });
  function clearFieldError(control) {
    const error = fieldErrors.get(control);
    if (!error) return;
    control.removeAttribute("aria-invalid");
    const ids = (control.getAttribute("aria-describedby") || "")
      .split(" ")
      .filter((id) => id && id !== error.id);
    if (ids.length) control.setAttribute("aria-describedby", ids.join(" "));
    else control.removeAttribute("aria-describedby");
    error.remove();
    fieldErrors.delete(control);
  }
  function setFieldError(control, message) {
    clearFieldError(control);
    const error = element("p", "field-error", message);
    error.id = "field-error-" + ++errorSequence;
    control.setAttribute("aria-invalid", "true");
    control.setAttribute(
      "aria-describedby",
      [control.getAttribute("aria-describedby"), error.id]
        .filter(Boolean)
        .join(" ")
    );
    (control.closest("label") || control).after(error);
    fieldErrors.set(control, error);
  }
  function revealControl(control) {
    let parent = control.parentElement;
    while (parent && parent !== $("editor")) {
      if (parent.tagName === "DETAILS") parent.open = true;
      parent = parent.parentElement;
    }
    control.scrollIntoView({ block: "center" });
    control.focus();
  }
  function validateForm(target) {
    let first = null;
    for (const control of target.elements) {
      clearFieldError(control);
      if (!control.willValidate) continue;
      const v = control.validity;
      const blank =
        control.required &&
        control.type !== "password" &&
        typeof control.value === "string" &&
        !control.value.trim();
      if (v.valid && !blank) continue;
      const names = {
        name: "ชื่อร้าน",
        email: "อีเมล",
        password: "รหัสผ่าน",
        attribution: "เครดิตภาพ",
        latitude: "ละติจูด",
        longitude: "ลองจิจูด",
        primary_category: "หมวดอาหาร",
      };
      let message = "กรุณาตรวจข้อมูลในช่องนี้";
      if (control.type === "checkbox")
        message = "กรุณายืนยันว่ามีสิทธิ์ใช้รูปและระบุเครดิตถูกต้อง";
      else if (v.valueMissing || blank)
        message = "กรุณาระบุ" + (names[control.name] || "ข้อมูลในช่องนี้");
      else if (v.typeMismatch && control.type === "email")
        message = "กรุณากรอกอีเมลให้ถูกต้อง เช่น name@example.com";
      else if (v.rangeUnderflow || v.rangeOverflow)
        message = `กรุณาระบุค่าระหว่าง ${control.min} ถึง ${control.max}`;
      else if (v.badInput) message = "กรุณากรอกตัวเลขหรือเวลาให้ถูกต้อง";
      else if (v.tooLong)
        message = `กรอกได้ไม่เกิน ${control.maxLength} ตัวอักษร`;
      setFieldError(control, message);
      first ||= control;
    }
    if (first) revealControl(first);
    return !first;
  }
  function serverFieldErrors(error, targets) {
    let first = null;
    for (const issue of error.validation || []) {
      const key = issue.loc?.[1];
      let control = targets
        .map((target) => target.elements.namedItem(key))
        .find(Boolean);
      if (!control && key === "opening_hours" && targets.includes(form)) {
        const index = issue.loc.indexOf("periods");
        const row =
          $("hours-rows").children[index >= 0 ? issue.loc[index + 1] : 0];
        control = row?.querySelectorAll("input")[1] || $("hours-mode");
      }
      if (control) {
        setFieldError(
          control,
          key === "email"
            ? "กรุณากรอกอีเมลให้ถูกต้อง เช่น name@example.com"
            : "กรุณาตรวจข้อมูลในช่องนี้ให้ถูกต้อง"
        );
        first ||= control;
      }
    }
    return first;
  }
  document.addEventListener("input", (event) => clearFieldError(event.target));
  document.addEventListener("change", (event) => clearFieldError(event.target));
  document.querySelectorAll("[data-section]").forEach((button) =>
    button.addEventListener("click", () => {
      const section = $(button.dataset.section);
      if (section.tagName === "DETAILS") section.open = true;
      section.scrollIntoView({ block: "start" });
      (section.querySelector("summary") || section).focus();
    })
  );
  function notify(message, error = false) {
    clearTimeout(toastTimer);
    $("toast").textContent = message;
    $("toast").classList.toggle("is-error", error);
    $("toast").hidden = false;
    toastTimer = setTimeout(
      () => {
        $("toast").hidden = true;
      },
      error ? 9000 : 4000
    );
  }
  function updateSaveState() {
    const changed = hasChanges();
    $("save-all").disabled =
      state.busy || state.sessionExpired || state.photoLoading || !changed;
    const hasNext =
      state.queueIndex >= 0 && state.queueIndex + 1 < state.queue.length;
    $("save-next").disabled =
      state.busy || state.sessionExpired || state.photoLoading || !hasNext;
    buttonLabel(
      $("save-next"),
      changed ? "บันทึกแล้วไปร้านถัดไป" : "ร้านถัดไป",
      "right"
    );
    $("queue-status").textContent =
      state.queueIndex >= 0
        ? `ร้าน ${state.queueIndex + 1} / ${state.queue.length} ในหน้านี้${
            hasNext
              ? " · ใช้ลำดับเดิมของรายการที่เปิด"
              : " · ครบหน้านี้แล้ว กลับรายการเพื่อเลือกหน้าถัดไป"
          }`
        : "";
    $("discard-changes").disabled = state.busy || !changed;
    buttonLabel(
      $("save-all"),
      state.busy
        ? "กำลังบันทึก…"
        : state.saveError && !state.dirty
        ? "ลองบันทึกรูปอีกครั้ง"
        : "บันทึกทั้งหมด",
      state.busy ? "refresh" : "save"
    );
    $("save-all").classList.toggle("is-loading", state.busy);
    $("save-status").textContent = state.busy
      ? state.saveProgress
      : state.saveError
      ? "บันทึกยังไม่ครบ"
      : changed
      ? "มีการแก้ไขที่ยังไม่บันทึก"
      : "บันทึกแล้ว ไม่มีการแก้ไขค้างอยู่";
    if (state.sessionExpired)
      $("save-status").textContent = "กรุณาเข้าสู่ระบบอีกครั้งเพื่อบันทึกต่อ";
    $("save-detail").textContent =
      state.saveError ||
      (changed
        ? [
            state.dirty && "ข้อมูลร้าน",
            state.photo && "รูปใหม่",
            state.removePhoto && "นำรูปออก",
          ]
            .filter(Boolean)
            .join(" · ") + " — กดบันทึกทั้งหมดเพื่อยืนยัน"
        : "แก้ข้อมูลหรือเลือกรูปได้ แล้วบันทึกพร้อมกันที่นี่");
    $("save-detail").classList.toggle("save-error", Boolean(state.saveError));
    $("editor").setAttribute("aria-busy", String(state.busy));
    $("photo-form")
      .querySelectorAll("input,select")
      .forEach((control) => {
        control.disabled = state.busy || !state.photo;
      });
    $("photo-file").disabled = state.busy || !state.storage;
    $("photo-drop").classList.toggle("unavailable", !state.storage);
    $("discard-photo").hidden = !state.photo && !state.removePhoto;
    $("remove-photo").hidden = !state.row?.photo_url || state.removePhoto;
    $("photo-selection-status").textContent = state.photo
      ? `รอบันทึก: ${state.photo.name} · ${(
          state.photo.size /
          1024 /
          1024
        ).toFixed(2)} MB`
      : state.removePhoto
      ? "จะนำรูปเดิมออกเมื่อกดบันทึกทั้งหมด ยังยกเลิกได้"
      : "เลือกรูปใหม่เพื่อเปลี่ยนรูปและระบุเครดิต";
    if (state.photoLoading)
      $("photo-selection-status").textContent = "กำลังเปิดภาพสำหรับปรับกรอบ…";
    $("photo-state-label").textContent = state.photo
      ? "รูปใหม่ · ยังไม่บันทึก"
      : state.removePhoto
      ? "รูปปัจจุบัน · รอลบเมื่อบันทึก"
      : state.row?.photo_url
      ? "รูปปัจจุบัน · บันทึกแล้ว"
      : "ยังไม่มีรูปประจำร้าน";
    $("photo-state-label").classList.toggle(
      "pending",
      Boolean(state.photo || state.removePhoto)
    );
    $("photo-state-label").classList.toggle(
      "empty",
      !state.photo && !state.removePhoto && !state.row?.photo_url
    );
    renderCompleteness();
    updateAppPreviewText();
  }
  function renderCompleteness() {
    if (!state.row) return;
    const value = {
      name: field("name").value,
      primary_category: field("primary_category").value,
      latitude:
        field("latitude").value === "" ? null : Number(field("latitude").value),
      longitude:
        field("longitude").value === ""
          ? null
          : Number(field("longitude").value),
      address: field("address").value,
      price_level:
        field("price_level").value === ""
          ? null
          : Number(field("price_level").value),
      opening_hours: readHours(),
    };
    value.photo_url = state.photo
      ? "pending"
      : state.removePhoto
      ? null
      : state.row.photo_url;
    const missing = missingFields(value);
    const signature = JSON.stringify(missing);
    if ($("completeness").dataset.missing === signature) return;
    $("completeness").dataset.missing = signature;
    $("completeness").replaceChildren(
      element("strong", "", `มีข้อมูลแล้ว ${7 - missing.length} จาก 7 รายการ`),
      element(
        "p",
        "fine",
        missing.length
          ? "ยังไม่มี: " + missing.join(" · ")
          : "มีข้อมูลพื้นฐานครบตามรายการนี้"
      ),
      element(
        "p",
        "fine",
        "นับข้อมูลพื้นฐานโดยไม่รวมคะแนน แยกจากการยืนยันว่าตรวจสอบแล้ว"
      )
    );
  }
  function markDirty() {
    $("discard-confirmation").hidden = true;
    state.dirty = true;
    updateSaveState();
  }
  function showLogin() {
    clearPhotoTools();
    state.csrf = "";
    state.row = null;
    state.dirty = false;
    state.photo = null;
    state.removePhoto = false;
    state.saveError = "";
    state.sessionExpired = false;
    $("session-renewal").hidden = true;
    $("editor").hidden = true;
    document.body.classList.remove("modal-open");
    $("restaurant-rows").replaceChildren();
    $("workspace").hidden = true;
    $("workspace").inert = false;
    $("login-view").hidden = false;
    $("initial-loading").hidden = true;
  }
  function showSessionRenewal() {
    state.sessionExpired = true;
    $("session-renewal").hidden = false;
    updateSaveState();
    $("session-renewal").scrollIntoView({ block: "start" });
  }
  function xhrUpload(url, options, headers) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(options.method, url);
      xhr.withCredentials = true;
      xhr.timeout = 120000;
      for (const [key, value] of Object.entries(headers))
        xhr.setRequestHeader(key, value);
      xhr.upload.addEventListener("progress", (event) =>
        options.onUploadProgress(
          event.lengthComputable
            ? Math.floor((event.loaded / event.total) * 100)
            : null
        )
      );
      xhr.addEventListener("load", () => {
        if (!xhr.status) return reject(new Error(requestError(0)));
        resolve(
          new Response(xhr.status === 204 ? null : xhr.responseText, {
            status: xhr.status,
            headers: { "Content-Type": "application/json" },
          })
        );
      });
      for (const type of ["error", "timeout", "abort"])
        xhr.addEventListener(type, () => reject(new Error(requestError(0))));
      xhr.send(options.body);
    });
  }
  async function api(path, options = {}) {
    const headers = { ...options.headers };
    if (options.body && !(options.body instanceof FormData))
      headers["Content-Type"] = "application/json";
    if (options.method && options.method !== "GET")
      headers["X-CSRF-Token"] = state.csrf;
    let response;
    try {
      if (options.onUploadProgress)
        response = await xhrUpload("/admin/api" + path, options, headers);
      else {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30000);
        try {
          response = await fetch("/admin/api" + path, {
            ...options,
            headers,
            credentials: "same-origin",
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
      }
    } catch {
      throw new Error(requestError(0));
    }
    if (response.headers.get("X-Ginder-Preview") === "true")
      $("preview-banner").hidden = false;
    if (response.status === 204) return null;
    const data = await response
      .json()
      .catch(() => ({ detail: "การเชื่อมต่อผิดพลาด กรุณาลองอีกครั้ง" }));
    if (!response.ok) {
      const error = new Error(requestError(response.status, path));
      if ([401, 403].includes(response.status) && path !== "/login") {
        if (state.row) showSessionRenewal();
        else {
          showLogin();
          $("login-error").textContent = error.message;
        }
      }
      error.status = response.status;
      error.validation = Array.isArray(data.detail) ? data.detail : [];
      throw error;
    }
    return data;
  }
  async function restoreSession() {
    const session = await api("/session");
    state.csrf = session.csrf_token;
    state.storage = session.photo_storage_ready;
    state.userId = session.user_id;
    state.sessionExpired = false;
    $("admin-name").textContent = session.name;
    $("category-filter").replaceChildren(new Option("ทุกหมวดอาหาร", ""));
    field("primary_category").replaceChildren();
    for (const category of session.categories) {
      $("category-filter").add(
        new Option(labels[category] || category, category)
      );
      field("primary_category").add(
        new Option(labels[category] || category, category)
      );
    }
    $("storage-notice").hidden = state.storage;
    $("login-view").hidden = true;
    $("workspace").hidden = false;
    $("initial-loading").hidden = true;
    await loadList();
  }
  $("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateForm(event.currentTarget)) return;
    const target = event.currentTarget,
      button = target.querySelector("button");
    button.disabled = true;
    $("login-error").textContent = "";
    const data = new FormData(event.currentTarget);
    try {
      await api("/login", {
        method: "POST",
        body: JSON.stringify({
          email: data.get("email"),
          password: data.get("password"),
        }),
      });
      $("login-form").reset();
      await restoreSession();
    } catch (error) {
      $("login-error").textContent = error.message;
      const first = serverFieldErrors(error, [target]);
      if (first) revealControl(first);
    } finally {
      button.disabled = false;
    }
  });
  $("renew-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateForm(event.currentTarget)) return;
    const target = event.currentTarget,
      button = target.querySelector("button"),
      values = new FormData(target);
    button.disabled = true;
    $("renew-error").textContent = "";
    try {
      await api("/login", {
        method: "POST",
        body: JSON.stringify({
          email: values.get("email"),
          password: values.get("password"),
        }),
      });
      target.elements.namedItem("password").value = "";
      const session = await api("/session");
      if (!state.userId || session.user_id !== state.userId)
        throw new Error("กรุณาใช้บัญชีผู้ดูแลเดิม ข้อมูลที่แก้ไว้ยังไม่ถูกส่ง");
      state.csrf = session.csrf_token;
      state.storage = session.photo_storage_ready;
      state.sessionExpired = false;
      state.saveError = "";
      target.reset();
      $("session-renewal").hidden = true;
      updateSaveState();
      $("save-all").focus();
      notify("เข้าสู่ระบบแล้ว ข้อมูลที่แก้ไว้ยังอยู่ กดบันทึกต่อได้");
    } catch (error) {
      $("renew-error").textContent = error.message;
      const first = serverFieldErrors(error, [target]);
      if (first) revealControl(first);
    } finally {
      button.disabled = false;
    }
  });
  $("logout").addEventListener("click", async () => {
    if (
      hasChanges() &&
      !confirm("มีการแก้ไขที่ยังไม่ได้บันทึก ต้องการออกจากระบบหรือไม่?")
    )
      return;
    try {
      await api("/logout", { method: "POST" });
      showLogin();
    } catch (error) {
      notify(error.message, true);
    }
  });
  async function loadList() {
    const requestId = ++state.listRequest;
    $("list-error").hidden = true;
    $("list-status").textContent = "กำลังโหลดรายการร้าน…";
    $("refresh").disabled = true;
    $("previous").disabled = $("next").disabled = true;
    $("refresh").classList.add("is-loading");
    $("restaurant-rows").closest("section").setAttribute("aria-busy", "true");
    $("restaurant-rows")
      .querySelectorAll("button")
      .forEach((button) => {
        button.disabled = true;
      });
    const params = new URLSearchParams({
      q: $("search").value.trim(),
      category: $("category-filter").value,
      issue: $("issue-filter").value,
      page: String(state.page),
    });
    try {
      const data = await api("/restaurants?" + params);
      if (requestId !== state.listRequest || !state.csrf) return;
      state.total = data.total;
      state.items = data.items;
      for (const key of ["all", "missing_photo", "unreviewed", "duplicates"])
        $("stat-" + key).textContent = data.stats[key];
      $("result-count").textContent = data.total + " รายการ";
      $("page-label").textContent = data.total
        ? `แสดง ${(state.page - 1) * 20 + 1}–${Math.min(
            state.page * 20,
            data.total
          )} จาก ${data.total} ร้าน`
        : "ไม่มีรายการ";
      $("previous").disabled = state.page <= 1;
      $("next").disabled = state.page * 20 >= data.total;
      $("empty-state").hidden = data.items.length !== 0;
      $("restaurant-rows").replaceChildren(...data.items.map(tableRow));
      document
        .querySelectorAll(".stat")
        .forEach((button) =>
          button.classList.toggle(
            "active",
            button.dataset.issue === $("issue-filter").value
          )
        );
    } catch (error) {
      if (requestId !== state.listRequest) return;
      $("list-error").hidden = false;
      $("list-error-text").textContent =
        error.message +
        (state.items.length
          ? " รายการที่เห็นเป็นข้อมูลที่โหลดไว้ก่อนหน้า"
          : "");
    } finally {
      if (requestId === state.listRequest) {
        $("list-status").textContent = "";
        $("refresh").disabled = false;
        $("previous").disabled = state.page <= 1 || !state.items.length;
        $("next").disabled =
          state.page * 20 >= state.total || !state.items.length;
        $("refresh").classList.remove("is-loading");
        $("restaurant-rows")
          .closest("section")
          .setAttribute("aria-busy", "false");
        $("restaurant-rows")
          .querySelectorAll("button")
          .forEach((button) => {
            button.disabled = false;
          });
      }
    }
  }
  $("retry-list").addEventListener("click", loadList);
  function tableRow(row) {
    const tr = element("tr");
    const identity = element("td"),
      cell = element("div", "restaurant-cell");
    if (row.photo_url) {
      const image = element("img", "thumb");
      image.src = row.photo_url;
      image.alt = "";
      image.loading = "lazy";
      image.addEventListener(
        "error",
        () => image.replaceWith(photoPlaceholder()),
        { once: true }
      );
      cell.append(image);
    } else cell.append(photoPlaceholder());
    const name = element("div");
    name.append(
      element("div", "restaurant-name", row.name),
      element("div", "restaurant-meta", row.address || "ยังไม่ระบุที่อยู่")
    );
    cell.append(name);
    identity.append(cell);
    const category = element("td");
    category.dataset.label = "หมวดอาหาร";
    category.append(
      element(
        "span",
        "badge",
        labels[row.primary_category] || row.primary_category
      )
    );
    const missing = missingFields(row);
    const issues = element("td");
    issues.dataset.label = "ข้อมูลที่ยังไม่มี";
    const tags = element("div", "issue-tags");
    if (missing.length)
      missing.forEach((label) =>
        tags.append(element("span", "issue-chip", label))
      );
    else tags.append(element("span", "badge good", "ข้อมูลครบ"));
    issues.append(tags);
    issues.append(
      element(
        "small",
        "data-count",
        `มีข้อมูล ${7 - missing.length} จาก 7 รายการ`
      )
    );
    const status = element("td");
    status.dataset.label = "การตรวจสอบ";
    status.append(
      element(
        "span",
        row.reviewed ? "badge good" : "badge pending",
        row.reviewed ? "ตรวจสอบแล้ว" : "รอตรวจสอบ"
      )
    );
    const action = element("td", "restaurant-action"),
      button = element("button", "row-edit");
    buttonLabel(button, "แก้ไขข้อมูล", "edit");
    button.setAttribute("aria-label", "แก้ไขข้อมูลร้าน " + row.name);
    button.addEventListener("click", () => {
      state.queue = state.items.map((item) => item.id);
      openEditor(row.id);
    });
    action.append(button);
    tr.append(identity, category, issues, status, action);
    return tr;
  }
  function photoPlaceholder() {
    const placeholder = element("div", "thumb thumb-placeholder");
    placeholder.append(icon("image"));
    return placeholder;
  }
  function resetPage() {
    state.page = 1;
    loadList();
  }
  $("search").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(resetPage, 250);
  });
  $("category-filter").addEventListener("change", resetPage);
  $("issue-filter").addEventListener("change", resetPage);
  document.querySelectorAll(".stat").forEach((button) =>
    button.addEventListener("click", () => {
      $("issue-filter").value = button.dataset.issue;
      resetPage();
    })
  );
  $("refresh").addEventListener("click", loadList);
  $("previous").addEventListener("click", () => {
    state.page--;
    loadList();
  });
  $("next").addEventListener("click", () => {
    state.page++;
    loadList();
  });

  function timeValue(value = "0900") {
    return value.slice(0, 2) + ":" + value.slice(2);
  }
  function addHours(
    period = { open: { day: 1, time: "0900" }, close: { day: 1, time: "2100" } }
  ) {
    const row = element("div", "hours-row");
    const openDay = element("select"),
      closeDay = element("select");
    openDay.setAttribute("aria-label", "วันเปิด");
    closeDay.setAttribute("aria-label", "วันปิด");
    days.forEach((day, i) => {
      openDay.add(new Option("เปิด · " + day, i));
      closeDay.add(new Option("ปิด · " + day, i));
    });
    openDay.value = period.open.day;
    closeDay.value = period.close.day;
    const openTime = element("input"),
      closeTime = element("input");
    openTime.type = closeTime.type = "time";
    openTime.required = closeTime.required = true;
    openTime.setAttribute("aria-label", "เวลาเปิด");
    closeTime.setAttribute("aria-label", "เวลาปิด");
    openTime.value = timeValue(period.open.time);
    closeTime.value = timeValue(period.close.time);
    const remove = element("button", "", "นำช่วงเวลานี้ออก");
    remove.type = "button";
    remove.addEventListener("click", () => {
      row.remove();
      markDirty();
    });
    const copy = element("button", "copy-hours", "คัดลอกไปวันอื่น");
    copy.type = "button";
    copy.addEventListener("click", () => {
      const daysApart =
        (Number(closeDay.value) - Number(openDay.value) + 7) % 7;
      if (daysApart > 1)
        return notify(
          "ช่วงเวลานี้ข้ามหลายวัน กรุณาตั้งช่วงเวลาใหม่ในเครื่องมือหลายวัน",
          true
        );
      $("bulk-open").value = openTime.value;
      $("bulk-close").value = closeTime.value;
      $("bulk-next-day").checked = daysApart === 1;
      $("bulk-days")
        .querySelectorAll("input")
        .forEach((input) => {
          input.checked = Number(input.value) === Number(openDay.value);
        });
      $("hours-controls").querySelector("details").open = true;
      $("bulk-open").focus();
    });
    row.append(openDay, closeDay, openTime, closeTime, copy, remove);
    $("hours-rows").append(row);
  }
  function readHours() {
    if ($("hours-mode").value === "unknown") return null;
    if ($("hours-mode").value === "always")
      return { periods: [{ open: { day: 0, time: "0000" } }] };
    return {
      periods: [...$("hours-rows").children].map((row) => {
        const selects = row.querySelectorAll("select"),
          times = row.querySelectorAll("input");
        return {
          open: {
            day: Number(selects[0].value),
            time: times[0].value.replace(":", ""),
          },
          close: {
            day: Number(selects[1].value),
            time: times[1].value.replace(":", ""),
          },
        };
      }),
    };
  }
  days.forEach((day, index) => {
    const label = element("label", "checkbox-row");
    const input = element("input");
    input.type = "checkbox";
    input.value = index;
    label.append(input, element("span", "", day));
    $("bulk-days").append(label);
  });
  document.querySelectorAll("[data-days]").forEach((button) =>
    button.addEventListener("click", () => {
      const selected = button.dataset.days.split(",");
      $("bulk-days")
        .querySelectorAll("input")
        .forEach((input) => {
          input.checked = selected.includes(input.value);
        });
    })
  );
  $("apply-hours").addEventListener("click", () => {
    if (state.busy) return;
    $("hours-error").textContent = "";
    try {
      const selected = [
        ...$("bulk-days").querySelectorAll("input:checked"),
      ].map((input) => Number(input.value));
      const added = weeklyPeriods(
        selected,
        $("bulk-open").value.replace(":", ""),
        $("bulk-close").value.replace(":", ""),
        $("bulk-next-day").checked
      );
      const unchanged = readHours().periods.filter(
        (period) => !selected.includes(period.open.day)
      );
      const periods = [...unchanged, ...added].sort(
        (a, b) =>
          a.open.day - b.open.day || a.open.time.localeCompare(b.open.time)
      );
      if (periods.length > 28) throw new Error("เพิ่มได้สูงสุด 28 ช่วงเวลา");
      $("hours-rows").replaceChildren();
      periods.forEach(addHours);
      markDirty();
      notify(`ใช้เวลากับ ${added.length} วันแล้ว รอกดบันทึกทั้งหมด`);
    } catch (error) {
      $("hours-error").textContent = error.message;
    }
  });
  function syncHoursControls() {
    const hidden = $("hours-mode").value !== "weekly";
    $("hours-controls").hidden = hidden;
    $("hours-controls")
      .querySelectorAll("input,button,select")
      .forEach((control) => {
        control.disabled = hidden || state.busy;
      });
  }
  function updateMapLink() {
    if (!field("latitude").value || !field("longitude").value) return;
    const latitude = Number(field("latitude").value),
      longitude = Number(field("longitude").value);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    )
      return;
    $(
      "map-link"
    ).href = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    if (locationMarker) {
      locationMarker.setLatLng([latitude, longitude]);
      if (!locationMap.getBounds().contains([latitude, longitude]))
        locationMap.panTo([latitude, longitude]);
    }
  }
  function selectLocation(latlng) {
    if (state.busy || !state.row) return;
    field("latitude").value = Math.max(-90, Math.min(90, latlng.lat)).toFixed(
      6
    );
    field("longitude").value = latlng.wrap().lng.toFixed(6);
    markDirty();
    updateMapLink();
    $("map-status").textContent =
      "เลือกตำแหน่งใหม่แล้ว กดบันทึกข้อมูลร้านเพื่อยืนยัน";
  }
  function openLocationMap() {
    if (locationMap) locationMap.remove();
    locationMap = locationMarker = null;
    $("coordinate-details").open = false;
    $("map-status").textContent =
      "หมุดแสดงตำแหน่งที่บันทึกไว้ ถ้าถูกต้องแล้วไม่ต้องเปลี่ยน";
    if (!window.L) {
      $("map-status").textContent =
        "เปิดแผนที่ไม่ได้ กรุณารีเฟรช หรือใช้ช่องปรับพิกัดด้วยตัวเลข";
      $("coordinate-details").open = true;
      return;
    }
    const position = [
      Number(field("latitude").value),
      Number(field("longitude").value),
    ];
    locationMap = L.map("location-map", { scrollWheelZoom: false }).setView(
      position,
      17
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      referrerPolicy: "strict-origin-when-cross-origin",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    })
      .on("tileerror", () => {
        $("map-status").textContent =
          "โหลดภาพแผนที่บางส่วนไม่ได้ ลองเปิดใหม่ หรือปรับพิกัดด้วยตัวเลข";
      })
      .addTo(locationMap);
    locationMarker = L.marker(position, {
      draggable: true,
      title: "ตำแหน่งร้าน — ลากหมุดเพื่อเปลี่ยน",
      alt: "หมุดตำแหน่งร้าน",
      icon: L.divIcon({
        className: "restaurant-pin",
        html: "<span></span>",
        iconSize: [30, 38],
        iconAnchor: [15, 38],
      }),
    }).addTo(locationMap);
    locationMarker.on("dragend", () =>
      selectLocation(locationMarker.getLatLng())
    );
    locationMap.on("click", (event) => selectLocation(event.latlng));
    requestAnimationFrame(() => locationMap?.invalidateSize());
  }
  $("reset-location").addEventListener("click", () => {
    if (!state.row || state.busy) return;
    field("latitude").value = state.row.latitude;
    field("longitude").value = state.row.longitude;
    markDirty();
    updateMapLink();
    locationMap?.setView([state.row.latitude, state.row.longitude], 17);
    $("map-status").textContent = "กลับไปตำแหน่งที่บันทึกไว้แล้ว";
  });
  form.addEventListener(
    "invalid",
    (event) => {
      if (["latitude", "longitude"].includes(event.target.name))
        $("coordinate-details").open = true;
    },
    true
  );
  form.addEventListener("input", (event) => {
    if (event.target.closest(".hours-bulk")) return;
    markDirty();
    updateMapLink();
  });
  form.addEventListener("change", (event) => {
    if (event.target.closest(".hours-bulk")) return;
    markDirty();
  });
  $("hours-mode").addEventListener("change", () => {
    syncHoursControls();
    if (!$("hours-controls").hidden && !$("hours-rows").children.length)
      addHours();
    renderCompleteness();
  });
  $("add-hours").addEventListener("click", () => {
    if ($("hours-rows").children.length >= 28)
      return notify("เพิ่มได้สูงสุด 28 ช่วงเวลา", true);
    addHours();
    markDirty();
  });
  function setPhotoPreview(url) {
    $("photo-preview").hidden = !url;
    $("photo-placeholder").hidden = Boolean(url);
    if (url) $("photo-preview").src = url;
    else $("photo-preview").removeAttribute("src");
    $("app-preview").hidden = !url;
    for (const id of ["app-card-photo", "app-list-photo"]) {
      if (url) $(id).src = url;
      else $(id).removeAttribute("src");
    }
    updateAppPreviewText();
  }
  function updateAppPreviewText() {
    $("app-card-name").textContent = field("name").value || "ชื่อร้าน";
    $("app-list-name").textContent = field("name").value || "ชื่อร้าน";
    $("app-card-category").textContent =
      labels[field("primary_category").value] || "หมวดอาหาร";
  }
  function clearPhotoTools() {
    for (const control of $("photo-form").elements) clearFieldError(control);
    photoLoadRequest++;
    photoBitmap?.close();
    photoBitmap = null;
    state.photoLoading = false;
    $("crop-controls").hidden = true;
    $("crop-controls").open = false;
    $("upload-feedback").hidden = true;
    $("upload-progress").hidden = false;
  }
  function photoCrop() {
    return cropRectangle(
      photoBitmap.width,
      photoBitmap.height,
      Number($("crop-ratio").value),
      Number($("crop-zoom").value),
      Number($("crop-x").value),
      Number($("crop-y").value)
    );
  }
  function drawPhotoCrop(canvas, maxSide) {
    const rect = photoCrop();
    const scale = Math.min(1, maxSide / Math.max(rect.width, rect.height));
    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      photoBitmap,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      canvas.width,
      canvas.height
    );
  }
  function renderPhotoCrop() {
    if (!state.photo || !photoBitmap || state.busy) return;
    const cropping = $("crop-ratio").value !== "original";
    $("crop-adjustments").hidden = !cropping;
    if (!cropping) setPhotoPreview(previewURL);
    else {
      drawPhotoCrop($("crop-canvas"), 600);
      setPhotoPreview($("crop-canvas").toDataURL("image/webp", 0.85));
    }
    updateSaveState();
  }
  for (const id of ["crop-ratio", "crop-zoom", "crop-x", "crop-y"])
    $(id).addEventListener("input", renderPhotoCrop);
  async function photoForUpload() {
    if (!photoBitmap || $("crop-ratio").value === "original")
      return state.photo;
    const canvas = document.createElement("canvas");
    drawPhotoCrop(canvas, 1600);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.9)
    );
    if (!blob || blob.size > 5 * 1024 * 1024)
      throw new Error("สร้างไฟล์รูปไม่สำเร็จ ลองเลือกภาพเต็มหรือไฟล์ใหม่");
    return new File([blob], "restaurant-crop.webp", { type: blob.type });
  }
  const historyLabels = {
    name: "ชื่อร้าน",
    primary_category: "หมวดอาหาร",
    latitude: "ละติจูด",
    longitude: "ลองจิจูด",
    address: "ที่อยู่",
    price_level: "ระดับราคา",
    opening_hours: "เวลาเปิด–ปิด",
    admin_notes: "หมายเหตุ",
    reviewed: "สถานะตรวจสอบ",
    photo_attribution: "เครดิตภาพ",
    photo_source: "แหล่งภาพ",
    photo_url: "รูปประจำร้าน",
  };
  function readableHistoryValue(key, value) {
    if (key === "reviewed") return value ? "ตรวจแล้ว" : "รอตรวจสอบ";
    if (value == null || value === "") return "ยังไม่มีข้อมูล";
    if (key === "primary_category") return labels[value] || String(value);
    if (key === "price_level")
      return (
        [
          "ไม่มีค่าใช้จ่าย",
          "฿ — ประหยัด",
          "฿฿ — ปานกลาง",
          "฿฿฿ — สูง",
          "฿฿฿฿ — สูงมาก",
        ][value] || String(value)
      );
    if (key === "photo_url") return "มีรูปภาพ";
    if (key === "photo_source")
      return (
        { owner_upload: "ทีมถ่ายเอง", permission_granted: "ได้รับอนุญาต" }[
          value
        ] || String(value)
      );
    if (key === "opening_hours") {
      if (!value.periods?.length) return "ยังไม่ทราบเวลา";
      if (value.periods.length === 1 && !value.periods[0].close)
        return "เปิด 24 ชั่วโมงทุกวัน";
      return value.periods
        .map(
          (period) =>
            `${days[period.open.day]} ${timeValue(period.open.time)} – ${
              days[period.close?.day] || ""
            } ${period.close ? timeValue(period.close.time) : "ไม่ระบุ"}`
        )
        .join("\n");
    }
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
  function renderAuditChanges(audit, item) {
    const list = element("dl", "audit-changes");
    for (const [key, change] of Object.entries(audit.changes)) {
      if (!historyLabels[key]) continue;
      const before = readableHistoryValue(key, change.before),
        after = readableHistoryValue(key, change.after);
      list.append(element("dt", "", historyLabels[key]));
      const value = element("dd");
      if (key === "photo_url" && change.before && change.after)
        value.textContent = "เปลี่ยนเป็นรูปใหม่";
      else
        value.append(
          element("span", "audit-before", before),
          element("span", "audit-arrow", " → "),
          element("span", "audit-after", after)
        );
      list.append(value);
    }
    item.append(list);
  }
  async function openEditor(id) {
    const request = ++state.editorRequest;
    const openingNew = $("editor").hidden || state.row?.id !== id;
    try {
      const data = await api("/restaurants/" + id),
        row = data.restaurant;
      if (request !== state.editorRequest) return false;
      for (const control of [...fieldErrors.keys()]) clearFieldError(control);
      if ($("editor").hidden) previousFocus = document.activeElement;
      state.row = row;
      state.queueIndex = state.queue.indexOf(id);
      state.dirty = false;
      state.photo = null;
      state.removePhoto = false;
      state.saveError = "";
      clearPhotoTools();
      $("discard-confirmation").hidden = true;
      if (previewURL) URL.revokeObjectURL(previewURL);
      previewURL = "";
      form.reset();
      $("photo-form").reset();
      $("photo-file").value = "";
      $("editor-title").textContent = row.name;
      $("record-info").replaceChildren(
        element("dt", "", "แหล่งข้อมูล"),
        element(
          "dd",
          "",
          row.source === "osm" ? "OpenStreetMap" : "เพิ่มโดยผู้ดูแล"
        ),
        element("dt", "", "รหัสอ้างอิงร้าน"),
        element("dd", "", row.place_id)
      );
      if (openingNew) $("history-panel").open = false;
      $("history-count").textContent = `${data.history.length} รายการล่าสุด`;
      for (const name of [
        "name",
        "primary_category",
        "address",
        "latitude",
        "longitude",
        "price_level",
        "admin_notes",
      ])
        field(name).value = row[name] ?? "";
      field("reviewed").checked = row.reviewed;
      $("hours-rows").replaceChildren();
      const periods = row.opening_hours?.periods;
      const always = periods?.length === 1 && !periods[0].close;
      $("hours-mode").value = !row.opening_hours
        ? "unknown"
        : always
        ? "always"
        : "weekly";
      if (periods && !always) periods.forEach(addHours);
      syncHoursControls();
      $("hours-error").textContent = "";
      $("hours-controls").querySelector("details").open = false;
      updateMapLink();
      setPhotoPreview(row.photo_url);
      $("photo-form").elements.namedItem("attribution").value =
        row.photo_attribution || "";
      $("photo-form").elements.namedItem("source").value =
        row.photo_source === "permission_granted"
          ? row.photo_source
          : "owner_upload";
      $("remove-photo").hidden = !row.photo_url;
      $("similar-restaurants").hidden = !data.similar.length;
      $("similar-restaurants").replaceChildren();
      if (data.similar.length) {
        $("similar-restaurants").append(
          element(
            "strong",
            "",
            "พบชื่อเดียวกัน · ตรวจสอบว่าเป็นคนละสาขาหรือไม่"
          )
        );
        data.similar.forEach((other) => {
          const link = element(
            "a",
            "text-link",
            other.name + " · " + other.latitude + ", " + other.longitude
          );
          link.href = `https://www.google.com/maps/search/?api=1&query=${other.latitude},${other.longitude}`;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          $("similar-restaurants").append(link);
        });
      }
      $("history").replaceChildren();
      if (!data.history.length)
        $("history").append(element("p", "fine", "ยังไม่มีการแก้ไขผ่าน Admin"));
      for (const audit of data.history) {
        const item = element("div", "history-item");
        item.append(
          element(
            "strong",
            "",
            {
              edit: "แก้ข้อมูลร้าน",
              photo_upload: "อัปโหลดรูป",
              photo_remove: "นำรูปออก",
            }[audit.action] || audit.action
          ),
          element(
            "small",
            "",
            (audit.actor === "Former administrator"
              ? "ผู้ดูแลที่ลบบัญชีแล้ว"
              : audit.actor) +
              " · " +
              new Date(audit.created_at).toLocaleString("th-TH", {
                timeZone: "Asia/Bangkok",
              }) +
              " น."
          )
        );
        renderAuditChanges(audit, item);
        const details = element("details"),
          summary = element("summary", "", "ข้อมูลสำหรับตรวจสอบระบบ");
        details.append(
          summary,
          element("pre", "", JSON.stringify(audit.changes, null, 2))
        );
        item.append(details);
        $("history").append(item);
      }
      $("editor").hidden = false;
      if (openingNew) $("editor").querySelector(".editor-body").scrollTop = 0;
      updateSaveState();
      openLocationMap();
      $("workspace").inert = true;
      document.body.classList.add("modal-open");
      $("close-editor").focus();
      return true;
    } catch (error) {
      if (request !== state.editorRequest) return false;
      notify(error.message, true);
      return false;
    }
  }
  function closeEditor() {
    if (state.busy) return;
    if (
      hasChanges() &&
      !confirm("ยังมีการแก้ไขที่ไม่ได้บันทึก ต้องการปิดหรือไม่?")
    )
      return;
    $("editor").hidden = true;
    state.editorRequest++;
    if (locationMap) locationMap.remove();
    locationMap = locationMarker = null;
    $("workspace").inert = false;
    document.body.classList.remove("modal-open");
    state.row = null;
    state.dirty = false;
    state.photo = null;
    state.removePhoto = false;
    clearPhotoTools();
    if (previewURL) URL.revokeObjectURL(previewURL);
    if (previousFocus?.isConnected) previousFocus.focus();
    else $("search").focus();
  }
  $("close-editor").addEventListener("click", closeEditor);
  $("editor").addEventListener("click", (event) => {
    if (event.target === $("editor")) closeEditor();
  });
  document.addEventListener("keydown", (event) => {
    if ($("editor").hidden) return;
    if (event.key === "Escape") closeEditor();
    if (event.key === "Tab") {
      const controls = [
        ...$("editor").querySelectorAll(
          "button,input,select,textarea,a[href],summary"
        ),
      ].filter((node) => !node.disabled && node.getClientRects().length);
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (hasChanges() || state.busy) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  function busy(value) {
    state.busy = value;
    $("location-map").inert = value;
    if (locationMarker) {
      if (value) locationMarker.dragging.disable();
      else locationMarker.dragging.enable();
    }
    $("editor")
      .querySelectorAll("button,input,select,textarea")
      .forEach((control) => (control.disabled = value));
    syncHoursControls();
    updateSaveState();
  }
  function restaurantBody() {
    const values = new FormData(form);
    return {
      expected_version: state.row.version,
      name: values.get("name"),
      primary_category: values.get("primary_category"),
      latitude: Number(values.get("latitude")),
      longitude: Number(values.get("longitude")),
      address: values.get("address") || null,
      price_level:
        values.get("price_level") === ""
          ? null
          : Number(values.get("price_level")),
      opening_hours: readHours(),
      admin_notes: values.get("admin_notes") || null,
      reviewed: field("reviewed").checked,
    };
  }
  async function goNext() {
    if (state.sessionExpired) return showSessionRenewal();
    const id = state.queue[state.queueIndex + 1];
    if (!id) return;
    busy(true);
    try {
      await openEditor(id);
    } finally {
      busy(false);
    }
  }
  async function saveAll(andNext = false) {
    if (!state.row || state.busy || state.photoLoading) return;
    if (!hasChanges()) {
      if (andNext) await goNext();
      return;
    }
    $("discard-confirmation").hidden = true;
    if (state.sessionExpired) return showSessionRenewal();
    if (!validateForm(form)) return;
    if (state.photo && !validateForm($("photo-form"))) return;
    if (state.photo && !state.storage)
      return notify("ยังไม่ได้เชื่อมที่เก็บรูป จึงยังบันทึกรูปไม่ได้", true);
    const body = restaurantBody();
    const photoData = state.photo ? new FormData($("photo-form")) : null;
    if (photoData) {
      photoData.set("rights_confirmed", "true");
    }
    const id = state.row.id;
    let savedData = false;
    let focusAfterSave = null;
    let stage = state.dirty ? "data" : "photo";
    state.saveError = "";
    state.saveProgress = state.dirty
      ? "กำลังบันทึกข้อมูลร้าน…"
      : "กำลังบันทึกรูป…";
    busy(true);
    try {
      if (photoData) photoData.set("file", await photoForUpload());
      if (state.dirty) {
        state.row = await api("/restaurants/" + id, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        state.dirty = false;
        savedData = true;
        $("editor-title").textContent = state.row.name;
      }
      stage = "photo";
      if (photoData || state.removePhoto) {
        state.saveProgress = savedData
          ? "ข้อมูลร้านบันทึกแล้ว กำลังบันทึกรูป…"
          : "กำลังบันทึกรูป…";
        updateSaveState();
        if (photoData) {
          photoData.set("expected_version", state.row.version);
          $("upload-feedback").hidden = false;
          $("upload-progress").hidden = false;
          $("upload-progress").value = 0;
          $("upload-status").textContent = "กำลังส่งรูป…";
          state.row = await api("/restaurants/" + id + "/photo", {
            method: "POST",
            body: photoData,
            onUploadProgress: (percent) => {
              if (percent === null)
                $("upload-progress").removeAttribute("value");
              else $("upload-progress").value = percent;
              state.saveProgress =
                percent === 100
                  ? "ส่งรูปแล้ว กำลังรอระบบบันทึก…"
                  : percent === null
                  ? "กำลังส่งรูป…"
                  : `กำลังส่งรูป ${percent}%`;
              $("upload-status").textContent = state.saveProgress;
              updateSaveState();
            },
          });
        } else {
          state.row = await api("/restaurants/" + id + "/photo", {
            method: "DELETE",
            body: JSON.stringify({ expected_version: state.row.version }),
          });
        }
        state.photo = null;
        state.removePhoto = false;
      }
      const refreshed = await openEditor(id);
      await loadList();
      notify(
        refreshed
          ? "บันทึกการแก้ไขทั้งหมดแล้ว"
          : "บันทึกสำเร็จ แต่โหลดข้อมูลล่าสุดไม่ได้ กรุณาปิดและเปิดร้านใหม่",
        !refreshed
      );
      if (andNext && refreshed) await goNext();
    } catch (error) {
      if (state.row) {
        focusAfterSave = serverFieldErrors(error, [form, $("photo-form")]);
        if (stage === "photo" && photoData) {
          $("upload-progress").hidden = true;
          $("upload-status").textContent =
            "ยังส่งรูปไม่สำเร็จ รูปที่เลือกยังอยู่และลองส่งซ้ำได้";
        }
        state.saveError =
          error.status === 409
            ? "ข้อมูลถูกแก้จากที่อื่น กรุณาคัดลอกสิ่งที่ยังไม่บันทึก แล้วปิดและเปิดร้านใหม่ก่อนลองอีกครั้ง"
            : stage === "photo"
            ? (savedData
                ? "ข้อมูลร้านบันทึกแล้ว แต่บันทึกรูปไม่สำเร็จ "
                : "ยังบันทึกรูปไม่สำเร็จ ") +
              (state.removePhoto
                ? "ยังไม่ได้รับการยืนยันการลบรูป กดลองอีกครั้งหรือตรวจข้อมูลล่าสุด — "
                : "รูปที่เลือกยังอยู่ กดลองบันทึกอีกครั้งได้ — ") +
              error.message
            : "ยังไม่ได้รับการยืนยันการบันทึกข้อมูลร้าน การแก้ไขยังอยู่ — " +
              error.message;
        notify("บันทึกยังไม่ครบ ตรวจรายละเอียดที่แถบด้านล่าง", true);
        if (savedData) await loadList();
      }
    } finally {
      busy(false);
      if (focusAfterSave) revealControl(focusAfterSave);
    }
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveAll();
  });
  $("save-all").addEventListener("click", () => saveAll());
  $("save-next").addEventListener("click", () => saveAll(true));
  $("discard-changes").addEventListener("click", () => {
    if (!state.row || state.busy) return;
    $("discard-confirmation").hidden = false;
    $("keep-editing").focus();
  });
  $("keep-editing").addEventListener("click", () => {
    $("discard-confirmation").hidden = true;
    $("discard-changes").focus();
  });
  $("confirm-discard").addEventListener("click", async () => {
    if (!state.row || state.busy) return;
    busy(true);
    try {
      await openEditor(state.row.id);
    } finally {
      busy(false);
    }
  });
  async function selectPhoto(file) {
    if (!file || state.busy || !state.storage) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    )
      return notify("เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB", true);
    const request = ++photoLoadRequest;
    state.photoLoading = true;
    updateSaveState();
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      if (request !== photoLoadRequest) {
        bitmap.close();
        return;
      }
      if (bitmap.width * bitmap.height > 25_000_000) {
        bitmap.close();
        throw new Error("รูปต้องไม่เกิน 25 ล้านพิกเซล");
      }
    } catch (error) {
      if (request !== photoLoadRequest) return;
      state.photoLoading = false;
      updateSaveState();
      return notify(
        error.message === "รูปต้องไม่เกิน 25 ล้านพิกเซล"
          ? error.message
          : "เปิดรูปไม่ได้ กรุณาเลือก JPG, PNG หรือ WebP ที่ไม่เสียหาย",
        true
      );
    }
    photoBitmap?.close();
    photoBitmap = bitmap;
    state.photoLoading = false;
    state.photo = file;
    state.removePhoto = false;
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = URL.createObjectURL(file);
    setPhotoPreview(previewURL);
    $("crop-controls").hidden = false;
    $("crop-ratio").value = "original";
    $("crop-zoom").value = "1";
    $("crop-x").value = $("crop-y").value = "50";
    $("crop-adjustments").hidden = true;
    $("photo-form").elements.namedItem("rights_confirmed").checked = false;
    updateSaveState();
  }
  $("photo-file").addEventListener("change", (event) =>
    selectPhoto(event.target.files[0])
  );
  $("photo-drop").addEventListener("dragover", (event) => {
    event.preventDefault();
    $("photo-drop").classList.add("dragging");
  });
  $("photo-drop").addEventListener("dragleave", () =>
    $("photo-drop").classList.remove("dragging")
  );
  $("photo-drop").addEventListener("drop", (event) => {
    event.preventDefault();
    $("photo-drop").classList.remove("dragging");
    selectPhoto(event.dataTransfer.files[0]);
  });
  $("photo-form").addEventListener("submit", (event) => {
    event.preventDefault();
    saveAll();
  });
  $("remove-photo").addEventListener("click", () => {
    if (!state.row || state.busy) return;
    state.photo = null;
    state.removePhoto = true;
    clearPhotoTools();
    setPhotoPreview(null);
    updateSaveState();
  });
  $("discard-photo").addEventListener("click", () => {
    if (!state.row || state.busy) return;
    state.photo = null;
    state.removePhoto = false;
    state.saveError = "";
    clearPhotoTools();
    $("photo-file").value = "";
    $("photo-form").reset();
    $("photo-form").elements.namedItem("attribution").value =
      state.row.photo_attribution || "";
    $("photo-form").elements.namedItem("source").value =
      state.row.photo_source === "permission_granted"
        ? "permission_granted"
        : "owner_upload";
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = "";
    setPhotoPreview(state.row.photo_url);
    updateSaveState();
  });
  async function start() {
    $("startup-error").hidden = true;
    $("initial-loading").hidden = false;
    try {
      await restoreSession();
    } catch (error) {
      if ([401, 403].includes(error.status)) {
        showLogin();
        $("login-error").textContent =
          error.status === 401 ? "" : error.message;
      } else {
        $("initial-loading").hidden = true;
        $("startup-error").hidden = false;
        $("startup-error-text").textContent = error.message;
      }
    }
  }
  $("retry-startup").addEventListener("click", start);
  start();
})();
