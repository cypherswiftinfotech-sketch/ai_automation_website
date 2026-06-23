"use client";

import { useState, useEffect, useRef } from "react";
import { adminStyles } from "./styles";

import {
  getSettings,
  updateSettings,
  adminLogin,
  listTables,
  getTableRows,
  type AdminTableInfo,
  type AdminTablePage,
} from "../lib/api";

const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined" && window.location.hostname.includes("vercel.app")) {
    return "/_/backend";
  }
  return "http://localhost:8000";
};
const API_URL = getApiUrl();

/* ─── Premium SVG Icons ─── */
const IconUpload = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
);
const IconSettings = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
);
const IconDoc = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
);
const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
);
const IconRecords = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
);
const IconLock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
);
const IconInfo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
);
const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const IconCopy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
);
const IconActivity = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
);

type TabType = "knowledge" | "settings" | "database";

// Predefined AI personality prompt templates for non-technical users
const SYSTEM_PROMPT_PRESETS = [
  {
    title: "🏥 Clinic Receptionist",
    description: "Ideal for doctors, dentists, or wellness consultants. Friendly, patient, and books calls.",
    prompt: "You are a warm, polite AI receptionist for our consulting clinic. Your goals are:\n1. Greet visitors professionally.\n2. Briefly answer questions about our services (refer to the uploaded knowledge base for facts).\n3. Keep answers under 3 sentences.\n4. Ask for the visitor's name and email, then gently invite them to schedule a meeting.\n5. Do not make up clinic policies or prices not in the knowledge base."
  },
  {
    title: "👔 Sales Consultant",
    description: "Ideal for agencies or professional services. Dynamic, qualification-focused, and persuasive.",
    prompt: "You are an expert sales consultant AI. Your tone is professional, confident, and business-focused. Your goals are:\n1. Understand the visitor's challenges and goals.\n2. Position our custom consulting solutions to solve their specific needs.\n3. Ask qualifying questions to evaluate their budget and timeline.\n4. Try to book a discovery call once interest is established.\n5. Remain concise and highly structured."
  },
  {
    title: "🎓 Product Specialist",
    description: "Ideal for software, product demos, or documentation training. Explains details thoroughly.",
    prompt: "You are a friendly AI Product Specialist. Your main role is to act as a knowledgeable guide using our uploaded documents. Your goals are:\n1. Help visitors understand exactly how our service or product works.\n2. Reference specific document details to answer technical or setup queries accurately.\n3. Suggest booking a detailed demonstration call if the user wants a hands-on walk-through.\n4. Maintain a clear, step-by-step communication style."
  }
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>("knowledge");

  /* ─── Knowledge Base state ─── */
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ─── Settings state ─── */
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUsername, setAdminUsername] = useState("admin");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminAuthError, setAdminAuthError] = useState<string>("");

  const [settings, setSettings] = useState({
    avatar_name: "",
    avatar_intro: "",
    system_prompt: "",
  });

  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsResult, setSettingsResult] = useState("");
  const [appliedPresetIndex, setAppliedPresetIndex] = useState<number | null>(null);

  /* ─── Database / CRM state ─── */
  const [tables, setTables] = useState<AdminTableInfo[]>([]);
  const [dbError, setDbError] = useState<string>("");
  const [dbLoading, setDbLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tablePage, setTablePage] = useState<AdminTablePage | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageOffset, setPageOffset] = useState(0);
  const PAGE_SIZE = 50;

  // Custom Detail Drawer for CRM record inspection
  const [inspectingRow, setInspectingRow] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Connection Indicator state
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

  // Load Settings and check connection
  useEffect(() => {
    if (!adminToken) return;
    setConnectionStatus("connecting");
    getSettings(adminToken)
      .then((data) => {
        setSettings(data);
        setConnectionStatus("connected");
      })
      .catch((err) => {
        console.error(err);
        setConnectionStatus("disconnected");
      });
  }, [adminToken]);

  // Load table list whenever admin token is present and the DB tab is open.
  useEffect(() => {
    if (!adminToken || activeTab !== "database") return;
    setDbLoading(true);
    setDbError("");
    listTables(adminToken)
      .then((res) => {
        setTables(res);
        setConnectionStatus("connected");
      })
      .catch((e) => {
        setDbError(e?.message || "Failed to load tables");
        setConnectionStatus("disconnected");
      })
      .finally(() => setDbLoading(false));
  }, [adminToken, activeTab]);

  // Load a page of rows whenever the selected table, page offset, or search
  // query changes.
  useEffect(() => {
    if (!adminToken || !selectedTable) return;
    setTableLoading(true);
    getTableRows(selectedTable, adminToken, {
      limit: PAGE_SIZE,
      offset: pageOffset,
      q: searchQuery || undefined,
    })
      .then((data) => setTablePage(data))
      .catch((e) =>
        setTablePage({
          name: selectedTable,
          rows: [],
          total: 0,
          columns: [],
          available: false,
          error: e?.message,
        })
      )
      .finally(() => setTableLoading(false));
  }, [adminToken, selectedTable, pageOffset, searchQuery]);

  const openTable = (name: string) => {
    setSelectedTable(name);
    setPageOffset(0);
    setSearchInput("");
    setSearchQuery("");
    setInspectingRow(null);
  };

  const commitSearch = () => {
    setSearchQuery(searchInput.trim());
    setPageOffset(0);
  };

  const backToTables = () => {
    setSelectedTable(null);
    setTablePage(null);
    setInspectingRow(null);
  };

  const handleAdminLogin = async () => {
    setAdminAuthError("");
    try {
      const token = await adminLogin(adminUsername, adminPassword);
      setAdminToken(token);
    } catch (e: any) {
      setAdminAuthError(e?.message || "Invalid administrator credentials");
      setAdminToken(null);
    }
  };

  /* ─── Upload logic ─── */
  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setResult("");

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`${API_URL}/admin/upload`, {
        method: "POST",
        headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
        body: form,
      });

      const data = await res.json();
      setResult(
        res.ok
          ? `success:Learning complete! Uploaded "${file.name}" (${data.chunks_stored} knowledge segments indexed).`
          : `error:${data.detail}`
      );
      if (res.ok) setFile(null);
    } catch (e) {
      setResult("error:Upload failed. Please check if the backend service is running.");
    } finally {
      setUploading(false);
    }
  };

  /* ─── Settings logic ─── */
  const handleSaveSettings = async () => {
    if (!adminToken) return;
    setSavingSettings(true);
    setSettingsResult("");
    try {
      await updateSettings(settings, adminToken);
      setSettingsResult("success:Avatar personality updated successfully!");
    } catch (e) {
      setSettingsResult("error:Failed to save settings. Please verify server connection.");
    } finally {
      setSavingSettings(false);
    }
  };

  const applyPreset = (index: number) => {
    setSettings({
      ...settings,
      system_prompt: SYSTEM_PROMPT_PRESETS[index].prompt
    });
    setAppliedPresetIndex(index);
    setTimeout(() => setAppliedPresetIndex(null), 3000);
  };

  /* ─── Drag & drop ─── */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      const ext = droppedFile.name.toLowerCase().split(".").pop();
      if (ext === "pdf" || ext === "docx" || ext === "doc") {
        setFile(droppedFile);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Convert technical table names to friendly user descriptors
  const getFriendlyTableMeta = (name: string) => {
    switch (name) {
      case "leads":
        return {
          title: "👥 Visitor Leads & Scores",
          desc: "Displays contact information and AI-computed interest scores for interested visitors.",
          color: "#8b5cf6"
        };
      case "bookings":
        return {
          title: "📅 Scheduled Appointments",
          desc: "Shows calendar bookings and consultant meetings scheduled by visitors.",
          color: "#10b981"
        };
      case "conversations":
        return {
          title: "💬 Chat Session Logs",
          desc: "Full transcripts and summaries of all visitor conversations with the AI avatar.",
          color: "#3b82f6"
        };
      case "users":
        return {
          title: "👤 Registered Visitors",
          desc: "List of users who created accounts or initiated conversations.",
          color: "#ec4899"
        };
      case "knowledge_chunks":
        return {
          title: "📚 Indexed Information Chunks",
          desc: "The broken-down paragraphs parsed from your uploaded PDF/Word training files.",
          color: "#f59e0b"
        };
      default:
        return {
          title: `⚙️ Database: ${name}`,
          desc: "Raw system record tables.",
          color: "#6b7280"
        };
    }
  };

  // Friendly rendering of cells based on names
  const renderFriendlyCell = (colName: string, value: any) => {
    if (value === null || value === undefined) {
      return <span style={{ color: "#4b5563", fontStyle: "italic" }}>Not set</span>;
    }

    // Format timestamps
    if (colName.endsWith("_at") || colName.startsWith("slot_") || colName === "created_at") {
      try {
        const d = new Date(value);
        return <span title={String(value)}>{d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>;
      } catch {
        return String(value);
      }
    }

    // Format UUIDs to be shorter
    if (typeof value === "string" && value.length === 36 && value.includes("-")) {
      return (
        <span style={{ fontFamily: "monospace", color: "#a78bfa", background: "rgba(167, 139, 250, 0.1)", padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>
          {value.slice(0, 8)}...
        </span>
      );
    }

    // Format Scores
    if (colName === "score" || colName === "lead_score") {
      const score = Number(value);
      let emoji = "❄️";
      let color = "#3b82f6";
      let bg = "rgba(59, 130, 246, 0.15)";
      if (score >= 70) {
        emoji = "🔥";
        color = "#f43f5e";
        bg = "rgba(244, 63, 94, 0.15)";
      } else if (score >= 40) {
        emoji = "⚡";
        color = "#f59e0b";
        bg = "rgba(245, 158, 11, 0.15)";
      }
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 12, backgroundColor: bg, color, fontSize: 11, fontWeight: 600 }}>
          {emoji} {score}/100
        </span>
      );
    }

    // Format Status and Stages
    if (colName === "status" || colName === "stage") {
      const statusText = String(value).toUpperCase();
      let color = "#9ca3af";
      let bg = "rgba(156, 163, 175, 0.1)";
      if (["HOT", "QUALIFICATION", "BOOKING"].includes(statusText)) {
        color = "#ef4444";
        bg = "rgba(239, 68, 68, 0.1)";
      } else if (["WARM", "DISCOVER"].includes(statusText)) {
        color = "#f59e0b";
        bg = "rgba(245, 158, 11, 0.1)";
      } else if (["COLD"].includes(statusText)) {
        color = "#3b82f6";
        bg = "rgba(59, 130, 246, 0.1)";
      } else if (["CONFIRMED", "SUCCESS", "QUALIFIED"].includes(statusText)) {
        color = "#10b981";
        bg = "rgba(16, 185, 129, 0.1)";
      }
      return (
        <span style={{ padding: "2px 8px", borderRadius: 12, backgroundColor: bg, color, fontSize: 10, fontWeight: 700, letterSpacing: "0.02em" }}>
          {statusText}
        </span>
      );
    }

    // Format JSON signals or fields into cleaner tags
    if (typeof value === "object") {
      try {
        const keys = Object.keys(value);
        if (keys.length === 0) return <span style={{ color: "#4b5563" }}>None</span>;
        if (Array.isArray(value)) {
          return <span style={{ color: "#d1d5db" }}>{value.length} items</span>;
        }
        // Extract a key string for lead details (e.g. name or email)
        const nameVal = value.name || value.email || value.phone;
        if (nameVal) return String(nameVal);
        return <span style={{ color: "#9ca3af", fontSize: 11 }}>{keys.length} fields</span>;
      } catch {
        return "[Object]";
      }
    }

    return String(value);
  };

  const ResultBadge = ({ msg }: { msg: string }) => {
    if (!msg) return null;
    const isSuccess = msg.startsWith("success:");
    const text = msg.replace(/^(success|error):/, "");
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 18px",
          borderRadius: 12,
          background: isSuccess ? "rgba(16,185,129,0.06)" : "rgba(244,63,94,0.06)",
          border: `1px solid ${isSuccess ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)"}`,
          fontSize: 13,
          color: isSuccess ? "#34d399" : "#f43f5e",
          marginTop: 12,
          lineHeight: "1.5",
          animation: "fadeIn 0.3s ease"
        }}
      >
        <span style={{ flexShrink: 0 }}>{isSuccess ? <IconCheck /> : <IconX />}</span>
        <span style={{ flex: 1 }}>{text}</span>
      </div>
    );
  };

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        /* Premium custom scrollbar styling */
        .admin-page::-webkit-scrollbar,
        .admin-page *::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .admin-page::-webkit-scrollbar-track,
        .admin-page *::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
        }
        .admin-page::-webkit-scrollbar-thumb,
        .admin-page *::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 99px;
        }
        .admin-page::-webkit-scrollbar-thumb:hover,
        .admin-page *::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .admin-page {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background: radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.08) 0%, rgba(99, 102, 241, 0.03) 50%, rgba(8, 8, 12, 1) 100%) !important;
          color: #e5e7eb;
          overflow-x: hidden;
        }
        .admin-page * { box-sizing: border-box; }

        .sidebar-panel {
          width: 280px;
          padding: 32px 24px;
          border-right: 1px solid rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          background: rgba(10, 10, 15, 0.6);
          backdrop-filter: blur(20px);
          flex-shrink: 0;
          height: 100vh;
          position: sticky;
          top: 0;
        }

        .admin-tab {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 18px; border-radius: 12px;
          border: none; background: transparent; color: #9ca3af;
          font-size: 14px; font-weight: 500; cursor: pointer;
          transition: all 0.2s ease; font-family: inherit;
          width: 100%;
          text-align: left;
        }
        .admin-tab:hover { background: rgba(255,255,255,0.03); color: #f3f4f6; }
        .admin-tab.active {
          background: linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(99, 102, 241, 0.08));
          color: #a78bfa;
          font-weight: 600;
          box-shadow: inset 0 0 12px rgba(124, 58, 237, 0.05);
          border-left: 3px solid #8b5cf6;
        }

        .admin-card {
          background: linear-gradient(145deg, rgba(22, 22, 34, 0.65), rgba(13, 13, 23, 0.75));
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 18px; padding: 28px;
          backdrop-filter: blur(24px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .admin-card:hover { border-color: rgba(139,92,246,0.15); }

        .admin-input {
          width: 100%; padding: 14px 16px; border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(5, 5, 8, 0.4); color: #f3f4f6;
          font-size: 14px; font-family: inherit;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
        }
        .admin-input:focus {
          border-color: rgba(139,92,246,0.4);
          box-shadow: 0 0 0 3px rgba(139,92,246,0.12);
        }
        .admin-input::placeholder { color: #4b5563; }

        textarea.admin-input { resize: vertical; line-height: 1.6; }

        .admin-btn-primary {
          display: inline-flex; align-items: center; justify-content: center;
          gap: 10px; padding: 14px 28px; border-radius: 12px;
          border: none; font-size: 14px; font-weight: 600;
          cursor: pointer; font-family: inherit;
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          color: #fff; transition: all 0.2s ease;
          box-shadow: 0 4px 16px rgba(124,58,237,0.25);
        }
        .admin-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(124,58,237,0.35);
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
        }
        .admin-btn-primary:active:not(:disabled) { transform: translateY(0); }
        .admin-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

        .admin-btn-secondary {
          display: inline-flex; align-items: center; justify-content: center;
          gap: 8px; padding: 12px 20px; border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.08); font-size: 13px; font-weight: 500;
          cursor: pointer; font-family: inherit;
          background: rgba(255,255,255,0.02);
          color: #d1d5db; transition: all 0.2s ease;
        }
        .admin-btn-secondary:hover:not(:disabled) {
          background: rgba(255,255,255,0.06);
          color: #ffffff;
          border-color: rgba(255,255,255,0.15);
        }

        .dropzone {
          border: 2px dashed rgba(139, 92, 246, 0.25);
          border-radius: 16px; padding: 44px 24px;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 12px; cursor: pointer;
          transition: all 0.3s ease;
          background: rgba(139, 92, 246, 0.02);
          min-height: 200px;
        }
        .dropzone:hover, .dropzone.drag-over {
          border-color: rgba(139,92,246,0.6);
          background: rgba(139,92,246,0.05);
          box-shadow: 0 0 20px rgba(139,92,246,0.1);
        }
        .dropzone.has-file {
          border-color: rgba(16, 185, 129, 0.4);
          background: rgba(16, 185, 129, 0.03);
        }

        .file-chip {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 18px; border-radius: 20px;
          background: rgba(139,92,246,0.15);
          border: 1px solid rgba(139,92,246,0.25);
          color: #c4b5fd; font-size: 13px; font-weight: 600;
        }

        .label-text {
          font-size: 12px; font-weight: 700; color: #a1a1aa;
          text-transform: uppercase; letter-spacing: 0.05em;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .label-hint {
          font-size: 12.5px; color: #71717a; margin: -4px 0 10px 0;
          line-height: 1.4;
        }

        .section-heading {
          font-size: 24px; font-weight: 800; color: #f4f4f5;
          margin: 0 0 8px 0; display: flex; align-items: center; gap: 12px;
          letter-spacing: -0.01em;
        }
        .section-sub {
          font-size: 14px; color: #a1a1aa; margin: 0 0 32px 0;
          line-height: 1.5;
        }

        .back-link {
          display: inline-flex; align-items: center; gap: 8px;
          color: #a1a1aa; font-size: 13px; text-decoration: none;
          cursor: pointer; transition: color 0.2s; font-weight: 500;
          border: none; background: none; padding: 0; font-family: inherit;
        }
        .back-link:hover { color: #f4f4f5; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        .brand-logo-container {
          display: flex; align-items: center; gap: 14px;
          margin-bottom: 28px;
        }
        .brand-logo-glow {
          width: 40px; height: 40px; border-radius: 12px;
          background: linear-gradient(135deg, #7c3aed, #3b82f6);
          display: flex; align-items: center; justify-content: center;
          font-weight: 900; font-size: 18px; color: #fff;
          box-shadow: 0 0 18px rgba(124,58,237,0.4);
        }
        .brand-logo-text {
          font-size: 18px; font-weight: 800; color: #ffffff;
          letter-spacing: -0.02em;
        }

        /* Preset Prompt Cards styling */
        .preset-badge {
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }
        .preset-badge:hover {
          background: rgba(139, 92, 246, 0.05);
          border-color: rgba(139, 92, 246, 0.2);
          transform: translateY(-1px);
        }
        .preset-badge-active {
          background: rgba(139, 92, 246, 0.08);
          border-color: rgba(139, 92, 246, 0.4);
        }

        /* Virtual Phone Mockup */
        .phone-mockup {
          width: 100%;
          background: #09090f;
          border: 6px solid #1a1a24;
          border-radius: 32px;
          height: 480px;
          overflow: hidden;
          box-shadow: 0 12px 40px rgba(0,0,0,0.6), inset 0 0 20px rgba(255,255,255,0.02);
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .phone-header {
          background: rgba(20, 20, 30, 0.9);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding: 18px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .phone-avatar-bubble {
          width: 38px; height: 38px; border-radius: 50%;
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          display: flex; align-items: center; justify-content: center;
          color: white; font-weight: 700; font-size: 13px;
        }
        .phone-status-dot {
          width: 8px; height: 8px; border-radius: 50%; background: #10b981;
          display: inline-block;
          box-shadow: 0 0 8px #10b981;
        }
        .phone-chat-body {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: radial-gradient(circle at 50% 10%, rgba(30, 20, 50, 0.25) 0%, rgba(9, 9, 15, 0.6) 100%);
        }
        .phone-msg-incoming {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.04);
          padding: 12px 16px;
          border-radius: 2px 16px 16px 16px;
          max-width: 85%;
          color: #e4e4e7;
          font-size: 13px;
          line-height: 1.5;
          align-self: flex-start;
          box-shadow: 0 2px 10px rgba(0,0,0,0.15);
        }
        .phone-input-bar {
          padding: 12px;
          background: rgba(20, 20, 30, 0.85);
          border-top: 1px solid rgba(255,255,255,0.04);
          display: flex;
          gap: 8px;
        }
        .phone-input {
          flex: 1;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(0,0,0,0.3);
          padding: 8px 14px;
          font-size: 12px;
          color: #9ca3af;
        }

        /* CRM Details Drawer Panel */
        .crm-drawer {
          position: fixed;
          top: 0; right: 0; bottom: 0;
          width: 440px;
          background: rgba(13, 13, 20, 0.95);
          backdrop-filter: blur(30px);
          border-left: 1px solid rgba(255,255,255,0.08);
          box-shadow: -10px 0 40px rgba(0,0,0,0.7);
          z-index: 1000;
          padding: 36px 28px;
          display: flex;
          flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .crm-drawer.open {
          transform: translateX(0);
        }
        .crm-drawer-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          z-index: 999;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s;
        }
        .crm-drawer-backdrop.open {
          opacity: 1;
          pointer-events: auto;
        }

        .crm-meta-badge {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 14px;
        }

        /* Pulsing Online Badge */
        .pulse-online {
          width: 8px; height: 8px; border-radius: 50%;
          background: #10b981;
          display: inline-block;
          position: relative;
        }
        .pulse-online::after {
          content: '';
          width: 100%; height: 100%;
          border-radius: 50%;
          background: #10b981;
          position: absolute;
          top: 0; left: 0;
          animation: pulseGlow 1.8s infinite ease-in-out;
        }
        @keyframes pulseGlow {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.8); opacity: 0; }
        }

        .pulse-connecting {
          width: 8px; height: 8px; border-radius: 50%;
          background: #f59e0b;
          display: inline-block;
        }
      `,
        }}
      />

      <div className="admin-page" style={{ display: "flex", minHeight: "100vh" }}>
        {!adminToken ? (
          /* ─── Sign-In Screen Redesign ─── */
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 20px",
          }}>
            <div className="admin-card fade-in" style={{
              width: "100%",
              maxWidth: 440,
              padding: "40px 36px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
                <div className="brand-logo-glow" style={{ width: 44, height: 44, fontSize: 18 }}>LA</div>
                <div>
                  <div className="brand-logo-text" style={{ fontSize: 20 }}>LiveAvatar Admin</div>
                  <div style={{ fontSize: 12.5, color: "#71717a", marginTop: 2 }}>Secure system configuration portal.</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <div className="label-text">
                    <IconLock /> Username
                  </div>
                  <input
                    className="admin-input"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="admin"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
                <div>
                  <div className="label-text">
                    <IconLock /> Password
                  </div>
                  <input
                    type="password"
                    className="admin-input"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAdminLogin();
                    }}
                  />
                </div>

                <button
                  className="admin-btn-primary"
                  onClick={handleAdminLogin}
                  disabled={!adminUsername || !adminPassword}
                  style={{ marginTop: 8 }}
                >
                  Authorize & Sign In
                </button>

                {adminAuthError && <ResultBadge msg={`error:${adminAuthError}`} />}
              </div>

              <div style={{ marginTop: 28, padding: "14px 18px", borderRadius: 12, backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", fontSize: 12, color: "#71717a", lineHeight: 1.5 }}>
                <span style={{ color: "#a78bfa", fontWeight: 600 }}>💡 Connection Tip:</span> Credentials are managed via the <code style={{ color: "#e4e4e7" }}>ADMIN_USERNAME</code> and <code style={{ color: "#e4e4e7" }}>ADMIN_PASSWORD</code> options in your backend configuration.
              </div>
            </div>
          </div>
        ) : (
          /* ─── Authenticated Shell View ─── */
          <>
            {/* ── Sidebar Redesign ── */}
            <aside className="sidebar-panel">
              <div className="brand-logo-container">
                <div className="brand-logo-glow">LA</div>
                <div className="brand-logo-text">LiveAvatar</div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 6px", marginBottom: 28 }}>
                {connectionStatus === "connected" ? (
                  <>
                    <span className="pulse-online" />
                    <span style={{ fontSize: 12, color: "#a1a1aa" }}>
                      Connected as <strong style={{ color: "#e4e4e7" }}>{adminUsername}</strong>
                    </span>
                  </>
                ) : connectionStatus === "connecting" ? (
                  <>
                    <span className="pulse-connecting" />
                    <span style={{ fontSize: 12, color: "#a1a1aa" }}>Checking connection…</span>
                  </>
                ) : (
                  <>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f43f5e" }} />
                    <span style={{ fontSize: 12, color: "#f43f5e" }}>Server offline</span>
                  </>
                )}
              </div>

              <nav style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  className={`admin-tab ${activeTab === "knowledge" ? "active" : ""}`}
                  onClick={() => { setActiveTab("knowledge"); setInspectingRow(null); }}
                >
                  <IconUpload /> Train Avatar
                </button>
                <button
                  className={`admin-tab ${activeTab === "settings" ? "active" : ""}`}
                  onClick={() => { setActiveTab("settings"); setInspectingRow(null); }}
                >
                  <IconSettings /> Avatar Personality
                </button>
                <button
                  className={`admin-tab ${activeTab === "database" ? "active" : ""}`}
                  onClick={() => { setActiveTab("database"); setInspectingRow(null); }}
                >
                  <IconRecords /> Visitor Records
                </button>
              </nav>

              <div style={{ flex: 1 }} />

              <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20 }}>
                <button
                  className="back-link"
                  onClick={() => { setAdminToken(null); setInspectingRow(null); }}
                  style={{ padding: "6px 4px" }}
                >
                  <IconBack /> Disconnect Panel
                </button>
                <a href="/" className="back-link" style={{ padding: "6px 4px" }}>
                  <IconBack /> Return to Live Chat
                </a>
              </div>
            </aside>

            {/* ── Main Content Area ── */}
            <main style={{
              flex: 1,
              padding: "44px 56px",
              maxWidth: 1100,
              overflowY: "auto",
              height: "100vh"
            }}>
              
              {/* ── Tab: Train Avatar (Knowledge Base) ── */}
              {activeTab === "knowledge" && (
                <div className="fade-in">
                  <h1 className="section-heading">
                    <span style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.15))",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      color: "#c4b5fd"
                    }}>
                      <IconUpload />
                    </span>
                    Teach Your AI Avatar
                  </h1>
                  <p className="section-sub">
                    Upload manuals, guidelines, product sheets, or FAQs. The avatar will read these documents to answer customer questions accurately.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 28 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      <div className="admin-card">
                        {/* Drag and Drop Zone */}
                        <div
                          className={`dropzone ${dragOver ? "drag-over" : ""} ${file ? "has-file" : ""}`}
                          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.docx,.doc"
                            style={{ display: "none" }}
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                          />
                          {file ? (
                            <>
                              <div className="file-chip">
                                <IconDoc />
                                {file.name}
                              </div>
                              <span style={{ fontSize: 13, color: "#a1a1aa", fontWeight: 500 }}>
                                {(file.size / 1024).toFixed(1)} KB — Click or drop another to replace
                              </span>
                            </>
                          ) : (
                            <>
                              <div style={{ color: "#8b5cf6", opacity: 0.85 }}><IconDoc /></div>
                              <span style={{ fontSize: 15, color: "#e4e4e7", fontWeight: 600 }}>
                                Drag & drop your training document here
                              </span>
                              <span style={{ fontSize: 12.5, color: "#71717a" }}>
                                or click to browse files
                              </span>
                              <span style={{ fontSize: 11, color: "#4b5563", background: "rgba(255,255,255,0.02)", padding: "4px 10px", borderRadius: 6, marginTop: 4 }}>
                                Supported: PDF, DOCX (Word) · Max size 10MB
                              </span>
                            </>
                          )}
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                          <button
                            className="admin-btn-primary"
                            onClick={upload}
                            disabled={!file || uploading}
                          >
                            {uploading ? (
                              <>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                Reading and indexing file…
                              </>
                            ) : (
                              <>
                                <IconUpload />
                                Teach Avatar Now
                              </>
                            )}
                          </button>
                        </div>

                        <ResultBadge msg={result} />
                      </div>
                    </div>

                    {/* Guidelines and Tips on the side */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      <div className="admin-card" style={{ padding: 22 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 14px 0", color: "#e4e4e7", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 8 }}>
                          <IconInfo /> Formatting Tips
                        </h3>
                        <ul style={{ paddingLeft: 16, margin: 0, fontSize: 13, color: "#a1a1aa", display: "flex", flexDirection: "column", gap: 10, lineHeight: 1.45 }}>
                          <li>
                            <strong style={{ color: "#d4d4d8" }}>Keep text simple:</strong> Avoid heavily decorated layouts or scans. Standard digital text is indexed best.
                          </li>
                          <li>
                            <strong style={{ color: "#d4d4d8" }}>Question & Answer:</strong> Formatting information as Q&A blocks makes it very easy for the AI to find answers.
                          </li>
                          <li>
                            <strong style={{ color: "#d4d4d8" }}>Up-to-date data:</strong> Make sure contact emails, pricing plans, and clinic schedules in the document match your current setup.
                          </li>
                        </ul>
                      </div>

                      <div className="admin-card" style={{ padding: 22, borderLeft: "4px solid #8b5cf6" }}>
                        <h4 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 6px 0", color: "#c4b5fd" }}>How it works</h4>
                        <p style={{ fontSize: 12, color: "#71717a", margin: 0, lineHeight: 1.5 }}>
                          When you upload a file, the system splits it into tiny thematic chunks. When a user asks a question, the AI retrieves the most relevant chunk to formulate an accurate response.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab: Avatar Personality Settings ── */}
              {activeTab === "settings" && (
                <div className="fade-in">
                  <h1 className="section-heading">
                    <span style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.15))",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      color: "#c4b5fd"
                    }}>
                      <IconSettings />
                    </span>
                    Avatar Identity & Behavior
                  </h1>
                  <p className="section-sub">
                    Configure how your AI avatar introduces itself, and how it behaves during chat sessions.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 32, alignItems: "start" }}>
                    
                    {/* Inputs panel */}
                    <div className="admin-card" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      
                      {/* Avatar Name */}
                      <div>
                        <div className="label-text">Avatar Name</div>
                        <div className="label-hint">The display name visitors see when they open the chat.</div>
                        <input
                          className="admin-input"
                          value={settings.avatar_name}
                          onChange={(e) => setSettings({ ...settings, avatar_name: e.target.value })}
                          placeholder="e.g. Avor, Dr. Sarah's Assistant"
                        />
                      </div>

                      {/* Welcome Message */}
                      <div>
                        <div className="label-text">Welcome Greeting Message</div>
                        <div className="label-hint">
                          The first bubble your avatar speaks. Keep it warm. 
                          Use <code style={{ color: "#a78bfa" }}>{"{avatar_name}"}</code> or <code style={{ color: "#a78bfa" }}>{"{user_name}"}</code> to customize.
                        </div>
                        <textarea
                          className="admin-input"
                          rows={3}
                          value={settings.avatar_intro}
                          onChange={(e) => setSettings({ ...settings, avatar_intro: e.target.value })}
                          placeholder="Hello {user_name}! I'm {avatar_name}, how can I help you today?"
                        />
                      </div>

                      {/* System Prompt & Presets */}
                      <div>
                        <div className="label-text" style={{ justifyContent: "space-between" }}>
                          <span>AI Role & Instructions (System Prompt)</span>
                        </div>
                        <div className="label-hint">
                          Define the avatar's goals and personality. You can write your own or click a preset below to instantly load optimized rules.
                        </div>

                        {/* Presets Cards */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                          {SYSTEM_PROMPT_PRESETS.map((preset, idx) => (
                            <div
                              key={idx}
                              className={`preset-badge ${settings.system_prompt === preset.prompt ? "preset-badge-active" : ""}`}
                              onClick={() => applyPreset(idx)}
                            >
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#e4e4e7" }}>{preset.title}</div>
                              <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>{preset.description}</div>
                            </div>
                          ))}
                        </div>

                        <textarea
                          className="admin-input"
                          rows={6}
                          value={settings.system_prompt}
                          onChange={(e) => setSettings({ ...settings, system_prompt: e.target.value })}
                          placeholder="Write behavioral instructions here..."
                          style={{ fontFamily: "monospace", fontSize: 13 }}
                        />
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                        <span style={{ fontSize: 12, color: "#71717a" }}>
                          {appliedPresetIndex !== null && (
                            <span style={{ color: "#34d399", fontWeight: 500, animation: "fadeIn 0.2s" }}>
                              ✓ Preset applied to editor!
                            </span>
                          )}
                        </span>
                        
                        <button
                          className="admin-btn-primary"
                          onClick={handleSaveSettings}
                          disabled={savingSettings}
                        >
                          {savingSettings ? (
                            <>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                              Saving identity…
                            </>
                          ) : (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                              Save Avatar Settings
                            </>
                          )}
                        </button>
                      </div>

                      <ResultBadge msg={settingsResult} />
                    </div>

                    {/* Right Column: Interactive Chat Preview Mockup */}
                    <div style={{ position: "sticky", top: 40, display: "flex", flexDirection: "column", gap: 14 }}>
                      <div className="label-text" style={{ paddingLeft: 6 }}>
                        <IconActivity /> Real-time Visitor Preview
                      </div>
                      <div className="phone-mockup">
                        <div className="phone-header">
                          <div className="phone-avatar-bubble">
                            {settings.avatar_name ? settings.avatar_name.slice(0,2).toUpperCase() : "AI"}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#f4f4f5", display: "flex", alignItems: "center", gap: 6 }}>
                              {settings.avatar_name || "AI Consultant"}
                              <span className="phone-status-dot" />
                            </div>
                            <div style={{ fontSize: 10, color: "#71717a", marginTop: 1 }}>Consulting Avatar</div>
                          </div>
                        </div>

                        <div className="phone-chat-body">
                          <div className="phone-msg-incoming">
                            {settings.avatar_intro 
                              ? settings.avatar_intro
                                  .replace(/{avatar_name}/g, settings.avatar_name || "Avor")
                                  .replace(/{user_name}/g, "Guest")
                              : "Hello! I am ready to consult you."
                            }
                          </div>
                        </div>

                        <div className="phone-input-bar">
                          <div className="phone-input">Ask a question about our services...</div>
                          <button style={{ borderRadius: "50%", width: 28, height: 28, border: "none", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "not-allowed", fontSize: 12 }}>
                            ➔
                          </button>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "#71717a", textAlign: "center", padding: "0 10px", lineHeight: 1.45 }}>
                        This shows how the greeting text looks inside the customer's chat interface. Note that bracket variables like <code style={{ color: "#a78bfa" }}>{"{user_name}"}</code> automatically resolve.
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* ── Tab: System Records & Customer Leads (Database) ── */}
              {activeTab === "database" && (
                <div className="fade-in">
                  <h1 className="section-heading">
                    <span style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.15))",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      color: "#c4b5fd"
                    }}>
                      <IconRecords />
                    </span>
                    Activity & Customer Records
                  </h1>
                  <p className="section-sub">
                    Browse all captured sales leads, scheduled appointments, and detailed chat logs parsed by the avatar.
                  </p>

                  {!selectedTable && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {dbLoading && (
                        <div className="admin-card" style={{ textAlign: "center", padding: 40 }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1.2s linear infinite", color: "#8b5cf6", marginBottom: 12 }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          <div style={{ fontSize: 14, color: "#a1a1aa" }}>Loading system files…</div>
                        </div>
                      )}
                      
                      {dbError && (
                        <ResultBadge msg={`error:${dbError}`} />
                      )}

                      {!dbLoading && !dbError && tables.length === 0 && (
                        <div className="admin-card" style={{ textAlign: "center", padding: 40, color: "#71717a" }}>
                          No database records found.
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
                        {tables.map((t) => {
                          const meta = getFriendlyTableMeta(t.name);
                          return (
                            <button
                              key={t.name}
                              onClick={() => t.available && openTable(t.name)}
                              disabled={!t.available}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                padding: "24px 22px",
                                borderRadius: 16,
                                border: "1px solid rgba(255,255,255,0.06)",
                                background: "rgba(22, 22, 34, 0.4)",
                                cursor: t.available ? "pointer" : "not-allowed",
                                textAlign: "left",
                                transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                                width: "100%",
                                outline: "none",
                                opacity: t.available ? 1 : 0.6
                              }}
                              onMouseOver={(e) => {
                                if (t.available) {
                                  e.currentTarget.style.borderColor = meta.color;
                                  e.currentTarget.style.backgroundColor = "rgba(22, 22, 34, 0.75)";
                                  e.currentTarget.style.transform = "translateY(-2px)";
                                  e.currentTarget.style.boxShadow = `0 10px 24px rgba(0,0,0,0.3)`;
                                }
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                                e.currentTarget.style.backgroundColor = "rgba(22, 22, 34, 0.4)";
                                e.currentTarget.style.transform = "none";
                                e.currentTarget.style.boxShadow = "none";
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: 8 }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: "#f4f4f5" }}>
                                  {meta.title}
                                </div>
                                <span style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  padding: "3px 9px",
                                  borderRadius: 12,
                                  background: "rgba(255,255,255,0.04)",
                                  border: "1px solid rgba(255,255,255,0.05)",
                                  color: meta.color
                                }}>
                                  {t.row_count != null ? `${t.row_count.toLocaleString()} rows` : "0"}
                                </span>
                              </div>

                              <p style={{ fontSize: 13, color: "#71717a", margin: "0 0 16px 0", lineHeight: 1.45, flex: 1 }}>
                                {meta.desc}
                              </p>

                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", fontSize: 11.5, color: "#4b5563", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 12 }}>
                                <span>Table: <code style={{ fontFamily: "monospace", color: "#a1a1aa" }}>{t.name}</code></span>
                                {t.available ? (
                                  <span style={{ color: "#34d399", fontWeight: 600 }}>Explore data ➔</span>
                                ) : (
                                  <span style={{ color: "#ef4444" }}>Unavailable</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedTable && (
                    <div className="admin-card fade-in" style={{ padding: "24px 20px" }}>
                      
                      {/* Breadcrumbs Navigation */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <button className="back-link" onClick={backToTables}>
                            <IconBack /> All Records
                          </button>
                          <span style={{ color: "#4b5563" }}>/</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#c4b5fd", display: "flex", alignItems: "center", gap: 6 }}>
                            {getFriendlyTableMeta(selectedTable).title.split(" ").slice(1).join(" ")}
                            <code style={{
                              color: "#8b5cf6",
                              background: "rgba(139,92,246,0.1)",
                              padding: "2px 8px",
                              borderRadius: 6,
                              fontSize: 12,
                              fontFamily: "monospace",
                              marginLeft: 4
                            }}>{selectedTable}</code>
                          </span>
                        </div>

                        {tablePage && tablePage.available && (
                          <div style={{ fontSize: 12.5, color: "#71717a" }}>
                            Found <strong style={{ color: "#e4e4e7" }}>{tablePage.total.toLocaleString()}</strong> records
                          </div>
                        )}
                      </div>

                      {/* Search and Filters Bar */}
                      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                        <div style={{ position: "relative", flex: 1 }}>
                          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#4b5563" }}><IconSearch /></span>
                          <input
                            className="admin-input"
                            placeholder="Type search terms and press Enter..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitSearch();
                            }}
                            style={{ paddingLeft: 40 }}
                          />
                        </div>
                        <button className="admin-btn-primary" onClick={commitSearch}>
                          Search
                        </button>
                      </div>

                      {tableLoading && (
                        <div style={{ textAlign: "center", padding: "40px 0" }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite", color: "#8b5cf6", marginBottom: 8 }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          <div style={{ fontSize: 13, color: "#71717a" }}>Fetching records…</div>
                        </div>
                      )}
                      
                      {tablePage?.error && (
                        <ResultBadge msg={`error:${tablePage.error}`} />
                      )}

                      {tablePage && !tableLoading && !tablePage.error && (
                        <>
                          {tablePage.rows.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "40px 0", color: "#71717a", fontSize: 13 }}>
                              No records match your search criteria.
                            </div>
                          ) : (
                            <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12, background: "rgba(0,0,0,0.15)" }}>
                              <table style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                fontSize: 12.5,
                                textAlign: "left"
                              }}>
                                <thead>
                                  <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                                    {tablePage.columns.map((c) => (
                                      <th key={c} style={{
                                        padding: "14px 16px",
                                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                                        color: "#71717a",
                                        fontWeight: 700,
                                        fontSize: 10.5,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.05em",
                                        whiteSpace: "nowrap"
                                      }}>
                                        {c.replace(/_/g, ' ')}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {tablePage.rows.map((row, i) => (
                                    <tr 
                                      key={i} 
                                      onClick={() => setInspectingRow(row)}
                                      style={{ 
                                        borderBottom: "1px solid rgba(255,255,255,0.03)", 
                                        cursor: "pointer",
                                        transition: "background-color 0.15s"
                                      }}
                                      className="table-row-hover"
                                      onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)"; }}
                                      onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                                    >
                                      {tablePage.columns.map((c) => {
                                        return (
                                          <td key={c} style={{
                                            padding: "12px 16px",
                                            color: "#d1d5db",
                                            maxWidth: 240,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                          }}>
                                            {renderFriendlyCell(c, row[c])}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Pagination Bar */}
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginTop: 20,
                            fontSize: 13,
                            color: "#71717a",
                            padding: "0 4px"
                          }}>
                            <span>
                              Showing records <strong style={{ color: "#d1d5db" }}>{pageOffset + 1}–{Math.min(pageOffset + PAGE_SIZE, tablePage.total)}</strong> of <strong style={{ color: "#d1d5db" }}>{tablePage.total}</strong>
                            </span>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                className="admin-btn-secondary"
                                onClick={() => setPageOffset(Math.max(0, pageOffset - PAGE_SIZE))}
                                disabled={pageOffset === 0}
                                style={{ padding: "8px 16px", borderRadius: 8 }}
                              >
                                Prev Page
                              </button>
                              <button
                                className="admin-btn-secondary"
                                onClick={() => setPageOffset(pageOffset + PAGE_SIZE)}
                                disabled={pageOffset + PAGE_SIZE >= tablePage.total}
                                style={{ padding: "8px 16px", borderRadius: 8 }}
                              >
                                Next Page
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </main>

            {/* ── CRM Details Drawer Backdrop ── */}
            <div 
              className={`crm-drawer-backdrop ${inspectingRow ? "open" : ""}`} 
              onClick={() => setInspectingRow(null)} 
            />

            {/* ── CRM Details Drawer Panel ── */}
            <div className={`crm-drawer ${inspectingRow ? "open" : ""}`}>
              {inspectingRow && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 16 }}>
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 800, color: "#ffffff", margin: 0 }}>Record Inspector</h2>
                      <div style={{ fontSize: 11, color: "#71717a", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>Table: {selectedTable}</div>
                    </div>
                    <button 
                      onClick={() => setInspectingRow(null)}
                      style={{ 
                        border: "none", background: "rgba(255,255,255,0.04)", 
                        color: "#9ca3af", width: 32, height: 32, borderRadius: "50%", 
                        display: "flex", alignItems: "center", justifyContent: "center", 
                        cursor: "pointer"
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#ffffff"; }}
                      onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#9ca3af"; }}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20, paddingRight: 4 }}>
                    
                    {/* Render Special Lead Info Profile */}
                    {selectedTable === "leads" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        {/* Lead Score Circle Gauge */}
                        <div className="crm-meta-badge" style={{ borderLeft: "4px solid #8b5cf6" }}>
                          <div style={{ fontSize: 11, color: "#71717a", textTransform: "uppercase", fontWeight: 700 }}>AI Lead Score</div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                            <span style={{ fontSize: 28, fontWeight: 900, color: "#ffffff" }}>{String(inspectingRow.score || 0)}</span>
                            <span style={{ fontSize: 13, color: "#4b5563" }}>/ 100</span>
                            <span style={{ 
                              fontSize: 12, fontWeight: 700, marginLeft: "auto", 
                              color: Number(inspectingRow.score || 0) >= 70 ? "#f43f5e" : Number(inspectingRow.score || 0) >= 40 ? "#f59e0b" : "#3b82f6" 
                            }}>
                              {Number(inspectingRow.score || 0) >= 70 ? "🔥 Hot Prospect" : Number(inspectingRow.score || 0) >= 40 ? "⚡ Interested" : "❄️ Cold / Query"}
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.04)", borderRadius: 3, marginTop: 10, overflow: "hidden" }}>
                            <div style={{ 
                              height: "100%", 
                              width: `${inspectingRow.score || 0}%`, 
                              background: Number(inspectingRow.score || 0) >= 70 ? "linear-gradient(90deg, #8b5cf6, #f43f5e)" : "linear-gradient(90deg, #3b82f6, #f59e0b)",
                              borderRadius: 3 
                            }} />
                          </div>
                        </div>

                        {/* Customer Contact Card */}
                        {inspectingRow.qualified_fields && typeof inspectingRow.qualified_fields === "object" && (
                          <div className="crm-meta-badge">
                            <div style={{ fontSize: 11, color: "#71717a", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>Contact Data Collected</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                              {Object.entries(inspectingRow.qualified_fields as Record<string, any>).map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.02)", paddingBottom: 6 }}>
                                  <span style={{ color: "#71717a", textTransform: "capitalize" }}>{k.replace(/_/g, ' ')}:</span>
                                  <strong style={{ color: "#e4e4e7" }}>{String(v)}</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Buying Signals checklist */}
                        {inspectingRow.signals && typeof inspectingRow.signals === "object" && (
                          <div className="crm-meta-badge">
                            <div style={{ fontSize: 11, color: "#71717a", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>AI-Detected Signals</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {Object.entries(inspectingRow.signals as Record<string, any>).map(([key, val]) => {
                                const active = Boolean(val);
                                return (
                                  <span 
                                    key={key} 
                                    style={{ 
                                      fontSize: 11, padding: "5px 10px", borderRadius: 20, 
                                      background: active ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)", 
                                      border: `1px solid ${active ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)"}`,
                                      color: active ? "#34d399" : "#71717a",
                                      display: "inline-flex", alignItems: "center", gap: 6
                                    }}
                                  >
                                    <span>{active ? "✓" : "✗"}</span>
                                    <span>{key.replace(/_/g, ' ')}</span>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Objections Handled */}
                        {Array.isArray(inspectingRow.objections) && inspectingRow.objections.length > 0 && (
                          <div className="crm-meta-badge">
                            <div style={{ fontSize: 11, color: "#71717a", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Objections Raised ({inspectingRow.objections.length})</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {inspectingRow.objections.map((obj: any, idx: number) => (
                                <div key={idx} style={{ fontSize: 12.5, padding: "6px 10px", borderRadius: 8, background: "rgba(244,63,94,0.04)", border: "1px solid rgba(244,63,94,0.1)", color: "#f43f5e" }}>
                                  ⚠ {String(obj)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Booked Appointments details */}
                    {selectedTable === "bookings" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        <div className="crm-meta-badge" style={{ borderLeft: "4px solid #10b981", background: "rgba(16,185,129,0.02)" }}>
                          <div style={{ fontSize: 11, color: "#71717a", textTransform: "uppercase", fontWeight: 700 }}>Meeting Details</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#ffffff", marginTop: 8 }}>
                            {String(inspectingRow.attendee_name || "Guest Attendee")}
                          </div>
                          <div style={{ fontSize: 13, color: "#a1a1aa", marginTop: 2 }}>
                            {String(inspectingRow.attendee_email || "No email provided")}
                          </div>

                          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span style={{ color: "#71717a" }}>Starts:</span>
                              <strong style={{ color: "#e4e4e7" }}>
                                {inspectingRow.slot_start ? new Date(String(inspectingRow.slot_start)).toLocaleString() : "—"}
                              </strong>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span style={{ color: "#71717a" }}>Ends:</span>
                              <strong style={{ color: "#e4e4e7" }}>
                                {inspectingRow.slot_end ? new Date(String(inspectingRow.slot_end)).toLocaleString() : "—"}
                              </strong>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span style={{ color: "#71717a" }}>Timezone:</span>
                              <span style={{ color: "#a1a1aa" }}>{String(inspectingRow.timezone || "UTC")}</span>
                            </div>
                          </div>
                        </div>

                        <div className="crm-meta-badge">
                          <div style={{ fontSize: 11, color: "#71717a", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Meeting Status</div>
                          <span style={{ 
                            display: "inline-block", padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                            backgroundColor: "rgba(16, 185, 129, 0.1)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.15)"
                          }}>
                            ✓ {String(inspectingRow.status || "CONFIRMED").toUpperCase()}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* General properties listing */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ fontSize: 11, color: "#71717a", textTransform: "uppercase", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 6 }}>All Properties</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {Object.entries(inspectingRow).map(([key, val]) => {
                          // Skip rendering sub-objects if we already customized them above
                          if (["qualified_fields", "signals", "objections"].includes(key) && selectedTable === "leads") return null;
                          if (["attendee_name", "attendee_email", "slot_start", "slot_end", "timezone"].includes(key) && selectedTable === "bookings") return null;

                          const isId = key === "id" || key.endsWith("_id");
                          const displayVal = val === null || val === undefined
                            ? "Not set"
                            : typeof val === "object"
                              ? JSON.stringify(val, null, 2)
                              : String(val);

                          return (
                            <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: "#71717a" }}>{key}</span>
                              <div style={{ 
                                display: "flex", alignItems: "center", gap: 8, 
                                padding: "10px 12px", borderRadius: 8, 
                                background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.03)" 
                              }}>
                                <span style={{ 
                                  fontSize: 12.5, 
                                  fontFamily: isId || typeof val === "object" ? "monospace" : "inherit",
                                  color: val === null || val === undefined ? "#4b5563" : "#d1d5db",
                                  whiteSpace: typeof val === "object" ? "pre-wrap" : "normal",
                                  wordBreak: "break-all",
                                  flex: 1
                                }}>
                                  {displayVal}
                                </span>
                                {isId && typeof val === "string" && (
                                  <button
                                    onClick={() => copyToClipboard(val)}
                                    style={{
                                      border: "none", background: "rgba(255,255,255,0.03)",
                                      color: "#8b5cf6", fontSize: 11, cursor: "pointer",
                                      padding: "4px 8px", borderRadius: 4
                                    }}
                                  >
                                    {copiedId === val ? "Copied" : <IconCopy />}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
