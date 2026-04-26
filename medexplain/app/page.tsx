"use client";

import { ChangeEvent, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  FileText,
  Globe,
  Info,
  ShieldCheck,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Language = "en" | "es" | "hi";
type Severity = "high" | "medium" | "low";

type AnalyzeIssue = {
  severity: Severity;
  title: string;
  explanation: string;
  chargeAmount: string | null;
  law: string | null;
};

type AnalyzeResult = {
  summary: string;
  totalAmount: string;
  issues: AnalyzeIssue[];
  fileText: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  es: "Español",
  hi: "हिन्दी",
};

const SUGGESTED_PROMPTS: Record<Language, string[]> = {
  en: [
    "Why is this charge so high?",
    "Can I negotiate this bill?",
    "What does this CPT code mean?",
  ],
  es: [
    "¿Por qué es tan alto este cargo?",
    "¿Puedo negociar esta factura?",
    "¿Qué significa este código CPT?",
  ],
  hi: [
    "यह शुल्क इतना ज़्यादा क्यों है?",
    "क्या मैं इस बिल पर बातचीत कर सकता हूं?",
    "इस CPT कोड का क्या मतलब है?",
  ],
};

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResult | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [chatError, setChatError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setSelectedFile(null);
      setErrorMessage("");
      setAnalysisError("");
      setAnalysisResult(null);
      setChatMessages([]);
      setChatInput("");
      setIsAsking(false);
      setChatError("");
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setSelectedFile(null);
      setErrorMessage("Please upload a PDF or image file (PNG, JPG, or WEBP).");
      event.target.value = "";
      setAnalysisResult(null);
      setAnalysisError("");
      setChatMessages([]);
      setChatInput("");
      setIsAsking(false);
      setChatError("");
      return;
    }

    setSelectedFile(file);
    setErrorMessage("");
    setAnalysisResult(null);
    setAnalysisError("");
    setChatMessages([]);
    setChatInput("");
    setIsAsking(false);
    setChatError("");
  };

  const onUploadClick = async () => {
    if (!selectedFile) {
      setErrorMessage("Please select a hospital bill before continuing.");
      return;
    }

    try {
      setIsSubmitting(true);
      setAnalysisError("");
      setAnalysisResult(null);
      setChatMessages([]);
      setChatInput("");
      setIsAsking(false);
      setChatError("");

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("language", language);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as Partial<AnalyzeResult> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to analyze this bill. Please try again.");
      }

      if (
        typeof payload.summary !== "string" ||
        typeof payload.totalAmount !== "string" ||
        !Array.isArray(payload.issues) ||
        typeof payload.fileText !== "string"
      ) {
        throw new Error("Invalid analysis response. Please try again.");
      }

      setAnalysisResult({
        summary: payload.summary,
        totalAmount: payload.totalAmount,
        issues: payload.issues as AnalyzeIssue[],
        fileText: payload.fileText,
      });
    } catch (error) {
      setAnalysisError(
        error instanceof Error ? error.message : "Failed to analyze this bill. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetState = () => {
    setSelectedFile(null);
    setErrorMessage("");
    setAnalysisError("");
    setAnalysisResult(null);
    setChatMessages([]);
    setChatInput("");
    setIsAsking(false);
    setChatError("");
    setIsSubmitting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const askQuestion = async (questionInput?: string) => {
    const question = (questionInput ?? chatInput).trim();
    if (!analysisResult?.fileText) {
      setChatError("Missing bill context. Please analyze the bill again.");
      return;
    }
    if (!question || isAsking) {
      return;
    }

    setChatError("");
    setChatInput("");
    setIsAsking(true);
    setChatMessages((prev) => [...prev, { role: "user", content: question }]);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileText: analysisResult.fileText,
          question,
          language,
        }),
      });

      const payload = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || typeof payload.answer !== "string") {
        throw new Error(payload.error || "Failed to get an answer. Please try again.");
      }

      setChatMessages((prev) => [...prev, { role: "assistant", content: payload.answer! }]);
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Failed to get an answer. Please try again."
      );
    } finally {
      setIsAsking(false);
    }
  };

  const getSeverityStyles = (severity: Severity) => {
    if (severity === "high") {
      return {
        border: "border-red-200",
        icon: <AlertCircle className="h-5 w-5 text-red-600" />,
      };
    }
    if (severity === "medium") {
      return {
        border: "border-amber-200",
        icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
      };
    }
    return {
      border: "border-blue-200",
      icon: <Info className="h-5 w-5 text-blue-600" />,
    };
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white px-6 py-10 text-slate-900">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-sm font-bold text-white">
            M
          </div>
          <span className="text-lg font-semibold tracking-tight text-slate-900">
            MedExplain
          </span>
        </div>

        <div className="space-y-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white px-4 py-1 text-sm text-sky-700 shadow-sm">
            <ShieldCheck className="h-4 w-4" />
            Built for patients, not insurers
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Understand your medical bill in 30 seconds -{" "}
            <span className="text-sky-700">in your language</span>
          </h1>
          <p className="mx-auto max-w-2xl text-base text-slate-600 sm:text-lg">
            Upload your bill, choose your language, and get a plain explanation
            before you pay.
          </p>
        </div>

        <Card className="border-sky-100 shadow-lg shadow-sky-100/60">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Start with your bill</CardTitle>
            <p className="text-sm text-slate-600">
              Accepted file types: PDF, PNG, JPG, WEBP
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="billFile" className="text-sm font-medium">
                Medical bill file
              </Label>
              <Input
                id="billFile"
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                onChange={onFileChange}
                className="sr-only"
              />
              <label
                htmlFor="billFile"
                className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-sky-200 bg-sky-50/60 px-4 py-4 transition hover:border-sky-300 hover:bg-sky-50"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-white p-2 shadow-sm">
                    <FileText className="h-5 w-5 text-sky-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {selectedFile ? selectedFile.name : "Choose your bill file"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Tap to browse from your computer
                    </p>
                  </div>
                </div>
                <Upload className="h-4 w-4 text-slate-500" />
              </label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language" className="text-sm font-medium">
                Preferred language
              </Label>
              <Select
                value={language}
                onValueChange={(value) => setLanguage(value as Language)}
              >
                <SelectTrigger
                  id="language"
                  aria-label="Language"
                  className="w-full h-11 rounded-xl"
                >
                  <SelectValue placeholder="Choose a language" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-center gap-2 text-slate-800">
                <Globe className="h-4 w-4" />
                <span className="font-medium">Language: {LANGUAGE_LABELS[language]}</span>
              </div>
              <p className="mt-2 truncate text-slate-600">
                File: {selectedFile ? selectedFile.name : "No file selected"}
              </p>
            </div>

            {errorMessage ? (
              <p className="text-sm font-medium text-red-600">{errorMessage}</p>
            ) : null}

            <Button
              className="h-12 w-full rounded-xl text-base font-semibold"
              onClick={onUploadClick}
              disabled={!selectedFile || isSubmitting}
            >
              {isSubmitting ? "Uploading..." : "Upload Bill"}
            </Button>
          </CardContent>
        </Card>

        {isSubmitting ? (
          <section className="grid gap-4">
            {[1, 2, 3].map((index) => (
              <Card key={index} className="animate-pulse border-slate-200">
                <CardContent className="space-y-3 p-6">
                  <div className="h-4 w-1/3 rounded bg-slate-200" />
                  <div className="h-4 w-full rounded bg-slate-200" />
                  <div className="h-4 w-2/3 rounded bg-slate-200" />
                </CardContent>
              </Card>
            ))}
          </section>
        ) : null}

        {analysisError ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="space-y-4 p-6">
              <p className="font-medium text-red-700">{analysisError}</p>
              <Button
                variant="outline"
                onClick={onUploadClick}
                disabled={!selectedFile || isSubmitting}
              >
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {analysisResult ? (
          <section className="space-y-4">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg">Plain-language summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700">{analysisResult.summary}</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg">Total amount</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tracking-tight text-slate-900">
                  {analysisResult.totalAmount}
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-3">
              {analysisResult.issues.map((issue, index) => {
                const styles = getSeverityStyles(issue.severity);
                return (
                  <Card key={`${issue.title}-${index}`} className={styles.border}>
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-center gap-2">
                        {styles.icon}
                        <h3 className="font-semibold text-slate-900">{issue.title}</h3>
                      </div>
                      <p className="text-sm text-slate-700">{issue.explanation}</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          Charge: {issue.chargeAmount ?? "N/A"}
                        </span>
                        {issue.law ? (
                          <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800">
                            {issue.law}
                          </span>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Button variant="outline" onClick={resetState}>
              Try another bill
            </Button>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Ask MedExplain about this bill</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_PROMPTS[language].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        setChatInput(prompt);
                        void askQuestion(prompt);
                      }}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <div className="max-h-80 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  {chatMessages.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Ask a follow-up question about charges, CPT codes, or your rights.
                    </p>
                  ) : null}

                  {chatMessages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                          message.role === "user"
                            ? "bg-sky-100 text-slate-900"
                            : "bg-slate-50 text-slate-800"
                        }`}
                      >
                        {message.role === "assistant" ? (
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            MedExplain
                          </p>
                        ) : null}
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  ))}

                  {isAsking ? (
                    <div className="flex justify-start">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          MedExplain
                        </p>
                        <div className="flex items-center gap-1">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {chatError ? <p className="text-sm font-medium text-red-600">{chatError}</p> : null}

                <div className="flex items-center gap-2">
                  <Input
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void askQuestion();
                      }
                    }}
                    placeholder="Ask a question about this bill..."
                    disabled={isAsking}
                    className="h-11 rounded-xl"
                  />
                  <Button
                    onClick={() => void askQuestion()}
                    disabled={isAsking || !chatInput.trim()}
                    className="h-11 rounded-xl"
                  >
                    Send
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        ) : null}
      </section>
    </main>
  );
}
