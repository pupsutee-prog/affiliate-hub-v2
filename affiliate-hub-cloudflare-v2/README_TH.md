# Affiliate Hub V2.0 — Cloudflare Pages + D1 + Cloudinary

โปรเจกต์ย้ายระบบจากไฟล์ `affiliate-hub-netlify.zip` ของเจ้าของเว็บไซต์ โดยใช้ **index.html และ CSS เดิม** เป็นฐาน แต่เปลี่ยน `app.js / store.js` เป็น `app-v2.js` และเปลี่ยน Netlify Functions/Blobs เป็น API บน Cloudflare Pages Functions + D1

> สถานะ: **ชุดโค้ดเริ่มต้นสำหรับติดตั้งและทดสอบ (starter)** ไม่ใช่เว็บที่ deploy ขึ้นบัญชี Cloudflare ของคุณแล้ว และไม่ได้ทดสอบกับ GitHub OAuth, D1 หรือ Cloudinary จริงจนกว่าจะใส่ค่าและทดสอบในบัญชีของคุณ

## สิ่งที่ทำในโค้ดนี้

- หน้าหลัก/การ์ด/หน้า About/หน้ารายละเอียด/ฟอร์ม Admin ใช้ markup และ CSS เดิม
- API สาธารณะ: ดึงสินค้าเฉพาะ `published` ตามเว็บไซต์ ค้นหา กรองหมวดหมู่/ตลาด และแบ่งหน้า 24 รายการ (สูงสุด 48)
- ระบบ Admin: เพิ่ม แก้ไข และ soft-delete สินค้าทีละรายการ (ไม่ส่งข้อมูลทั้งชุด); เพิ่มหลายลิงก์; bulk เปลี่ยนหมวดหมู่/ลบในหน้าปัจจุบัน
- Multi-Site: เพิ่มเว็บไซต์ใหม่จาก Admin เลือกไซต์ด้วย `?site=slug`; ตั้งชื่อ, tagline, สีหลัก, และแมปโดเมนที่ตั้งค่า Pages แล้ว
- อัปโหลดภาพจาก Admin โดย Cloudinary signed direct upload; เก็บ URL ขนาด และ public_id ใน D1; ดู/ลบภาพที่ไม่ถูกสินค้าอ้างถึง
- Admin login ค่าเริ่มต้น: GitHub OAuth + เซสชัน HttpOnly Secure cookie ลงลายเซ็น HMAC-SHA256 และ allowlist GitHub numeric ID; ไม่มีรหัส Admin เริ่มต้นใน JavaScript (สามารถเลือกใช้ Cloudflare Access สำหรับ custom domain ที่ตั้งค่ากฎได้จริง)
- ส่งออกข้อมูล JSON/CSV ทีละหน้า (รวมกลับฝั่งเบราว์เซอร์) และนำเข้าทั้งสองรูปแบบ; เปลี่ยนทั้งหมด (replace) จำกัด 50 แถวต่อครั้งโดยมีคำเตือนและ soft-delete สินค้าเก่า
- โควตา: จำนวนนับสินค้า/ภาพ, ขนาดภาพที่ระบบติดตาม, ประมาณการ D1 เมื่อ PRAGMA รองรับ และแสดงคำเตือนที่ D1 >=70% หรือภาพที่ระบบติดตาม >200 MB
- รายการเปลี่ยนแปลงใน `audit_logs` (ไม่ใช่ snapshot รายการย้อนหลัง); ลบสินค้าแบบ soft-delete เพื่อให้กู้คืนได้ด้วย SQL หากจำเป็น

## โครงสร้างไฟล์

