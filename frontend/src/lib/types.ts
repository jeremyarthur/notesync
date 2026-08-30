export interface Note {
  id: number;
  title: string;
  body: string;
  reminder_at: string | null;
  source: string;
  synced_to_ios: boolean;
  created_at: string;
}