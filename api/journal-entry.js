import { supabase } from '../supabase.js';

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { company_id, description, lines } = req.body;

    if (!company_id || !description || !Array.isArray(lines)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (lines.length < 2) {
      return res.status(400).json({ error: "At least 2 lines are required" });
    }

    const debits = lines.filter(l => l.side === "debit").reduce((sum, l) => sum + l.amount, 0);
    const credits = lines.filter(l => l.side === "credit").reduce((sum, l) => sum + l.amount, 0);

    if (debits !== credits) {
      return res.status(400).json({ error: "Debits must equal credits", debits, credits });
    }

    const { data: journalEntry, error: entryErr } = await supabase
      .from("journal_entries")
      .insert({ company_id, description })
      .select()
      .single();

    if (entryErr) throw entryErr;

    const lineData = lines.map(l => ({
      journal_entry_id: journalEntry.id,
      account_id: l.account_id,
      amount: l.amount,
      side: l.side,
      memo: l.memo || null
    }));

    const { data: journalLines, error: lineErr } = await supabase
      .from("journal_lines")
      .insert(lineData)
      .select();

    if (lineErr) throw lineErr;

    return res.status(201).json({
      journal_entry: journalEntry,
      journal_lines: journalLines,
      totals: { debits, credits }
    });

  } catch (err) {
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}
