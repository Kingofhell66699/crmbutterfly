import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, errors: ['Missing x-api-key header'] }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate API key
    const { data: keyRecord, error: keyError } = await supabase
      .from('partner_api_keys')
      .select('id, partner_name, is_active, permissions')
      .eq('api_key', apiKey)
      .maybeSingle();

    if (keyError || !keyRecord) {
      return new Response(JSON.stringify({ success: false, errors: ['Invalid API key'] }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!keyRecord.is_active) {
      return new Response(JSON.stringify({ success: false, errors: ['API key is deactivated'] }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!keyRecord.permissions.includes('add_lead')) {
      return new Response(JSON.stringify({ success: false, errors: ['API key lacks add_lead permission'] }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { first_name, last_name, name, email, phone, country, language, source, source_name, source_url, comment } = body;

    const fullName = name || [first_name, last_name].filter(Boolean).join(' ');

    const errors: string[] = [];
    if (!fullName) errors.push('name (or first_name/last_name) is required');
    if (!email && !phone) errors.push('email or phone is required');
    if (errors.length > 0) {
      return new Response(JSON.stringify({ success: false, errors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert lead into our CRM
    const { data: lead, error: insertError } = await supabase.from('leads').insert({
      full_name: fullName,
      email,
      phone,
      country,
      source: source || source_name || `Partner: ${keyRecord.partner_name}`,
      tags: source_url ? [`source_url:${source_url}`] : null,
    }).select('id').single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ success: false, errors: [insertError.message] }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Add comment as a note if provided
    if (comment && lead) {
      await supabase.from('lead_notes').insert({
        lead_id: lead.id,
        author_id: keyRecord.id, // store partner key id as reference
        author_team: 'sales',
        note_text: `[Partner: ${keyRecord.partner_name}] ${comment}`,
      });
    }

    // Update last_used_at on the API key
    await supabase.from('partner_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRecord.id);

    // Log the activity
    await supabase.from('activity_logs').insert({
      user_id: keyRecord.created_by,
      action_type: 'api_receive',
      description: `Lead received via API from partner "${keyRecord.partner_name}": ${name}`,
      lead_id: lead.id,
    });

    return new Response(JSON.stringify({ success: true, client_id: lead.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error receiving lead:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, errors: [message] }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
