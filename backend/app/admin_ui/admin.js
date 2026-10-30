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
    Other: "อื่น ๆ",
  };
  const form = $("restaurant-form");
  const field = (name) => form.elements.namedItem(name);
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
    $("save-all").disabled = state.busy || !changed;
    $("discard-changes").disabled = state.busy || !changed;
    $("save-all").textContent = state.busy
      ? "กำลังบันทึก…"
      : state.saveError && !state.dirty
      ? "ลองบันทึกรูปอีกครั้ง"
      : "บันทึกทั้งหมด";
    $("save-status").textContent = state.busy
      ? state.saveProgress
      : state.saveError
      ? "บันทึกยังไม่ครบ"
      : changed
      ? "มีการแก้ไขที่ยังไม่บันทึก"
      : "ข้อมูลตรงกับที่บันทึกไว้";
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
  }
  function markDirty() {
    $("discard-confirmation").hidden = true;
    state.dirty = true;
    updateSaveState();
  }
  function showLogin() {
    state.csrf = "";
    state.row = null;
    state.dirty = false;
    state.photo = null;
    state.removePhoto = false;
    state.saveError = "";
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
      const error = new Error(detail);
      error.status = response.status;
      throw error;
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
    category.dataset.label = "หมวดอาหาร";
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
    issues.dataset.label = "ข้อมูลที่ยังไม่มี";
    const tags = element("div", "issue-tags");
    if (missing.length)
      missing.forEach((label) =>
        tags.append(element("span", "issue-chip", label))
      );
    else tags.append(element("span", "badge good", "ข้อมูลครบ"));
    issues.append(tags);
    const status = element("td");
    status.dataset.label = "การตรวจสอบ";
    status.append(
      element(
        "span",
        row.reviewed ? "badge good" : "badge pending",
        row.reviewed ? "✓ ตรวจแล้ว" : "รอตรวจสอบ"
      )
    );
    const action = element("td", "restaurant-action"),
      button = element("button", "row-edit", "จัดการ →");
    button.setAttribute("aria-label", "จัดการร้าน " + row.name);
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
      markDirty();
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
  form.addEventListener("input", () => {
    markDirty();
    updateMapLink();
  });
  form.addEventListener("change", () => {
    markDirty();
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
    markDirty();
  });
  function setPhotoPreview(url) {
    $("photo-preview").hidden = !url;
    $("photo-placeholder").hidden = Boolean(url);
    if (url) $("photo-preview").src = url;
    else $("photo-preview").removeAttribute("src");
  }
  async function openEditor(id) {
    const openingNew = $("editor").hidden || state.row?.id !== id;
    try {
      const data = await api("/restaurants/" + id),
        row = data.restaurant;
      if ($("editor").hidden) previousFocus = document.activeElement;
      state.row = row;
      state.dirty = false;
      state.photo = null;
      state.removePhoto = false;
      state.saveError = "";
      $("discard-confirmation").hidden = true;
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
      if (openingNew) $("editor").querySelector(".editor-body").scrollTop = 0;
      updateSaveState();
      openLocationMap();
      $("workspace").inert = true;
      document.body.classList.add("modal-open");
      $("close-editor").focus();
      return true;
    } catch (error) {
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
    if (locationMap) locationMap.remove();
    locationMap = locationMarker = null;
    $("workspace").inert = false;
    document.body.classList.remove("modal-open");
    state.row = null;
    state.dirty = false;
    state.photo = null;
    state.removePhoto = false;
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
    if (!value)
      $("hours-rows")
        .querySelectorAll("input")
        .forEach((input) => (input.disabled = $("hours-controls").hidden));
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
  async function saveAll() {
    if (!state.row || state.busy || !hasChanges()) return;
    $("discard-confirmation").hidden = true;
    if (!form.reportValidity()) return;
    if (state.photo && !$("photo-form").reportValidity()) return;
    if (state.photo && !state.storage)
      return notify("ยังไม่ได้เชื่อมที่เก็บรูป จึงยังบันทึกรูปไม่ได้", true);
    const body = restaurantBody();
    const photoData = state.photo ? new FormData($("photo-form")) : null;
    if (photoData) {
      photoData.set("file", state.photo);
      photoData.set("rights_confirmed", "true");
    }
    const id = state.row.id;
    let savedData = false;
    let stage = state.dirty ? "data" : "photo";
    state.saveError = "";
    state.saveProgress = state.dirty
      ? "กำลังบันทึกข้อมูลร้าน…"
      : "กำลังบันทึกรูป…";
    busy(true);
    try {
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
          state.row = await api("/restaurants/" + id + "/photo", {
            method: "POST",
            body: photoData,
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
    } catch (error) {
      if (state.row) {
        state.saveError =
          error.status === 409
            ? "ข้อมูลถูกแก้จากที่อื่น กรุณาคัดลอกสิ่งที่ยังไม่บันทึก แล้วปิดและเปิดร้านใหม่ก่อนลองอีกครั้ง"
            : stage === "photo"
            ? (savedData
                ? "ข้อมูลร้านบันทึกแล้ว แต่บันทึกรูปไม่สำเร็จ "
                : "ยังบันทึกรูปไม่สำเร็จ ") +
              (state.removePhoto
                ? "รูปเดิมยังอยู่ กดลองนำรูปออกอีกครั้งได้ — "
                : "รูปที่เลือกยังอยู่ กดลองบันทึกอีกครั้งได้ — ") +
              error.message
            : "ยังบันทึกข้อมูลร้านไม่สำเร็จ การแก้ไขยังอยู่ — " + error.message;
        notify("บันทึกยังไม่ครบ ตรวจรายละเอียดที่แถบด้านล่าง", true);
        if (savedData) await loadList();
      }
    } finally {
      busy(false);
    }
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveAll();
  });
  $("save-all").addEventListener("click", saveAll);
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
  function selectPhoto(file) {
    if (!file || state.busy || !state.storage) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    )
      return notify("เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB", true);
    state.photo = file;
    state.removePhoto = false;
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = URL.createObjectURL(file);
    setPhotoPreview(previewURL);
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
    setPhotoPreview(null);
    updateSaveState();
  });
  $("discard-photo").addEventListener("click", () => {
    if (!state.row || state.busy) return;
    state.photo = null;
    state.removePhoto = false;
    state.saveError = "";
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
  restoreSession().catch(() => showLogin());
})();
