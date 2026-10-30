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
    Other: "อื่น ๆ",
  };
  const form = $("restaurant-form");
  const field = (name) => form.elements.namedItem(name);
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
  function showLogin() {
    state.csrf = "";
    state.row = null;
    state.dirty = false;
    state.photo = null;
    $("editor").hidden = true;
    document.body.classList.remove("modal-open");
    $("restaurant-rows").replaceChildren();
    $("workspace").hidden = true;
    $("workspace").inert = false;
    $("login-view").hidden = false;
    $("initial-loading").hidden = true;
  }
  async function api(path, options = {}) {
    const headers = { ...options.headers };
    if (options.body && !(options.body instanceof FormData))
      headers["Content-Type"] = "application/json";
    if (options.method && options.method !== "GET")
      headers["X-CSRF-Token"] = state.csrf;
    const response = await fetch("/admin/api" + path, {
      ...options,
      headers,
      credentials: "same-origin",
    });
    if (response.headers.get("X-Ginder-Preview") === "true")
      $("preview-banner").hidden = false;
    if (response.status === 204) return null;
    const data = await response
      .json()
      .catch(() => ({ detail: "การเชื่อมต่อผิดพลาด กรุณาลองอีกครั้ง" }));
    if (!response.ok) {
      if (response.status === 401 && path !== "/login") showLogin();
      const detail =
        typeof data.detail === "string"
          ? data.detail
          : "กรุณาตรวจข้อมูลที่กรอกให้ครบและถูกต้อง";
      throw new Error(detail);
    }
    return data;
  }
  async function restoreSession() {
    const session = await api("/session");
    state.csrf = session.csrf_token;
    state.storage = session.photo_storage_ready;
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
    const button = event.currentTarget.querySelector("button");
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
    } finally {
      button.disabled = false;
    }
  });
  $("logout").addEventListener("click", async () => {
    if (
      (state.dirty || state.photo) &&
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
      notify(error.message, true);
    }
  }
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
        () => image.replaceWith(element("div", "thumb thumb-placeholder", "▧")),
        { once: true }
      );
      cell.append(image);
    } else cell.append(element("div", "thumb thumb-placeholder", "▧"));
    const name = element("div");
    name.append(
      element("div", "restaurant-name", row.name),
      element(
        "div",
        "restaurant-meta",
        row.source.toUpperCase() + " · " + row.place_id
      )
    );
    cell.append(name);
    identity.append(cell);
    const category = element("td");
    category.append(
      element(
        "span",
        "badge",
        labels[row.primary_category] || row.primary_category
      )
    );
    const missing = [];
    if (!row.photo_url) missing.push("รูปภาพ");
    if (!row.address) missing.push("ที่อยู่");
    if (!row.opening_hours?.periods?.length) missing.push("เวลาเปิด–ปิด");
    if (row.price_level === null) missing.push("ราคา");
    const issues = element("td");
    issues.append(
      element(
        "span",
        "issue-text",
        missing.length ? missing.join(" · ") : "ข้อมูลครบ"
      )
    );
    const status = element("td");
    status.append(
      element(
        "span",
        row.reviewed ? "badge good" : "badge pending",
        row.reviewed ? "✓ ตรวจแล้ว" : "รอตรวจสอบ"
      )
    );
    const action = element("td"),
      button = element("button", "row-edit", "จัดการ →");
    button.addEventListener("click", () => openEditor(row.id));
    action.append(button);
    tr.append(identity, category, issues, status, action);
    return tr;
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
      state.dirty = true;
    });
    row.append(openDay, closeDay, openTime, closeTime, remove);
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
  function updateMapLink() {
    const latitude = Number(field("latitude").value),
      longitude = Number(field("longitude").value);
    $(
      "map-link"
    ).href = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }
  form.addEventListener("input", () => {
    state.dirty = true;
    updateMapLink();
  });
  form.addEventListener("change", () => {
    state.dirty = true;
  });
  $("hours-mode").addEventListener("change", () => {
    $("hours-controls").hidden = $("hours-mode").value !== "weekly";
    $("hours-rows")
      .querySelectorAll("input")
      .forEach((input) => (input.disabled = $("hours-controls").hidden));
    if (!$("hours-controls").hidden && !$("hours-rows").children.length)
      addHours();
  });
  $("add-hours").addEventListener("click", () => {
    if ($("hours-rows").children.length >= 28)
      return notify("เพิ่มได้สูงสุด 28 ช่วงเวลา", true);
    addHours();
    state.dirty = true;
  });
  function setPhotoPreview(url) {
    $("photo-preview").hidden = !url;
    $("photo-placeholder").hidden = Boolean(url);
    if (url) $("photo-preview").src = url;
    else $("photo-preview").removeAttribute("src");
  }
  async function openEditor(id) {
    try {
      const data = await api("/restaurants/" + id),
        row = data.restaurant;
      if ($("editor").hidden) previousFocus = document.activeElement;
      state.row = row;
      state.dirty = false;
      state.photo = null;
      if (previewURL) URL.revokeObjectURL(previewURL);
      previewURL = "";
      form.reset();
      $("photo-form").reset();
      $("photo-file").value = "";
      $("editor-title").textContent = row.name;
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
      $("hours-controls").hidden = $("hours-mode").value !== "weekly";
      updateMapLink();
      setPhotoPreview(row.photo_url);
      $("photo-form").elements.namedItem("attribution").value =
        row.photo_attribution || "";
      $("photo-form").elements.namedItem("source").value =
        row.photo_source === "permission_granted"
          ? row.photo_source
          : "owner_upload";
      $("upload-photo").disabled = !state.storage;
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
            audit.actor +
              " · " +
              new Date(audit.created_at).toLocaleString("th-TH", {
                timeZone: "Asia/Bangkok",
              }) +
              " น."
          )
        );
        const details = element("details"),
          summary = element("summary", "", "ดูข้อมูลที่เปลี่ยน");
        details.append(
          summary,
          element("pre", "", JSON.stringify(audit.changes, null, 2))
        );
        item.append(details);
        $("history").append(item);
      }
      $("editor").hidden = false;
      $("workspace").inert = true;
      document.body.classList.add("modal-open");
      $("close-editor").focus();
    } catch (error) {
      notify(error.message, true);
    }
  }
  function closeEditor() {
    if (state.busy) return;
    if (
      (state.dirty || state.photo) &&
      !confirm("ยังมีการแก้ไขที่ไม่ได้บันทึก ต้องการปิดหรือไม่?")
    )
      return;
    $("editor").hidden = true;
    $("workspace").inert = false;
    document.body.classList.remove("modal-open");
    state.row = null;
    state.dirty = false;
    state.photo = null;
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
    if (state.dirty || state.photo || state.busy) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  function busy(value) {
    state.busy = value;
    $("editor")
      .querySelectorAll("button,input,select,textarea")
      .forEach((control) => (control.disabled = value));
    if (!value)
      $("hours-rows")
        .querySelectorAll("input")
        .forEach((input) => (input.disabled = $("hours-controls").hidden));
    $("upload-photo").disabled = value || !state.storage;
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.row || state.busy) return;
    const values = new FormData(form);
    const body = {
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
    busy(true);
    try {
      const updated = await api("/restaurants/" + state.row.id, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      state.row = updated;
      state.dirty = false;
      if (!state.photo) await openEditor(updated.id);
      else $("editor-title").textContent = updated.name;
      await loadList();
      notify("บันทึกข้อมูลร้านเรียบร้อยแล้ว");
    } catch (error) {
      notify(error.message, true);
    } finally {
      busy(false);
    }
  });
  function selectPhoto(file) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    )
      return notify("เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB", true);
    state.photo = file;
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = URL.createObjectURL(file);
    setPhotoPreview(previewURL);
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
  $("photo-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.row || state.busy) return;
    if (state.dirty) return notify("กรุณาบันทึกข้อมูลร้านก่อนอัปโหลดรูป", true);
    if (!state.photo) return notify("กรุณาเลือกรูปจากคอมก่อน", true);
    const data = new FormData(event.currentTarget);
    data.set("file", state.photo);
    data.set("expected_version", state.row.version);
    data.set("rights_confirmed", "true");
    busy(true);
    try {
      await api("/restaurants/" + state.row.id + "/photo", {
        method: "POST",
        body: data,
      });
      const id = state.row.id;
      state.photo = null;
      await openEditor(id);
      await loadList();
      notify("อัปโหลดรูปเรียบร้อยแล้ว");
    } catch (error) {
      notify(error.message, true);
    } finally {
      busy(false);
    }
  });
  $("remove-photo").addEventListener("click", async () => {
    if (state.dirty || state.photo)
      return notify("กรุณาบันทึกหรือยกเลิกการแก้ไขก่อนนำรูปออก", true);
    if (!confirm("ต้องการนำรูปปัจจุบันออกหรือไม่? แอปจะกลับไปใช้ภาพตัวอย่าง"))
      return;
    busy(true);
    try {
      await api("/restaurants/" + state.row.id + "/photo", {
        method: "DELETE",
        body: JSON.stringify({ expected_version: state.row.version }),
      });
      const id = state.row.id;
      await openEditor(id);
      await loadList();
      notify("นำรูปออกแล้ว");
    } catch (error) {
      notify(error.message, true);
    } finally {
      busy(false);
    }
  });
  restoreSession().catch(() => showLogin());
})();
