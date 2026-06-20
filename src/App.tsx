import React, { useState, useEffect } from "react";
import SurveyWizard from "./components/SurveyWizard";
import AdminPanel from "./components/AdminPanel";
import { SurveyAnswers } from "./types";
import { Database, FileText, Sparkles } from "lucide-react";

export default function App() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [submissionCount, setSubmissionCount] = useState(0);

  // Sync count on startup
  useEffect(() => {
    fetch("/api/responses")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSubmissionCount(data.length);
        }
      })
      .catch(err => console.error("Could not fetch submissions count:", err));
  }, [isAdminMode]);

  const handleSurveySubmit = async (answers: SurveyAnswers) => {
    try {
      const res = await fetch("/api/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(answers)
      });
      const data = await res.json();
      if (data.success) {
        setSubmissionCount(prev => prev + 1);
        return { success: true };
      }
      return { success: false };
    } catch (err) {
      console.error("Failed submitting survey answers:", err);
      return { success: false };
    }
  };

  return (
    <div className="min-h-screen bg-[#F4EFEB] flex flex-col justify-between py-4 px-4 overflow-hidden" id="app-root">
      {/* Main interactive content card without static top headers */}
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-xl">
          {isAdminMode ? (
            <AdminPanel onBack={() => setIsAdminMode(false)} />
          ) : (
            <div className="w-full relative" id="wizard-wrapper">
              <SurveyWizard 
                onSubmit={handleSurveySubmit} 
                onAdminClick={() => setIsAdminMode(true)} 
              />
            </div>
          )}
        </div>
      </main>

      {/* Simplified, zero-clutter semantic copyright line */}
      <footer className="text-center py-2" id="footer-navigation">
        <span className="text-[10px] text-neutral-400 font-medium select-none">
          © {new Date().getFullYear()} Survey Results Saved Securely
        </span>
      </footer>
    </div>
  );
}
