import Dexie from 'dexie';
import { db, type CaptureItem } from './database';

/**
 * Blob에서 해시를 생성한다.
 * HTTPS에서는 SHA-256, HTTP에서는 간단한 해시 사용.
 */
export async function generateImageHash(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();

  // crypto.subtle은 HTTPS(secure context)에서만 사용 가능
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // HTTP 폴백: 파일 크기 + 첫/중간/끝 바이트 조합으로 해시 생성
  const bytes = new Uint8Array(buffer);
  const len = bytes.length;
  let hash = len;
  const step = Math.max(1, Math.floor(len / 1024));
  for (let i = 0; i < len; i += step) {
    hash = ((hash << 5) - hash + bytes[i]) | 0;
  }
  return `simple-${len}-${(hash >>> 0).toString(16)}`;
}

/**
 * 해당 해시를 가진 캡처가 이미 존재하는지 확인한다.
 */
export async function checkDuplicate(hash: string): Promise<boolean> {
  const existing = await db.captures.where('imageHash').equals(hash).first();
  return existing !== undefined;
}

/**
 * Blob을 200px 너비로 리사이즈한 썸네일을 생성한다.
 * OffscreenCanvas 미지원 시 일반 Canvas 사용, 그것도 안 되면 원본 반환.
 */
export async function generateThumbnail(blob: Blob): Promise<Blob> {
  const THUMB_WIDTH = 200;

  try {
    // 방법 1: OffscreenCanvas (최신 브라우저)
    if (typeof OffscreenCanvas !== 'undefined') {
      const bitmap = await createImageBitmap(blob);
      const scale = THUMB_WIDTH / bitmap.width;
      const thumbHeight = Math.round(bitmap.height * scale);
      const canvas = new OffscreenCanvas(THUMB_WIDTH, thumbHeight);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, THUMB_WIDTH, thumbHeight);
        bitmap.close();
        return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
      }
    }
  } catch {
    // 폴백으로 진행
  }

  try {
    // 방법 2: 일반 Canvas (DOM)
    const bitmap = await createImageBitmap(blob);
    const scale = THUMB_WIDTH / bitmap.width;
    const thumbHeight = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = THUMB_WIDTH;
    canvas.height = thumbHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(bitmap, 0, 0, THUMB_WIDTH, thumbHeight);
      bitmap.close();
      return new Promise<Blob>((resolve) => {
        canvas.toBlob(
          (b) => resolve(b ?? blob),
          'image/jpeg',
          0.7
        );
      });
    }
  } catch {
    // 폴백으로 진행
  }

  // 방법 3: 썸네일 생성 실패 시 원본 반환
  return blob;
}

/**
 * 이미지를 캡처 DB에 추가한다. 해시 기반 중복 체크를 수행한다.
 * 중복이면 에러를 던진다.
 * @returns 새로 생성된 캡처의 id
 */
export async function addCapture(imageBlob: Blob): Promise<number> {
  const imageHash = await generateImageHash(imageBlob);
  const thumbnailBlob = await generateThumbnail(imageBlob);

  const item: CaptureItem = {
    imageBlob,
    thumbnailBlob,
    rawText: '',
    cleanedText: '',
    summary: '',
    tags: [],
    sourceApp: '',
    createdAt: new Date(),
    imageHash,
    state: 'imported',
    confidence: 0,
  };

  try {
    const id = await db.transaction('rw', db.captures, () =>
      db.captures.add(item)
    );
    return id as number;
  } catch (error) {
    if (error instanceof Dexie.ConstraintError) {
      throw new Error(`중복 이미지입니다 (hash: ${imageHash.slice(0, 12)}...)`);
    }
    throw error;
  }
}

/**
 * 캡처 항목을 부분 업데이트한다.
 */
export async function updateCapture(
  id: number,
  data: Partial<CaptureItem>,
): Promise<void> {
  const count = await db.captures.update(id, data);
  if (count === 0) {
    throw new Error(`캡처를 찾을 수 없습니다 (id: ${id})`);
  }
}

/**
 * Inbox 항목을 반환한다 (imported / processing / completed).
 * 최신 순으로 정렬한다.
 */
export async function getInbox(): Promise<CaptureItem[]> {
  return db.captures
    .where('state')
    .anyOf(['imported', 'processing', 'completed', 'failed'])
    .reverse()
    .sortBy('createdAt');
}

/**
 * 확인 완료된 항목을 반환한다 (confirmed).
 * 최신 순으로 정렬한다.
 */
export async function getConfirmed(): Promise<CaptureItem[]> {
  return db.captures
    .where('state')
    .equals('confirmed')
    .reverse()
    .sortBy('createdAt');
}

/**
 * cleanedText에서 쿼리 문자열을 검색한다 (대소문자 무시).
 */
export async function searchCaptures(query: string): Promise<CaptureItem[]> {
  const lowerQuery = query.toLowerCase();
  return db.captures
    .filter((item) => item.cleanedText.toLowerCase().includes(lowerQuery))
    .toArray();
}

/**
 * 특정 태그를 가진 캡처를 필터링한다.
 */
export async function filterByTag(tag: string): Promise<CaptureItem[]> {
  return db.captures.where('tags').equals(tag).toArray();
}

/**
 * 특정 소스 앱의 캡처를 필터링한다.
 */
export async function filterBySource(source: string): Promise<CaptureItem[]> {
  return db.captures.where('sourceApp').equals(source).toArray();
}

/**
 * DB에 저장된 모든 태그를 중복 없이 반환한다.
 */
export async function getAllTags(): Promise<string[]> {
  const allItems = await db.captures.toArray();
  const tagSet = new Set<string>();
  for (const item of allItems) {
    for (const tag of item.tags) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
}
