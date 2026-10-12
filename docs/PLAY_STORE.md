# Ginder — Play Store release pack

Status: source and artwork prepared; publication needs a working production server,
owner contact details, review account and screenshots from the final app.

## Store listing — Thai

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

## Store listing — English

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

## Release notes

TH: รุ่นแรกของ Ginder: ค้นหาร้านใกล้ตัว บันทึกร้านที่ถูกใจ และโหวตร้านกับเพื่อนในห้องเดียวกัน

EN: First Ginder release: discover nearby restaurants, save favourites and vote with friends.

## Assets

- Icon: `frontend/android/play-store-assets/icon-512.png` (512 × 512).
- Feature graphic: `frontend/android/play-store-assets/feature-graphic-1024x500.png`.
- Capture at least two real screenshots from the final release. Suggested screens:
  nearby restaurant card, categories, and a group lobby. Do not substitute mock screenshots.
- Artwork source/generator: `frontend/scripts/build-artwork.cjs` (requires Sharp).
- Original category placeholder images are owned by this project; old unverified
  demo photos are not referenced by the app bundle.

## Reviewer instructions

Before submission create a dedicated reviewer account on the production service
and supply its working email/password in Play Console's App access section. Do
not commit the password. The production server must remain available during review.

Suggested access instructions:

1. Accept the Terms and Privacy Policy, then sign in using the provided account.
2. Allow foreground location. No background location permission is requested.
3. The initial launch area is Thammasat Rangsit, Thailand. If reviewing elsewhere,
   nearby coverage may be limited. Reviewers can still use Profile and account tools.
4. Home shows nearby restaurants; swipe right to save a local restaurant.
5. Profile → Create room or Join with code provides the group flow; give the reviewer
   a second account if needed to inspect voting on two devices.
6. Profile → Settings → Delete account removes the test account. A replacement
   account must be available if the review team repeats this test.

## App content preparation

Restaurant audit: run `python backend/scripts/audit_restaurants.py`.
The current 113-row dataset has 14 uncategorised entries, four repeated-name
groups, four addresses, 13 opening schedules and no licensed photo URLs.
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

## Release sequence

1. Deploy the server following `DEPLOYMENT.md`, migrate and import the restaurant CSV.
2. Configure SMTP and optional Firebase. Keep Google Places disabled until billing is ready.
3. Set production URLs and run `npm run release:check` inside frontend.
4. Run Android `bundleRelease` from `C:\g\frontend\android` on Windows.
5. Upload the AAB to Internal testing, inspect the pre-launch report and validate
   Android 16 / 16 KB native page-size support in Play Console.
6. Capture final screenshots, fill App content and provide reviewer credentials.
7. Complete closed testing if required, request production access and submit for review.
8. Release gradually and monitor API health, crashes and feedback.
