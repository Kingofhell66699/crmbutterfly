import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CRM_API_KEY = Deno.env.get('CRM_API_KEY');
    if (!CRM_API_KEY) throw new Error('CRM_API_KEY is not configured');
    const CRM_API_BASE_URL = Deno.env.get('CRM_API_BASE_URL');
    if (!CRM_API_BASE_URL) throw new Error('CRM_API_BASE_URL is not configured');

    // Verify user is authenticated and is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'super_admin' });
    if (!isAdmin) throw new Error('Only admins can fetch leads from API');

    const body = await req.json();
    const { limit = 200, offset = 0, ftd_date_from, ftd_date_to, registration_date_from, registration_date_to } = body;

    // Build request body for external CRM
    const apiBody: Record<string, any> = { limit, offset };
    if (ftd_date_from) apiBody.ftd_date_from = ftd_date_from;
    if (ftd_date_to) apiBody.ftd_date_to = ftd_date_to;
    if (registration_date_from) apiBody.registration_date_from = registration_date_from;
    if (registration_date_to) apiBody.registration_date_to = registration_date_to;

    // Must have at least one date filter
    if (!ftd_date_from && !registration_date_from) {
      throw new Error('At least one date filter is required (ftd_date or registration_date)');
    }

    const apiResponse = await fetch(`${CRM_API_BASE_URL}/api/leads_info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CRM_API_KEY,
      },
      body: JSON.stringify(apiBody),
    });

    const apiData = await apiResponse.json();

    if (!apiResponse.ok || !apiData.success) {
      throw new Error(`External CRM API error [${apiResponse.status}]: ${JSON.stringify(apiData)}`);
    }

    return new Response(JSON.stringify(apiData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error fetching leads from API:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
