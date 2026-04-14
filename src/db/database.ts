import Dexie, { type Table } from 'dexie';

export type CaptureState =
  | 'imported'
  | 'processing'
  | 'completed'
  | 'confirmed'
  | 'exported'
  | 'failed';

export interface CaptureItem {
  id?: number;
  imageBlob: Blob;
  thumbnailBlob?: Blob;
  rawText: string;
  cleanedText: string;
  summary: string;
  tags: string[];
  sourceApp: string;
  editedText?: string;
  createdAt: Date;
  imageHash: string;
  state: CaptureState;
  confidence: number;
  groupId?: string;
}

class CaptureDatabase extends Dexie {
  captures!: Table<CaptureItem, number>;

  constructor() {
    super('sns-capture-db');

    this.version(1).stores({
      captures: '++id, imageHash, state, sourceApp, createdAt, groupId, *tags',
    });

    // v2: imageHash를 유니크 인덱스로 변경
    this.version(2).stores({
      captures: '++id, &imageHash, state, sourceApp, createdAt, groupId, *tags',
    });
  }
}

export const db = new CaptureDatabase();
