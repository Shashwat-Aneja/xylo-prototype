import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Only POST allowed' });

  try {
    const { company_id, description, lines } = req.body;

    if (!company_id || !description || !Array.isArray(lines))
      return res.status(400).json({ error: 'Missing required fields' });

    if (lines.length < 2)
      return res.status(400).json({ error: 'At least 2 lines required' });

    for (const line of lines) {
      if (!line.account_id || line.amount == null || !line.side)
        return res.status(400).json({ error: 'Invalid line format' });

      if (!['debit', 'credit'].includes(line.side))
        return res.status(400).json({ error: 'Invalid side' });
    }

    const debits = lines
      .filter(l => l.side === 'debit')
      .reduce((s, l) => s + l.amount, 0);

    const credits = lines
      .filter(l => l.side === 'credit')
      .reduce((s, l) => s + l.amount, 0);

    if (debits !== credits)
      return res.status(400).json({ error: 'Debits must equal credits', debits, credits });

    const { data: journalEntry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({ company_id, description })
      .select()
      .single();

    if (entryError) throw entryError;

    const { data: journalLines, error: lineError } = await supabase
      .from('journal_lines')
      .insert(
        lines.map(l => ({
          journal_entry_id: journalEntry.id,
          account_id: l.account_id,
          amount: l.amount,
          side: l.side,
          memo: l.memo || null
        }))
      )
      .select();

    if (lineError) throw lineError;

    res.status(201).json({
      journal_entry: journalEntry,
      journal_lines: journalLines,
    });

  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
}