```text
affiliate-hub-cloudflare-v2/
├── public/
│   ├── index.html                    # องค์ประกอบหน้าเว็บเดิม + Admin V2
│   ├── assets/styles.css             # สไตล์เดิม + สไตล์ส่วนเสริม
│   ├── assets/app-v2.js              # หน้าเว็บและ Admin เรียก API
│   ├── _headers                      # Security headers
│   └── _redirects
├── functions/
│   ├── _lib/auth.js                  # ตรวจสอบเซสชัน GitHub หรือ Cloudflare Access
│   ├── _lib/github-auth.js           # GitHub session signing/verification
│   ├── _lib/db.js                    # Site resolution & validation
│   ├── _lib/http.js                  # JSON / error handling
│   ├── api/catalog.js               # GET /api/catalog (public)
│   ├── api/auth/[[path]].js          # GitHub OAuth login/callback/logout
│   └── api/admin/[[path]].js         # API CRUD Sites/Products/Media/Import/Export/Quota
├── schema/001_init.sql              # D1 schema + site main
├── legacy-data/links.json          # JSON ที่อยู่ใน ZIP เดิม (ไม่เผยแพร่สาธารณะ)
├── wrangler.toml                    # แก้ database_id ก่อนใช้งาน
├── package.json
└── README_TH.md
```

## เริ่มติดตั้งครั้งแรก (ต้องมีบัญชีฟรี)

### ขั้นที่ 1. Cloudflare + D1

1. สมัครบัญชี Cloudflare Free และใช้ GitHub เก็บไฟล์ชุดนี้ (อย่านำรหัสผ่านหรือ Secrets ใส่ GitHub)
2. เปิด Terminal ในโฟลเดอร์โปรเจกต์ ใช้ Node.js 20+ แล้ว `npm install`
3. `npx wrangler login`
4. สร้าง D1: `npx wrangler d1 create affiliate-hub-db`
5. นำ `database_id` จากคำตอบไปแทน `REPLACE_WITH_D1_DATABASE_ID` ใน `wrangler.toml`
6. รัน schema ขึ้น D1 บน Cloudflare:
   `npm run db:remote`
7. สร้าง Cloudflare Pages Project จาก GitHub repository นั้น **Build command ว่าง** และ **Output directory: `public`** (หรือ deploy ด้วย Wrangler ตาม docs)
8. ตรวจสอบ Pages Project -> Settings -> Bindings ว่ามี D1 binding ชื่อ **DB** ที่ชี้ฐานข้อมูลของคุณ และ deploy ใหม่หลังเปลี่ยน Bindings

สำหรับทดสอบ D1 ในเครื่องสามารถใช้ `npm run db:local` และ `npm run dev` ได้ แต่การล็อกอินแบบ OAuth อาศัย `https://...pages.dev` ที่กำหนด callback ถูกต้อง: API Admin จะปฏิเสธการใช้งานหากไม่มีเซสชันที่มีลายเซ็นถูกต้อง (ตั้งใจให้ fail-closed)

### ขั้นที่ 2. ตั้งค่า Admin Login แบบฟรีด้วย GitHub OAuth (ค่าเริ่มต้น)

**เหตุผล:** เว็บสาธารณะ `pages.dev` ต้องเข้าชมได้โดยไม่ต้อง Login ในขณะที่หน้า Admin เป็นส่วนตัว การใช้ Cloudflare Access บน `pages.dev` อาจไม่รองรับการป้องกันเฉพาะ path ตามต้องการ จึงเลือก GitHub OAuth แทน ไม่ต้องจดโดเมนส่วนตัวและไม่ต้องใช้บัญชี Cloudflare แบบเสียเงิน

