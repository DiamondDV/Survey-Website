import React, { useState, useEffect } from "react";
import { 
  googleSignIn, 
  logout, 
  auth 
} from "../firebase";
import { User } from "firebase/auth";
import { AppConfig, SurveyResponse, SURVEY_QUESTIONS, SurveyAnswers } from "../types";
import { 
  Database, 
  FileSpreadsheet, 
  RefreshCw, 
  LogOut, 
  CheckCircle, 
  AlertCircle, 
  BarChart3, 
  ListOrdered, 
  Settings, 
  Trash2, 
  Plus, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Inbox
} from "lucide-react";

export default function AdminPanel({ onBack }: { onBack: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig>({
    spreadsheetId: null,
    spreadsheetUrl: null,
    adminEmail: null,
    hasToken: false
  });
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [sheetInput, setSheetInput] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'responses' | 'sheets'>('stats');
  const [selectedResponse, setSelectedResponse] = useState<SurveyResponse | null>(null);

  // Load backend states
  useEffect(() => {
    fetchConfigAndResponses();

    // Listen to Firebase sign-in state changes
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const fetchConfigAndResponses = async () => {
    try {
      const configRes = await fetch("/api/config");
      const configData = await configRes.json();
      setConfig(configData);
      if (configData.spreadsheetUrl) {
        setSheetInput(configData.spreadsheetUrl);
      }

      const resResponse = await fetch("/api/responses");
      const resData = await resResponse.json();
      setResponses(resData);
    } catch (err) {
      console.error("Failed to fetch admin config:", err);
    }
  };

  const performAutoCreateSheet = async (userEmail: string, token: string) => {
    try {
      // 1. Create spreadsheet file using Google Sheets API body request
      const sheetsApiUrl = "https://sheets.googleapis.com/v4/spreadsheets";
      const createRes = await fetch(sheetsApiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          properties: {
            title: "Study Habits Survey Responses"
          }
        })
      });

      if (!createRes.ok) {
        throw new Error(await createRes.text());
      }

      const createData = await createRes.json();
      const newId = createData.spreadsheetId;
      const newUrl = createData.spreadsheetUrl;

      // 2. Clear & save configuration on backend
      const configSaveRes = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetId: newId,
          spreadsheetUrl: newUrl,
          adminAccessToken: token,
          adminEmail: userEmail
        })
      });

      if (configSaveRes.ok) {
        setSheetInput(newUrl);
        return { success: true, spreadsheetId: newId, spreadsheetUrl: newUrl };
      }
    } catch (err) {
      console.error("Failed creating spreadsheet automatically:", err);
    }
    return null;
  };

  const handleGoogleSignIn = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        
        // Save token & email to server config so the server can write responses in real-time
        await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adminAccessToken: result.accessToken,
            adminEmail: result.user.email
          })
        });

        // Check if spreadsheetId is already configured. If not, auto-create it immediately!
        const currConfigRes = await fetch("/api/config");
        const currConfig = await currConfigRes.json();

        if (!currConfig.spreadsheetId) {
          const autoSheet = await performAutoCreateSheet(result.user.email || "", result.accessToken);
          if (autoSheet) {
            alert("Authorized! We have automatically created a new 'Study Habits Survey Responses' sheet on your Google Drive and connected it successfully.");
          }
        } else {
          // Sync any local pending responses immediately
          await fetch("/api/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken: result.accessToken })
          });
        }

        await fetchConfigAndResponses();
      }
    } catch (err) {
      console.error("Auth sign-in issue:", err);
      alert("Google Sign-In failed. Please try again.");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setAccessToken(null);
      
      // Wipe administrative access token on server for security
      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminAccessToken: null })
      });
      await fetchConfigAndResponses();
    } catch (err) {
      console.error("Logout issue:", err);
    }
  };

  const handleSaveSheetConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!sheetInput.trim()) return;

    setIsSavingConfig(true);
    let targetId = sheetInput.trim();
    let targetUrl = sheetInput.trim();

    // Extract Google Spreadsheet ID from potential full URLs
    const urlPattern = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = sheetInput.match(urlPattern);
    if (match && match[1]) {
      targetId = match[1];
    }

    try {
      if (!targetUrl.startsWith("http")) {
        targetUrl = `https://docs.google.com/spreadsheets/d/${targetId}/edit`;
      }

      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetId: targetId,
          spreadsheetUrl: targetUrl
        })
      });
      const data = await res.json();
      if (data.spreadsheetId) {
        setConfig(prev => ({
          ...prev,
          spreadsheetId: data.spreadsheetId,
          spreadsheetUrl: data.spreadsheetUrl
        }));
        await fetchConfigAndResponses();
        alert("Spreadsheet connected matches successfully!");
      }
    } catch (err) {
      console.error("Save config failure:", err);
      alert("Failed to connect sheet registry.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleAutoCreateSheet = async () => {
    if (!user || (!accessToken && !config.hasToken)) {
      alert("Please sign in with Google to allow Spreadsheet creation.");
      return;
    }

    setIsCreatingSheet(true);
    const token = accessToken || prompt("No access token cached. Please paste your Google access token:");
    if (!token) {
      setIsCreatingSheet(false);
      return;
    }

    const res = await performAutoCreateSheet(user?.email || config.adminEmail || "", token);
    if (res) {
      await fetchConfigAndResponses();
      alert("Perfect! 'Study Habits Survey Responses' sheet has been created on your Google Drive and connected!");
    } else {
      alert("Error building spreadsheet automatically. Please ensure Google Sheet write authorizations are accurate.");
    }
    setIsCreatingSheet(false);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      // Pass the current active token to server to renew sync validation
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: accessToken })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully synced ${data.syncedCount} response(s) to Google Sheets!`);
        await fetchConfigAndResponses();
      } else {
        alert(data.error || "Failed to trigger sync.");
      }
    } catch (err) {
      console.error("Trigger sync error:", err);
      alert("Sync request failed. Make sure your sheet configuration matches.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearResponses = async () => {
    const confirmation = window.confirm("Are you sure you want to clear all accumulated survey responses locally? Google Sheets contents will remain intact.");
    if (!confirmation) return;

    setIsClearing(true);
    try {
      const res = await fetch("/api/responses/clear", { method: "POST" });
      if (res.ok) {
        setResponses([]);
        setSelectedResponse(null);
      }
    } catch (err) {
      console.error("Clear failed:", err);
    } finally {
      setIsClearing(false);
    }
  };

  // Compute stats helper
  const computeStats = (qId: string) => {
    const counts: { [key: string]: number } = {};
    let total = 0;

    responses.forEach((resp) => {
      const ans = resp.answers[qId as keyof typeof resp.answers];
      if (Array.isArray(ans)) {
        ans.forEach((subAns) => {
          counts[subAns] = (counts[subAns] || 0) + 1;
          total++;
        });
      } else if (ans) {
        counts[ans] = (counts[ans] || 0) + 1;
        total++;
      }
    });

    return { counts, total };
  };

  const pendingSyncCount = responses.filter(r => !r.synced).length;

  return (
    <div className="bg-[#FAF8F5] min-h-[580px] rounded-2xl flex flex-col overflow-hidden border border-neutral-200 shadow-sm" id="admin-panel-container">
      {/* Admin Header */}
      <div className="bg-neutral-900 px-6 py-5 flex items-center justify-between text-[#F4EFEB]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition flex items-center justify-center mr-1"
            title="Return to Survey"
          >
            <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-neutral-400" />
            <span className="font-sans font-medium tracking-wide">Creator Admin Portal</span>
          </div>
        </div>
        
        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-300 font-mono hidden sm:inline">{user.email}</span>
            <button 
              onClick={handleLogout}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          </div>
        ) : (
          <button 
            onClick={handleGoogleSignIn}
            className="px-4 py-1.5 bg-white hover:bg-neutral-100 text-neutral-900 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow"
          >
            {/* Embedded GSI icon */}
            <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
            </svg>
            <span>Auth Google Sheets</span>
          </button>
        )}
      </div>

      {/* Connection & Actions Banner */}
      <div className="bg-neutral-100 border-b border-neutral-205 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-800">Google Sheet Connection:</span>
            {config.spreadsheetId ? (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-mono text-[10px] font-bold flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Connected
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-mono text-[10px] font-bold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Unconfigured
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 max-w-xl">
            {config.spreadsheetId ? (
              <a 
                href={config.spreadsheetUrl || "#"} 
                target="_blank" 
                rel="noreferrer" 
                className="text-neutral-900 underline font-medium hover:text-black flex items-center gap-1"
              >
                Open Google Spreadsheet <ExternalLink className="w-3.5 h-3.5 inline" />
              </a>
            ) : "Responses are currently saved locally. Auth Google & connect a spreadsheet to sync."}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={fetchConfigAndResponses}
            className="p-2 bg-white hover:bg-neutral-50 border border-neutral-300 rounded-lg text-neutral-700 hover:text-neutral-900 transition flex items-center gap-1"
            title="Refresh local data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleManualSync}
            disabled={isSyncing || !config.spreadsheetId}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-[#F4EFEB] disabled:bg-neutral-300 disabled:text-neutral-500 disabled:cursor-not-allowed rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
          >
            {isSyncing ? "Syncing..." : `Sync (${pendingSyncCount} pending)`}
          </button>
        </div>
      </div>

      {/* Inner Navigation Tabs */}
      <div className="border-b border-neutral-200 flex text-xs font-medium">
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 py-3 text-center border-b-2 transition ${
            activeTab === 'stats' 
              ? 'border-neutral-900 text-neutral-900 font-bold' 
              : 'border-transparent text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            <BarChart3 className="w-4 h-4" />
            <span>Statistics ({responses.length})</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('responses')}
          className={`flex-1 py-3 text-center border-b-2 transition ${
            activeTab === 'responses' 
              ? 'border-neutral-900 text-neutral-900 font-bold' 
              : 'border-transparent text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            <ListOrdered className="w-4 h-4" />
            <span>Submissions</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('sheets')}
          className={`flex-1 py-3 text-center border-b-2 transition ${
            activeTab === 'sheets' 
              ? 'border-neutral-900 text-neutral-900 font-bold' 
              : 'border-transparent text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            <Settings className="w-4 h-4" />
            <span>Configuration</span>
          </div>
        </button>
      </div>

      {/* Main Tab Details Area */}
      <div className="flex-1 p-6 overflow-y-auto max-h-[500px]">
        {responses.length === 0 && activeTab !== 'sheets' ? (
          <div className="h-44 flex flex-col items-center justify-center text-center text-neutral-400 gap-2">
            <Inbox className="w-10 h-10 stroke-[1.5]" />
            <p className="text-sm">No responses submitted yet.</p>
            <p className="text-xs">Submit responses in the survey and they will appear here!</p>
          </div>
        ) : (
          <>
            {/* Tab: STATISTICS */}
            {activeTab === 'stats' && (
              <div className="space-y-8" id="tab-statistics">
                {/* Visual Stats Overview cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-3xs">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Total Responses</span>
                    <p className="text-3xl font-bold text-neutral-900">{responses.length}</p>
                  </div>
                  <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-3xs">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Synced to Google</span>
                    <p className="text-3xl font-bold text-emerald-600">{responses.filter(r => r.synced).length}</p>
                  </div>
                  <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-3xs">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Procrastination Factor</span>
                    <div className="flex items-baseline gap-1.5">
                      <p className="text-3xl font-bold text-neutral-900">
                        {Math.floor(
                          (responses.filter(r => ["Often", "Very Often", "Sometimes"].includes(r.answers.q3)).length / responses.length) * 100 || 0
                        )}%
                      </p>
                      <span className="text-[10px] text-neutral-500 flex items-center font-medium gap-0.5"><TrendingUp className="w-3 h-3 text-red-500" /> delay index</span>
                    </div>
                  </div>
                </div>

                {/* Iterate select questions and render clean, pure CSS/Flex percentage displays instead of heavy charts */}
                {SURVEY_QUESTIONS.slice(0, 4).map((q) => {
                  const data = computeStats(q.id);
                  return (
                    <div key={q.id} className="bg-white border border-neutral-200 rounded-xl p-4 shadow-3xs space-y-3">
                      <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider font-mono">Q{q.number}: {q.text}</h3>
                      <div className="space-y-2">
                        {q.options.map((opt) => {
                          const count = data.counts[opt.text] || 0;
                          const pct = responses.length > 0 ? Math.round((count / responses.length) * 100) : 0;
                          return (
                            <div key={opt.key} className="space-y-1">
                              <div className="flex items-center justify-between text-xs text-neutral-700">
                                <span>{opt.text}</span>
                                <span className="font-semibold">{count} ({pct}%)</span>
                              </div>
                              <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden border border-neutral-200 shadow-3xs">
                                <div 
                                  className="bg-neutral-800 h-2 rounded-full" 
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab: INDIVIDUAL RESPONSES */}
            {activeTab === 'responses' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="tab-responses">
                {/* Responses List Side */}
                <div className="md:col-span-1 space-y-2 border-r border-neutral-200 pr-0 md:pr-4">
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest px-2">Submissions</h3>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {responses.map((resp, i) => (
                      <button
                        key={resp.id}
                        onClick={() => setSelectedResponse(resp)}
                        className={`w-full text-left p-3 rounded-lg border transition text-xs flex items-center justify-between
                          ${
                            selectedResponse?.id === resp.id
                              ? "bg-neutral-900 border-neutral-900 text-[#F4EFEB]"
                              : "bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-800"
                          }
                        `}
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold font-mono">Response #{responses.length - i}</p>
                          <p className={`text-[10px] ${selectedResponse?.id === resp.id ? "text-neutral-400" : "text-neutral-500"}`}>
                            {resp.timestamp}
                          </p>
                        </div>
                        <div className="flex items-center">
                          {resp.synced ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Synced" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-amber-500" title="Pending Sync" />
                          )}
                          <ChevronRight className="w-4 h-4 ml-1 opacity-50" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submissions Detail view */}
                <div className="md:col-span-2">
                  {selectedResponse ? (
                    <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4 shadow-3xs">
                      <div className="flex items-center justify-between border-b pb-3">
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-neutral-800 text-sm">Response details</h4>
                          <p className="text-[10px] text-neutral-400 font-mono">ID: {selectedResponse.id} • {selectedResponse.timestamp}</p>
                        </div>
                        <div>
                          {selectedResponse.synced ? (
                            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] font-bold rounded-lg flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> Synced to Sheets
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-5 border border-amber-100 text-amber-800 text-[10px] font-bold rounded-lg flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Pending Sync
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3 divide-y divide-neutral-100 text-xs">
                        {SURVEY_QUESTIONS.map((q) => {
                          const ans = selectedResponse.answers[q.id as keyof SurveyAnswers];
                          return (
                            <div key={q.id} className="pt-2 text-neutral-800">
                              <p className="font-semibold text-neutral-600 mb-1">Q{q.number}: {q.text}</p>
                              <p className="p-2 bg-neutral-50 border rounded-lg font-medium text-neutral-900">
                                {Array.isArray(ans) ? ans.join(", ") : ans || "—"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 rounded-xl p-10 text-center text-neutral-400">
                      <Database className="w-8 h-8 mb-2" />
                      <p className="text-xs">Select a response card from the left panel to examine complete questionnaire values.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab: CONFIGURATION / SETTINGS */}
            {activeTab === 'sheets' && (
              <div className="space-y-6" id="tab-settings">
                <form onSubmit={handleSaveSheetConfig} className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4 shadow-3xs">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                      Google Spreadsheet url or id
                    </label>
                    <input
                      type="text"
                      value={sheetInput}
                      onChange={(e) => setSheetInput(e.target.value)}
                      placeholder="Paste your Google Spreadsheet link or ID here"
                      className="w-full text-xs p-3 bg-neutral-100 border border-neutral-300 rounded-xl focus:border-neutral-900 focus:bg-white outline-none transition"
                    />
                    <p className="text-[10px] text-neutral-400">
                      e.g., https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isCreatingSheet || !user}
                      onClick={handleAutoCreateSheet}
                      className="flex-1 py-2.5 px-4 bg-transparent border border-neutral-300 hover:border-neutral-800 text-neutral-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isCreatingSheet ? "Creating..." : "Create Spreadsheet"}</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isSavingConfig || !sheetInput.trim()}
                      className="flex-1 py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-[#F4EFEB] disabled:bg-neutral-200 disabled:text-neutral-400 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition active:scale-95"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>{isSavingConfig ? "Connecting..." : "Connect Sheet"}</span>
                    </button>
                  </div>
                </form>

                {/* Google Instructions Panel */}
                <div className="bg-neutral-100 border rounded-xl p-4 space-y-2 text-xs text-neutral-600">
                  <h4 className="font-bold text-neutral-800 uppercase tracking-widest text-[10px] flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-blue-500" /> Complete Setup Walkthrough
                  </h4>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Sign in with your Google Account above.</li>
                    <li>Click <strong>Create Spreadsheet</strong>, or paste an existing blank spreadsheet URL.</li>
                    <li>Row headings will be automatically configured for you immediately.</li>
                    <li>All subsequent survey submissions will automatically sync onto your sheet!</li>
                  </ol>
                </div>

                {/* Dangerous buttons area */}
                <div className="bg-red-50/50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h5 className="text-red-800 font-bold text-xs flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" /> Database Maintenance
                    </h5>
                    <p className="text-[10px] text-red-600">Clear local submissions cache for clean questionnaire restarts.</p>
                  </div>
                  <button
                    onClick={handleClearResponses}
                    disabled={isClearing || responses.length === 0}
                    className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-800 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed rounded-lg text-xs font-semibold transition"
                  >
                    {isClearing ? "Clearing..." : "Delete Local Submissions"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
