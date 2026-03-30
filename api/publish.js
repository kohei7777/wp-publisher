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
}
