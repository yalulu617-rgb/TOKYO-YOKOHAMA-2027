# 紫陽花の旅｜2027 TOKYO × YOKOHAMA

維護版本 2.1.0，採 GitHub Pages、Google 帳號登入與 Cloud Firestore。公開目錄是 `public/`。原站含家庭訂購狀況的版面、程式與旅行資料放在管理員持有的私人維護包。Agent Skills 與發布規範見 `AGENTS.md`。

## 管理與部署

1. 東京專案使用 Spark 免費方案，免綁信用卡。建立 Firestore Standard 的預設資料庫，啟用 Firebase Authentication 的 Google 供應商，將 Pages 網域加入 Authorized domains。三位家人各用自己的 Google 帳號。
2. 在 `public/config.js` 填入此專案的 Web app ID、project ID、API key 與 auth domain。這些設定來自 Firebase Web App SDK 設定。私人憑證只在管理員工作階段使用。
3. 確認 CLI 所選專案後執行 `firebase deploy --only firestore:rules --project <東京專案ID>`。以 GitHub Free 的公開獨立儲存庫搭配標準 runner，Pages 建置來源選 GitHub Actions。推送 main 會檢查公開素材、重算離線快取版本，並部署 public 目錄。
4. 管理員至網站首次 Google 登入。此時只能提出申請。管理員在本機解開私人維護包，以同一個 Google 帳號的管理授權，透過環境變數 `GOOGLE_OAUTH_ACCESS_TOKEN` 傳入短效 Google OAuth access token，執行 `node tools/admin.mjs <東京專案ID> initialize`。工具檢查計費停用、Google 已驗證身分、Firebase Google provider 主體相符，並在單次交易初始化私人版本及家庭名單。這個操作須在有專案權限的管理員環境執行。
5. 管理員重新登入。家人各自登入提出申請後，管理員在「家庭成員管理」核對信箱並逐一核准。名額上限三位。需要撤銷成員時，由專案管理員在 Firebase Console 更新 access/family 名單。已匯出的私人備份、裝置斷網時的加密副本須另行保管或清除。

## 維護原版與重新部署

私人維護包的 `private/source/data.json`、`app.js`、`index.html` 為目前版本的原站資料與程式。保留既有項目 ID，新項目使用新 ID。首次轉換已完成，日後直接編輯這三個檔案。公開程式管理登入、家庭核准、同步與快取。

修改私人內容後，以 Node.js 執行 `node tools/prepare.mjs`。它輸出私人 release 文件與公開版本摘要。以管理員工作階段執行 `node tools/admin.mjs <東京專案ID> update-release` 寫入該版本，再提交公開改動。內容定址可讓較舊的客戶端使用原先的版本。更新圖片、CSS 或登入介面只需修改 public 並推送 main。重跑同一次部署可在 Actions 選 Publish travel app → Run workflow。

## 離線、備份與復原

私人裝置預設勾選「保持登入」。重新開啟時由 Firebase SDK 恢復登入並向 Firestore 核對旅行權限。共用裝置請取消勾選。

所有可編輯欄位自動排入待同步佇列。私人模式在裝置加密儲存完成後顯示等待同步，Firestore 確認後顯示已同步至雲端。若提示尚未安全儲存，請保持頁面開啟至完成儲存或雲端確認。共用模式在記憶體保留待傳值。手動同步可立即重試。

私人模式也會加密保存上次瀏覽的功能頁、行程日期、搜尋與展開狀態。不同裝置各自保存瀏覽位置。需要無網路查看完整行程時，請另啟用密語離線副本。

需要離線使用時，可在登入後的「進階選項 · 離線副本」設定至少 10 字元的裝置密語。副本與待同步佇列以 PBKDF2-SHA256 及 AES-GCM 加密。正常連網使用無需輸入密語。想接續副本中尚未同步的修改時，在進階選項解鎖即可。離線重開可用密語閱讀與編輯。恢復連線時會嘗試用已保存的 Google 工作階段同步，若已失效可按「同步」重新登入同一帳號。收到 Firestore 確認才會顯示「已同步」。

在首頁或待辦頁選「備份」。版本 2 JSON 包含原始旅行資料、編輯值及 SHA-256 校驗碼，為私人明文檔案。請保存在只有家人可存取的位置。選「還原」後先檢查版本、行程、重複欄位、完整性及變更筆數，再確認合併。支援本次第一版格式的勾選、報價及預算。不同底稿的備份會要求人工核對。登出前可先匯出未同步的修改；登出會清除目前使用的本機私人副本。手動修改過的原始備份請保留原檔。

## 費用

Firestore 每專案一個免費資料庫，每日 50,000 次讀取、20,000 次寫入、20,000 次刪除，儲存 1 GiB。App 在前景每 90 秒查詢變更，編輯後或使用者按同步時也會更新。服務拒絕寫入時會保留待傳狀態，並在配額限制時顯示提示。公開庫的標準 GitHub Actions runner 與 GitHub Pages 可免費使用。[Firestore 配額](https://firebase.google.com/docs/firestore/quotas) · [Firebase Spark](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans) · [Pages 限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) · [Actions 費用](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

