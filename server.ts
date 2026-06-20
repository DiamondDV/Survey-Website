import express from "express";
import path from "path";
import fs from "fs/promises";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

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

// Helper to initialize or load files
async function loadJSON<T>(filePath: string, defaultVal: T): Promise<T> {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as T;
  } catch (error) {
    await fs.writeFile(filePath, JSON.stringify(defaultVal, null, 2));
    return defaultVal;
  }
}

async function saveJSON<T>(filePath: string, val: T): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(val, null, 2));
}

// Format a single response into Google Sheets row values
function responseToRow(res: SurveyResponse): any[] {
  return [
    res.timestamp,
    res.answers.q1,
    res.answers.q2,
    res.answers.q3,
    res.answers.q4,
    res.answers.q5.join(", "),
    res.answers.q6,
    res.answers.q7,
    res.answers.q8,
    res.answers.q9,
    res.answers.q10
  ];
}

// Append rows directly via Google Sheets HTTP API
async function appendToGoogleSheet(spreadsheetId: string, accessToken: string, response: SurveyResponse): Promise<boolean> {
  try {
    const range = "Sheet1!A:K";
    const values = [responseToRow(response)];
    
    // Check if the sheets exists or append
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
      console.error("Google Sheets append API error:", errorText);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed appending to Google Sheet:", err);
    return false;
  }
}

// Make sure Sheet columns are formatted on setup
async function setupGoogleSheetColumns(spreadsheetId: string, accessToken: string): Promise<boolean> {
  try {
    const range = "Sheet1!A1:K1";
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

    return res.ok;
  } catch (err) {
    console.error("Failed updating Google Sheet headers:", err);
    return false;
  }
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
      const isSynced = await appendToGoogleSheet(config.spreadsheetId, config.adminAccessToken, newResponse);
      newResponse.synced = isSynced;
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

    // Set up headers once to ensure columns exist
    await setupGoogleSheetColumns(sheetId, currentToken);

    for (const resp of responses) {
      if (!resp.synced) {
        const ok = await appendToGoogleSheet(sheetId, currentToken, resp);
        if (ok) {
          resp.synced = true;
          syncCount++;
        }
      }
    }

    if (syncCount > 0) {
      await saveJSON(DATA_FILE, responses);
    }

    res.json({ success: true, syncedCount: syncCount, totalCount: responses.length });
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
