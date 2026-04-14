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

    this.version(3).stores({
      captures: '++id, &imageHash, state, sourceApp, createdAt, groupId, *tags',
    });
  }
}

export const db = new CaptureDatabase();
