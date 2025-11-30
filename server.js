// server.js — Render에서 돌아가는 백엔드 프록시

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/**
 * 헬스 체크용
 */
app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/**
 * 1) 기본 프록시 (node-fetch 사용)
 *    /kra-proxy?url=...
 */
app.get('/kra-proxy', async (req, res) => {
  const target = req.query.url;

  if (!target) {
    return res.status(400).json({ error: 'url parameter required' });
  }

  try {
    const response = await fetch(target, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 15000
    });

    const contentType = response.headers.get('content-type') || 'text/plain';
    const text = await response.text();

    res.set('Content-Type', contentType);
    res.set('Access-Control-Allow-Origin', '*');
    res.status(response.status).send(text);
  } catch (err) {
    console.error('[kra-proxy] error:', err);
    res
      .status(502)
      .json({ error: 'fetch failed', message: err.message || String(err) });
  }
});

/**
 * 2) Puppeteer 프록시
 *    /kra-puppeteer?url=...
 */
app.get('/kra-puppeteer', async (req, res) => {
  const target = req.query.url;

  if (!target) {
    return res.status(400).json({ error: 'url parameter required' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.goto(target, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    const html = await page.content();

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Access-Control-Allow-Origin', '*');
    res.status(200).send(html);
  } catch (err) {
    console.error('[kra-puppeteer] error:', err);
    res
      .status(502)
      .json({ error: 'puppeteer failed', message: err.message || String(err) });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
});

app.listen(PORT, () => {
  console.log(`KRA backend listening on port ${PORT}`);
});
