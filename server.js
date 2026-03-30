require('dotenv').config({ override: true });
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const anthropic = new Anthropic();

// URLからページのタイトルとメタ情報を取得
app.post('/api/fetch-url', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URLが必要です' });

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
    });
    const html = await response.text();

    // タイトル抽出
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // meta description抽出
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : '';

    // OGP画像抽出
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    const ogImage = ogImageMatch ? ogImageMatch[1].trim() : '';

    res.json({ title, description, ogImage, url });
  } catch (err) {
    res.status(500).json({ error: `URL取得エラー: ${err.message}` });
  }
});

// AIで本文を生成
app.post('/api/generate-content', async (req, res) => {
  const { title, description, url } = req.body;
  if (!title) return res.status(400).json({ error: 'タイトルが必要です' });

  const today = new Date().toISOString().split('T')[0];

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `あなたはキープレイヤーズ（代表：高野）の広報担当です。
以下の情報をもとに、WordPress投稿用の「タイトル」と「本文HTML」を生成してください。

【元ページのタイトル】${title}
【元ページのdescription】${description || 'なし'}
【元ページのURL】${url}
【今日の日付（入力日）】${today}

【時制ルール（最重要）】
- ページ内容から開催日・掲載日を読み取ること
- 開催日が入力日（${today}）以前 → 過去形（「登壇しました」「参加しました」「掲載されました」）
- 開催日が入力日（${today}）より後 → 未来形（「登壇します」「参加します」「掲載されます」）
- 開催日が不明な場合は過去形をデフォルトとする
- タイトルと本文の両方で時制を統一すること

【タイトルのルール】
- 形式例（過去形）：「〇〇〇〇『イベント名』に弊社代表高野が登壇しました」
- 形式例（未来形）：「〇〇〇〇『イベント名』に弊社代表高野が登壇します」
- 冒頭にイベントの特徴を簡潔に入れる（例：「完全招待制ビジネスカンファレンス」「日本最大級のHRカンファレンス」）
- イベント名は『』で囲む
- 末尾は「弊社代表高野が〇〇しました/します」

【本文のルール】
- descriptionの文章をそのままコピーせず、必ず自分の言葉で言い換えること
- HTML形式（<p>タグで段落を区切る）
- 1段落目：イベント名や記事名をリンク付きで紹介し、弊社代表高野が何をしたか（登壇/取材/掲載など）を簡潔に書く
  - リンクは <a href="${url}" target="_blank" rel="noreferrer noopener">『イベント名』</a> の形式
- 2段落目：セッション内容や共演者など、descriptionから読み取れる詳細を言い換えて記述（情報がなければ省略可）
- 最終段落：過去形→「このような貴重な機会をいただき、関係者の皆様に心より感謝申し上げます。ありがとうございました！」、未来形→「皆様のご参加をお待ちしております。」

【出力形式】
以下のJSON形式のみ出力。説明や前置きは不要。
{"title": "タイトル文字列", "content": "<p>本文HTML</p>"}`
      }]
    });

    let text = message.content[0].text;
    // コードブロック記法が含まれていた場合は除去
    text = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(text);
    res.json({ title: parsed.title, content: parsed.content });
  } catch (err) {
    res.status(500).json({ error: `AI生成エラー: ${err.message}` });
  }
});

// WordPressに公開
app.post('/api/publish', async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'タイトルと本文が必要です' });

  const auth = Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString('base64');

  try {
    const response = await fetch(process.env.WP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({
        title,
        content,
        status: 'publish',
        categories: [Number(process.env.WP_CATEGORY)]
      })
    });

    const data = await response.json();
    if (data.id) {
      res.json({ success: true, id: data.id, link: data.link });
    } else {
      res.status(500).json({ error: '公開に失敗しました', detail: data });
    }
  } catch (err) {
    res.status(500).json({ error: `WordPress APIエラー: ${err.message}` });
  }
});

const PORT = process.env.PORT || 3456;
app.listen(PORT, () => {
  console.log(`WP Publisher running at http://localhost:${PORT}`);
});
