import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { fiscalSequences } from '@/db/schema'

export async function nextCrSequence(businessId: string, docType = 'FE'): Promise<{
  consecutive: string
  establishment: string
  terminal: string
}> {
  // Try atomic increment first (covers the steady-state case)
  const [updated] = await db
    .update(fiscalSequences)
    .set({
      lastSequence: sql`${fiscalSequences.lastSequence} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(fiscalSequences.businessId, businessId), eq(fiscalSequences.docType, docType)))
    .returning()

  if (updated) {
    return {
      consecutive:  String(updated.lastSequence).padStart(10, '0'),
      establishment: updated.establishment,
      terminal:      updated.terminal,
    }
  }

  // First use: INSERT ON CONFLICT DO UPDATE ensures atomicity even under concurrent first requests
  const [inserted] = await db
    .insert(fiscalSequences)
    .values({ businessId, docType, lastSequence: 1, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [fiscalSequences.businessId, fiscalSequences.docType],
      set: {
        lastSequence: sql`${fiscalSequences.lastSequence} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning()

  return {
    consecutive:  String(inserted.lastSequence).padStart(10, '0'),
    establishment: inserted.establishment,
    terminal:      inserted.terminal,
  }
}
