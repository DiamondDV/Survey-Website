import express from "express";
import path from "path";
import fs from "fs/promises";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, setDoc, getDocs } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

dotenv.config();

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

interface SurveyResponse {
  id: string;
  timestamp: string;
  answers: {
    q1: string; // What grade
    q2: string; // How many hours
    q3: string; // How often delay studying
    q4: string; // Sitting down difficulty
    q5: string[]; // Prevents starting (Select all)
    q6: string; // Opened social media
    q7: string; // How often does this happen
    q8: string; // How useful would help app be
    q9: string; // Would you try it
    q10: string; // Biggest challenge
  };
  synced: boolean;
}

interface AppConfig {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  adminAccessToken: string | null;
  adminEmail: string | null;
}

const DATA_FILE = path.join(process.cwd(), "responses.json");
const CONFIG_FILE = path.join(process.cwd(), "config.json");

// Helper to initialize or load files from cloud or backup local disk
async function loadJSON<T>(filePath: string, defaultVal: T): Promise<T> {
  try {
    if (filePath === CONFIG_FILE) {
      const docRef = doc(db, "configs", "global");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as T;
      }
      try {
        const local = await fs.readFile(filePath, "utf-8");
        const parsed = JSON.parse(local) as T;
        await setDoc(docRef, parsed);
        return parsed;
      } catch (e) {
        await setDoc(docRef, defaultVal as any);
        return defaultVal;
      }
    } else if (filePath === DATA_FILE) {
      const querySnapshot = await getDocs(collection(db, "responses"));
      if (!querySnapshot.empty) {
        const list: any[] = [];
        querySnapshot.forEach((doc) => {
          list.push(doc.data());
        });
        return list as T;
      }
      try {
        const local = await fs.readFile(filePath, "utf-8");
        const parsed = JSON.parse(local) as T;
        for (const item of (parsed as any[])) {
          if (item && item.id) {
            await setDoc(doc(db, "responses", item.id), item);
          }
        }
        return parsed;
      } catch (e) {
        return defaultVal;
      }
    }
  } catch (err) {
    console.error("Firestore read fallback to local JSON file:", err);
  }

  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as T;
  } catch (error) {
    return defaultVal;
  }
}

