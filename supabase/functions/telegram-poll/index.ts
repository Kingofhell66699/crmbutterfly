import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

// Parse the Telegram lead format:
// AN7 Sf:
// Сумма потерь: 15000$_and_more
// Имя: Lun Yeetak
// Телефон: +16045555555
// Имейл: email@example.com
function parseLeadMessage(text: string): {
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  comment: string | null;
} {
  const rawLines = text.split("\n").map((l) => l.trim());

  let name: string | null = null;
  let phone: string | null = null;
  let email: string | null = null;
  let source: string | null = null;
  const extraLines: string[] = [];
  let pendingField: string | null = null;

  // First non-empty line is the source/partner identifier (e.g. "AN7 Sf:")
  for (const line of rawLines) {
    if (!line) continue;
    source = line.replace(/:$/, '').trim(); // strip trailing colon
    break;
  }

  const labelRegexes = {
    name: /^(?:Имя|Name|ФИО)\s*:\s*(.*)/i,
    phone: /^(?:Телефон|Phone|Тел)\s*:\s*(.*)/i,
    email: /^(?:Имейл|Email|Почта|E-mail|Mail)\s*:\s*(.*)/i,
    amount: /^(?:Сумма потерь|Amount|Loss|Сумма)\s*:\s*(.*)/i,
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Skip empty lines but DON'T reset pendingField - value may follow after blank line
    if (!line) continue;

    // Skip the source line (first non-empty line)
    if (i === rawLines.findIndex((l) => l.length > 0)) continue;

    // If previous label had no value, this line IS the value
    if (pendingField) {
      if (pendingField === "email") email = line;
      else if (pendingField === "name") name = line;
      else if (pendingField === "phone") phone = line;
      pendingField = null;
      continue;
    }

    // Try matching known labels
    const nameMatch = line.match(labelRegexes.name);
    const phoneMatch = line.match(labelRegexes.phone);
    const emailMatch = line.match(labelRegexes.email);
    const amountMatch = line.match(labelRegexes.amount);

    if (nameMatch) {
      const val = nameMatch[1].trim();
      if (val) name = val; else pendingField = "name";
    } else if (phoneMatch) {
      const val = phoneMatch[1].trim();
      if (val) phone = val; else pendingField = "phone";
    } else if (emailMatch) {
      const val = emailMatch[1].trim();
      if (val) email = val; else pendingField = "email";
    } else if (amountMatch) {
      const val = amountMatch[1].trim();
      if (val) extraLines.push(`Сумма потерь: ${val}`);
    } else {
      extraLines.push(line);
    }
  }

  const comment = extraLines.length > 0 ? extraLines.join("; ") : null;

  return { name, phone, email, source, comment };
}

Deno.serve(async () => {
  const startTime = Date.now();

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }), { status: 500 });
  }

  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
  if (!TELEGRAM_API_KEY) {
    return new Response(JSON.stringify({ error: "TELEGRAM_API_KEY is not configured" }), { status: 500 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let totalProcessed = 0;
  let leadsCreated = 0;

  // Read initial offset
  const { data: state, error: stateErr } = await supabase
    .from("telegram_bot_state")
    .select("update_offset")
    .eq("id", 1)
    .single();

  if (stateErr) {
    return new Response(JSON.stringify({ error: stateErr.message }), { status: 500 });
  }

  let currentOffset = state.update_offset;

  while (true) {
    const elapsed = Date.now() - startTime;
    const remainingMs = MAX_RUNTIME_MS - elapsed;
    if (remainingMs < MIN_REMAINING_MS) break;

    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
    if (timeout < 1) break;

    const response = await fetch(`${GATEWAY_URL}/getUpdates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        offset: currentOffset,
        timeout,
        allowed_updates: ["message", "channel_post"],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Telegram getUpdates error:", data);
      return new Response(JSON.stringify({ error: data }), { status: 502 });
    }

    const updates = data.result ?? [];
    if (updates.length === 0) continue;

    // Store raw messages
    const rows = updates
      .filter((u: any) => u.message || u.channel_post)
      .map((u: any) => {
        const msg = u.message || u.channel_post;
        return {
          update_id: u.update_id,
          chat_id: msg.chat.id,
          text: msg.text ?? null,
          raw_update: u,
        };
      });

    if (rows.length > 0) {
      const { error: insertErr } = await supabase
        .from("telegram_messages")
        .upsert(rows, { onConflict: "update_id" });

      if (insertErr) {
        console.error("Message insert error:", insertErr);
        return new Response(JSON.stringify({ error: insertErr.message }), { status: 500 });
      }

      totalProcessed += rows.length;

      // Parse and create leads from messages
      for (const row of rows) {
        if (!row.text) continue;

        const parsed = parseLeadMessage(row.text);
        console.log("Parsed lead:", JSON.stringify(parsed));
        if (!parsed.name) continue; // Skip messages that don't look like leads

        // Insert lead
        const { data: lead, error: leadErr } = await supabase
          .from("leads")
          .insert({
            full_name: parsed.name,
            phone: parsed.phone,
            email: parsed.email,
            source: "MLab",
            tags: ["telegram-import"],
          })
          .select("id")
          .single();

        if (leadErr) {
          console.error("Lead insert error:", leadErr);
          continue;
        }

        leadsCreated++;

        // Get admin user for attribution
        const { data: admin } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "super_admin")
          .limit(1)
          .single();

        const adminId = admin?.user_id;

        // Add comment/extra info as a note
        if (parsed.comment && lead && adminId) {
          await supabase.from("lead_notes").insert({
            lead_id: lead.id,
            author_id: adminId,
            author_team: "sales",
            note_text: `[Telegram Import] ${parsed.comment}`,
          });
        }

        // Log activity
        if (lead && adminId) {
          await supabase.from("activity_logs").insert({
            user_id: adminId,
            action_type: "telegram_import",
            description: `Lead imported from Telegram: ${parsed.name}`,
            lead_id: lead.id,
          });
        }

        // Mark message as processed
        await supabase
          .from("telegram_messages")
          .update({ processed: true })
          .eq("update_id", row.update_id);
      }
    }

    // Advance offset
    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    const { error: offsetErr } = await supabase
      .from("telegram_bot_state")
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq("id", 1);

    if (offsetErr) {
      console.error("Offset update error:", offsetErr);
      return new Response(JSON.stringify({ error: offsetErr.message }), { status: 500 });
    }

    currentOffset = newOffset;
  }

  return new Response(
    JSON.stringify({ ok: true, processed: totalProcessed, leads_created: leadsCreated, final_offset: currentOffset }),
    { headers: { "Content-Type": "application/json" } }
  );
});
