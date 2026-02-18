/**
 * Validation Engine - логическая валидация консистентности мира
 * - Смерть персонажа (появление после смерти)
 * - Конфликты владения предметами
 * - Конфликты локаций
 * - Нарушения таймлайна
 */

export interface ValidationIssue {
  type: 'character_death' | 'item_ownership' | 'location_overlap' | 'timeline_violation';
  severity: 'error' | 'warning';
  message: string;
  entityId?: string;
  chapterId?: string;
  sceneId?: string;
}

export interface Character {
  id: string;
  name: string;
  is_alive: boolean;
  death_chapter_id?: string;
  death_scene_id?: string;
}

export interface EntityAppearance {
  entity_type: string;
  entity_id: string;
  chapter_id?: string;
  scene_id?: string;
}

export function validateCharacterDeath(
  character: Character,
  appearances: EntityAppearance[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!character.is_alive && character.death_chapter_id) {
    const deathOrder = appearances.find(
      (a) => a.chapter_id === character.death_chapter_id
    );
    if (deathOrder) {
      const afterDeath = appearances.filter((a) => {
        if (!a.chapter_id) return false;
        return a.chapter_id !== character.death_chapter_id;
      });
      for (const app of afterDeath) {
        issues.push({
          type: 'character_death',
          severity: 'error',
          message: `Персонаж "${character.name}" появляется после смерти`,
          entityId: character.id,
          chapterId: app.chapter_id,
        });
      }
    }
  }
  return issues;
}

export function validateItemOwnership(
  ownerships: Array<{
    item_id: string;
    owner_character_id?: string;
    from_chapter_id?: string;
    to_chapter_id?: string;
  }>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byItem = new Map<string, typeof ownerships>();
  for (const o of ownerships) {
    if (!byItem.has(o.item_id)) byItem.set(o.item_id, []);
    byItem.get(o.item_id)!.push(o);
  }
  for (const [itemId, list] of byItem) {
    const sorted = [...list].sort((a, b) =>
      (a.from_chapter_id || '').localeCompare(b.from_chapter_id || '')
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (prev.to_chapter_id && curr.from_chapter_id) {
        if (prev.to_chapter_id > curr.from_chapter_id) {
          issues.push({
            type: 'item_ownership',
            severity: 'error',
            message: 'Конфликт владения предметом: перекрывающиеся периоды',
            entityId: itemId,
          });
        }
      }
    }
  }
  return issues;
}
