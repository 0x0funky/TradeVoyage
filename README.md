# TradeVoyage 🚀

![Next.js](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![TailwindCSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss)

**TradeVoyage** - 您的加密貨幣交易旅程分析平台。整合多家中心化交易所（CEX），透過視覺化圖表與詳細統計數據，深入了解您的交易策略與倉位管理。

## ✨ v2.0 新功能

- 🏦 **多交易所支援** - 支援 BitMEX、Binance Futures、OKX，未來將整合 Bybit 等更多交易所
- 🔑 **Read-Only API 導入** - 直接在平台上使用唯讀 API 安全下載您的交易數據
- 📊 **優化倉位計算** - 更精準的倉位開平邏輯與 PnL 計算
- 📈 **優化圖表顯示** - 改進 K 線圖與交易標記顯示效果
- 🌓 **深色/淺色模式** - 支援主題切換，保護您的眼睛
- 🎨 **全新品牌設計** - 更現代化的 UI 與交易所圖標

## 🌟 核心功能

- 📊 **多時間週期 K 線圖** - 支援 1m、5m、15m、30m、1h、4h、1d、1w 多種時間週期
- 📈 **倉位歷史分析** - 完整追蹤每一個倉位從開倉到平倉的過程
- 💰 **損益統計** - 月度 PnL、勝率、盈虧比等關鍵指標
- 📉 **權益曲線** - 視覺化資金變化趨勢
- 🎯 **交易標記** - 在 K 線圖上標記所有買賣點位，支援跳轉到歷史倉位
- 🔍 **倉位詳情** - 點擊倉位即可查看該倉位所有交易細節
- 🌐 **線上數據導入** - 直接在平台上輸入 API 密鑰導入數據

## 📸 截圖預覽

![Platform Preview](TradeVoyage.gif)

---

## 🚀 快速開始

### 環境需求

- Node.js 18+
- npm 或 yarn

### 安裝步驟

1. **Clone 專案**
```bash
git clone https://github.com/0x0funky/TradeVoyage
cd TradeVoyage
```

2. **安裝依賴**
```bash
npm install
```

3. **啟動開發伺服器**
```bash
npm run dev
```

4. **開啟瀏覽器**

訪問 [http://localhost:3000](http://localhost:3000)

---

## 📥 數據導入方式

### 方式一：透過平台介面導入（推薦）

1. 點擊右上角的 ⚙️ **設定** 圖示進入數據導入頁面
2. 選擇交易所（BitMEX、Binance Futures 或 OKX）
3. 輸入 Read-Only API Key 和 API Secret（OKX 需額外輸入 Passphrase）
4. OKX 用戶可選擇 Instrument Type（SWAP、FUTURES、MARGIN 或 ALL）
5. 設定數據日期範圍
6. 點擊「測試連接」確認 API 正確
7. 點擊「開始導入」自動抓取並儲存數據

> ⚠️ **安全提示：** 
> - 請使用 **Read-Only** 權限的 API Key
> - API 密鑰只用於抓取數據，不會被儲存或傳送至第三方
> - 數據儲存在本地專案目錄中

### 方式二：使用 Demo 數據

📦 **paulwei 交易員示範數據** (CSV 檔案，放置於根目錄)

🔗 [下載連結 (Google Drive)](https://drive.google.com/file/d/11i_nJ90QpgP6Lnwalucapcsd2NbuC9co/view?usp=sharing)

下載後解壓縮，將 CSV 檔案放置於專案根目錄即可使用。

### 方式三：手動下載數據檔案

如果您有現成的數據檔案，可以手動放置：

#### 交易數據（根目錄）

**BitMEX：**
```
TradeVoyage/
├── bitmex_executions.csv      # 成交執行記錄（必需）
├── bitmex_trades.csv          # 交易記錄
├── bitmex_orders.csv          # 訂單歷史
├── bitmex_wallet_history.csv  # 錢包歷史（資金費率、存取款）
└── bitmex_account_summary.json # 帳戶摘要
```

**Binance Futures：**
```
TradeVoyage/
├── binance_executions.csv      # 成交執行記錄（必需）
├── binance_wallet_history.csv  # 收益歷史（PnL、資金費率）
└── binance_account_summary.json # 帳戶摘要
```

**OKX：**
```
TradeVoyage/
├── okx_executions.csv          # 成交執行記錄（必需）
├── okx_positions_history.csv   # 已平倉倉位歷史
├── okx_wallet_history.csv      # 資金變動（Funding、PnL）
└── okx_account_summary.json    # 帳戶摘要
```

---

## 🔑 API Key 設定指南

### BitMEX

1. 前往 [BitMEX API Keys](https://www.bitmex.com/app/apiKeys)
2. 點擊「Create API Key」
3. 權限設定：
   - ✅ **Read** - 必須開啟
   - ❌ Order - 不需要
   - ❌ Withdraw - 不需要
4. 複製 API Key 和 Secret

### Binance Futures

1. 前往 [Binance API Management](https://www.binance.com/en/my/settings/api-management)
2. 點擊「Create API」
3. 選擇「System generated」
4. 完成安全驗證
5. 權限設定：
   - ✅ **Enable Reading** - 必須開啟
   - ✅ **Enable Futures** - 必須開啟
   - ❌ Enable Spot & Margin Trading - 不需要
   - ❌ Enable Withdrawals - 不需要
6. 複製 API Key 和 Secret Key

### OKX

1. 前往 [OKX API Management](https://www.okx.com/account/my-api)
2. 點擊「Create V5 API Key」
3. 設定 Passphrase（必填，導入時需要）
4. 權限設定：
   - ✅ **Read** - 必須開啟
   - ❌ Trade - 不需要
   - ❌ Withdraw - 不需要
5. 選擇 Instrument Type：
   - **SWAP** - 永續合約（預設）
   - **FUTURES** - 交割合約
   - **MARGIN** - 保證金交易
   - **ALL** - 同時查詢以上所有類型
6. 複製 API Key、Secret Key 和 Passphrase

---

## ️ 技術架構

| 技術 | 用途 |
|------|------|
| **Next.js 16** | React 全端框架 |
| **React 19** | UI 框架 |
| **TypeScript** | 類型安全 |
| **Tailwind CSS 4** | 樣式框架 |
| **Lightweight Charts** | K 線圖表 |
| **Lucide React** | 圖標庫 |

---

## 📁 專案結構

```
TradeVoyage/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── trades/       # 交易數據 API
│   │   └── import/       # 數據導入 API
│   ├── settings/         # 設定頁面（數據導入）
│   ├── page.tsx          # 主頁面
│   └── layout.tsx        # 根佈局
├── components/            # React 組件
│   ├── Dashboard.tsx     # 主儀表板
│   ├── TradingViewChart.tsx   # K 線圖表（Binance API）
│   ├── PositionSessionList.tsx  # 倉位列表
│   ├── PositionDetail.tsx       # 倉位詳情
│   ├── StatsOverview.tsx        # 統計概覽
│   ├── MonthlyPnLChart.tsx      # 月度 PnL
│   ├── EquityCurve.tsx          # 權益曲線
│   └── ThemeProvider.tsx        # 主題切換
├── lib/                   # 工具庫
│   ├── types.ts          # TypeScript 類型定義
│   ├── exchange_types.ts # 交易所類型定義
│   ├── data_loader.ts    # 數據載入器（支援多交易所）
│   ├── bitmex_exporter.ts   # BitMEX 數據導出
│   └── binance_exporter.ts  # Binance 數據導出
├── scripts/               # 數據抓取腳本
│   └── export_all_data.js
└── *.csv / *.json        # 交易數據檔案
```

---

##  開發指令

```bash
# 開發模式
npm run dev

# 建置生產版本
npm run build

# 啟動生產伺服器
npm run start

# 程式碼檢查
npm run lint
```

---

## 🗺️ 未來規劃

- [ ] 整合 Bybit 交易所
- [x] ~~整合 OKX 交易所~~ ✅ 已完成！
- [ ] AI 交易分析與建議
- [ ] 多帳戶管理
- [ ] 更多統計指標

---

## 📝 License

MIT License

---

## 🙏 致謝

感謝 paulwei 交易員提供 Read-Only API，讓這個學習平台得以持續改進。

**⚠️ 免責聲明：本平台僅供學習和研究使用，不構成任何投資建議。加密貨幣交易具有高風險，請謹慎投資。**