async function saveJSON<T>(filePath: string, val: T): Promise<void> {
  try {
    if (filePath === CONFIG_FILE) {
      const docRef = doc(db, "configs", "global");
      await setDoc(docRef, val as any);
    } else if (filePath === DATA_FILE) {
      if (Array.isArray(val)) {
        for (const item of val) {
          if (item && item.id) {
            try {
              await setDoc(doc(db, "responses", item.id), item);
            } catch (innerErr) {
              console.error(`Firestore save error for response ${item.id}:`, innerErr);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Firestore save error:", err);
  }

  try {
    await fs.writeFile(filePath, JSON.stringify(val, null, 2));
  } catch (error) {
    console.error("Local disk backup save failed:", error);
  }
}

// Format a single response into Google Sheets row values
function responseToRow(res: SurveyResponse): any[] {
  const answers = res.answers || {} as any;
  const q5Val = Array.isArray(answers.q5) ? answers.q5.join(", ") : (answers.q5 || "");
  return [
    res.timestamp || new Date().toLocaleString(),
    answers.q1 || "",
    answers.q2 || "",
    answers.q3 || "",
    answers.q4 || "",
    q5Val,
    answers.q6 || "",
    answers.q7 || "",
    answers.q8 || "",
    answers.q9 || "",
    answers.q10 || ""
  ];
}

interface AppendResult {
  success: boolean;
  isAuthError?: boolean;
  errorText?: string;
}

// Append rows directly via Google Sheets HTTP API
async function appendToGoogleSheet(spreadsheetId: string, accessToken: string, response: SurveyResponse): Promise<AppendResult> {
  const values = [responseToRow(response)];

  async function tryAppend(range: string): Promise<AppendResult> {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          values
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Google Sheets append API error for range ${range}:`, errorText);
        const isAuthError = res.status === 401 || res.status === 403;
        return { success: false, isAuthError, errorText };
      }
      return { success: true };
    } catch (err: any) {
      console.error(`Failed appending to Google Sheet for range ${range}:`, err);
      return { success: false, errorText: err.message || String(err) };
    }
  }

  // Try appending to Sheet1!A:K first
  let result = await tryAppend("Sheet1!A:K");
  if (!result.success && !result.isAuthError) {
    // If it is a bad request/range error (e.g. Sheet1 doesn't exist due to localized naming),
    // fallback to default first sheet using "A:K"
    const fallbackResult = await tryAppend("A:K");
    if (fallbackResult.success) {
      return fallbackResult;
    }
  }
  return result;
}

// Make sure Sheet columns are formatted on setup
async function setupGoogleSheetColumns(spreadsheetId: string, accessToken: string): Promise<boolean> {
  const headers = [
    "Timestamp",
    "Q1: Grade",
    "Q2: Study Hours/Week",
    "Q3: Delay Frequency",
    "Q4: Decision Difficulty",
    "Q5: Distractions/Prevents Starting",
    "Q6: Social Media Overwhelm",
    "Q7: Overwhelm Frequency",
    "Q8: Smart Planner App Usefulness",
    "Q9: App Adoption Willingness",
    "Q10: Biggest Challenge"
  ];

  async function trySetup(range: string): Promise<boolean> {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          values: [headers]
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`Failed setup columns on range ${range}:`, errText);
        return false;
      }
      return true;
    } catch (err) {
      console.error(`Failed setup Google Sheet headers on range ${range}:`, err);
      return false;
    }
  }

  let ok = await trySetup("Sheet1!A1:K1");
  if (!ok) {
    // Fall back to first sheet default range
    ok = await trySetup("A1:K1");
  }
  return ok;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // GET: App configuration
  app.get("/api/config", async (req, res) => {
    const config = await loadJSON<AppConfig>(CONFIG_FILE, {
      spreadsheetId: null,
      spreadsheetUrl: null,
      adminAccessToken: null,
      adminEmail: null
    });
    // Sanitize access token for security
    res.json({
      spreadsheetId: config.spreadsheetId,
      spreadsheetUrl: config.spreadsheetUrl,
      adminEmail: config.adminEmail,
      hasToken: !!config.adminAccessToken
    });
  });

  // POST: Update configuration
  app.post("/api/config", async (req, res) => {
    const { spreadsheetId, spreadsheetUrl, adminAccessToken, adminEmail } = req.body;
    const config = await loadJSON<AppConfig>(CONFIG_FILE, {
      spreadsheetId: null,
      spreadsheetUrl: null,
      adminAccessToken: null,
      adminEmail: null
    });

    if (spreadsheetId !== undefined) config.spreadsheetId = spreadsheetId;
    if (spreadsheetUrl !== undefined) config.spreadsheetUrl = spreadsheetUrl;
    if (adminAccessToken !== undefined) config.adminAccessToken = adminAccessToken;
    if (adminEmail !== undefined) config.adminEmail = adminEmail;

    await saveJSON(CONFIG_FILE, config);

    // If new spreadsheet configured, try to set up headers
    if (config.spreadsheetId && config.adminAccessToken) {
      await setupGoogleSheetColumns(config.spreadsheetId, config.adminAccessToken);
    }

    res.json({ success: true, spreadsheetId: config.spreadsheetId, spreadsheetUrl: config.spreadsheetUrl });
  });

  // GET: Responses
  app.get("/api/responses", async (req, res) => {
    const responses = await loadJSON<SurveyResponse[]>(DATA_FILE, []);
    res.json(responses);
  });

  // POST: Submit survey response
  app.post("/api/responses", async (req, res) => {
    const answerData = req.body;
    const responses = await loadJSON<SurveyResponse[]>(DATA_FILE, []);
    const config = await loadJSON<AppConfig>(CONFIG_FILE, {
      spreadsheetId: null,
      spreadsheetUrl: null,
      adminAccessToken: null,
      adminEmail: null
    });

    const newResponse: SurveyResponse = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toLocaleString(),
      answers: answerData,
      synced: false
    };

    // Try to sync instantly with Google Sheets if configured and token is present
    if (config.spreadsheetId && config.adminAccessToken) {
      const appendResult = await appendToGoogleSheet(config.spreadsheetId, config.adminAccessToken, newResponse);
      newResponse.synced = appendResult.success;
    }

    responses.push(newResponse);
    await saveJSON(DATA_FILE, responses);

    res.json({ success: true, response: newResponse });
  });

  // POST: Force full manual sync
  app.post("/api/sync", async (req, res) => {
    const { accessToken } = req.body;
    const config = await loadJSON<AppConfig>(CONFIG_FILE, {
      spreadsheetId: null,
      spreadsheetUrl: null,
      adminAccessToken: null,
      adminEmail: null
    });

    if (accessToken) {
      config.adminAccessToken = accessToken;
      await saveJSON(CONFIG_FILE, config);
    }

    const currentToken = config.adminAccessToken;
    const sheetId = config.spreadsheetId;

    if (!sheetId || !currentToken) {
      return res.status(400).json({ error: "Google sheet or authentication token not configured." });
    }

    const responses = await loadJSON<SurveyResponse[]>(DATA_FILE, []);
    let syncCount = 0;
    let authErrorOccurred = false;
    let lastErrorDetails = "";

    // Set up headers once to ensure columns exist
    await setupGoogleSheetColumns(sheetId, currentToken);

    for (const resp of responses) {
      if (!resp.synced) {
        const appendResult = await appendToGoogleSheet(sheetId, currentToken, resp);
        if (appendResult.success) {
          resp.synced = true;
          syncCount++;
        } else {
          if (appendResult.isAuthError) {
            authErrorOccurred = true;
          }
          if (appendResult.errorText) {
            lastErrorDetails = appendResult.errorText;
          }
        }
      }
    }

    if (syncCount > 0) {
      await saveJSON(DATA_FILE, responses);
    }

    const pendingCount = responses.filter(r => !r.synced).length;

    res.json({ 
      success: true, 
      syncedCount: syncCount, 
      totalCount: responses.length,
      pendingCount,
      authError: authErrorOccurred,
      lastError: lastErrorDetails
    });
  });

  // POST: Clear all responses (Reset stats for testing)
  app.post("/api/responses/clear", async (req, res) => {
    await saveJSON(DATA_FILE, []);
    res.json({ success: true });
  });

  // Vite development middleware vs Static Production files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
