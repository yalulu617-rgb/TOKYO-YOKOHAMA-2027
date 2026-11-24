# 東京・橫濱專案維護規範

本專案只操作既有東京 GitHub Pages 與 Firebase Spark 專案。私人資料由管理員以已授權的工作階段發布至 Firestore。公開 Git 不包含原站私人原始檔、成員身分、備份或憑證。

| Agent Skill | 本案版本 | 實作位置 |
|---|---|---|
| web-app-starter | 1.2.0 | 使用者介面透過 boot 的狀態橋接，雲端介面在 cloud，裝置儲存在 device，佇列與退避在 outbox。 |
| pwa-offline-sync | 1.1.0 | Google 與 Firestore 雙重門檻，帳號隔離的加密佇列，固定文件 ID、條件式寫入及退避重試。 |
| release-verification | 1.1.0 | Pages CI 驗證語法、相對路徑、資產、機密與發布資訊。正式驗收只讀。 |
| travel-data-schema | 1.1.0 | 私人 `private/source/data.json` 保持既有底稿結構，`prepare` 驗證 ID、日期與節點關聯，供 Web App 與未來手冊共用。 |
| travel-app-adapter | 1.1.0 | 既有出發前頁面保留。瀏覽位置屬於個別裝置。記帳草稿模型獨立驗證，暫無雲端寫入或 UI。 |

來源為本機 LUNA-CREATIVE-SKILLS，Registry 系統版 1.2.0（2026-11-23）。唯讀查詢 GitHub 私有庫得到 404。未來照片採 photo-reliability 1.2.0，旅程手冊保留對 travel-booklet-design、itinerary-to-booklet、booklet-illustration 與 print-preflight 1.1.0 的相容性。這些功能需另行實作。

## 本案適配

- 已安裝 PWA 保留原 manifest ID。Service Worker 先查正式首頁並核對內容版本，模組及圖片採同版快取。保留舊版既有的固定版 Firebase 靜態程式碼快取來支援復線，帳戶端點、Token、Firestore 回應與私人資料均排除。
- 保留 Firebase SDK 持久登入及舊版密語加密副本。新佇列只保存在私人模式，以 UID 作為 AES-GCM 驗證資料，並使用 IndexedDB 內不可匯出的裝置金鑰。這層保護並非另一個密語層，需以鎖定裝置與瀏覽器帳號隔離保護同一個裝置層級的讀取權限。
- 人工核准維持三位。既有 Firestore 規則與資料集合維持原權限。未來的共享記帳寫入需先新增精確到集合及欄位的規則並隔離驗證。
- 發布前以唯讀 API 匯出到 Git 外並加密。若需實作資料復原驗證，使用獨立測試專案和合成資料。
