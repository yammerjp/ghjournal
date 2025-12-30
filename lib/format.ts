import Ionicons from '@expo/vector-icons/Ionicons';
import { Weather } from './entry';

// Date formatting utilities

export const formatDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const formatDateShort = (d: Date): string => {
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export const formatDateTime = (isoStr: string): string => {
  const d = new Date(isoStr);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hour}:${min}`;
};

export const generateTitle = (content: string): string => {
  if (!content.trim()) return '';
  const firstLine = content.split('\n')[0].trim();
  return firstLine.slice(0, 20) + (firstLine.length > 20 ? '...' : '');
};

// Weather formatting utilities

export const getWeatherIcon = (wmoCode: number | null): { name: keyof typeof Ionicons.glyphMap; color: string } => {
  if (wmoCode === null) return { name: 'help-outline', color: '#999' };
  if (wmoCode <= 1) return { name: 'sunny', color: '#f97316' };
  if (wmoCode <= 3) return { name: 'cloudy', color: '#6b7280' };
  if (wmoCode <= 48) return { name: 'cloudy', color: '#6b7280' };
  if (wmoCode <= 67) return { name: 'rainy', color: '#3b82f6' };
  if (wmoCode <= 77) return { name: 'snow', color: '#22d3ee' };
  if (wmoCode <= 82) return { name: 'rainy', color: '#3b82f6' };
  if (wmoCode <= 86) return { name: 'snow', color: '#22d3ee' };
  return { name: 'thunderstorm', color: '#8b5cf6' };
};

export const formatTemperature = (weather: Weather | null): string | null => {
  if (!weather) return null;
  return `${weather.temperatureMin}℃〜${weather.temperatureMax}℃`;
};
