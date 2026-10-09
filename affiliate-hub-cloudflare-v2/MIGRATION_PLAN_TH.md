# แผนเปิดใช้ Affiliate Hub V2.0 (เน้นแผนฟรี)

## จุดเริ่มต้น
- `public/index.html` และ `public/assets/styles.css` ใช้ฐานจากไฟล์ ZIP เดิม พร้อมปรับ UI เฉพาะส่วนที่จำเป็น
- ฝั่ง Frontend ใช้ `public/assets/app-v2.js` แทน client logic เดิมที่เรียก Netlify Blobs
- `legacy-data/links.json` เป็นตัวอย่าง 15 รายการที่มากับ ZIP เท่านั้น **ไม่ใช่ข้อมูล Production ล่าสุด**
- ต้องสำรองสินค้าออกจาก Netlify Blobs จริงผ่านหน้า Admin เว็บเดิมก่อนย้าย

## ลำดับทำงานที่ปลอดภัย

| ลำดับ | ทำอะไร | ผลลัพธ์ที่ต้องตรวจ |
|---|---|---|
| 0 | Export JSON จาก Netlify เดิมและคัดลอก ZIP เก็บ | มีไฟล์ข้อมูลจริงสำรอง 2 ชุด และเปิดอ่านได้ |
| 1 | สร้าง D1 Free, รัน `schema/001_init.sql`, เชื่อมกับ Pages Free | `/api/catalog?site=main` แสดง JSON และหน้าเว็บเปิดได้ |
| 2 | ลงทะเบียน GitHub OAuth App, ตั้ง `AUTH_PROVIDER=github` พร้อม Secrets/allowlist | หน้าเว็บ Public เปิดโดยไม่ Login, Admin API ปฏิเสธ Anonymous |
| 3 | ทดสอบ Admin CRUD และ Import/Export ด้วย 2-3 รายการ | เพิ่ม/แก้/ลบ/Export/Import สำเร็จ ข้อมูลไม่หายหลัง refresh |
| 4 | เพิ่ม Cloudinary Free และ signed upload | อัปโหลดรูป 1 รูปแล้วแสดงบนสินค้าและดูใน Media Library ได้ |
| 5 | สร้างไซต์ที่สอง เช่น `?site=tech` | ข้อมูลไม่ปะปนกับ `main` และเปิดเว็บได้จาก URL ฟรี |
| 6 | Import ข้อมูล Production จริงเป็นรอบละไม่เกิน 50 สินค้า | จำนวน/หมวดหมู่/URL/รูปถูกต้อง; ห้ามปิดเว็บเก่าก่อน QA |
| 7 | ทดสอบความปลอดภัย, quota dashboard, export backup, mobile | Incognito เข้า Admin ไม่ได้; Export/Restore ทดสอบผ่าน |
| 8 | ประกาศ URL เว็บใหม่ และเก็บเว็บ Netlify เดิมเป็น fallback ชั่วคราว | ผู้ชมใช้งานได้จริงและเฝ้าดูโควตาใน Dashboard |

## ขอบเขตที่พัฒนาแล้วใน Starter

- ✅ หน้าสินค้าเดิมและระบบค้นหา/กรอง/รายละเอียด + API สาธารณะ
- ✅ Admin เพิ่ม แก้ ลบ Soft-delete, นำเข้า/ส่งออก JSON/CSV, สร้าง/แก้ไซต์
- ✅ Cloudflare D1 SQL schema พร้อมตาราง `sites`, `products`, `media`, `audit_logs`
- ✅ Signed Cloudinary Upload/Media metadata/Delete ที่ไม่ได้อ้างอิง
- ✅ GitHub OAuth, signed session cookie, GitHub ID allowlist; มี Cloudflare Access เป็นทางเลือก
- ✅ Quota UI แบบค่าประมาณและคำเตือน ไม่ใช่เครดิตเรียลไทม์
- ✅ Integration tests ด้วย SQLite local ครอบคลุม CRUD และการแยกข้อมูล

## สิ่งที่ยังไม่ใช่ระบบอัตโนมัติ/ยังต้องตั้งค่าเอง

- OAuth App, D1 Binding, Cloudinary Secrets และการ Deploy จริงบนบัญชีคุณ
- การแปลงรูป `data:image/...` จากเว็บเดิมเป็น HTTPS URL ก่อน Import
- การสำรองข้อมูลตามเวลา: มีปุ่ม Export ให้ Admin แต่ยังไม่มี Backup scheduler
- ตรวจเครดิต Cloudinary / Workers / D1 ทั้งบัญชี: ยังต้องเข้า Provider Dashboard ด้วยตนเอง
- สร้างเว็บไซต์ใหม่เป็นไซต์ย่อย `?site=slug` ภายใน Pages Project เดียว ไม่ได้สร้าง Pages Project หรือ Custom Domain ใหม่ให้โดยอัตโนมัติ
- Cloudflare Pages, D1 และ Cloudinary ต่างมีโควตาฟรี; เมื่อเกินต้องลดการใช้งานหรือพิจารณาทางเลือก ไม่ควรตั้งระบบจ่ายเงินอัตโนมัติ

## เกณฑ์อนุมัติเปิดจริง

**Go** เมื่อ (1) Backup เดิมแล้ว (2) Login ใช้ได้และผู้ไม่เกี่ยวข้องเข้าถึงข้อมูลไม่ได้ (3) เพิ่ม/แก้/ลบ + Import/Export ได้ (4) รูปแสดงถูกต้อง (5) ทดสอบอย่างน้อยสองไซต์แล้ว และ (6) ตรวจว่าไม่มี Secrets อยู่ใน GitHub

**No-go** เมื่อยังไม่ได้ทดสอบจริงในบัญชี Cloudflare/Cloudinary หรือลิงก์รูปบางส่วนยังเป็น Base64 หรือยังไม่ได้ Export ฐานข้อมูล Production เดิม
