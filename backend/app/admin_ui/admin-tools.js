/* Pure helpers shared by the Admin screen and Node's built-in test runner. */
((root) => {
  "use strict";
  function cropRectangle(width, height, aspect, zoom = 1, x = 50, y = 50) {
    if (
      ![width, height, aspect, zoom, x, y].every(Number.isFinite) ||
      width <= 0 ||
      height <= 0 ||
      aspect <= 0 ||
      zoom < 1 ||
      zoom > 3 ||
      x < 0 ||
      x > 100 ||
      y < 0 ||
      y > 100
    )
      throw new Error("Invalid crop dimensions");
    const cropWidth = Math.min(width, height * aspect) / zoom;
    const cropHeight = cropWidth / aspect;
    return {
      x: ((width - cropWidth) * x) / 100,
      y: ((height - cropHeight) * y) / 100,
      width: cropWidth,
      height: cropHeight,
    };
  }
  function weeklyPeriods(days, open, close, nextDay = false) {
    const validTime = /^(?:[01]\d|2[0-3])[0-5]\d$/;
    if (
      !days.length ||
      days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
      !validTime.test(open) ||
      !validTime.test(close) ||
      (!nextDay && close <= open)
    )
      throw new Error(
        "เลือกวันและเวลาให้ถูกต้อง ถ้าปิดหลังเที่ยงคืนให้เลือกปิดวันถัดไป"
      );
    // A daily period must end within 24 hours to avoid overlapping adjacent days.
    if (nextDay && close > open)
      throw new Error("ช่วงเวลาเกิน 24 ชั่วโมง กรุณาตรวจเวลาเปิด–ปิด");
    return [...new Set(days)]
      .sort((a, b) => a - b)
      .map((day) => ({
        open: { day, time: open },
        close: { day: nextDay ? (day + 1) % 7 : day, time: close },
      }));
  }
  function missingFields(row) {
    const missing = [];
    if (!row.name?.trim()) missing.push("ชื่อร้าน");
    if (!row.primary_category || row.primary_category === "Other")
      missing.push("หมวดอาหาร");
    if (
      !Number.isFinite(row.latitude) ||
      !Number.isFinite(row.longitude) ||
      Math.abs(row.latitude) > 90 ||
      Math.abs(row.longitude) > 180
    )
      missing.push("พิกัด");
    if (!row.photo_url) missing.push("รูปภาพ");
    if (!row.address?.trim()) missing.push("ที่อยู่");
    if (!row.opening_hours?.periods?.length) missing.push("เวลาเปิด–ปิด");
    if (row.price_level == null) missing.push("ราคา");
    return missing;
  }
  function requestError(status, path = "") {
    if (status === 401)
      return path === "/login"
        ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีนี้ยังไม่มีสิทธิ์ผู้ดูแล"
        : "หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง";
    if (status === 403)
      return "ไม่สามารถยืนยันสิทธิ์ได้ กรุณาเข้าสู่ระบบอีกครั้งจากที่อยู่เว็บไซต์ที่ถูกต้อง";
    if (status === 404)
      return "ไม่พบข้อมูลที่ต้องการ หรือระบบผู้ดูแลยังไม่เปิดใช้งาน";
    if (status === 409)
      return "ข้อมูลร้านถูกแก้ไขจากที่อื่น กรุณาตรวจข้อมูลล่าสุดก่อนบันทึก";
    if (status === 413)
      return "ไฟล์หรือข้อมูลมีขนาดใหญ่เกินไป กรุณาเลือกรูปไม่เกิน 5 MB";
    if (status === 422)
      return path.endsWith("/photo")
        ? "รูปหรือข้อมูลภาพไม่ถูกต้อง ตรวจไฟล์ เครดิต และการยืนยันสิทธิ์ใช้งาน"
        : "กรุณาตรวจข้อมูลที่กรอกให้ถูกต้อง";
    if (status === 429)
      return "ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองอีกครั้ง";
    if (status >= 500)
      return "ระบบยังทำรายการไม่ได้ กรุณารอสักครู่แล้วลองอีกครั้ง";
    return "เชื่อมต่อระบบไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง";
  }
  const helpers = Object.freeze({
    cropRectangle,
    weeklyPeriods,
    missingFields,
    requestError,
  });
  if (typeof module !== "undefined" && module.exports) module.exports = helpers;
  else root.GinderAdminTools = helpers;
})(typeof window !== "undefined" ? window : globalThis);
