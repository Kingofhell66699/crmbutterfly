import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";

export default function VendorExport() {
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [filterNotes, setFilterNotes] = useState("all"); // all | with_notes | without_notes
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState([]);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    loadSources();
  }, []);

  async function loadSources() {
    const { data } = await supabase
      .from("leads")
      .select("source")
      .not("source", "is", null);
    if (data) {
      const unique = [...new Set(data.map((r) => r.source).filter(Boolean))].sort();
      setSources(unique);
    }
  }

  async function fetchLeads() {
    if (!selectedSource) return alert("Please select a source first.");
    setLoading(true);
    setFetched(false);
    setLeads([]);

    const { data: sourceLeads, error: leadsError } = await supabase
      .from("leads")
      .select("id, full_name, email, phone, source, country, interested_status")
      .eq("source", selectedSource);

    if (leadsError) {
      alert("Error: " + leadsError.message);
      setLoading(false);
      return;
    }

    if (!sourceLeads || sourceLeads.length === 0) {
      setFetched(true);
      setLoading(false);
      return;
    }

    const leadIds = sourceLeads.map((l) => l.id);

    const { data: notes } = await supabase
      .from("notes")
      .select("lead_id, note_text")
      .in("lead_id", leadIds);

    const notesByLead = {};
    (notes || []).forEach((n) => {
      if (!notesByLead[n.lead_id]) notesByLead[n.lead_id] = [];
      notesByLead[n.lead_id].push(n.note_text);
    });

    let rows = sourceLeads.map((l) => ({
      id: l.id,
      full_name: l.full_name || "",
      email: l.email || "",
      phone: l.phone || "",
      country: l.country || "",
      status: l.interested_status || "",
      notes: (notesByLead[l.id] || []).join(" | "),
    }));

    if (filterNotes === "with_notes") rows = rows.filter((r) => r.notes.trim().length > 0);
    if (filterNotes === "without_notes") rows = rows.filter((r) => r.notes.trim().length === 0);

    setLeads(rows);
    setFetched(true);
    setLoading(false);
  }

  function downloadXLSX() {
    const sheetData = leads.map((r) => ({
      "Full Name": r.full_name,
      "Email": r.email,
      "Phone": r.phone,
      "Country": r.country,
      "Status": r.status,
      "Notes / Feedback": r.notes,
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    ws["!cols"] = [
      { wch: 25 }, { wch: 35 }, { wch: 18 },
      { wch: 15 }, { wch: 18 }, { wch: 60 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, selectedSource.slice(0, 31));
    XLSX.writeFile(wb, `${selectedSource.replace(/\s+/g, "_")}_export.xlsx`);
  }

  const withNotes = leads.filter((r) => r.notes.trim().length > 0).length;
  const withoutNotes = leads.length - withNotes;

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 960 }}>
      <h2 style={{ marginBottom: "0.25rem", fontSize: 20 }}>Vendor Export</h2>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: "1.5rem" }}>
        Select a source batch, filter by feedback, and download for your vendor.
      </p>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: "1.5rem", alignItems: "flex-end" }}>
        <div>
          <label style={labelStyle}>Source batch</label>
          <select
            value={selectedSource}
            onChange={(e) => { setSelectedSource(e.target.value); setFetched(false); setLeads([]); }}
            style={selectStyle}
          >
            <option value="">— Select source —</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Show leads</label>
          <select
            value={filterNotes}
            onChange={(e) => setFilterNotes(e.target.value)}
            style={selectStyle}
          >
            <option value="all">All leads</option>
            <option value="with_notes">With feedback/notes only</option>
            <option value="without_notes">Without notes only</option>
          </select>
        </div>

        <button onClick={fetchLeads} disabled={loading || !selectedSource} style={btnPrimary}>
          {loading ? "Loading..." : "Load leads"}
        </button>

        {fetched && leads.length > 0 && (
          <button onClick={downloadXLSX} style={btnOutline}>
            ⬇ Download xlsx ({leads.length} leads)
          </button>
        )}
      </div>

      {/* Stats */}
      {fetched && leads.length > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: "1.5rem" }}>
          {[
            { label: "Total", value: leads.length },
            { label: "With notes", value: withNotes },
            { label: "No notes", value: withoutNotes },
          ].map((s) => (
            <div key={s.label} style={statCard}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {fetched && leads.length === 0 && (
        <p style={{ color: "#6b7280", fontSize: 14 }}>No leads found for this selection.</p>
      )}

      {/* Table */}
      {leads.length > 0 && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ overflowX: "auto", maxHeight: 480, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb", position: "sticky", top: 0 }}>
                  {["Full Name", "Email", "Phone", "Country", "Status", "Notes / Feedback"].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={td}>{r.full_name}</td>
                    <td style={td}>{r.email}</td>
                    <td style={td}>{r.phone}</td>
                    <td style={td}>{r.country}</td>
                    <td style={td}>
                      {r.status ? (
                        <span style={{ background: "#e0f2f1", color: "#0f766e", padding: "2px 8px", borderRadius: 99, fontSize: 11 }}>
                          {r.status}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ ...td, color: r.notes ? "#374151" : "#d1d5db", maxWidth: 280 }}>
                      {r.notes || "no notes"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 };
const selectStyle = { padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, minWidth: 200, background: "#fff" };
const btnPrimary = { padding: "9px 20px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, alignSelf: "flex-end" };
const btnOutline = { padding: "9px 20px", background: "#fff", color: "#0f766e", border: "1px solid #0f766e", borderRadius: 8, cursor: "pointer", fontSize: 14, alignSelf: "flex-end" };
const statCard = { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 20px", minWidth: 100 };
const th = { textAlign: "left", padding: "10px 12px", fontWeight: 500, fontSize: 12, color: "#6b7280", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" };
const td = { padding: "8px 12px", verticalAlign: "top", color: "#111827" };
