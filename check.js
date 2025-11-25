import axios from "axios";
import Parser from "rss-parser";
import fs from "fs";

const parser = new Parser();

// 모니터링할 트위터 계정 (원하는 만큼 추가 가능)
const ACCOUNTS = {
  T1LoL: "https://nitter.net/T1LoL/rss"
};

const CACHE_FILE = "last_ids.json";
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const DEBUG = process.env.DEBUG; // "mini" 또는 undefined

// 미니 테스트 모드에서 보낼 트윗 개수
const MINI_LIMIT = 3;

function loadCache() {
  if (fs.existsSync(CACHE_FILE)) {
    return JSON.parse(fs.readFileSync(CACHE_FILE));
  }
  return {};
}

function saveCache(data) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data));
}

async function sendDiscord(username, url, content) {
  await axios.post(WEBHOOK_URL, {
    content: `**${username}** 새 트윗!\n${url}\n\n${content}`
  });
}

async function checkTweets() {
  const lastIds = loadCache();
  const updated = { ...lastIds };

  for (const [username, rss] of Object.entries(ACCOUNTS)) {
    try {
      const feed = await parser.parseURL(rss);
      if (!feed.items) continue;

      const items = feed.items.reverse(); // 오래된 → 최신 순서

      // -----------------------------
      // 🔥 미니 테스트 모드 (최신 3개만 전송)
      // -----------------------------
      if (DEBUG === "mini") {
        console.log(`[DEBUG mini] 최신 ${MINI_LIMIT}개 전송`);
        const latestItems = items.slice(-MINI_LIMIT);
        for (const item of latestItems) {
          await sendDiscord(username, item.link, item.title);
        }
        continue;
      }

      // -----------------------------
      // ✔ 운영 모드
      // -----------------------------
      let lastSent = lastIds[username];

      for (const item of items) {
        const tweetId = item.id;
        const tweetUrl = item.link;
        const content = item.title;

        // 첫 실행이면 기준만 저장하고 알림 보낼 필요 없음
        if (!lastSent) {
          updated[username] = tweetId;
          continue;
        }

        // lastSent 이후의 트윗이면 전송
        if (tweetId > lastSent) {
          console.log(`[SEND] ${username}: ${tweetUrl}`);
          await sendDiscord(username, tweetUrl, content);
          updated[username] = tweetId;
        }
      }

    } catch (err) {
      console.log(`${username} 에러: ${err.message}`);
    }
  }

  // 미니 테스트 모드에서는 저장하지 않음
  if (DEBUG !== "mini") {
    saveCache(updated);
  }
}

await checkTweets();
