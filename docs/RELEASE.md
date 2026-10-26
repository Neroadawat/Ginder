# Release

เริ่มที่ checklist ด้านล่าง: งานก่อนปล่อยแอป, วิธี build และข้อความ Play Store
ถูกรวมไว้ที่นี่ ส่วนวิธีดูแลเซิร์ฟเวอร์อยู่ใน [Operations](OPERATIONS.md)

หัวข้อ: [งานที่เหลือ](#release-checklist) · [Build Android](#android-release-build) · [Play Store](#play-store-materials) · [เอกสารกฎหมาย](#published-legal-pages)

## Release checklist

ฉบับหลักสำหรับติดตามงานก่อนปล่อยแอป ตรวจสถานะล่าสุด **25 ตุลาคม 2026**
เครื่องหมายเสร็จหมายถึงมีหลักฐาน ณ วันที่ตรวจ ไม่ใช่การรับรองว่าระบบจะพร้อมตลอดเวลา
ไม่ต้องสร้าง Hosting, SMTP หรือ Firebase ใหม่เพียงเพราะพบคู่มือเก่าที่ยังเขียนเป็นขั้นตอนเตรียมระบบ

### ทำแล้ว

- [x] React Native 0.87.1 และ compile/target SDK API 36
- [x] Package Android `com.tamsoot.ginder` และการตั้งค่า release signing
- [x] EC2, production database/Redis, HTTPS และ WebSocket ใช้ URL จริง
- [x] Deploy Backend/security ล่าสุดและแก้ Caddy health check; ทุกบริการ healthy หลัง deploy
- [x] สำรองฐานข้อมูลและ image เดิม พร้อม rollback สำหรับ deployment รอบล่าสุด
- [x] Public smoke test ผ่าน: health, readiness และหน้าเว็บบัญชี/เอกสาร
- [x] ทดสอบ API/WebSocket สองบัญชี: join, host-only start, kick, reconnect,
  สำรับตรงกัน, unanimous และหมดเวลาแบบ no-likes/tie พร้อมผลวงล้อตรงกัน
- [x] Backend 302 tests, Ruff และ mypy ผ่านหลังแก้ WebSocket server-close
- [x] Frontend 45 tests, TypeScript และ lint ผ่านในการตรวจวันที่ 23 ตุลาคม
- [x] ตั้งค่า SMTP และทดสอบ Forgot/reset password สำเร็จ
- [x] Frontend production URLs และ `npm run release:check` ผ่าน
- [x] ภาษาอังกฤษเริ่มต้น/ไทย, ภาพ placeholder ภายในแอป และเครดิต OSM

หลักฐาน: [บันทึก deployment](OPERATIONS.md#deployment-record-2026-10-23) และ
[security review ก่อน deployment](OPERATIONS.md#security-review-2026-10-22)

### 1. บัญชีและข้อมูลเจ้าของ — ต้องยืนยันเอง

- [ ] ยืนยันชื่อเจ้าของบริการ/ผู้ควบคุมข้อมูล ประเทศ/เขตอำนาจ และอีเมลที่มีคนดูแลจริง
- [ ] ยืนยันสิทธิ์เจ้าของบัญชี AWS, DNS และช่องทางชำระเงิน/กู้บัญชี
- [ ] ยืนยัน Play Console: สมัคร/ยืนยันตัวตนแล้วหรือยัง เป็น Personal หรือ Organization
  และวันที่สร้างบัญชีหากเป็น Personal
- [x] สำรอง upload keystore และ properties ที่มีรหัสผ่านเป็น ZIP เข้ารหัสในคอม และทดสอบถอดรหัสเทียบ hash แล้ว
- [ ] เก็บ recovery key แยกใน password manager/สื่อ offline เข้ารหัส; ปัจจุบัน key อยู่บนคอมนี้เท่านั้น

### 2. Production operations และ security

- [x] ตั้ง backup ฐานข้อมูลอัตโนมัติรายวันแบบ GPG เข้ารหัส และทดสอบเส้นทางล้มเหลว
- [x] เก็บสำเนาเข้ารหัสนอก EC2 บนคอมนี้หนึ่งชุด พร้อมตรวจ checksum
- [x] ถอดรหัสและทดลอง restore จริงในฐานข้อมูลแยก แล้วลบฐานข้อมูล/ไฟล์ plaintext ทดสอบ
- [x] ตั้ง host monitoring ทุก 5 นาทีสำหรับ HTTPS, containers, disk, memory, backup และ TLS
- [ ] เลือกและตั้งปลายทางสำรองนอก EC2 แบบอัตโนมัติถาวร; การดาวน์โหลดมาคอมตอนนี้เป็น manual
- [ ] ยืนยันผู้รับอีเมล แล้วเปิดและทดสอบส่ง alert/recovery จริง (ตอนนี้ยังเป็น journal logs)
- [ ] ตั้ง external uptime monitoring ที่ยังแจ้งเตือนได้เมื่อ EC2 ดับทั้งเครื่อง

รายละเอียดและวิธีกู้คืน: [Backup and monitoring](OPERATIONS.md#backup-and-monitoring-2026-10-23)
- [ ] ตรวจ AWS Security Group, SSH เฉพาะผู้ดูแล, IAM/IMDS, OS และ container-image CVEs
- [x] เพิ่ม rotating refresh sessions, ตรวจ reuse, logout รายการล็อกอิน และตรวจ revocation ใน HTTP/WebSocket
- [x] ทดสอบ migration 0006 upgrade/downgrade, concurrent refresh, replay, logout,
  reset password และ account-delete cascade กับ PostgreSQL ในฐานข้อมูลชั่วคราวแยกจาก production
- [x] Deploy และ smoke test ระบบ auth ใหม่บน EC2 วันที่ 25 ตุลาคม:
  signup/login/rotation/replay/isolation/logout ผ่าน HTTPS จริง และลบบัญชีทดสอบแล้ว
- [x] Audit npm ทั้งหมดและ `--omit=dev` ไม่พบ advisory หลัง pin `body-parser` 2.4.0
  ณ 25 ตุลาคม; `braces` ที่ติดตั้งคือ 3.0.3 ผล High 22 entries เดิมไม่ใช่ผลปัจจุบัน
- [x] `pip-audit .` ไม่พบ advisory ใน app dependency resolution รอบนี้
- [x] ตรวจ installed Python packages ของ image ใหม่หลังอัปเดต pip/setuptools/wheel:
  `pip-audit --no-deps --disable-pip` ไม่พบ known advisory; image เดิมมี advisory
  ใน packaging tools แม้ app requirements ผ่าน audit
- [ ] ทดสอบอีเมลส่งถึง inbox/spam หลายผู้ให้บริการ รวมถึงลิงก์หมดอายุและใช้ซ้ำ

คู่มือปฏิบัติ: [deployment/backup/rollback](OPERATIONS.md#deployment-runbook)

### 3. Firebase และ Google — ตัดสินใจขอบเขตรุ่นแรก

เปิด `FCM_ENABLED=true` ใน debug/release frontend และ backend/worker ผ่าน Firebase overlay
แล้วเมื่อ 24 ตุลาคม 2026; Google Places ยังปิดอยู่
ไม่ต้องเปิด Google หากรุ่นแรกใช้ข้อมูลในระบบและ OSM

- [x] เลือกเปิด Push สำหรับคำเชิญเข้าห้อง และเพิ่ม foreground alert / การแตะเปิดหน้าคำเชิญ
- [x] สร้าง Firebase Android app ด้วย package `com.tamsoot.ginder`,
  ใส่ `frontend/android/app/google-services.json` และ `secrets/firebase-credentials.json`
  โดยไม่ commit credentials แล้วใช้ Firebase Compose overlay
- [x] ตรวจ package/project ตรงกัน, runtime อ่าน secret ได้ และ Google OAuth / FCM HTTP v1 ผ่าน
- [x] Backend 303 tests และ Frontend 51 tests ผ่านหลังเพิ่ม recipient-scoped push และ lifecycle tests
- [ ] หากเปิด Push: ทดสอบ foreground/background/แอปปิด, permission, logout,
  สลับบัญชี และล้าง FCM token บนมือถือจริง
- [ ] หากเปิด Google: ตั้ง server-only key restrictions, quota/budget alerts
  และทดสอบ quota exhaustion/attribution; ห้ามใส่ key ใน frontend

### 4. ร้านและรูปภาพ

Production snapshot วันที่ตรวจ: 124 ร้าน, Other 15, ชื่อซ้ำ 4 กลุ่ม,
ที่อยู่ 8, เวลาเปิด–ปิดที่ใช้ได้ 13, ราคา/เรตติ้ง 0 และรูปที่มีข้อมูลแหล่งที่มา/เครดิตครบ 0
อย่านำจำนวนใน CSV seed มาแทนจำนวน production โดยไม่ตรวจใหม่

- [ ] ตรวจ Other, สาขาชื่อซ้ำ, ร้านปิดและพิกัดก่อนแก้หรือเอาร้านออก
- [ ] เติมที่อยู่/เวลา/ราคา/เรตติ้งที่ตรวจสอบได้ และตรวจตัวกรองเมื่อข้อมูลขาด
- [ ] ใช้ placeholder ต่อได้; รูปจริงที่เพิ่มต้องมีสิทธิ์ใช้และบันทึก source/attribution
- [ ] ตรวจข้อมูลร้านและ GPS บริเวณธรรมศาสตร์ด้วยมือถือจริง

### 5. เอกสารเผยแพร่และการลบบัญชี

หน้า `/privacy`, `/terms`, `/delete-account`, `/reset-password` เปิดผ่าน HTTPS แล้ว
ต้นฉบับหน้าใช้งานจริงคือ `backend/app/public/` ไม่ใช่ Markdown ฉบับร่างที่สำรองไว้นอกโปรเจกต์

- [ ] อนุมัติข้อความ Privacy/Terms ฉบับสุดท้าย พร้อมเจ้าของบริการ/อีเมล/ประเทศ
- [ ] ระบุระยะเก็บข้อมูลและ backup หลังลบบัญชีให้ตรงกับระบบจริง
- [ ] ตรวจการลบบัญชีจากหน้าเว็บและแอป รวมถึงผลที่สมาชิกห้องคนอื่นยังเห็นได้
- [ ] ตรวจลิงก์สาธารณะและช่องทางติดต่อจากแอป release

### 6. Release build และมือถือจริง

- [x] สร้าง signed APK/AAB ใหม่วันที่ 25 ตุลาคม รุ่น 1.0.0 / 10001
  แทนไฟล์เก่าจาก 13 ตุลาคม; JS bundle อยู่ในแอป ไม่ต้องใช้ Metro
- [x] ผู้ใช้ยืนยันว่ายังไม่เคยอัปโหลด Play Console; package `com.tamsoot.ginder`,
  versionCode 10001, upload certificate และ SHA-256 ตรวจแล้ว
- [x] ตรวจ URL/permissions และ private-key/file markers ใน artifact;
  เพิ่มกฎ R8 เก็บ BuildConfig ที่ react-native-config โหลดผ่าน reflection
  ป้องกันค่าจริงถูกลบแล้วแอปย้อนใช้ emulator URL / ปิด FCM
- [x] Native ELF 64-bit 44 ไฟล์ผ่าน 16 KB alignment; APK zipalign และ AAB
  `PAGE_ALIGNMENT_16K` ผ่าน (ไม่ใช่หลักฐาน runtime)
- [ ] ทดสอบรันจริงในโหมด 16 KB page size / Android 16
- [ ] ทดสอบ release โดยไม่เปิด Metro บนมือถือจริงอย่างน้อยสองเครื่อง
- [ ] ทดสอบสมัคร/login/refresh/reset/logout/ลบบัญชี และสลับสองบัญชีบนเครื่องเดียว
- [ ] ทดสอบ session timer, no-likes/tie, back gesture, background, เน็ตหลุดและ reconnect

ขั้นตอน build: [Android release guide](#android-release-build)

หลักฐานรุ่น 10001:

- APK SHA-256: `dc833c9c23796fe04fc2543ce0bcbd13fbac42947f1152b92c562f55e57d48bc`
- AAB SHA-256: `7e99b8a189b6cc342ce56ecd581fbf03fc960f84bd82116526cc0696a78501d9`
- Upload certificate SHA-256: `3b989dcdd046e6d33e3e88e609fe853d32015595de987eb0a798d824b1c5852c`
- Backend image ทดสอบผ่าน 309 tests; Frontend 54 tests, lint และ typecheck ผ่าน
- ไฟล์อยู่ใต้ `frontend/android/app/build/outputs/`; ยังไม่อัปโหลด Play Store
- ตรวจซ้ำด้วย `python frontend/scripts/check-artifact.py <APK-or-AAB>`;
  ใช้ `--source-map <release-source-map>` เพื่อตรวจว่า build tooling ไม่อยู่ใน JS

### 7. Play Console และเปิดใช้งาน

- [ ] เตรียม screenshot จาก release จริงอย่างน้อยสองภาพ
- [ ] อนุมัติ store copy, support email, ประเทศเปิดใช้, หมวดแอปและ release notes
- [ ] เตรียม reviewer accounts/instructions โดยไม่บันทึกรหัสผ่านลง Git
- [ ] กรอก Data safety, App access, Content rating, Target audience, Ads,
  Privacy URL, Account deletion URL และ permission declarations ที่ Console ขอ
- [ ] ยืนยัน Play App Signing แล้วเข้า Internal testing และตรวจ Pre-launch report
- [ ] ทำ Closed testing / ขอ Production access ตามเกณฑ์ที่บัญชีใน Console แสดง
- [ ] แก้ crash/ANR/feedback แล้วจึงเปิด staged rollout และเฝ้าดูระบบ

ข้อความหน้าร้านและแหล่งอ้างอิง: [Play Store materials](#play-store-materials)

## Android release build

Paths and build commands in this guide are relative to `frontend/` unless stated
otherwise. Release progress belongs in the [release checklist](#release-checklist).

### Current release identity

- Package ID: `com.tamsoot.ginder`
- Version name: `1.0.0`
- Version code: `10001` (ผู้ใช้ยืนยัน 25 ตุลาคมว่ายังไม่เคยอัปโหลด Play Console)
- Compile/target SDK: Android API 36
- Minimum SDK: Android API 24
- React Native: `0.87.1`
- Node.js: `22.13.1` or a compatible newer version from `package.json`

The package ID cannot be changed after the first Google Play upload. Register this
exact package in Firebase before enabling production push notifications.

### Secrets that must be backed up

The following local files are intentionally ignored by Git:

- `android/app/ginder-upload-key.jks`
- `android/keystore.properties`
- `.env.production`

Back up the keystore and its passwords in a password manager and a second secure
location. Losing the upload key can block future updates until Google approves a
key reset. Never commit these files.

### Production configuration

Before publishing, verify `.env.production` contains the intended real
HTTPS API and WebSocket URLs. If Firebase Cloud Messaging is enabled, download a
new `google-services.json` for `com.tamsoot.ginder` and complete the Firebase
Android setup for this package.

### Build on Windows

React Native's native build can exceed Windows' legacy 260-character path limit.
This repository's Babel configuration supports building through a short junction:

```powershell
New-Item -ItemType Junction -Path C:\g -Target <absolute-repository-path>
Set-Location C:\g\frontend\android
.\gradlew.bat bundleRelease assembleRelease
```

Release artifacts are written to:

- `android/app/build/outputs/bundle/release/app-release.aab`
- `android/app/build/outputs/apk/release/app-release.apk`

### Versioning

Increase `versionCode` for every Play Console upload. Use an increasing integer;
the initial convention starts `1.0.0` at `10000`; this candidate uses `10001`. Update `versionName` when the
user-facing version changes.

### Install on a real phone

Enable Developer options and USB debugging, connect the phone, accept its RSA
prompt, then run:

```powershell
adb devices -l
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.tamsoot.ginder/.MainActivity
```

Test location permission, nearby restaurants, photos, authentication, session
creation/joining, push notifications, background/foreground transitions, and a
cold start. Repeat on an Android 16 device or API 36 emulator before publishing.

## Play Store materials

Store copy, artwork locations and reviewer guidance. Release progress is tracked
only in the [release checklist](#release-checklist), not in this document.
All repository paths below are relative to the repository root.

### Store listing — Thai

Name: Ginder

Short description: หาร้านอาหารใกล้ตัว ปัดเลือกร้านที่ถูกใจ และโหวตมื้อถัดไปกับเพื่อน

Full description:

วันนี้กินอะไรดี? Ginder ช่วยค้นหาร้านอาหารใกล้คุณและเลือกร้านร่วมกับเพื่อน

- ปัดดูร้านใกล้ตัวและบันทึกร้านที่ถูกใจ
- เลือกประเภทอาหารและปรับรัศมีค้นหา
- สร้างห้อง ชวนเพื่อนด้วยรหัสคำเชิญ และโหวตร้านด้วยกัน
- ดูผลร้านที่เลือกและประวัติห้องที่ผ่านมา
- เปิดตำแหน่งร้านใน Google Maps

พื้นที่ข้อมูลเริ่มต้นอยู่รอบธรรมศาสตร์ ศูนย์รังสิต การค้นหาพื้นที่อื่นขึ้นอยู่กับข้อมูลที่มี
Ginder ใช้ตำแหน่งขณะใช้งานเพื่อค้นหาร้านและแสดงระยะเส้นตรง ร้านบางแห่งยังไม่มีรูป
เวลาเปิด ราคา หรือคะแนน กรุณาตรวจสอบกับร้านก่อนเดินทาง

ข้อมูลร้าน © OpenStreetMap contributors

### Store listing — English

Name: Ginder

Short description: Find nearby restaurants, save favourites and choose where to eat with friends.

Full description:

Deciding where to eat? Ginder helps you discover nearby restaurants and choose together.

- Swipe through nearby restaurants and save favourites.
- Browse food categories and adjust your search radius.
- Create a room, invite friends with a code and vote together.
- View group results and previous restaurant matches.
- Open restaurant locations in Google Maps.

Initial restaurant coverage is around Thammasat University's Rangsit campus.
Coverage elsewhere depends on available data. Location is used while the app is
in use, and displayed distances are straight-line distances. Photos, hours,
prices and ratings may be unavailable. Confirm details with the restaurant before visiting.

Restaurant data © OpenStreetMap contributors.

### Release notes

TH: รุ่นแรกของ Ginder: ค้นหาร้านใกล้ตัว บันทึกร้านที่ถูกใจ และโหวตร้านกับเพื่อนในห้องเดียวกัน

EN: First Ginder release: discover nearby restaurants, save favourites and vote with friends.

### Assets

- Icon: `frontend/android/play-store-assets/icon-512.png` (512 × 512).
- Feature graphic: `frontend/android/play-store-assets/feature-graphic-1024x500.png`.
- Capture at least two real screenshots from the final release. Suggested screens:
  nearby restaurant card, categories, and a group lobby. Do not substitute mock screenshots.
- Artwork source/generator: `frontend/scripts/build-artwork.cjs` (requires Sharp).
- Original category placeholder images are owned by this project; old unverified
  demo photos are not referenced by the app bundle.

### Reviewer instructions

Before submission create a dedicated reviewer account on the production service
and supply its working email/password in Play Console's App access section. Do
not commit the password. The production server must remain available during review.

Suggested access instructions:

1. Accept the Terms and Privacy Policy, then sign in using the provided account.
2. Allow foreground location. No background location permission is requested.
3. The initial launch area is Thammasat Rangsit, Thailand. If reviewing elsewhere,
   nearby coverage may be limited. Reviewers can still use Profile and account tools.
4. Home shows nearby restaurants; swipe right to save a local restaurant.
5. Discover → + → Create room or Join with code provides the group flow; give the reviewer
   a second account if needed to inspect voting on two devices.
6. Profile → Settings → Delete account removes the test account. A replacement
   account must be available if the review team repeats this test.

### App content preparation

Restaurant audit: run `python backend/scripts/audit_restaurants.py`.
The checked-in seed CSV and live database are different snapshots. See the
[release checklist](#release-checklist) for the dated production audit; do not treat
these store materials as a live restaurant inventory.
Repeated names have distinct coordinates and IDs; they were retained rather
than deleting possible branches. Confirm categories, branch identity and
missing facts with the shop/OSM before editing. Do not infer opening hours or
photo rights from a name. The app uses original placeholders in the meantime.

Build warning audit: project-owned Gradle property declarations now use explicit
assignment, and the activity no longer uses the deprecated delegate constructor.
Remaining AGP legacy DSL and third-party library warnings require upstream
compatibility updates; keep the tested toolchain pinned rather than removing
compatibility flags or editing installed dependencies. They do not currently
prevent the release build. Recheck before upgrading to Gradle/AGP 10.

Use the real deployment origin for `/privacy`, `/terms` and `/delete-account`.
The deletion page authenticates the user and deletes the same account/data as the app.

Review Data safety against the release's actual SDKs and providers. Candidate
types are email/name, precise location, app interactions/votes/history, and
device identifiers for FCM if enabled. Sending data off-device counts even if
processed temporarily. Do not declare that this app collects no data.

Choose the actual target age group, complete content rating, declare the presence
of ads accurately, and provide owner support contact details. Review and approve
the final policy and backup retention before publishing.

For new personal developer accounts created after 13 November 2023, closed
testing needs 12 opted-in testers continuously for 14 days before applying for
production access. Internal testing alone does not satisfy this requirement.

Official references:

- https://support.google.com/googleplay/android-developer/answer/14151465
- https://support.google.com/googleplay/android-developer/answer/13327111
- https://support.google.com/googleplay/android-developer/answer/10787469
- https://support.google.com/googleplay/android-developer/answer/9866151

### Release sequence

Follow the [release checklist](#release-checklist). Build instructions live in the
[Android release guide](#android-release-build); server procedures live
in the [deployment runbook](OPERATIONS.md#deployment-runbook).

## Published legal pages

หน้าเว็บใช้งานจริงมาจาก [Privacy HTML](../backend/app/public/privacy.html),
[Terms HTML](../backend/app/public/terms.html),
[Account deletion HTML](../backend/app/public/delete-account.html)
และ [public routes](../backend/app/api/routes/public.py)
ใช้ URL HTTPS ของหน้าเหล่านี้ในแอป/Play Console ไม่ใช่ลิงก์ Markdown ใน GitHub

ฉบับร่างภาษาอังกฤษเดิมถูกเก็บไว้นอกโปรเจกต์ใน archive ของการรวมเอกสารวันที่
23 ตุลาคม 2026 โดยไม่แก้หรือลบ HTML ที่กำลังเผยแพร่
เจ้าของบริการยังต้องอนุมัติข้อมูลติดต่อ ประเทศ และระยะเก็บข้อมูล/backup ตาม checklist
