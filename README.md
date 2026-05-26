# สนามผลบอล

เว็บดูโปรแกรมบอลและผลบอลวันนี้ตามเวลาไทย พร้อม UI แนวนีออนและ SEO route รายวัน

## Run locally

```sh
npm start
```

เปิด `http://localhost:3000`

## Environment

คัดลอก `.env.example` เป็น `.env` แล้วตั้งค่า:

```env
ISPORTS_API_KEY=your_key
PORT=3000
```

## GitHub Pages note

GitHub Pages รันได้เฉพาะ static files จึงไม่สามารถรัน `server.js` หรือซ่อน `ISPORTS_API_KEY` ได้โดยตรง

## Recommended deploy: GitHub Pages + Render

### 1. Deploy backend on Render

ใช้ `render.yaml` ใน repo นี้เพื่อสร้าง Web Service:

- Service name: `sanam-football-api`
- Runtime: Node
- Start command: `npm start`
- Environment variable: `ISPORTS_API_KEY`

หลัง deploy เสร็จ Render จะให้ URL เช่น:

```txt
https://sanam-football-api.onrender.com
```

ตรวจ backend:

```txt
https://sanam-football-api.onrender.com/api/matches
```

### 2. Configure GitHub Pages frontend

แก้ `public/config.js` ให้ชี้ไป Render backend:

```js
window.SANAM_CONFIG = {
  apiBaseUrl: "https://sanam-football-api.onrender.com"
};
```

### 3. Publish frontend on GitHub Pages

ตั้ง repo เป็น `sanam-football` แล้ว publish โฟลเดอร์ `public/` เป็น GitHub Pages

ถ้าใช้ GitHub Actions ให้ตั้ง workflow ให้ deploy เฉพาะ contents ของ `public/`

### Why this split exists

GitHub Pages เป็น static hosting จึงรัน `server.js` ไม่ได้ และไม่ควรฝัง `ISPORTS_API_KEY` ใน browser

Render เป็น backend proxy เพื่อซ่อน API key และส่งข้อมูลให้ frontend ผ่าน `/api/matches`

## Example production config

```js
window.SANAM_CONFIG = {
  apiBaseUrl: "https://your-backend.example.com"
};
```
