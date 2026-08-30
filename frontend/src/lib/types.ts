export interface InkStroke {
  tool: "pen" | "eraser";
  color: string;
  width: number;
  points: [number, number, number][];
}

export interface InkData {
  version: 1;
  page: { w: number; h: number };
  strokes: InkStroke[];
}

export interface Note {
  id: number;
  title: string;
  body: string;
  ink: InkData | null;
  reminder_at: string | null;
  source: string;
  synced_to_ios: boolean;
  created_at: string;
}