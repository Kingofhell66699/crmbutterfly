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

    if (!keyRecord.permissions.includes('leads_info')) {
      return new Response(JSON.stringify({ success: false, errors: ['API key lacks leads_info permission'] }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Support both GET (query params) and POST (JSON body)
    let params: any = {};
    const url = new URL(req.url);
    if (req.method === 'GET' || url.searchParams.toString()) {
      for (const [key, value] of url.searchParams.entries()) {
        params[key] = value;
      }
    }
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        params = { ...params, ...body };
      } catch {
        // No JSON body, use query params only
      }
    }

    const {
      limit = 200, offset = 0,
      ftd_date_from, ftd_date_to,
      registration_date_from, registration_date_to,
      start_date, end_date,
    } = params;

    // Map start_date/end_date to registration_date filters as fallback
    const regFrom = registration_date_from || start_date;
    const regTo = registration_date_to || end_date;

    if (!ftd_date_from && !regFrom) {
      return new Response(JSON.stringify({ success: false, errors: ['At least one date filter is required (ftd_date, registration_date, or start_date/end_date)'] }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse date: supports dd-mm-yyyy or yyyy-mm-dd
    const parseDate = (d: string): string => {
      if (d.match(/^\d{4}-\d{2}-\d{2}/)) return d; // already ISO
      const [day, month, year] = d.split('-');
      return `${year}-${month}-${day}`;
    };

    let query = supabase.from('leads').select('*').range(Number(offset), Number(offset) + Number(limit) - 1);

    if (regFrom) query = query.gte('created_at', parseDate(regFrom));
    if (regTo) query = query.lte('created_at', parseDate(regTo) + 'T23:59:59Z');

    if (ftd_date_from && !regFrom) {
      query = query.gte('updated_at', parseDate(ftd_date_from));
    }
    if (ftd_date_to && !regTo) {
      query = query.lte('updated_at', parseDate(ftd_date_to) + 'T23:59:59Z');
    }

    const { data: leads, error: queryError } = await query;

    if (queryError) {
      return new Response(JSON.stringify({ success: false, errors: [queryError.message] }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Format response to match the API doc format
    const formatDateDMY = (iso: string): string => {
      const d = new Date(iso);
      return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    };

    const isFtdLead = (lead: any) =>
      lead.interested_status === 'converted' || lead.retention_status === 'deposited_converted';

    const statusLabelMap: Record<string, string> = {
      not_called: 'Not Called',
      callback_later: 'Initial Call',
      no_answer: 'No Answer',
      hung_up: 'Hung Up',
      wrong_number: 'Wrong Number',
      not_interested: 'Not Interested',
      interested: 'Interested',
      converted: 'FTD',
      wrong_info: 'Wrong Info',
    };

    const clients = (leads || []).map((l: any) => {
      const isFtd = isFtdLead(l);

      return {
        client_id: l.id,
        name: l.full_name,
        email: l.email || '',
        phone: l.phone || '',
        country: l.country || '',
        registration_date: formatDateDMY(l.created_at),
        last_call_status: isFtd ? 'FTD' : (statusLabelMap[l.interested_status] || statusLabelMap[l.retention_status] || 'No Answer'),
        is_ftd: isFtd,
        ftd: isFtd ? 1 : 0,
        ftd_date: isFtd ? formatDateDMY(l.updated_at) : null,
      };
    });

    // Update last_used_at
    await supabase.from('partner_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRecord.id);

    return new Response(JSON.stringify({ success: true, clients }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in leads-info:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, errors: [message] }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
