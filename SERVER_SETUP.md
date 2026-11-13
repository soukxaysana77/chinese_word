# ตั้งค่าเซิร์ฟเวอร์ (Supabase) — ทำครั้งเดียว ประมาณ 10 นาที

เซิร์ฟเวอร์ใช้เก็บคำศัพท์ที่แอดมินแก้ไข เพื่อให้ผู้เล่นทุกคนเห็นคำศัพท์ชุดเดียวกัน
และใช้ตรวจรหัสแอดมินบนเซิร์ฟเวอร์ (คนที่เปิดดูโค้ดเว็บจะไม่เห็นรหัส)
Supabase ใช้ฟรี ไม่ต้องใส่บัตรเครดิต

## 1. สมัครและสร้างโปรเจกต์

1. ไปที่ <https://supabase.com> → กด **Start your project** → **Continue with GitHub**
2. กด **New project**
   - **Name:** `chinese-word`
   - **Database Password:** ตั้งรหัสแล้วจดเก็บไว้ (เป็นรหัสฐานข้อมูล ไม่ใช่รหัสแอดมินของเกม)
   - **Region:** Southeast Asia (Singapore)
3. กด **Create new project** แล้วรอ 1–2 นาทีจนโปรเจกต์พร้อม

## 2. สร้างตารางคำศัพท์และรหัสแอดมิน

1. เมนูซ้าย → **SQL Editor** → **New query**
2. เปิดไฟล์ [`supabase/setup.sql`](supabase/setup.sql) บน GitHub → กด **Raw** → คัดลอกทั้งหมด
3. วางในช่อง SQL แล้วกด **Run** → ต้องขึ้นว่า *Success*

## 3. เอาค่าเชื่อมต่อมาใส่ในเกม

1. เมนูซ้าย → **Project Settings** (ไอคอนเฟือง) → **API** / **API Keys**
2. คัดลอก 2 ค่านี้:
   - **Project URL** เช่น `https://abcdefghijkl.supabase.co`
   - **anon public key** (หรือ **Publishable key**)
3. ใส่ในไฟล์ [`js/config.js`](js/config.js) แล้ว push ขึ้น GitHub

ค่า 2 ค่านี้ออกแบบมาให้อยู่ในหน้าเว็บได้ ใช้ได้แค่อ่านคำศัพท์และเรียกฟังก์ชันแอดมินที่ต้องมีรหัส
**ห้ามใช้ `service_role` / `secret` key** เพราะอันนั้นเป็นกุญแจลับ

## ข้อควรรู้

- **รหัสแอดมินเริ่มต้นคือ `1234`** เปลี่ยนได้ที่หน้าแอดมิน → เครื่องมือ → เปลี่ยนรหัสแอดมิน (ตัวเลข 4–12 หลัก ยิ่งยาวยิ่งปลอดภัย)
- **ใส่รหัสผิด 5 ครั้งติดกัน** ระบบจะล็อก 10 นาที
- **ลืมรหัส:** SQL Editor → วางบรรทัดนี้แล้วกด Run (รหัสจะกลับเป็น 1234)

  ```sql
  update private.admin_settings set pin_hash = extensions.crypt('1234', extensions.gen_salt('bf')), failed_attempts = 0, locked_until = null where id = 1;
  ```

## ไฟล์เสียงที่อัดไว้ (Recorded audio)

เสียงอ่านของทุกประโยคและทุกคำอยู่ในโฟลเดอร์ `audio/` สร้างด้วยโปรแกรม Kokoro ในคอม (ไม่ต้องใช้เน็ต)
ประโยคที่แอดมินเพิ่มหรือแก้ทีหลังจะใช้**เสียงจากเบราว์เซอร์**ไปก่อน จนกว่าจะสร้างไฟล์เสียงให้

**สร้างไฟล์เสียงให้ประโยคใหม่** (บนคอมที่ติดตั้ง Kokoro ไว้แล้ว) เปิด terminal ที่โฟลเดอร์เกมแล้วรัน:

```bash
../tts/env/Scripts/python -X utf8 tools/make_audio.py
```

สคริปต์อ่านทั้งรายการในเกมและรายการบนเซิร์ฟเวอร์ สร้างเฉพาะไฟล์ที่ยังไม่มี แล้ว push โฟลเดอร์ `audio/` ขึ้น GitHub
(เปลี่ยนเสียงได้ด้วย `--voice zf_002` เป็นต้น และใส่ `--redo` เพื่อสร้างใหม่ทั้งหมด)

**ติดตั้ง Kokoro บนคอมเครื่องใหม่** (ทำครั้งเดียว ประมาณ 220 MB) ในโฟลเดอร์ที่อยู่ข้าง ๆ โฟลเดอร์เกม:

```bash
python -m venv tts/env
tts/env/Scripts/python -m pip install "kokoro-onnx==0.6.1" "misaki[zh]==0.9.4" soundfile
```

แล้วดาวน์โหลด 3 ไฟล์นี้ใส่ `tts/model/`:
`kokoro-v1.1-zh.fp16.onnx` และ `voices-v1.1-zh.bin` จาก <https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1>
และ `config.json` จาก <https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh>

- **ถ้าไม่มีใครเล่นเลย 7 วัน** Supabase แบบฟรีจะหยุดโปรเจกต์ชั่วคราว ให้เข้า supabase.com แล้วกด **Restore project**
  ระหว่างนั้นเกมยังเล่นได้ด้วยคำศัพท์ที่โหลดไว้ล่าสุดในเครื่อง (หรือชุดเริ่มต้น) แต่หน้าแอดมินจะบันทึกไม่ได้
