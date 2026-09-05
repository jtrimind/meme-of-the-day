import fs from 'node:fs';
import path from 'node:path';

export interface MemeItem {
  id: string;
  fileName: string;
  title: string;
  date: {
    month: number | null; // null이면 매월 반복
    day: number;
    year: number | null;
    isRecurring: boolean;
    isMonthly?: boolean;
  };
  formattedDate: string; // 예: "9월 1일" 또는 "2000년 9월 1일" 또는 "매월 20일"
  media: {
    url: string;
    type: 'image' | 'video' | 'gif';
    fileName: string;
  };
  tagline?: string;
  description?: string;
  source?: {
    origin?: string;
    url?: string;
  };
  tags: string[];
}

const mediaDir = path.resolve(process.cwd(), 'data/media');
const jsonPath = path.resolve(process.cwd(), 'data/memes.json');

export function getAllMemes(): MemeItem[] {
  if (!fs.existsSync(mediaDir)) return [];

  const files = fs.readdirSync(mediaDir).filter(f => f !== '.gitkeep' && !f.startsWith('.'));

  // 선택적 memes.json 로드
  let extraMetadataMap: Record<string, Partial<MemeItem>> = {};
  if (fs.existsSync(jsonPath)) {
    try {
      const raw = fs.readFileSync(jsonPath, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item.id) extraMetadataMap[item.id] = item;
          if (item.fileName) extraMetadataMap[item.fileName] = item;
        }
      }
    } catch (e) {
      console.warn('Failed to parse data/memes.json:', e);
    }
  }

  // YYYY-09-01_name.ext 또는 YYYY-MM-20.gif 또는 2022-10-31_name.png 등 유연하게 매칭
  const memePattern = /^(\d{4}|[xX]{4}|[yY]{4})-([01]\d|[mM]{2})-([0-3]\d)(?:[_-](.+))?\.([a-zA-Z0-9]+)$/;

  const memes: MemeItem[] = [];

  for (const file of files) {
    const match = file.match(memePattern);
    if (!match) continue;

    const [, yearStr, monthStr, dayStr, rawSlug, ext] = match;
    const isYearExplicit = !yearStr.toLowerCase().includes('x') && !yearStr.toLowerCase().includes('y') && yearStr !== '0000';
    const year = isYearExplicit ? parseInt(yearStr, 10) : null;

    const isMonthly = monthStr.toLowerCase().includes('m');
    const month = isMonthly ? null : parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);

    const extLower = ext.toLowerCase();
    const mediaType = ['mp4', 'webm'].includes(extLower)
      ? 'video'
      : extLower === 'gif'
        ? 'gif'
        : 'image';

    const slug = rawSlug ? rawSlug.replace(/[-_]/g, ' ').trim() : (isMonthly ? `매월 ${day}일 밈` : `${month}월 ${day}일 밈`);
    const defaultTitle = slug;

    let formattedDate = '';
    if (isMonthly) {
      formattedDate = `매월 ${day}일`;
    } else if (year) {
      formattedDate = `${year}년 ${month}월 ${day}일`;
    } else {
      formattedDate = `${month}월 ${day}일`;
    }

    const id = file.replace(/\.[^/.]+$/, '');

    // 기본 데이터
    const baseMeme: MemeItem = {
      id,
      fileName: file,
      title: defaultTitle,
      date: {
        month,
        day,
        year,
        isRecurring: !isYearExplicit,
        isMonthly,
      },
      formattedDate,
      media: {
        url: `/data/media/${encodeURIComponent(file)}`,
        type: mediaType,
        fileName: file,
      },
      tags: isMonthly ? [`매월 ${day}일`, defaultTitle] : [`${month}월 ${day}일`, defaultTitle],
    };

    // memes.json 메타데이터 머지
    const extra = extraMetadataMap[id] || extraMetadataMap[file];
    if (extra) {
      if (extra.title) baseMeme.title = extra.title;
      if (extra.tagline) baseMeme.tagline = extra.tagline;
      if (extra.description) baseMeme.description = extra.description;
      if (extra.source) baseMeme.source = extra.source;
      if (extra.tags && Array.isArray(extra.tags)) {
        baseMeme.tags = Array.from(new Set([...baseMeme.tags, ...extra.tags]));
      }
    }

    memes.push(baseMeme);
  }

  // 날짜 순 정렬 (월, 일 순, 매월 반복은 0월로 취급)
  return memes.sort((a, b) => {
    const monthA = a.date.month ?? 0;
    const monthB = b.date.month ?? 0;
    if (monthA !== monthB) return monthA - monthB;
    return a.date.day - b.date.day;
  });
}

export function getMemesForDate(month: number, day: number): MemeItem[] {
  const all = getAllMemes();
  return all.filter(m => {
    if (m.date.month === null) {
      return m.date.day === day;
    }
    return m.date.month === month && m.date.day === day;
  });
}

export function getTodayKST(): { month: number; day: number; year: number } {
  const now = new Date();
  const kstOffset = 9 * 60; // UTC+9
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kstDate = new Date(utc + kstOffset * 60000);

  return {
    year: kstDate.getFullYear(),
    month: kstDate.getMonth() + 1,
    day: kstDate.getDate(),
  };
}

export interface UpcomingMemeResult {
  meme: MemeItem;
  daysRemaining: number;
}

export function getUpcomingMeme(todayMonth: number, todayDay: number, currentYear: number): UpcomingMemeResult | null {
  const all = getAllMemes();
  if (all.length === 0) return null;

  // 오늘 00:00:00 기준 시간
  const today = new Date(currentYear, todayMonth - 1, todayDay);

  let closestMeme: MemeItem | null = null;
  let minDiffDays = Infinity;

  for (const meme of all) {
    let target: Date;

    if (meme.date.month === null) {
      // 매월 반복 밈
      if (meme.date.day === todayDay) continue; // 오늘이면 제외
      if (meme.date.day > todayDay) {
        // 이번 달 해당 날짜
        target = new Date(currentYear, todayMonth - 1, meme.date.day);
      } else {
        // 다음 달 해당 날짜
        target = new Date(currentYear, todayMonth, meme.date.day);
      }
    } else {
      // 연간/고정 밈
      if (meme.date.month === todayMonth && meme.date.day === todayDay) continue;

      target = new Date(currentYear, meme.date.month - 1, meme.date.day);
      if (target.getTime() < today.getTime()) {
        target = new Date(currentYear + 1, meme.date.month - 1, meme.date.day);
      }
    }

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0 && diffDays < minDiffDays) {
      minDiffDays = diffDays;
      closestMeme = meme;
    }
  }

  if (!closestMeme) return null;

  return {
    meme: closestMeme,
    daysRemaining: minDiffDays,
  };
}

