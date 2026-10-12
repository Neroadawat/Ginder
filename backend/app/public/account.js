(() => {
  'use strict';
  const status = document.getElementById('status');
  const reset = document.getElementById('reset-form');
  const deletion = document.getElementById('delete-form');
  const token = new URLSearchParams(location.hash.slice(1)).get('token');
  if (reset) history.replaceState(null, '', location.pathname);
  async function request(path, body, accessToken) {
    const response = await fetch('/api/v1' + path, {
      method: accessToken ? 'DELETE' : 'POST',
      credentials: 'omit',
      headers: {'Content-Type': 'application/json', ...(accessToken ? {Authorization: 'Bearer ' + accessToken} : {})},
      body: accessToken ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error('request failed');
    return response.json();
  }
  const form = reset || deletion;
  if (reset && !token) {
    status.textContent = 'ลิงก์ไม่ถูกต้อง กรุณาขอลิงก์ตั้งรหัสผ่านใหม่จากแอป';
    reset.hidden = true;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const button = form.querySelector('button');
    if (reset && data.get('password') !== data.get('confirm')) {
      status.textContent = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน';
      return;
    }
    button.disabled = true;
    status.textContent = 'กำลังดำเนินการ…';
    try {
      if (reset) {
        await request('/auth/reset-password', {token, new_password: data.get('password')});
        status.textContent = 'ตั้งรหัสผ่านสำเร็จ กลับไปเข้าใช้งานในแอป Ginder ได้เลย';
      } else {
        const auth = await request('/auth/login', {email: data.get('email').trim(), password: data.get('password')});
        await request('/users/me', undefined, auth.access_token);
        status.textContent = 'ลบบัญชีและข้อมูลเรียบร้อยแล้ว';
      }
      form.reset();
      form.hidden = true;
    } catch (_) {
      status.textContent = reset
        ? 'ตั้งรหัสผ่านไม่สำเร็จ ลิงก์อาจหมดอายุหรือถูกใช้แล้ว กรุณาขอลิงก์ใหม่ หรือลองอีกครั้งหากเครือข่ายมีปัญหา'
        : 'ลบไม่สำเร็จ กรุณาตรวจอีเมลและรหัสผ่าน หรือติดต่อผู้ดูแลหากยังใช้งานไม่ได้';
      button.disabled = false;
    }
  });
})();
