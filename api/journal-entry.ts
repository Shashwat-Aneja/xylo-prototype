import { supabase } from '../supabase';

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { company_id, description, lines } = req.body;

    if (!company_id || !description || !lines) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const debits = lines.filter(l => l.side === "debit").reduce((a, b) => a + b.amount, 0);
    const credits = lines.filter(l => l.side === "credit").reduce((a, b) => a + b.amount, 0);

    if (debits !== credits) {
      return res.status(400).json({ error: "Debits must equal credits" });
    }

    const { data: entry, error: entryErr } = await supabase
      .from("journal_entries")
      .insert({ company_id, description })
      .select()
      .single();

    if (entryErr) throw entryErr;

    const linesData = lines.map(l => ({
      journal_entry_id: entry.id,
      ...l
    }));

    const { data: lineRows, error: lineErr } = await supabase
      .from("journal_lines")
      .insert(linesData)
      .select();

    if (lineErr) throw lineErr;

    res.status(201).json({
      journal_entry: entry,
      journal_lines: lineRows
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
