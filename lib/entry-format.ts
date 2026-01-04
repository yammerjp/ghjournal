import { Entry } from './entry';

/**
 * Parse markdown frontmatter and body
 */
export function parseMarkdownFrontmatter(markdown: string): { frontmatter: string; body: string } {
  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!frontmatterMatch) {
    return { frontmatter: '', body: markdown.trim() };
  }

  return {
    frontmatter: frontmatterMatch[1],
    body: frontmatterMatch[2].trim(),
  };
}

/**
 * Simple YAML-like frontmatter parser
 */
function parseFrontmatter(frontmatter: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = frontmatter.split('\n');

  let currentSection: string | null = null;
  let sectionData: Record<string, unknown> = {};

  for (const line of lines) {
    // Skip empty lines
    if (line.trim() === '') continue;

    // Check for section start (no indentation, ends with colon, no value)
    const sectionMatch = line.match(/^([a-z_]+):$/);
    if (sectionMatch) {
      // Save previous section if exists
      if (currentSection) {
        result[currentSection] = sectionData;
      }
      currentSection = sectionMatch[1];
      sectionData = {};
      continue;
    }

    // Check for indented property (inside section)
    const indentedMatch = line.match(/^  ([a-z_]+): (.+)$/);
    if (indentedMatch && currentSection) {
      const [, key, value] = indentedMatch;
      sectionData[key] = parseValue(value);
      continue;
    }

    // Check for top-level property
    const topLevelMatch = line.match(/^([a-z_]+): (.+)$/);
    if (topLevelMatch) {
      // Save previous section if exists
      if (currentSection) {
        result[currentSection] = sectionData;
        currentSection = null;
        sectionData = {};
      }
      const [, key, value] = topLevelMatch;
      result[key] = parseValue(value);
    }
  }

  // Save last section if exists
  if (currentSection) {
    result[currentSection] = sectionData;
  }

  return result;
}

/**
 * Parse a YAML value (number, string)
 */
function parseValue(value: string): string | number {
  // Try to parse as number
  const num = Number(value);
  if (!isNaN(num) && value !== '') {
    return num;
  }
  return value;
}

/**
 * Convert Entry to Markdown format with frontmatter
 */
export function entryToMarkdown(entry: Entry): string {
  const lines: string[] = ['---'];

  // Title (only if not empty)
  if (entry.title) {
    lines.push(`title: ${entry.title}`);
  }

  // Date (required)
  lines.push(`date: ${entry.date}`);

  // Location (if any location field is set)
  if (entry.location_latitude !== null || entry.location_longitude !== null) {
    lines.push('location:');
    if (entry.location_latitude !== null) {
      lines.push(`  latitude: ${entry.location_latitude}`);
    }
    if (entry.location_longitude !== null) {
      lines.push(`  longitude: ${entry.location_longitude}`);
    }
    if (entry.location_description) {
      lines.push(`  description: ${entry.location_description}`);
    }
    if (entry.location_city) {
      lines.push(`  city: ${entry.location_city}`);
    }
  }

  // Weather (if any weather field is set)
  if (entry.weather_wmo_code !== null || entry.weather_description) {
    lines.push('weather:');
    if (entry.weather_wmo_code !== null) {
      lines.push(`  wmo_code: ${entry.weather_wmo_code}`);
    }
    if (entry.weather_description) {
      lines.push(`  description: ${entry.weather_description}`);
    }
    if (entry.weather_temperature_min !== null) {
      lines.push(`  temperature_min: ${entry.weather_temperature_min}`);
    }
    if (entry.weather_temperature_max !== null) {
      lines.push(`  temperature_max: ${entry.weather_temperature_max}`);
    }
  }

  // Timestamps
  lines.push(`created_at: ${entry.created_at}`);
  lines.push(`updated_at: ${entry.updated_at}`);

  lines.push('---');

  // Content
  if (entry.content) {
    lines.push('');
    lines.push(entry.content);
  }

  return lines.join('\n');
}

/**
 * Convert Markdown with frontmatter to Entry
 */
export function markdownToEntry(markdown: string, id: string): Entry {
  const { frontmatter, body } = parseMarkdownFrontmatter(markdown);
  const data = parseFrontmatter(frontmatter);

  const location = data.location as Record<string, unknown> | undefined;
  const weather = data.weather as Record<string, unknown> | undefined;

  return {
    id,
    date: String(data.date ?? ''),
    title: String(data.title ?? ''),
    content: body,
    location_latitude: location?.latitude as number | null ?? null,
    location_longitude: location?.longitude as number | null ?? null,
    location_description: location?.description as string | null ?? null,
    location_city: location?.city as string | null ?? null,
    weather_wmo_code: weather?.wmo_code as number | null ?? null,
    weather_description: weather?.description as string | null ?? null,
    weather_temperature_min: weather?.temperature_min as number | null ?? null,
    weather_temperature_max: weather?.temperature_max as number | null ?? null,
    weather_symbol_name: weather?.symbol_name as string | null ?? null,
    created_at: String(data.created_at ?? ''),
    updated_at: String(data.updated_at ?? ''),
    sync_status: 'committed',
    synced_sha: null,
  };
}
