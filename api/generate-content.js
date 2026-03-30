import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { title, description, url, rawText } = req.body;
  if (!title && !rawText) return res.status(400).json({ error: 'タイトルまたはテキストが必要です' });

  const today = new Date().toISOString().split('T')[0];

  let prompt;
  if (rawText) {
    // テキスト貼り付けモード
    prompt = `あなたはキープレイヤーズ（代表：高野）の広報担当です。
以下に貼り付けられたイベント情報テキストをもとに、WordPress投稿用の「タイトル」と「本文HTML」を生成してください。

【貼り付けられたテキスト】
${rawText}

【今日の日付（入力日）】${today}

【時制ルール（最重要）】
- テキストから開催日・掲載日を読み取ること
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
- 貼り付けられたテキストをそのままコピーせず、必ず自分の言葉で言い換えること
- HTML形式（<p>タグで段落を区切る）
- 1段落目：イベント名や記事名を紹介し、弊社代表高野が何をしたか（登壇/取材/掲載など）を簡潔に書く
  - テキスト内にURLがあれば <a href="URL" target="_blank" rel="noreferrer noopener">『イベント名』</a> の形式でリンクにする
  - URLがなければリンクなしで『イベント名』と書く
- 2段落目：セッション内容や共演者など、テキストから読み取れる詳細を言い換えて記述（情報がなければ省略可）
- 最終段落：過去形→「このような貴重な機会をいただき、関係者の皆様に心より感謝申し上げます。ありがとうございました！」、未来形→「皆様のご参加をお待ちしております。」

【出力形式】
以下のJSON形式のみ出力。説明や前置きは不要。
{"title": "タイトル文字列", "content": "<p>本文HTML</p>"}`;
  } else {
    // URL取得モード
    prompt = `あなたはキープレイヤーズ（代表：高野）の広報担当です。
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
{"title": "タイトル文字列", "content": "<p>本文HTML</p>"}`;
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    let text = message.content[0].text;
    text = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(text);
    res.json({ title: parsed.title, content: parsed.content });
  } catch (err) {
    res.status(500).json({ error: `AI生成エラー: ${err.message}` });
  }
}
