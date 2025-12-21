# TradeVoyage

![TradeVoyage Banner](public/banner.png)

![Next.js](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![TailwindCSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss)
![AI Powered](https://img.shields.io/badge/AI_Powered-GPT5%20%7C%20Claude%20%7C%20Gemini-blueviolet)

**TradeVoyage** - 您的加密貨幣交易旅程分析平台。整合多家中心化交易所（CEX），透過視覺化圖表與詳細統計數據，深入了解您的交易策略與倉位管理。支援 **GPT-5.2、Claude Sonnet 4、Gemini 3 Pro** 等 22 款最新 AI 模型。

[English Version](README_EN.md)

## v2.0 新功能

- **多交易所支援** - 支援 BitMEX、Binance Futures、OKX、Bybit 等多家交易所
- **Read-Only API 導入** - 直接在平台上使用唯讀 API 安全下載您的交易數據
- **AI 交易分析** - 整合 22 款 AI 模型（GPT-5.2、Claude Sonnet 4、Gemini 3 Pro 等），智能分析您的交易表現
- **優化倉位計算** - 更精準的倉位開平邏輯與 PnL 計算
- **優化圖表顯示** - 改進 K 線圖與交易標記顯示效果
- **深色/淺色模式** - 支援主題切換，保護您的眼睛
- **全新品牌設計** - 更現代化的 UI 與交易所圖標

## 核心功能

- **多時間週期 K 線圖** - 支援 1m、5m、15m、30m、1h、4h、1d、1w 多種時間週期
- **倉位歷史分析** - 完整追蹤每一個倉位從開倉到平倉的過程
- **損益統計** - 月度 PnL、勝率、盈虧比等關鍵指標
- **權益曲線** - 視覺化資金變化趨勢
- **交易標記** - 在 K 線圖上標記所有買賣點位，支援跳轉到歷史倉位
- **倉位詳情** - 點擊倉位即可查看該倉位所有交易細節
- **線上數據導入** - 直接在平台上輸入 API 密鑰導入數據
- **AI 智能分析** - 使用 GPT/Claude/Gemini 分析交易表現並給出改進建議

## 截圖預覽

![Platform Preview](TradeVoyage.gif)

---

## 快速開始

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

## 數據導入方式

### 方式一：透過平台介面導入（推薦）

1. 點擊右上角的設定圖示進入數據導入頁面
2. 選擇交易所（BitMEX、Binance Futures、OKX 或 Bybit）
3. 輸入 Read-Only API Key 和 API Secret（OKX 需額外輸入 Passphrase）
4. OKX 用戶可選擇 Instrument Type（SWAP、FUTURES、MARGIN 或 ALL）
5. 設定數據日期範圍
6. 點擊「測試連接」確認 API 正確
7. 點擊「開始導入」自動抓取並儲存數據

> **安全提示：**
> - 請使用 **Read-Only** 權限的 API Key
> - API 密鑰只用於抓取數據，不會被儲存或傳送至第三方
> - 數據儲存在本地專案目錄中

### 方式二：使用 Demo 數據

**paulwei 交易員示範數據** (CSV 檔案，放置於根目錄)

[下載連結 (Google Drive)](https://drive.google.com/file/d/11i_nJ90QpgP6Lnwalucapcsd2NbuC9co/view?usp=sharing)

下載後解壓縮，將 CSV 檔案放置於專案根目錄即可使用。

### 方式三：手動下載數據檔案

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

**Bybit：**
```
TradeVoyage/
├── bybit_executions.csv        # 成交執行記錄（必需）
├── bybit_closed_pnl.csv        # 平倉損益記錄（精準倉位計算）
├── bybit_wallet_history.csv    # 資金變動
└── bybit_account_summary.json  # 帳戶摘要
```

---

## API Key 設定指南

### BitMEX

1. 前往 [BitMEX API Keys](https://www.bitmex.com/app/apiKeys)
2. 點擊「Create API Key」
3. 權限設定：
   - [x] **Read** - 必須開啟
   - [ ] Order - 不需要
   - [ ] Withdraw - 不需要
4. 複製 API Key 和 Secret

### Binance Futures

1. 前往 [Binance API Management](https://www.binance.com/en/my/settings/api-management)
2. 點擊「Create API」
3. 選擇「System generated」
4. 完成安全驗證
5. 權限設定：
   - [x] **Enable Reading** - 必須開啟
   - [x] **Enable Futures** - 必須開啟
   - [ ] Enable Spot & Margin Trading - 不需要
   - [ ] Enable Withdrawals - 不需要
6. 複製 API Key 和 Secret Key

### OKX

1. 前往 [OKX API Management](https://www.okx.com/account/my-api)
2. 點擊「Create V5 API Key」
3. 設定 Passphrase（必填，導入時需要）
4. 權限設定：
   - [x] **Read** - 必須開啟
   - [ ] Trade - 不需要
   - [ ] Withdraw - 不需要
5. 選擇 Instrument Type：
   - **SWAP** - 永續合約（預設）
   - **FUTURES** - 交割合約
   - **MARGIN** - 保證金交易
   - **ALL** - 同時查詢以上所有類型
6. 複製 API Key、Secret Key 和 Passphrase

### Bybit

1. 前往 [Bybit API Management](https://www.bybit.com/app/user/api-management)
2. 點擊「Create New Key」
3. 選擇「API Transaction」
4. 權限設定：
   - [x] **Read-Only** - 必須開啟
   - [ ] Contract - Trade - 不需要
   - [ ] Withdraw - 不需要
5. 複製 API Key 和 Secret Key

> **注意：** Bybit API 僅支援查詢最近 2 年的交易數據，每次請求最多抓取 7 天資料（系統會自動分批處理）。

---

## 技術架構

| 技術 | 用途 |
|------|------|
| **Next.js 16** | React 全端框架 |
| **React 19** | UI 框架 |
| **TypeScript** | 類型安全 |
| **Tailwind CSS 4** | 樣式框架 |
| **Lightweight Charts** | K 線圖表 |
| **Lucide React** | 圖標庫 |

---

## 專案結構

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
│   ├── binance_exporter.ts  # Binance 數據導出
│   ├── okx_exporter.ts      # OKX 數據導出
│   └── bybit_exporter.ts    # Bybit 數據導出
├── scripts/               # 數據抓取腳本
│   └── export_all_data.js
└── *.csv / *.json        # 交易數據檔案
```

---

## 開發指令

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

## 未來規劃

- [x] ~~整合 Bybit 交易所~~ - 已完成！
- [x] ~~整合 OKX 交易所~~ - 已完成！
- [x] ~~AI 交易分析與建議~~ - 已完成！
- [ ] 多帳戶管理
- [ ] 更多統計指標

---

## AI 交易分析

TradeVoyage 整合了多個 AI 模型，可智能分析您的交易表現並提供改進建議：

### 支援的 AI 模型（共 22 款）

#### OpenAI（9 款）
| 模型 | API 名稱 | 特點 |
|------|----------|------|
| **GPT-5.2** | `gpt-5.2` | 最新最強 - 代碼與代理任務最佳 |
| GPT-5.1 | `gpt-5.1` | 速度與智能平衡 - 通用首選 |
| GPT-5 | `gpt-5` | 第五代旗艦 - 強大多模態 |
| GPT-4o | `gpt-4o` | 經典款 - 穩定可靠 |
| GPT-4o Mini | `gpt-4o-mini` | 快速且經濟 |
| GPT-4 Turbo | `gpt-4-turbo` | 128K 上下文 |
| o3 Mini | `o3-mini` | 推理模型 - 高效能 |
| o1 | `o1` | 推理模型 - 複雜問題 |
| o1 Mini | `o1-mini` | 快速推理 |

#### Anthropic Claude（5 款）
| 模型 | API 名稱 | 特點 |
|------|----------|------|
| Claude Sonnet 4 | `claude-sonnet-4-20250514` | 最新 - 平衡性能與成本 |
| Claude Opus 4 | `claude-opus-4-20250514` | 最強大 - 複雜任務專用 |
| Claude 3.5 Sonnet | `claude-3-5-sonnet-20241022` | 經典款 - 穩定可靠 |
| Claude 3.5 Haiku | `claude-3-5-haiku-20241022` | 最快速 - 即時回應 |
| Claude 3 Opus | `claude-3-opus-20240229` | 舊版旗艦 |

#### Google Gemini（8 款）
| 模型 | API 名稱 | 特點 |
|------|----------|------|
| **Gemini 3 Pro** | `gemini-3-pro-preview` | 最新 - 高精度多模態推理 (Preview) |
| **Gemini 3 Flash** | `gemini-3-flash-preview` | 最新快速 - 視覺與代理推理 (Preview) |
| Gemini 2.5 Pro | `gemini-2.5-pro` | 專業版 - 深度思考 |
| Gemini 2.5 Flash | `gemini-2.5-flash` | 價效比最佳 - 自適應思考 |
| Gemini 2.0 Flash | `gemini-2.0-flash` | 2倍速度提升 |
| Gemini 2.0 Flash Lite | `gemini-2.0-flash-lite` | 超低延遲 |
| Gemini 1.5 Pro | `gemini-1.5-pro` | 100萬 Token |
| Gemini 1.5 Flash | `gemini-1.5-flash` | 經典快速版 |

### 設定方式

1. 前往 **Settings > AI Settings**
2. 輸入您的 AI Provider API Key
3. （可選）自訂 System Prompt
4. 點擊「Save Settings」

### 使用方式

1. 在 Dashboard 點擊 **AI Analysis** 分頁
2. 選擇要使用的 AI Provider 和 Model
3. 點擊「分析我的交易」
4. AI 將分析您的：
   - 整體統計數據（勝率、盈虧比等）
   - 最近 20 筆倉位表現
   - 月度盈虧趨勢
5. 獲得詳細的分析報告與改進建議

### 特點

- **全面分析** - 分析勝率、盈虧比、持倉時間等指標
- **本地儲存** - 分析結果自動儲存，下次訪問無需重新分析
- **安全** - API Key 僅儲存在您的瀏覽器中
- **多交易所** - 每個交易所獨立儲存分析結果

---

## License

MIT License

---

## 致謝

感謝 paulwei 交易員提供 Read-Only API，讓這個學習平台得以持續改進。

**免責聲明：本平台僅供學習和研究使用，不構成任何投資建議。加密貨幣交易具有高風險，請謹慎投資。**
