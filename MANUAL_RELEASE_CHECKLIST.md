# Ginder manual release checklist

รายการนี้คือสิ่งที่ต้องใช้บัญชี ข้อมูลจริง หรือการตัดสินใจจากเจ้าของแอป จึงไม่ควรใส่ค่าจำลองหรือให้ระบบสร้างแทน

## 1. บัญชีและชื่อสาธารณะ

- [ ] ตัดสินใจชื่อเจ้าของบริการ/ผู้ควบคุมข้อมูลที่จะใช้ใน Privacy Policy และ Play Console
- [ ] เตรียมอีเมล support ที่ตรวจสอบเป็นประจำ
- [ ] จดโดเมน หรือเลือก subdomain ฟรีที่ควบคุมได้ และตั้ง DNS ไปยังเซิร์ฟเวอร์ production
- [ ] สมัคร hosting/VPS และเก็บสิทธิ์เข้าถึงกับข้อมูลชำระเงินไว้ในบัญชีของเจ้าของแอป
- [ ] สมัคร Google Play Console ชำระค่าลงทะเบียน และทำขั้นตอนยืนยันตัวตน/อุปกรณ์ตามที่บัญชีร้องขอ

## 2. Production server

- [ ] สร้าง `.env.production` จาก `.env.production.example` และใส่รหัสผ่าน/secret ใหม่ที่สุ่มสำหรับ production เท่านั้น
- [ ] ตั้ง `DOMAIN` และ `PUBLIC_BASE_URL` ใน `.env.production` เป็น HTTPS URL จริง
- [ ] ตั้ง firewall ให้เปิดเฉพาะพอร์ตที่ต้องใช้ และไม่เปิด PostgreSQL/Redis ออกสู่อินเทอร์เน็ต
- [ ] deploy ด้วย `docker-compose.prod.yml` แล้วตรวจ health, migration, seed และ smoke test
- [ ] ตั้ง backup อัตโนมัติด้วย `ops/backup-postgres.sh` และคัดลอก backup ไปอีกเครื่องหรือ object storage
- [ ] ทดลอง restore ด้วย `ops/restore-postgres.sh` ก่อนเปิดใช้จริง
- [ ] ตั้ง monitoring/แจ้งเตือน uptime, disk, memory และวันหมดอายุ TLS

## 3. อีเมล Forgot Password

- [ ] เลือกผู้ให้บริการ SMTP และยืนยันโดเมนหรืออีเมลผู้ส่ง
- [ ] ใส่ `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` และ `SUPPORT_EMAIL` ใน production secret
- [ ] ทดสอบส่งจริงไปยัง Gmail/Outlook และตรวจทั้ง inbox/spam
- [ ] ทดสอบลิงก์ reset จากมือถือจริง รวมถึงลิงก์หมดอายุและการจำกัดจำนวนคำขอ

## 4. Firebase Push Notification

- [ ] สร้าง Firebase project และเพิ่ม Android app ด้วย package `com.neroadawat.ginder`
- [ ] วาง `google-services.json` ที่ `frontend/android/app/google-services.json` (ห้าม commit)
- [ ] สร้าง service-account credential และวางที่ `secrets/firebase-credentials.json` บน server (ห้าม commit)
- [ ] เปิด production ด้วย `docker-compose.firebase.yml` และทดสอบ foreground/background/แอปปิดบนเครื่องจริง

## 5. ข้อมูลร้านและรูปภาพ

- [ ] ตรวจร้านหมวด `Other` 14 รายการแล้วกำหนดหมวดที่ถูกต้อง
- [ ] ตรวจชื่อซ้ำ 4 กลุ่มว่าเป็นคนละสาขาหรือข้อมูลซ้ำ
- [ ] เติมที่อยู่ร้านที่ยังขาด (ปัจจุบันมีข้อมูลเพียง 4 ร้าน)
- [ ] เติมเวลาเปิด–ปิดที่ยังขาด (ปัจจุบันมีข้อมูลเพียง 13 ร้าน)
- [ ] เตรียมรูปที่ถ่ายเองหรือมีสิทธิ์ใช้งาน และบันทึก URL, แหล่งที่มา และข้อความ attribution ในข้อมูล seed
- [ ] ตรวจพิกัด หมวด ราคา ที่อยู่ เวลา และรูปของทุกร้านก่อน seed production

ห้ามนำรูปจาก Google Maps, Facebook, Wongnai หรือเว็บไซต์อื่นมาใช้เพียงเพราะดาวน์โหลดได้ หากไม่ได้รับอนุญาตอย่างชัดเจน

## 6. เอกสารและหน้าเว็บสาธารณะ

- [ ] ตรวจชื่อผู้ให้บริการ อีเมลติดต่อ ระยะเวลาเก็บข้อมูล และประเทศ/เขตอำนาจใน `PRIVACY.md` และ `TERMS.md`
- [ ] เผยแพร่ Privacy Policy, Terms และ Account Deletion เป็น HTTPS URL ที่เปิดได้โดยไม่ต้องล็อกอิน
- [ ] ทดลองขั้นตอนขอลบบัญชีบนหน้าเว็บ และตรวจว่าทีม support ได้รับคำขอจริง
- [ ] กำหนดระยะเวลาเก็บ backup หลังลบบัญชีให้ตรงกับนโยบายที่เผยแพร่

## 7. แอปและ Play Store

- [ ] อัปเกรด Node.js บนเครื่อง build เป็น 22.13 หรือใหม่กว่าตามที่โปรเจกต์กำหนด
- [ ] ใส่ `API_BASE_URL`, `WS_BASE_URL`, `PRIVACY_POLICY_URL` และ `TERMS_OF_SERVICE_URL` ใน `frontend/.env.production` แล้วรัน `npm run release:check`
- [ ] เพิ่ม version name/version code สำหรับ release จริง แล้วสร้าง signed AAB ด้วย upload keystore ของเจ้าของแอป
- [ ] เตรียมชื่อแอป คำอธิบายสั้น/ยาว ไทยและอังกฤษ ไอคอน feature graphic 1024×500 และ screenshot จริงอย่างน้อย 2 ภาพ
- [ ] เตรียม release notes, reviewer instructions และบัญชีทดสอบที่ไม่ใช้ข้อมูลส่วนตัวจริง
- [ ] กรอก App content, Data safety, Content rating, Ads, Target audience และ Account deletion ใน Play Console ให้ตรงกับพฤติกรรมจริง
- [ ] ถ้าบัญชีเป็นบัญชีนักพัฒนาส่วนบุคคลใหม่ ให้ทำ closed test ตามจำนวนผู้ทดสอบและระยะเวลาที่ Play Console แสดง
- [ ] อัปโหลด AAB ไป Internal testing ก่อน ตรวจ Pre-launch report และแก้ crash/ANR แล้วจึงเลื่อนไป Production

## 8. การตรวจหลัง deploy

- [ ] สมัคร ล็อกอิน refresh token ลืมรหัสผ่าน และลบบัญชีบน production
- [ ] สร้าง/เข้าร่วมห้อง swipe จับคู่ เตะสมาชิก WebSocket และ reconnect ด้วยผู้ใช้สองเครื่อง
- [ ] ตรวจ notification และล้าง FCM token หลัง logout
- [ ] ตรวจ Privacy/Terms/Account deletion/OpenStreetMap attribution จากแอปและ browser
- [ ] ตรวจ backup ล่าสุด log error และ resource usage หลังเปิดใช้จริง
