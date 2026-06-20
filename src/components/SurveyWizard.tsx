import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Clock, ChevronLeft, Check, CheckSquare, Square, ThumbsUp, Sparkles } from "lucide-react";
import { Question, SURVEY_QUESTIONS, SurveyAnswers } from "../types";

interface SurveyWizardProps {
  onSubmit: (answers: SurveyAnswers) => Promise<{ success: boolean }>;
  onAdminClick: () => void;
}

export default function SurveyWizard({ onSubmit, onAdminClick }: SurveyWizardProps) {
  const [step, setStep] = useState<number>(0); // 0: Welcome, 1-10: Questions, 11: Success
  const [answers, setAnswers] = useState<Partial<SurveyAnswers>>({
    q1: "",
    q2: "",
    q3: "",
    q4: "",
    q5: [],
    q6: "",
    q7: "",
    q8: "",
    q9: "",
    q10: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentQuestionIndex = step - 1;
  const question: Question | undefined = SURVEY_QUESTIONS[currentQuestionIndex];

  const handleStart = () => {
    setStep(1);
    setErrorMsg(null);
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setErrorMsg(null);
    }
  };

  const handleOptionSelect = async (optionText: string) => {
    if (!question) return;
    const qId = question.id as keyof SurveyAnswers;

    if (question.type === "single") {
      const updatedAnswers = {
        ...answers,
        [qId]: optionText
      };
      setAnswers(updatedAnswers);
      setErrorMsg(null);

      // Automatically advance to the next step
      if (step === 10) {
        setIsSubmitting(true);
        setErrorMsg(null);
        try {
          const res = await onSubmit(updatedAnswers as SurveyAnswers);
          if (res.success) {
            setStep(11);
          } else {
            setErrorMsg("There was a problem submitting your response. Please try again.");
          }
        } catch (err) {
          setErrorMsg("Connection error. Could not reach server.");
        } finally {
          setIsSubmitting(false);
        }
      } else {
        // High fidelity feedback loop: small delay to let user see selection highlight
        setTimeout(() => {
          setStep((prev) => prev + 1);
        }, 185);
      }
    } else {
      // Multiple choice (q5)
      const currentSelected = (answers[qId] as string[]) || [];
      if (currentSelected.includes(optionText)) {
        setAnswers((prev) => ({
          ...prev,
          [qId]: currentSelected.filter((val) => val !== optionText)
        }));
      } else {
        setAnswers((prev) => ({
          ...prev,
          [qId]: [...currentSelected, optionText]
        }));
      }
      setErrorMsg(null);
    }
  };

  const validateCurrentStep = (): boolean => {
    if (!question) return true;
    const qId = question.id as keyof SurveyAnswers;
    const currentAnswer = answers[qId];

    if (question.type === "single") {
      if (!currentAnswer || currentAnswer === "") {
        setErrorMsg("Please select an option to continue.");
        return false;
      }
    } else {
      // Multiple choice
      if (!currentAnswer || (currentAnswer as string[]).length === 0) {
        setErrorMsg("Please select at least one option to continue.");
        return false;
      }
    }
    return true;
  };

  const handleNext = async () => {
    if (!validateCurrentStep()) return;

    if (step === 10) {
      // Submit responses to server
      setIsSubmitting(true);
      setErrorMsg(null);
      try {
        const res = await onSubmit(answers as SurveyAnswers);
        if (res.success) {
          setStep(11);
        } else {
          setErrorMsg("There was a problem submitting your response. Please try again.");
        }
      } catch (err) {
        setErrorMsg("Connection error. Could not reach server.");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setStep(step + 1);
      setErrorMsg(null);
    }
  };

  // Welcome state renderer
  if (step === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] py-12 px-6 text-center select-none" id="survey-welcome">
        <div className="flex-1 flex flex-col justify-center items-center max-w-lg">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-3xl sm:text-4xl font-sans font-medium text-neutral-850 tracking-normal mb-3"
          >
            Study Habits Survey
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-neutral-500 text-sm sm:text-base leading-relaxed max-w-sm mb-8 italic"
          >
            Help us understand high school and middle school student prep routines and procrastination hurdles.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex flex-col items-center gap-4 w-full max-w-xs"
          >
            <button
              id="btn-start"
              onClick={handleStart}
              className="w-auto px-10 py-3.5 bg-[#2B2A27] hover:bg-neutral-800 text-[#F4EFEB] font-sans font-medium text-lg tracking-wide rounded-xl shadow-sm transition-all duration-200 active:scale-[0.97]"
            >
              Start
            </button>
            
            <div className="flex items-center text-xs text-neutral-500 gap-1.5 mt-1" id="survey-timer-notice">
              <Clock className="w-4 h-4 text-neutral-400" />
              <span>Takes 1 minute 30 seconds</span>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Success state renderer
  if (step === 11) {
    return (
      <div className="flex flex-col items-center justify-between min-h-[580px] py-12 px-6 text-center" id="survey-complete">
        <div className="flex-1 flex flex-col justify-center items-center max-w-md">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mb-6 shadow-sm"
          >
            <Check className="w-8 h-8 stroke-[2.5]" />
          </motion.div>
          <h1 className="text-2xl font-serif font-semibold tracking-tight text-neutral-900 mb-4">
            Thanks For Your Time!
          </h1>
          <p className="text-neutral-600 text-sm leading-relaxed mb-6">
            The following code gives you Karma that can be used to get free research participants at SurveySwap.io.
          </p>

          <div className="bg-neutral-100 border border-neutral-200 rounded-xl p-4 w-full text-center space-y-3 shadow-inner">
            <a
              href="https://surveyswap.io/sr/GZNV-B4ME-6LJO"
              target="_blank"
              rel="noreferrer"
              className="text-neutral-950 font-medium hover:underline flex items-center justify-center gap-1.5 text-sm"
            >
              Go to: <span className="text-blue-600 font-semibold break-all">https://surveyswap.io/sr/GZNV-B4ME-6LJO</span>
            </a>
            <div className="h-[1px] bg-neutral-200 w-full" />
            <div className="text-xs text-neutral-500">
              Or, alternatively, enter the code manually: {" "}
              <span className="font-mono bg-neutral-200 text-neutral-800 px-2 py-0.5 rounded font-bold tracking-wider">
                GZNV-B4ME-6LJO
              </span>
            </div>
          </div>
        </div>

        <div className="w-full max-w-sm mt-6 flex flex-col items-center gap-3">
          <button
            onClick={() => setStep(0)}
            className="w-full py-3.5 bg-[#2B2A27] hover:bg-neutral-800 text-[#F4EFEB] font-sans font-medium rounded-xl transition duration-200 active:scale-[0.98] text-sm"
          >
            Submit Another Response
          </button>
          
          <button
            onClick={onAdminClick}
            className="text-xs font-semibold text-neutral-400 hover:text-neutral-700 transition flex items-center justify-center gap-1.5 px-3 py-1 bg-neutral-100/30 hover:bg-neutral-100/80 rounded-lg select-none"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Admin & Sheets Portal</span>
          </button>
        </div>
      </div>
    );
  }

  // Question state renderer
  const qId = question.id as keyof SurveyAnswers;
  const currentAnswer = answers[qId];

  return (
    <div className="flex flex-col justify-between min-h-[580px] py-10 px-6 select-none" id={`survey-step-${step}`}>
      {/* Top progress indicator bar */}
      <div className="w-full bg-neutral-200 h-1.5 rounded-full overflow-hidden mb-6" id="survey-progressbar">
        <div
          className="bg-neutral-900 h-1.5 transition-all duration-300 rounded-full"
          style={{ width: `${(step / 10) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Number badge */}
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 bg-neutral-900 text-[#F4EFEB] flex items-center justify-center rounded text-xs font-bold leading-none shadow-sm">
                {question.number}
              </span>
              <span className="text-xs text-neutral-400 font-mono">Question {question.number} of 10</span>
            </div>

            {/* Question Text */}
            <div className="space-y-1">
              <h2 className="text-xl font-sans font-medium text-neutral-900 leading-snug">
                {question.text}
              </h2>
              {question.subtext && (
                <p className="text-xs text-neutral-500 font-sans uppercase tracking-wider">
                  {question.subtext}
                </p>
              )}
            </div>

            {/* Options container */}
            <div className="space-y-2 pt-2">
              {question.options.map((opt) => {
                const isSelected =
                  question.type === "single"
                    ? currentAnswer === opt.text
                    : ((currentAnswer as string[]) || []).includes(opt.text);

                return (
                  <button
                    key={opt.key}
                    onClick={() => handleOptionSelect(opt.text)}
                    className={`w-full flex items-center text-left py-3 px-4 rounded-xl border transition-all duration-200 outline-none
                      ${
                        isSelected
                          ? "bg-[#2B2A27] border-[#2B2A27] text-[#F4EFEB] font-medium shadow-sm"
                          : "bg-white hover:bg-neutral-50/80 border-neutral-200 text-neutral-800 shadow-2xs"
                      }
                    `}
                  >
                    <span className={`w-6 h-6 font-mono text-xs font-bold flex items-center justify-center rounded border mr-3 shrink-0
                      ${
                        isSelected
                          ? "bg-neutral-800 text-white border-neutral-700"
                          : "bg-neutral-100 text-neutral-700 border-neutral-200"
                      }
                    `}>
                      {opt.key}
                    </span>
                    <span className="flex-1 text-sm leading-snug">{opt.text}</span>
                    <div className="ml-2 shrink-0">
                      {question.type === "multiple" ? (
                        isSelected ? (
                          <CheckSquare className="w-5 h-5 text-white" />
                        ) : (
                          <Square className="w-5 h-5 text-neutral-300" />
                        )
                      ) : (
                        isSelected && <Check className="w-5 h-5 text-white" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer controls */}
      <div className="mt-8 space-y-4">
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-red-600 text-center font-medium bg-red-100 py-2 px-3 rounded-lg border border-red-200"
          >
            {errorMsg}
          </motion.div>
        )}

        <div className="flex items-center gap-3 w-full max-w-md mx-auto">
          {/* Back Trigger */}
          {step > 1 && (
            <button
              onClick={handleBack}
              disabled={isSubmitting}
              className="px-4 py-4 border-2 border-neutral-300 hover:border-neutral-500 bg-transparent text-neutral-700 rounded-xl hover:text-neutral-900 transition active:scale-95 disabled:opacity-50"
              title="Previous question"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Forward / Submit Trigger */}
          <button
            onClick={handleNext}
            disabled={isSubmitting}
            className="flex-1 py-4 px-6 bg-neutral-900 hover:bg-neutral-800 text-[#F4EFEB] font-sans font-medium tracking-wide rounded-xl shadow-sm transition active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin" />
            ) : step === 10 ? (
              "Submit"
            ) : (
              "OK"
            )}
          </button>
        </div>

        {/* Footer info text on Question 10 */}
        {step === 10 && (
          <p className="text-[10px] text-neutral-400 text-center uppercase tracking-wider">
            Never submit passwords! - <a href="#" className="hover:underline">Report abuse</a>
          </p>
        )}
      </div>
    </div>
  );
}
