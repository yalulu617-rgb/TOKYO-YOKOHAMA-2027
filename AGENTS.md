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
- 2.1.1 瀏覽狀態只允許非敏感欄位（頁面、日期、捲動與展開識別碼）按帳號同步寫入裝置。行程、搜尋文字、備份與帳務保留原加密保護。正式裝置驗收與觸控模擬分開紀錄。
- 發布前以唯讀 API 匯出到 Git 外並加密。若需實作資料復原驗證，使用獨立測試專案和合成資料。

## V2.1.1 穩定暨回滾基準

標籤 `v2.1.1` 必須指向 `342b1f593e30f718fb3294f75c29467f1a82d9fb`。2026/11/24 15:43（台北時間），使用者於 Samsung S25 確認自動同步、行程不跳頁、重開保留位置及離線自動補送皆通過。iPhone 與其他家庭成員的獨立帳號實機測試維持待驗收。

- 2.1.0 的模擬曾通過，但 S25 仍重現問題。日期曾和加密裝置快照共用非同步寫入。重畫行程與前背景切換也可能擾動捲動。選日事件須先同步保存帳號隔離的非敏感 UI 狀態，再渲染行程。雲端更新只能局部修改受影響的卡片或備註。背景回報的零捲動不能覆蓋前景位置。
- SW 啟用前須完成整套版本快取並核對首頁。保留已發布的離線 renderer 相容清單，復線後先確認待傳修改安全，再切換新版。測試時須等正式 active controller 與新版快取內實際首頁同時成立。Playwright 的非同步輪詢條件應由測試端反覆 await 布林結果。
- 執行 `node tools/test-view-state.mjs` 和 `node tools/test-outbox.mjs`。瀏覽器回歸須涵蓋 Day 2～6 各兩輪背景讀取、另一帳號修改、搜尋及展開、寫入受阻時立即重開首畫面、背景零捲動及前景恢復、真實前一版 SW 升級與舊離線副本復線補送。模擬和各實機的驗收需分欄記錄。
- 若另經授權要回滾，可從穩定標籤重新發布其公開成品。先唯讀確認對應的 Firestore 私人發布文件仍存在。回滾程式時保留現有雲端欄位、登入及規則。

## V2.2.0 出發前規劃

本機 LUNA-CREATIVE-SKILLS Registry 1.2.1。web-app-starter 1.2.0 用於共用行動導覽、比較卡片及欄位；pwa-offline-sync 1.1.1 延用既有自動同步、加密佇列與瀏覽狀態；release-verification 1.1.1 要求封存基準、獨立模擬器及正式唯讀核對；travel-data-schema 1.1.0 保留六天、54 個原節點和六間飯店的原始內容及 ID；travel-app-adapter 1.1.1 將推薦排序和原始資料順序分離。

新增族人共用欄位存於 /planning，保留 /fields 的路徑、值及規則。舊版回滾可重新發布 v2.1.1 的公開成品，原私人 release 與既有雲端欄位繼續保留。V2.2.0 再發布後，新增規劃欄位會重新顯示。規劃來源與舊資料均經 prepare 封入私人 release。
