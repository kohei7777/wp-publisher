export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'タイトルと本文が必要です' });

  const auth = Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString('base64');

  try {
    const response = await fetch(process.env.WP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        title,
        content,
        status: 'publish',
        categories: [Number(process.env.WP_CATEGORY)]
      })
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({ error: `WordPress APIエラー: レスポンスがJSONではありません (HTTP ${response.status})`, detail: text.substring(0, 500) });
    }
    if (data.id) {
      res.json({ success: true, id: data.id, link: data.link });
    } else {
      res.status(500).json({ error: '公開に失敗しました', detail: data });
    }
  } catch (err) {
    res.status(500).json({ error: `WordPress APIエラー: ${err.message}`, env_check: { hasUrl: !!process.env.WP_URL, hasUser: !!process.env.WP_USER, hasPass: !!process.env.WP_APP_PASSWORD } });
  }
}
