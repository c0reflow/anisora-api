import { prisma } from '../db/prisma';

export const HOME_SECTIONS = [
  'spotlight',
  'trending',
  'top_airing',
  'most_popular',
  'most_favorite',
  'latest_completed',
  'latest_episodes',
  'new_on_anisora',
  'top_upcoming',
  'this_season',
  'next_season',
  'popular_movies',
  'popular_series',
] as const;

export type HomeSectionKey = (typeof HOME_SECTIONS)[number];

export class HomeAdminService {
  /**
   * Retrieves all home sections
   */
  static async getHomeData(): Promise<Record<string, any>> {
    const record = await prisma.home.findFirst({
      where: { id: 'current' },
    });
    if (!record || !record.data) {
      return {};
    }
    return record.data as Record<string, any>;
  }

  /**
   * Retrieves a specific section from home
   */
  static async getSection(section: string): Promise<any[]> {
    const home = await this.getHomeData();
    return Array.isArray(home[section]) ? home[section] : [];
  }

  /**
   * Updates an entire section with a new ordered list
   */
  static async updateSection(section: string, items: any[]): Promise<any[]> {
    const home = await this.getHomeData();

    // Re-index / update rank or spotlight_badge if spotlight
    const orderedItems = items.map((item, index) => {
      const updated = { ...item, rank: index + 1 };
      if (section === 'spotlight') {
        updated.spotlight_badge = `#${index + 1} Spotlight`;
      }
      return updated;
    });

    home[section] = orderedItems;
    home.updated_at = new Date().toISOString();

    await prisma.home.upsert({
      where: { id: 'current' },
      update: {
        data: home,
        updated_at: new Date(),
      },
      create: {
        id: 'current',
        data: home,
        updated_at: new Date(),
      },
    });

    return orderedItems;
  }

  /**
   * Adds an anime to a section at a specific position (default: start)
   */
  static async addItemToSection(section: string, animeCard: any, position?: number): Promise<any[]> {
    const list = await this.getSection(section);

    // Remove if already exists in this section
    const filtered = list.filter((item: any) => String(item.id || item.anisora_id) !== String(animeCard.id));

    const insertIdx = position !== undefined && position >= 0 && position <= filtered.length
      ? position
      : 0; // Default add to top

    filtered.splice(insertIdx, 0, animeCard);

    return this.updateSection(section, filtered);
  }

  /**
   * Removes an anime from a section
   */
  static async removeItemFromSection(section: string, animeId: string): Promise<any[]> {
    const list = await this.getSection(section);
    const filtered = list.filter((item: any) => String(item.id || item.anisora_id) !== String(animeId));
    return this.updateSection(section, filtered);
  }

  /**
   * Reorders an entire section by an array of anime IDs
   */
  static async reorderSection(section: string, orderedIds: string[]): Promise<any[]> {
    const list = await this.getSection(section);
    const map = new Map<string, any>();
    for (const item of list) {
      const id = String(item.id || item.anisora_id);
      map.set(id, item);
    }

    const reordered: any[] = [];
    for (const id of orderedIds) {
      if (map.has(String(id))) {
        reordered.push(map.get(String(id)));
        map.delete(String(id));
      }
    }

    // Append any items that were in the original list but omitted from orderedIds
    for (const remaining of map.values()) {
      reordered.push(remaining);
    }

    return this.updateSection(section, reordered);
  }
}

