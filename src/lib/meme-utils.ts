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

export interface UpcomingMemeResult {
  meme: MemeItem;
  daysRemaining: number;
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

export function getMemesForDate(all: MemeItem[], month: number, day: number): MemeItem[] {
  return all.filter(m => {
    if (m.date.month === null) {
      return m.date.day === day;
    }
    return m.date.month === month && m.date.day === day;
  });
}

export function getUpcomingMeme(all: MemeItem[], todayMonth: number, todayDay: number, currentYear: number): UpcomingMemeResult | null {
  if (!all || all.length === 0) return null;

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
