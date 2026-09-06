import fs from 'node:fs';
import path from 'node:path';

export * from './meme-utils';
import type { MemeItem, UpcomingMemeResult } from './meme-utils';
import {
  getTodayKST as getTodayKSTPure,
  getMemesForDate as getMemesForDatePure,
  getUpcomingMeme as getUpcomingMemePure,
} from './meme-utils';

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

export function getMemesForDate(month: number, day: number, allMemesList?: MemeItem[]): MemeItem[] {
  return getMemesForDatePure(allMemesList || getAllMemes(), month, day);
}

export function getTodayKST(): { month: number; day: number; year: number } {
  return getTodayKSTPure();
}

export function getUpcomingMeme(todayMonth: number, todayDay: number, currentYear: number, allMemesList?: MemeItem[]): UpcomingMemeResult | null {
  return getUpcomingMemePure(allMemesList || getAllMemes(), todayMonth, todayDay, currentYear);
}

