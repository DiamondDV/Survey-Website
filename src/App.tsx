import React, { useState, useEffect } from "react";
import SurveyWizard from "./components/SurveyWizard";
import AdminPanel from "./components/AdminPanel";
import { SurveyAnswers } from "./types";
import { Database, FileText, Sparkles, Lock, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [showPinGate, setShowPinGate] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

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

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === "0428") {
      setPinError(false);
      setShowPinGate(false);
      setIsAdminMode(true);
      setPinInput("");
    } else {
      setPinError(true);
      setPinInput("");
      // Clear error alert color after custom duration
      setTimeout(() => setPinError(false), 2000);
    }
  };

  const handleKeyPadClick = (num: string) => {
    setPinError(false);
    if (pinInput.length < 4) {
      const nextPin = pinInput + num;
      setPinInput(nextPin);
      
      // Auto-submit when exactly 4 digits are specified
      if (nextPin === "0428") {
        setTimeout(() => {
          setShowPinGate(false);
          setIsAdminMode(true);
          setPinInput("");
        }, 300);
      } else if (nextPin.length === 4) {
        setTimeout(() => {
          setPinError(true);
          setPinInput("");
        }, 300);
      }
    }
  };

  const handleBackspace = () => {
    setPinInput(prev => prev.slice(0, -1));
  };

  return (
    <div className="min-h-screen bg-[#F4EFEB] flex flex-col justify-between py-4 px-4 overflow-hidden relative" id="app-root">
      {/* Main interactive content card without static top headers */}
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-xl">
          {isAdminMode ? (
            <AdminPanel onBack={() => setIsAdminMode(false)} />
          ) : (
            <div className="w-full relative" id="wizard-wrapper">
              <SurveyWizard 
                onSubmit={handleSurveySubmit} 
                onAdminClick={() => {
                  setPinInput("");
                  setPinError(false);
                  setShowPinGate(true);
                }} 
              />
            </div>
          )}
        </div>
      </main>

      {/* High Fidelity Animated Passcode PIN Gate Overlay */}
      <AnimatePresence>
        {showPinGate && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutral-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
            id="pin-gate-overlay"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              className="bg-white max-w-xs w-full rounded-2xl shadow-xl p-6 border border-neutral-100 flex flex-col items-center relative text-center"
              id="pin-gate-card"
            >
              {/* Close Button */}
              <button 
                onClick={() => setShowPinGate(false)}
                className="absolute top-4 right-4 p-1 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-800 mb-4 mt-2">
                <Lock className="w-5 h-5" />
              </div>

              <h2 className="text-lg font-sans font-medium text-neutral-900 mb-1">Enter Portal PIN</h2>
              <p className="text-neutral-500 text-xs mb-6 px-4">Authorized credential required to configure Sheets</p>

              {/* PIN Code Dots Indicator */}
              <div className="flex gap-4 mb-8 justify-center items-center h-6">
                {[0, 1, 2, 3].map((idx) => {
                  const hasVal = pinInput.length > idx;
                  return (
                    <motion.div
                      key={idx}
                      animate={pinError ? { x: [0, -6, 6, -6, 0] } : { scale: hasVal ? 1.25 : 1 }}
                      transition={{ duration: pinError ? 0.4 : 0.15 }}
                      className={`w-3.5 h-3.5 rounded-full transition-colors duration-200 ${
                        pinError
                          ? "bg-red-500 border-red-500"
                          : hasVal
                          ? "bg-neutral-900"
                          : "bg-neutral-200"
                      }`}
                    />
                  );
                })}
              </div>

              {/* Status or error feedback */}
              <div className="h-4 mb-4">
                {pinError && (
                  <span className="text-red-500 text-xs font-semibold animate-pulse">Incorrect PIN Code</span>
                )}
              </div>

              {/* Circular Keypad Grid */}
              <div className="grid grid-cols-3 gap-3 w-full px-2" id="keypad">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleKeyPadClick(num)}
                    className="w-14 h-14 mx-auto rounded-full bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-800 text-lg font-medium font-sans flex items-center justify-center transition-all duration-150 select-none cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={handleBackspace}
                  className="w-14 h-14 mx-auto rounded-full bg-transparent text-xs font-semibold text-neutral-500 hover:text-neutral-700 flex items-center justify-center transition select-none"
                >
                  Clear
                </button>
                <button
                  onClick={() => handleKeyPadClick("0")}
                  className="w-14 h-14 mx-auto rounded-full bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-800 text-lg font-medium font-sans flex items-center justify-center transition-all duration-150 select-none cursor-pointer"
                >
                  0
                </button>
                <button
                  onClick={() => setShowPinGate(false)}
                  className="w-14 h-14 mx-auto rounded-full bg-transparent text-xs font-semibold text-neutral-400 hover:text-neutral-600 flex items-center justify-center transition select-none"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Simplified, zero-clutter semantic copyright line */}
      <footer className="text-center py-2" id="footer-navigation">
        <span className="text-[10px] text-neutral-400 font-medium select-none">
          © {new Date().getFullYear()} Survey Results Saved Securely
        </span>
      </footer>
    </div>
  );
}

