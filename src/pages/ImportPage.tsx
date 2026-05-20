import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Globe, Sheet, Upload, AlertTriangle, Download, Send, FileSpreadsheet, Search, CheckCircle2, XCircle, FileDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STATUS_LABELS, STATUS_OPTIONS } from '@/components/StatusBadges';

interface EmailCheckRow {
  email: string;
  exists: boolean;
  full_name?: string;
  phone?: string;
  assigned_to?: string | null;
}

interface PreviewRow {
  full_name: string;
  phone?: string;
  email?: string;
  country?: string;
  source?: string;
  comment?: string;
  client_id?: number;
  registration_date?: string;
  last_call_status?: string;
  is_ftd?: boolean;
  ftd?: number;
  ftd_date?: string;
  isDuplicate?: boolean;
}

export default function ImportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // API Import state
  const [regDateFrom, setRegDateFrom] = useState('');
  const [regDateTo, setRegDateTo] = useState('');
  const [ftdDateFrom, setFtdDateFrom] = useState('');
  const [ftdDateTo, setFtdDateTo] = useState('');
  const [limit, setLimit] = useState('200');
  const [offset, setOffset] = useState('0');
  const [apiPreview, setApiPreview] = useState<PreviewRow[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);

  // Push to API state
  const [pushName, setPushName] = useState('');
  const [pushEmail, setPushEmail] = useState('');
  const [pushPhone, setPushPhone] = useState('');
  const [pushCountry, setPushCountry] = useState('');
  const [pushLanguage, setPushLanguage] = useState('');
  const [pushSource, setPushSource] = useState('');
  const [pushSourceUrl, setPushSourceUrl] = useState('');
  const [pushComment, setPushComment] = useState('');

  // Sheet import state
  const [sheetData, setSheetData] = useState('');
  const [sheetPreview, setSheetPreview] = useState<PreviewRow[]>([]);

  // XLSX import state
  const [xlsxFileName, setXlsxFileName] = useState('');
  const [xlsxPreview, setXlsxPreview] = useState<PreviewRow[]>([]);
  const [xlsxLoading, setXlsxLoading] = useState(false);
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const [xlsxSourceName, setXlsxSourceName] = useState('');

  // Email check state
  const [emailCheckFileName, setEmailCheckFileName] = useState('');
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);
  const [emailCheckResults, setEmailCheckResults] = useState<EmailCheckRow[]>([]);
  const emailCheckInputRef = useRef<HTMLInputElement>(null);

  // Export state
  const [exportStatus, setExportStatus] = useState<string>('no_answer');
  const [exportLimit, setExportLimit] = useState<string>('100');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportPreview, setExportPreview] = useState<{ full_name: string; phone: string | null }[]>([]);

  const runExport = async () => {
    setExportLoading(true);
    setExportPreview([]);
    try {
      const lim = Math.max(1, Math.min(10000, parseInt(exportLimit) || 100));
      let q = supabase.from('leads').select('full_name, phone').order('created_at', { ascending: false }).limit(lim);
      if (exportStatus !== 'all') q = q.eq('interested_status', exportStatus as any);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []).filter(r => r.phone);
      setExportPreview(rows);
      if (rows.length === 0) {
        toast({ title: 'No leads found', description: 'Try a different status or higher limit', variant: 'destructive' });
      } else {
        toast({ title: `Found ${rows.length} leads`, description: 'Click Download XLSX to save the file' });
      }
    } catch (e: any) {
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    } finally {
      setExportLoading(false);
    }
  };

  const downloadExportXlsx = () => {
    if (exportPreview.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(
      exportPreview.map(r => ({ Name: r.full_name, Phone: r.phone ?? '' }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    const label = exportStatus === 'all' ? 'all' : exportStatus;
    XLSX.writeFile(wb, `leads-${label}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const downloadExportCsv = () => {
    if (exportPreview.length === 0) return;
    const csv = exportPreview
      .map(r => `${r.full_name ?? ''}, ${r.phone ?? ''}`)
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const label = exportStatus === 'all' ? 'all' : exportStatus;
    a.href = url;
    a.download = `leads-${label}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  };

  const checkDuplicates = async (rows: PreviewRow[]): Promise<PreviewRow[]> => {
    const phones = Array.from(new Set(rows.map(r => r.phone).filter(Boolean) as string[]));
    const emails = Array.from(new Set(rows.map(r => r.email?.toLowerCase()).filter(Boolean) as string[]));

    const existingPhones = new Set<string>();
    const existingEmails = new Set<string>();

    // Batch fetch in chunks of 200 to stay under URL/IN-list limits
    const chunk = <T,>(arr: T[], size: number) =>
      Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

    await Promise.all([
      ...chunk(phones, 200).map(async (batch) => {
        const { data } = await supabase.from('leads').select('phone').in('phone', batch);
        data?.forEach(d => d.phone && existingPhones.add(d.phone));
      }),
      ...chunk(emails, 200).map(async (batch) => {
        const { data } = await supabase.from('leads').select('email').in('email', batch);
        data?.forEach(d => d.email && existingEmails.add(d.email.toLowerCase()));
      }),
    ]);

    // Also flag duplicates within the pasted batch itself
    const seenPhones = new Set<string>();
    const seenEmails = new Set<string>();

    return rows.map(row => {
      let isDuplicate = false;
      if (row.phone) {
        if (existingPhones.has(row.phone) || seenPhones.has(row.phone)) isDuplicate = true;
        seenPhones.add(row.phone);
      }
      if (!isDuplicate && row.email) {
        const e = row.email.toLowerCase();
        if (existingEmails.has(e) || seenEmails.has(e)) isDuplicate = true;
        seenEmails.add(e);
      }
      return { ...row, isDuplicate };
    });
  };

  const fetchFromApi = async () => {
    if (!regDateFrom && !ftdDateFrom) {
      toast({ title: 'Date required', description: 'At least one date filter (Registration or FTD) is required', variant: 'destructive' });
      return;
    }
    setApiLoading(true);
    try {
      const body: Record<string, any> = {
        limit: parseInt(limit) || 200,
        offset: parseInt(offset) || 0,
      };
      if (regDateFrom) body.registration_date_from = formatDate(regDateFrom);
      if (regDateTo) body.registration_date_to = formatDate(regDateTo);
      if (ftdDateFrom) body.ftd_date_from = formatDate(ftdDateFrom);
      if (ftdDateTo) body.ftd_date_to = formatDate(ftdDateTo);

      const { data, error } = await supabase.functions.invoke('fetch-leads-api', { body });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'API returned an error');

      const clients = data.clients || [];
      const mapped: PreviewRow[] = clients.map((c: any) => ({
        full_name: c.name || c.full_name || `Client #${c.client_id}`,
        phone: c.phone || '',
        email: c.email || '',
        country: c.country || '',
        source: 'MLab',
        client_id: c.client_id,
        registration_date: c.registration_date,
        last_call_status: c.last_call_status,
        is_ftd: c.is_ftd,
        ftd: c.ftd,
        ftd_date: c.ftd_date,
      }));

      const withDupes = await checkDuplicates(mapped);
      setApiPreview(withDupes);
      setSelectedRows(withDupes.map((_, i) => i).filter(i => !withDupes[i].isDuplicate));
      toast({ title: `${withDupes.length} leads fetched from API` });
    } catch (err: any) {
      toast({ title: 'API Error', description: err.message || String(err), variant: 'destructive' });
    } finally {
      setApiLoading(false);
    }
  };

  const pushToApi = async () => {
    if (!pushName || !pushEmail || !pushPhone || !pushCountry) {
      toast({ title: 'Missing fields', description: 'Name, email, phone, and country are required', variant: 'destructive' });
      return;
    }
    try {
      const body: Record<string, any> = {
        name: pushName,
        email: pushEmail,
        phone: pushPhone,
        country: pushCountry,
      };
      if (pushLanguage) body.language = pushLanguage;
      if (pushSource) body.source = pushSource;
      if (pushSourceUrl) body.source_url = pushSourceUrl;
      if (pushComment) body.comment = pushComment;

      const { data, error } = await supabase.functions.invoke('push-lead-api', { body });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'API returned an error');

      toast({ title: `Lead pushed to external CRM (ID: ${data.client_id})` });
      setPushName(''); setPushEmail(''); setPushPhone(''); setPushCountry('');
      setPushLanguage(''); setPushSource(''); setPushSourceUrl(''); setPushComment('');
    } catch (err: any) {
      toast({ title: 'Push Error', description: err.message || String(err), variant: 'destructive' });
    }
  };

  const parseSheet = async () => {
    if (!sheetData.trim()) return;
    const raw = sheetData.replace(/\r/g, '').trim().split('\n');
    if (raw.length === 0) return;

    // Detect if a line starts a new record: any non-digit/non-separator first char,
    // followed by something, then a tab, then an email-looking column.
    // Allows Cyrillic, accented, and other Unicode names.
    const isRecordStart = (line: string) =>
      /^[^\d\-\t|.][^\t]*\t[^\t]*@[^\t]+/.test(line);

    // Check if first line is a header row (English OR Russian headers)
    const firstLower = raw[0].toLowerCase();
    const isHeader =
      (/\bname\b/.test(firstLower) || /полное\s*имя/.test(firstLower) || /имя/.test(firstLower)) &&
      (/\bemail\b/.test(firstLower) || /\bphone\b/.test(firstLower) || /телефон/.test(firstLower));

    const dataLines = isHeader ? raw.slice(1) : raw;

    // Group multiline records: a new record starts when the line matches isRecordStart
    const records: string[] = [];
    for (const line of dataLines) {
      if (!line.trim()) continue;
      if (isRecordStart(line)) {
        records.push(line);
      } else if (records.length > 0) {
        // Continuation line belongs to the description of the previous record
        records[records.length - 1] += '\n' + line;
      }
    }

    // Fixed column order:
    // Name \t Email \t Phone \t (placeholder/-) \t Language \t Country \t Deposit \t Company \t ...rest
    // Anything after the company column + any continuation lines become the comment.
    const rows: PreviewRow[] = records.map(rec => {
      // Split off continuation lines (everything after the first newline goes to comment)
      const [firstLine, ...extraLines] = rec.split('\n');
      const parts = firstLine.split('\t').map(p => p.trim());

      const full_name = parts[0] || '';
      const email = parts[1] || '';
      const phone = (parts[2] || '').replace(/[\s\-()]/g, '');
      // parts[3] is usually a placeholder ("-"), skip it
      // parts[4] = language (ignored for now), parts[5] = country
      const country = parts[5] || '';
      const deposit = parts[6] || '';
      const company = parts[7] || '';

      // Build comment from: deposit, company, any extra tab columns, and continuation lines
      const tail = parts.slice(8).filter(Boolean).join(' | ');
      const continuation = extraLines
        .map(l => l.trim())
        .filter(l => l && l !== '-------------')
        .join('\n');

      const commentParts: string[] = [];
      if (deposit) commentParts.push(`Deposit: ${deposit}`);
      if (company) commentParts.push(`Company: ${company}`);
      if (tail) commentParts.push(tail);
      if (continuation) commentParts.push(continuation);
      const comment = commentParts.join('\n').trim();

      return {
        full_name,
        email,
        phone,
        country,
        comment: comment || undefined,
        source: 'Sheet Import',
      };
    }).filter(r => r.full_name);

    const withDupes = await checkDuplicates(rows);
    setSheetPreview(withDupes);
    setSelectedRows(withDupes.map((_, i) => i).filter(i => !withDupes[i].isDuplicate));
  };

  // Normalize an XLSX header to a canonical key (handles RU + EN, case/space-insensitive)
  const normalizeHeader = (h: string): string => {
    const s = String(h || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (/полное\s*имя|^имя$|full\s*name|^name$/.test(s)) return 'name';
    if (/email|e-mail|почта/.test(s)) return 'email';
    if (/телефон\s*2|phone\s*2|second\s*phone/.test(s)) return 'phone2';
    if (/телефон|phone|tel\b|mobile/.test(s)) return 'phone';
    if (/страна|country/.test(s)) return 'country';
    if (/total\s*deposit|deposit|депозит/.test(s)) return 'deposit';
    if (/источник|source/.test(s)) return 'source';
    if (/язык|language/.test(s)) return 'language';
    return s; // unknown → goes into comment
  };

  const parseXlsx = async (file: File) => {
    setXlsxLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
      if (aoa.length < 2) {
        toast({ title: 'Empty file', description: 'No data rows found in the spreadsheet', variant: 'destructive' });
        setXlsxLoading(false);
        return;
      }
      const headers = aoa[0].map((h: any) => normalizeHeader(String(h)));
      const dataRows = aoa.slice(1);

      const rows: PreviewRow[] = dataRows.map(r => {
        const get = (key: string) => {
          const idx = headers.indexOf(key);
          return idx >= 0 ? String(r[idx] ?? '').trim() : '';
        };
        const full_name = get('name');
        if (!full_name) return null;

        const email = get('email');
        const phone = get('phone').replace(/[\s\-()]/g, '');
        const phone2 = get('phone2').replace(/[\s\-()]/g, '');
        const country = get('country');
        const deposit = get('deposit');
        const source = xlsxSourceName.trim() || get('source') || 'XLSX Import';

        // Anything unmapped goes into the comment so no data is lost
        const extras: string[] = [];
        headers.forEach((h, i) => {
          if (!['name', 'email', 'phone', 'country', 'deposit', 'source', 'language'].includes(h)) {
            const val = String(r[i] ?? '').trim();
            if (val) extras.push(`${h}: ${val}`);
          }
        });

        const commentParts: string[] = [];
        if (phone2) commentParts.push(`Phone 2: ${phone2}`);
        if (deposit) commentParts.push(`Total Deposit: ${deposit}`);
        if (extras.length) commentParts.push(extras.join('\n'));

        return {
          full_name,
          email: email || undefined,
          phone: phone || undefined,
          country: country || undefined,
          source,
          comment: commentParts.join('\n') || undefined,
        } as PreviewRow;
      }).filter((r): r is PreviewRow => r !== null);

      const withDupes = await checkDuplicates(rows);
      setXlsxPreview(withDupes);
      setSelectedRows(withDupes.map((_, i) => i).filter(i => !withDupes[i].isDuplicate));
      const dupCount = withDupes.filter(r => r.isDuplicate).length;
      toast({
        title: `${withDupes.length} rows parsed`,
        description: dupCount > 0 ? `${dupCount} flagged as duplicates and excluded` : 'All rows are new',
      });
    } catch (err: any) {
      toast({ title: 'Failed to read file', description: err.message || String(err), variant: 'destructive' });
    } finally {
      setXlsxLoading(false);
    }
  };

  const handleXlsxFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setXlsxFileName(file.name);
    setXlsxPreview([]);
    parseXlsx(file);
  };

  const handleEmailCheckFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEmailCheckFileName(file.name);
    setEmailCheckResults([]);
    setEmailCheckLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });

      // Detect header row: if first row contains a word like "email", skip it
      const firstCellLower = String(aoa[0]?.[0] ?? '').toLowerCase();
      const startIdx = /email|почта|e-mail/.test(firstCellLower) ? 1 : 0;

      const emails = Array.from(new Set(
        aoa.slice(startIdx)
          .map(r => String(r[0] ?? '').trim().toLowerCase())
          .filter(e => e && e.includes('@'))
      ));

      if (emails.length === 0) {
        toast({ title: 'No emails found', description: 'Put emails in the first column of the file', variant: 'destructive' });
        setEmailCheckLoading(false);
        return;
      }

      const chunk = <T,>(arr: T[], size: number) =>
        Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

      const found = new Map<string, { full_name: string; phone: string | null; assigned_to: string | null }>();
      await Promise.all(chunk(emails, 200).map(async (batch) => {
        const { data } = await supabase.from('leads').select('email, full_name, phone, assigned_to').in('email', batch);
        data?.forEach(d => {
          if (d.email) found.set(d.email.toLowerCase(), { full_name: d.full_name, phone: d.phone, assigned_to: d.assigned_to });
        });
      }));

      const results: EmailCheckRow[] = emails.map(email => {
        const hit = found.get(email);
        return hit
          ? { email, exists: true, full_name: hit.full_name, phone: hit.phone || undefined, assigned_to: hit.assigned_to }
          : { email, exists: false };
      });

      setEmailCheckResults(results);
      const matchCount = results.filter(r => r.exists).length;
      toast({
        title: `${emails.length} emails checked`,
        description: `${matchCount} already in CRM, ${emails.length - matchCount} new`,
      });
    } catch (err: any) {
      toast({ title: 'Failed to read file', description: err.message || String(err), variant: 'destructive' });
    } finally {
      setEmailCheckLoading(false);
    }
  };

  const downloadEmailCheckCsv = () => {
    if (emailCheckResults.length === 0) return;
    const header = 'email,status,full_name,phone\n';
    const body = emailCheckResults.map(r =>
      [r.email, r.exists ? 'IN_CRM' : 'NEW', r.full_name || '', r.phone || ''].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-check-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importMutation = useMutation({
    mutationFn: async ({ rows, sourceType }: { rows: PreviewRow[]; sourceType: string }) => {
      const toImport = rows.filter((_, i) => selectedRows.includes(i) && !_.isDuplicate);
      let insertedCount = 0;
      let skippedCount = 0;
      for (const row of toImport) {
        // Re-check duplicates right before insert
        if (row.phone) {
          const { data: existsByPhone } = await supabase.from('leads').select('id').eq('phone', row.phone).limit(1);
          if (existsByPhone && existsByPhone.length > 0) { skippedCount++; continue; }
        }
        if (row.email) {
          const { data: existsByEmail } = await supabase.from('leads').select('id').eq('email', row.email).limit(1);
          if (existsByEmail && existsByEmail.length > 0) { skippedCount++; continue; }
        }
        const effectiveSource = sourceType === 'xlsx'
          ? (xlsxSourceName.trim() || row.source || 'XLSX Import')
          : (row.source || null);
        const { data: lead, error: insertErr } = await supabase.from('leads').insert({
          full_name: row.full_name,
          phone: row.phone || null,
          email: row.email || null,
          country: row.country || null,
          source: effectiveSource,
        }).select('id').single();

        if (insertErr) {
          // Unique constraint violation = duplicate caught by DB. Skip silently.
          if (insertErr.code === '23505') { skippedCount++; continue; }
          throw insertErr;
        }
        insertedCount++;

        if (row.comment && lead) {
          await supabase.from('lead_notes').insert({
            lead_id: lead.id,
            author_id: user!.id,
            author_team: 'sales',
            note_text: row.comment,
          });
        }
      }
      if (insertedCount > 0) {
        await supabase.from('lead_imports').insert({
          source_type: sourceType,
          source_name: sourceType === 'api' ? 'External CRM API' : sourceType === 'xlsx' ? (xlsxSourceName.trim() || 'XLSX Import') : 'Google Sheet Paste',
          imported_by: user!.id,
          imported_count: insertedCount,
        });
        await supabase.from('activity_logs').insert({
          user_id: user!.id,
          action_type: 'import',
          description: `Imported ${insertedCount} leads from ${sourceType}`,
        });
      }
      return { insertedCount, skippedCount };
    },
    onSuccess: ({ insertedCount, skippedCount }) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setApiPreview([]);
      setSheetPreview([]);
      setSelectedRows([]);
      setSheetData('');
      setXlsxPreview([]);
      setXlsxFileName('');
      setXlsxSourceName('');
      if (xlsxInputRef.current) xlsxInputRef.current.value = '';
      const msg = skippedCount > 0
        ? `${insertedCount} imported, ${skippedCount} skipped (already in CRM)`
        : `${insertedCount} leads imported successfully`;
      toast({ title: msg });
    },
    onError: (err: Error) => {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    },
  });

  const toggleRow = (idx: number) => {
    setSelectedRows(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };

  const renderPreviewTable = (rows: PreviewRow[], sourceType: string) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selectedRows.filter(i => !rows[i]?.isDuplicate).length} of {rows.length} leads selected
        </p>
        <Button onClick={() => importMutation.mutate({ rows, sourceType })} disabled={selectedRows.length === 0 || importMutation.isPending}>
          <Upload className="h-4 w-4 mr-1" /> {importMutation.isPending ? 'Importing...' : 'Import Selected into CRM'}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead className="table-header">Name</TableHead>
              <TableHead className="table-header">Email</TableHead>
              <TableHead className="table-header">Phone</TableHead>
              <TableHead className="table-header">Country</TableHead>
              {sourceType === 'api' && <TableHead className="table-header">Status</TableHead>}
              {sourceType === 'api' && <TableHead className="table-header">FTD</TableHead>}
              {sourceType === 'api' && <TableHead className="table-header">Reg Date</TableHead>}
              {(sourceType === 'sheet' || sourceType === 'xlsx') && <TableHead className="table-header">Comment</TableHead>}
              <TableHead className="table-header">Duplicate?</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i} className={row.isDuplicate ? 'opacity-50' : ''}>
                <TableCell>
                  <Checkbox checked={selectedRows.includes(i)} onCheckedChange={() => toggleRow(i)} disabled={row.isDuplicate} />
                </TableCell>
                <TableCell className="font-medium">{row.full_name}</TableCell>
                <TableCell>{row.email || '—'}</TableCell>
                <TableCell>{row.phone || '—'}</TableCell>
                <TableCell>{row.country || '—'}</TableCell>
                {sourceType === 'api' && <TableCell className="text-sm">{row.last_call_status || '—'}</TableCell>}
                {sourceType === 'api' && (
                  <TableCell>
                    {row.is_ftd ? (
                      <span className="status-badge status-converted">${row.ftd}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">No</span>
                    )}
                  </TableCell>
                )}
                {sourceType === 'api' && <TableCell className="text-sm text-muted-foreground">{row.registration_date || '—'}</TableCell>}
                {(sourceType === 'sheet' || sourceType === 'xlsx') && <TableCell className="text-xs text-muted-foreground max-w-[320px] whitespace-pre-wrap align-top" title={row.comment}>{row.comment || '—'}</TableCell>}
                <TableCell>
                  {row.isDuplicate && (
                    <span className="inline-flex items-center gap-1 text-xs text-warning">
                      <AlertTriangle className="h-3 w-3" /> Duplicate
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Import Center</h1>
          <p className="text-muted-foreground">Import leads from external CRM API or Google Sheets</p>
        </div>

        <Tabs defaultValue="fetch">
          <TabsList>
            <TabsTrigger value="fetch" className="gap-2"><Download className="h-4 w-4" /> Fetch from API</TabsTrigger>
            <TabsTrigger value="push" className="gap-2"><Send className="h-4 w-4" /> Push to API</TabsTrigger>
            <TabsTrigger value="sheet" className="gap-2"><Sheet className="h-4 w-4" /> Google Sheet</TabsTrigger>
            <TabsTrigger value="xlsx" className="gap-2"><FileSpreadsheet className="h-4 w-4" /> Upload XLSX</TabsTrigger>
            <TabsTrigger value="emailcheck" className="gap-2"><Search className="h-4 w-4" /> Check Emails</TabsTrigger>
            <TabsTrigger value="export" className="gap-2"><FileDown className="h-4 w-4" /> Export Leads</TabsTrigger>
          </TabsList>

          {/* FETCH FROM API TAB */}
          <TabsContent value="fetch" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Fetch Leads from External CRM
                </CardTitle>
                <CardDescription>
                  POST to <code className="text-xs bg-muted px-1 py-0.5 rounded">/api/leads_info</code> — 
                  Requires at least one date filter (Registration Date or FTD Date)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Registration Date From</Label>
                    <Input type="date" value={regDateFrom} onChange={e => setRegDateFrom(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Registration Date To</Label>
                    <Input type="date" value={regDateTo} onChange={e => setRegDateTo(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">FTD Date From</Label>
                    <Input type="date" value={ftdDateFrom} onChange={e => setFtdDateFrom(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">FTD Date To</Label>
                    <Input type="date" value={ftdDateTo} onChange={e => setFtdDateTo(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Limit</Label>
                    <Input type="number" value={limit} onChange={e => setLimit(e.target.value)} placeholder="200" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Offset</Label>
                    <Input type="number" value={offset} onChange={e => setOffset(e.target.value)} placeholder="0" />
                  </div>
                </div>
                <Button onClick={fetchFromApi} disabled={apiLoading}>
                  <Download className="h-4 w-4 mr-1" /> {apiLoading ? 'Fetching...' : 'Fetch & Preview Leads'}
                </Button>
              </CardContent>
            </Card>
            {apiPreview.length > 0 && (
              <Card className="bg-card border-border">
                <CardContent className="pt-6">{renderPreviewTable(apiPreview, 'api')}</CardContent>
              </Card>
            )}
          </TabsContent>

          {/* PUSH TO API TAB */}
          <TabsContent value="push" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" />
                  Push Lead to External CRM
                </CardTitle>
                <CardDescription>
                  POST to <code className="text-xs bg-muted px-1 py-0.5 rounded">/api/add_lead</code> — 
                  Send a lead to the external CRM system
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name <span className="text-destructive">*</span></Label>
                    <Input value={pushName} onChange={e => setPushName(e.target.value)} placeholder="John Doe" />
                  </div>
                  <div>
                    <Label>Email <span className="text-destructive">*</span></Label>
                    <Input type="email" value={pushEmail} onChange={e => setPushEmail(e.target.value)} placeholder="test@mail.com" />
                  </div>
                  <div>
                    <Label>Phone <span className="text-destructive">*</span></Label>
                    <Input value={pushPhone} onChange={e => setPushPhone(e.target.value)} placeholder="12345678912" />
                  </div>
                  <div>
                    <Label>Country <span className="text-destructive">*</span></Label>
                    <Input value={pushCountry} onChange={e => setPushCountry(e.target.value)} placeholder="US" />
                  </div>
                  <div>
                    <Label>Language</Label>
                    <Input value={pushLanguage} onChange={e => setPushLanguage(e.target.value)} placeholder="EN" />
                  </div>
                  <div>
                    <Label>Source</Label>
                    <Input value={pushSource} onChange={e => setPushSource(e.target.value)} placeholder="Test Source" />
                  </div>
                  <div>
                    <Label>Source URL</Label>
                    <Input value={pushSourceUrl} onChange={e => setPushSourceUrl(e.target.value)} placeholder="https://test.com" />
                  </div>
                </div>
                <div>
                  <Label>Comment</Label>
                  <Textarea value={pushComment} onChange={e => setPushComment(e.target.value)} placeholder="Comment about new lead" rows={3} />
                </div>
                <Button onClick={pushToApi} disabled={!pushName || !pushEmail || !pushPhone || !pushCountry}>
                  <Send className="h-4 w-4 mr-1" /> Push Lead to External CRM
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* GOOGLE SHEET TAB */}
          <TabsContent value="sheet" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Google Sheet Import</CardTitle>
                <CardDescription>
                  Paste tab-separated data from Google Sheets. First row = headers (Name, Phone, Email, Country, Source)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={sheetData}
                  onChange={e => setSheetData(e.target.value)}
                  placeholder={"Name\tPhone\tEmail\tCountry\nJohn Doe\t+1234567890\tjohn@example.com\tUS"}
                  rows={8}
                />
                <Button onClick={parseSheet} disabled={!sheetData.trim()}>
                  <Sheet className="h-4 w-4 mr-1" /> Parse & Preview
                </Button>
              </CardContent>
            </Card>
            {sheetPreview.length > 0 && (
              <Card className="bg-card border-border">
                <CardContent className="pt-6">{renderPreviewTable(sheetPreview, 'sheet')}</CardContent>
              </Card>
            )}
          </TabsContent>

          {/* XLSX UPLOAD TAB */}
          <TabsContent value="xlsx" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  Upload Excel File (.xlsx / .xls / .csv)
                </CardTitle>
                <CardDescription>
                  Expected columns (any order, RU or EN):{' '}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">Полное имя</code>,{' '}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">Email</code>,{' '}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">Телефон</code>,{' '}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">Телефон 2</code>,{' '}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">Страна</code>,{' '}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">Total Deposit</code>,{' '}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">Источник</code>.
                  Phone 2 and deposit are saved into the lead's comment. Duplicates (by phone or email) are flagged and excluded automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Source name (batch label) <span className="text-muted-foreground text-xs">— used to track which batch / vendor these leads came from</span></Label>
                  <Input
                    value={xlsxSourceName}
                    onChange={e => setXlsxSourceName(e.target.value)}
                    placeholder="e.g. FB Ads – Apr 2026, Vendor X Batch 12, Telegram Channel Y"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    If set, this overrides the file's Источник/Source column and is saved as the lead source for every row.
                  </p>
                </div>
                <Input
                  ref={xlsxInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  onChange={handleXlsxFile}
                  disabled={xlsxLoading}
                />
                {xlsxFileName && (
                  <p className="text-xs text-muted-foreground">
                    {xlsxLoading ? 'Parsing…' : 'Loaded:'} <span className="font-medium text-foreground">{xlsxFileName}</span>
                  </p>
                )}
              </CardContent>
            </Card>
            {xlsxPreview.length > 0 && (
              <Card className="bg-card border-border">
                <CardContent className="pt-6">{renderPreviewTable(xlsxPreview, 'xlsx')}</CardContent>
              </Card>
            )}
          </TabsContent>

          {/* EMAIL CHECK TAB */}
          <TabsContent value="emailcheck" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  Check Emails Against CRM
                </CardTitle>
                <CardDescription>
                  Upload an Excel/CSV file with emails in the first column. Each email will be checked against the database
                  to see if it's already a lead. Nothing is imported — this is read-only.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  ref={emailCheckInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  onChange={handleEmailCheckFile}
                  disabled={emailCheckLoading}
                />
                {emailCheckFileName && (
                  <p className="text-xs text-muted-foreground">
                    {emailCheckLoading ? 'Checking…' : 'Loaded:'} <span className="font-medium text-foreground">{emailCheckFileName}</span>
                  </p>
                )}
              </CardContent>
            </Card>
            {emailCheckResults.length > 0 && (
              <Card className="bg-card border-border">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-4 text-sm">
                      <span className="inline-flex items-center gap-1 text-warning">
                        <CheckCircle2 className="h-4 w-4" /> {emailCheckResults.filter(r => r.exists).length} already in CRM
                      </span>
                      <span className="inline-flex items-center gap-1 text-success">
                        <XCircle className="h-4 w-4" /> {emailCheckResults.filter(r => !r.exists).length} new
                      </span>
                    </div>
                    <Button variant="outline" size="sm" onClick={downloadEmailCheckCsv}>
                      <Download className="h-4 w-4 mr-1" /> Export CSV
                    </Button>
                  </div>
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="table-header">Email</TableHead>
                          <TableHead className="table-header">Status</TableHead>
                          <TableHead className="table-header">Lead Name</TableHead>
                          <TableHead className="table-header">Phone</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {emailCheckResults.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{r.email}</TableCell>
                            <TableCell>
                              {r.exists ? (
                                <span className="inline-flex items-center gap-1 text-xs text-warning">
                                  <CheckCircle2 className="h-3 w-3" /> In CRM
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-success">
                                  <XCircle className="h-3 w-3" /> New
                                </span>
                              )}
                            </TableCell>
                            <TableCell>{r.full_name || '—'}</TableCell>
                            <TableCell>{r.phone || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* EXPORT LEADS TAB */}
          <TabsContent value="export" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileDown className="h-5 w-5 text-primary" />
                  Export Leads to XLSX
                </CardTitle>
                <CardDescription>
                  Pick a status and how many leads to export. The file contains only Name and Phone.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={exportStatus} onValueChange={setExportStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {STATUS_OPTIONS.map(s => (
                          <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>How many leads</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10000}
                      value={exportLimit}
                      onChange={e => setExportLimit(e.target.value)}
                      placeholder="100"
                    />
                  </div>
                  <div className="space-y-2 flex items-end">
                    <Button onClick={runExport} disabled={exportLoading} className="w-full">
                      <Search className="h-4 w-4 mr-2" />
                      {exportLoading ? 'Loading…' : 'Find Leads'}
                    </Button>
                  </div>
                </div>

                {exportPreview.length > 0 && (
                  <>
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-sm text-muted-foreground">
                        {exportPreview.length} lead{exportPreview.length === 1 ? '' : 's'} ready to export
                      </p>
                      <div className="flex gap-2">
                        <Button onClick={downloadExportCsv} variant="outline">
                          <Download className="h-4 w-4 mr-2" /> Download CSV
                        </Button>
                        <Button onClick={downloadExportXlsx} variant="default">
                          <FileDown className="h-4 w-4 mr-2" /> Download XLSX
                        </Button>
                      </div>
                    </div>
                    <div className="border border-border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Phone</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {exportPreview.slice(0, 200).map((r, i) => (
                            <TableRow key={i}>
                              <TableCell>{r.full_name}</TableCell>
                              <TableCell className="font-mono text-xs">{r.phone}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {exportPreview.length > 200 && (
                        <p className="text-xs text-muted-foreground text-center p-2">
                          Showing first 200 of {exportPreview.length}. Full list will be in the XLSX file.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
