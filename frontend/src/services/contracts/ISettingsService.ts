import { AppSettings } from '@/types';

export interface ISettingsService {
  getSettings(): Promise<AppSettings>;
  updateSettings(partial: Partial<AppSettings>): Promise<AppSettings>;
  resetToDefaults(): Promise<AppSettings>;
}

