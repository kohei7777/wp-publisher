export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 認証情報をフロントに返す（フロントからWordPressに直接POSTするため）
  const auth = Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString('base64');
  res.json({
    wpUrl: process.env.WP_URL,
    auth,
    category: Number(process.env.WP_CATEGORY)
  });
}