1. สมัคร/ใช้บัญชี GitHub ที่จะเป็น Admin (ใช้ฟรี) และเข้า [GitHub Developer Settings → OAuth Apps](https://github.com/settings/developers) → **New OAuth App**
2. Homepage URL: `https://YOURPROJECT.pages.dev/`
3. Authorization callback URL: `https://YOURPROJECT.pages.dev/api/auth/callback` (**ต้องตรงกับโดเมนที่เข้า Admin**)
4. บันทึก **Client ID** และสร้าง **Client Secret**; หา **numeric GitHub user ID** ของบัญชีที่อนุญาต (ไม่ใช่ชื่อ username ที่แก้ได้) ผ่าน GitHub API `/users/YOUR_USERNAME` และดูฟิลด์ `id`
5. ไปที่ Cloudflare Pages → Settings → Variables and Secrets ตั้งค่าให้ครบ ใน Environment ที่ใช้:
   - `AUTH_PROVIDER=github` (Variable)
   - `GITHUB_CLIENT_ID` (Variable หรือ Secret)
   - `GITHUB_CLIENT_SECRET` (**Secret**)
   - `SESSION_SECRET` (**Secret**; ข้อความสุ่มยาวอย่างน้อย 32 ตัว เช่นสร้างด้วย `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` )
   - `ADMIN_GITHUB_IDS=12345678` (Variable; หลายบัญชีคั่น comma)
6. Deploy เว็บใหม่ จากนั้นเข้า `https://YOURPROJECT.pages.dev/#/admin` กด **เข้าสู่ระบบด้วย GitHub** และอนุญาตการเข้าสู่ระบบ
7. ทดสอบในหน้าต่าง Incognito: หน้า Home ต้องเปิดได้โดยไม่ล็อกอิน แต่ `/api/admin/me` ต้องคืน HTTP 401 เมื่อไม่มีเซสชัน และทุกคำสั่งเปลี่ยนข้อมูลต้องถูกปฏิเสธ
8. **สำคัญ:** ถ้าใช้ชื่อโดเมนอื่นสำหรับ Login ต้องสร้าง OAuth App หรือปรับ callback ให้ตรง อย่าคัดลอก Client Secret ลงในโค้ดหน้าเว็บ

การเข้าสู่ระบบใช้ GitHub OAuth token ชั่วคราวเพื่อระบุตัวตน จากนั้นออกเซสชัน cookie อายุ 12 ชั่วโมงที่ลงลายเซ็นฝั่งเซิร์ฟเวอร์; **ไม่เก็บ GitHub access token ในหน้าเว็บหรือ D1** และ Admin ทุก Endpoint ตรวจเซสชันกับ allowlist อีกครั้ง

**ทางเลือก Cloudflare Access (เฉพาะเมื่อคุณมี custom domain ที่ตั้งกฎเฉพาะ `/api/admin/*` ได้):** ตั้ง `AUTH_PROVIDER=access`, `TEAM_DOMAIN`, `POLICY_AUD`, `ADMIN_EMAILS` แล้วป้องกัน path `/api/admin/*` ด้วย Cloudflare Access; API ตรวจ JWT RS256 อีกชั้น หากยังใช้โดเมนฟรี `pages.dev` ให้เลือก GitHub OAuth ตามขั้นตอนด้านบน

### ขั้นที่ 3. Cloudinary (แนะนำเมื่อเริ่มอัปโหลดภาพ)

1. สมัคร Cloudinary Free แล้วดู Cloud Name, API Key, API Secret ใน Cloudinary Console
2. เพิ่ม Secrets ใน Cloudflare Pages (Production และ Preview ตามที่ต้องใช้):
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET` **ตั้งเป็น Secret ไม่ใช่ Public variable**
3. Deploy ใหม่ จาก Admin ทดลองอัปโหลด JPEG/PNG/WebP/AVIF ไม่เกิน 3 MB
4. ระบบส่งรูปจากเบราว์เซอร์ไป Cloudinary ตรง ๆ ด้วยลายเซ็นจาก API; หากอัปโหลดสำเร็จแล้วบันทึก metadata ล้มเหลว อาจต้องลบ orphan image ใน Cloudinary Console ด้วยตนเอง
5. ใช้ลิงก์ภาพจากช่อง URL รูปได้โดยไม่ต้องใช้ Storage Cloudinary แต่ต้องมีสิทธิ์ในการแสดงภาพของแหล่งนั้น
6. ตรวจเครดิต/การเข้าชมภาพจริงที่ Cloudinary Dashboard เป็นประจำ (25 credits/เดือนเป็นโควตาที่ใช้ร่วมกันหลายรายการ ไม่ใช่พื้นที่ 25GB เสมอไป)

### ขั้นที่ 4. ย้ายข้อมูลจาก Netlify (สำคัญ)

1. **ก่อนแก้ไขเว็บไซต์ที่กำลังใช้งานอยู่** เข้า Admin Netlify เวอร์ชันเก่าและกด **ส่งออก JSON** เพื่อสำรองข้อมูลจริงล่าสุดจาก Netlify Blobs
2. ไฟล์ `legacy-data/links.json` ในโปรเจกต์นี้คือไฟล์ที่แนบมากับ ZIP เท่านั้น อาจเป็นข้อมูลเก่าหรือข้อมูลตัวอย่าง ไม่ใช่ Netlify Blobs ใน production
3. เมื่อเข้าสู่ Admin V2 เลือก `main` -> เลือกแท็บ CSV/JSON -> **นำเข้าไฟล์** เลือก Append; ข้อมูลจะบันทึกผ่าน D1 ทีละไม่เกิน 50 รายการต่อ API request
4. ตรวจจำนวนสินค้าและสุ่มทดสอบลิงก์ร้าน รูป และหมวดหมู่ ก่อนย้ายโดเมน/แชร์เว็บใหม่
5. รูปภาพเก่าที่ฝังในไฟล์เป็น `data:image/...` จะ **ไม่สามารถนำเข้าผ่าน API ได้** เพราะเวอร์ชันนี้รับเฉพาะ HTTPS image URL; ต้องแปลงไฟล์รูปขึ้น Cloudinary หรือเปลี่ยนเป็น URL ที่ได้รับอนุญาตก่อน
6. สำหรับข้อมูลมากกว่า 50 รายการ ให้ใช้ `Append` เป็นรอบ ๆ; `Replace` จำกัด 50 รายการต่อการ Import เพื่อป้องกันล้างข้อมูลก้อนใหญ่ผิดพลาด

### ขั้นที่ 5. สร้างเว็บไซต์เพิ่มเติม

- Admin -> **+ สร้างเว็บไซต์ใหม่** -> ใส่ชื่อและ slug เช่น `tech`, `beauty`
- URL ตัวอย่าง: `https://YOURPROJECT.pages.dev/?site=tech#/` และ `?site=beauty#/`
- ทั้งหมดใช้ **Pages Project เดียวและ D1 เดียวกัน** ไม่ได้ใช้ Pages Project หนึ่งอันต่อหนึ่งเว็บไซต์
- หากต้องการแยก `tech.example.com`/`beauty.example.com`: จดโดเมน/มีโดเมนอยู่แล้ว -> เพิ่ม Custom Domains ใน Cloudflare Pages -> อัปเดต `host` ในการตั้งค่าเว็บไซต์ โดยโดเมนเหล่านั้นต้องชี้มาที่ Pages จริง
- **Pages ไม่แจกโดเมนที่จดทะเบียนให้ฟรี**; ใช้ `pages.dev` ของโครงการและ query slug ได้ฟรี

## การใช้โควตาให้คุ้ม

| ส่วน | ข้อจำกัดและวิธีรับมือ |
|---|---|
| Pages static | ใช้ HTML/CSS/JS เดิม; เพิ่มสินค้าไม่ต้อง Build ใหม่ |
| Workers/Pages Functions | Free 100,000 Requests ต่อวันต่อบัญชี; API catalog ทุกหน้าที่เปิดใช้โควตา |
| D1 | Free 5 ล้าน rows read + 100,000 rows write ต่อวัน, สูงสุด 500 MB ต่อ DB และ 5 GB ทั้งบัญชี (ตรวจผู้ให้บริการอีกครั้งก่อนเปิดจริง) |
| Cloudinary | Free 25 Credits ต่อเดือนแบบใช้รวมหลายทรัพยากร; รูปแนะนำ 3 MB ต่อไฟล์หรือเล็กกว่า |
| Quota UI | แสดงข้อมูลจาก DB ที่แอปติดตามและค่าประมาณ; **ไม่ใช่การดึงค่า Workers Requests หรือ Cloudinary Credits จริง** |
| Traffic | เมื่อสูงขึ้น ควรทำ static catalog/cache เป็นระยะเพื่อลด API requests (ยังไม่รวมโค้ด build/caching ขั้นสูงไว้ใน starter) |

**ไม่สามารถรับประกัน 'ฟรีตลอดไปแบบไม่จำกัด'** โปรดใช้ Free Plan เท่านั้น ตั้งค่าไม่อัปเกรด และตรวจดูการเปลี่ยนแปลงเงื่อนไขผู้ให้บริการ

## รายการที่ต้องทดสอบก่อนเปิดจริง

- [ ] หน้า Home, ค้นหา, หมวดหมู่, เปลี่ยนหน้า และรายละเอียดแสดงผลถูกต้องทั้งมือถือ/คอมพิวเตอร์
- [ ] API Admin ทุกเส้นทางปฏิเสธคนที่ไม่มีเซสชันที่ถูกต้องและ GitHub ID ที่ไม่ได้อนุญาต
- [ ] Login จาก GitHub OAuth บน pages.dev ได้จริง, Logout แล้วเข้า Admin ไม่ได้ และหน้าเว็บ Public ยังเปิดได้
- [ ] เพิ่ม แก้ไข soft-delete และ Import/Export JSON/CSV แล้วข้อมูลคงอยู่หลัง refresh และเปิดผ่านอีกอุปกรณ์
- [ ] แยกสินค้า site=tech กับ site=beauty ถูกต้อง
- [ ] รูปอัปโหลดแล้วอยู่ใน Cloudinary; ใช้งานในสินค้า; รูปที่ถูกอ้างถึงลบไม่ได้
- [ ] รูปที่ถูกลบไม่เหลือภาพกำพร้าที่ไม่จำเป็น และ HTTPS-only URLs
- [ ] โควตาเตือนเมื่อเข้าใกล้พื้นที่ D1 และตรวจเครดิตฟรีจริงที่ Dashboard
- [ ] สำรองไฟล์ก่อนลบสินค้า/เปลี่ยน schema และทดลอง restore จริง
- [ ] เมื่อ Traffic สูงควรเพิ่ม throttling/WAF ตามโควตา Cloudflare ฟรีและทำ Cache ให้เหมาะสม

## ความต่างจากเว็บเดิมที่ควรรู้

- ไม่ได้ใช้รหัส Admin เดิม และ **ห้ามคัดลอก hash/key ฝั่งหน้าเว็บกลับมาใช้**
- ไม่ใช้ Netlify Blobs/Functions อีกต่อไป
- ไม่เก็บข้อมูลสินค้าใน localStorage แล้ว (ข้อมูลจริงอยู่ใน D1)
- ไม่ดึงรูปอัตโนมัติจากแพลตฟอร์มร้านค้า เพราะต้องเคารพเงื่อนไข/ป้องกัน block/ป้องกันค่า API
- ไม่เก็บยอดคลิกรวม (ปุ่มไปสินค้าพาไป URL ตรง) เพื่อจำกัด API Write ต่อวัน
- Multi-Site ใช้ query parameter สำหรับ URL ฟรี ยังไม่สร้าง Custom Pages Project ให้อัตโนมัติ
- การแก้ไขโครงสร้างเว็บ/ฟีเจอร์ยังต้อง Deploy โค้ด แต่การเพิ่มสินค้าหรือแก้ข้อมูลใน Admin ไม่ต้องแก้โค้ด

## เอกสารผู้ให้บริการ

- https://developers.cloudflare.com/pages/functions/bindings/
- https://developers.cloudflare.com/pages/functions/local-development/
- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://cloudinary.com/documentation/authentication_signatures
- https://cloudinary.com/documentation/image_upload_api_reference

## คำเตือนเรื่องระบบยังไม่เปิดจริง

- Starter นี้ **ยังไม่เคยทดสอบ Deploy บนบัญชี Cloudflare จริง** และ **ยังไม่เคยต่อ Cloudinary จริง**; ควรทดสอบในโปรเจกต์ใหม่ก่อนนำไปใช้กับเว็บที่มีผู้ชมอยู่
- Quota Panel เป็นตัวเลขที่แอปคำนวณ/ติดตามเอง ไม่ใช่ API วัดโควตาคงเหลือ Workers, Cloudinary เครดิต หรือ D1 read/write ทั้งบัญชีแบบ Real-time
- ระบบ Export เป็นการดาวน์โหลดจากเบราว์เซอร์ ผู้ดูแลต้องสำรองข้อมูลเองเป็นประจำ; ไม่มีระบบสำรองอัตโนมัติ/ส่งแจ้งเตือนอีเมล
- Multi-site ใช้ `?site=slug` ในโดเมนเดียว; ยัง **ไม่สร้าง Pages Project หรือโดเมนย่อยแยกให้อัตโนมัติ**
- เงื่อนไขบริการฟรีอาจเปลี่ยนแปลงในอนาคตและไม่ได้รับประกันจำนวนสินค้า/ผู้ชมไม่จำกัด; โปรดตรวจหน้าราคาและ usage dashboard ก่อนใช้จริง
