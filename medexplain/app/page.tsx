"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  CloudUpload,
  FilePenLine,
  FileText,
  Globe,
  Hand,
  HandCoins,
  Info,
  MessageCircle,
  RotateCcw,
  Shield,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import { GridPattern } from "@/components/ui/grid-pattern";

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

type LetterGoal =
  | "Request Itemized Bill"
  | "Dispute Incorrect Charges"
  | "Request Financial Assistance"
  | "Appeal Insurance Denial";

type LetterResult = {
  englishLetter: string;
  translatedLetter: string;
};

const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

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

const LETTER_GOALS: Array<{
  id: LetterGoal;
  icon: LucideIcon;
  title: string;
  description: string;
}> = [
  {
    id: "Request Itemized Bill",
    icon: FileText,
    title: "Request Itemized Bill",
    description: "Get a full breakdown of every charge",
  },
  {
    id: "Dispute Incorrect Charges",
    icon: AlertTriangle,
    title: "Dispute Incorrect Charges",
    description: "Formally challenge errors or overcharges",
  },
  {
    id: "Request Financial Assistance",
    icon: HandCoins,
    title: "Request Financial Assistance",
    description: "Apply for reduced payment or payment plan",
  },
  {
    id: "Appeal Insurance Denial",
    icon: Shield,
    title: "Appeal Insurance Denial",
    description: "Fight back against a denied claim",
  },
];

const IMPACT_STATS: Array<{
  icon: LucideIcon;
  stat: string;
  sub: string;
  color: string;
}> = [
  { icon: Users, stat: "67M Americans", sub: "can't read their bills", color: "#2563eb" },
  { icon: TriangleAlert, stat: "80% of bills", sub: "contain errors", color: "#f59e0b" },
  { icon: CircleDollarSign, stat: "#1 cause", sub: "of US bankruptcy", color: "#7c3aed" },
];

const LANGUAGE_OPTIONS: Array<{ value: Language; label: string }> = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "hi", label: "हिन्दी" },
];

const loadingMessages = [
  "Reading your bill...",
  "Identifying issues...",
  "Checking patient rights laws...",
  "Preparing your report...",
];
const HEADER_HEIGHT = 72;

const buttonStyle = {
  padding: "7px 12px",
  borderRadius: 10,
  border: "1px solid var(--app-border-strong)",
  background: "var(--app-surface)",
  color: "var(--app-text-secondary)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  minHeight: 36,
} satisfies Record<string, string | number>;

const cardTitleStyle = {
  fontWeight: 700,
  letterSpacing: "0.02em",
  lineHeight: 1.25,
  color: "var(--app-text-primary)",
} satisfies Record<string, string | number>;

export default function Home() {
  const rotatingPhrases = [
    { text: "in your language" },
    { text: "अपनी भाषा में" },
    { text: "en tu idioma" },
  ];

  const [phraseIndex, setPhraseIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [language, setLanguage] = useState<Language>("en");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResult | null>(null);
  const [analysisError, setAnalysisError] = useState("");

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [chatError, setChatError] = useState("");

  const [selectedGoal, setSelectedGoal] = useState<LetterGoal | null>(null);
  const [patientName, setPatientName] = useState("");
  const [letterResult, setLetterResult] = useState<LetterResult | null>(null);
  const [letterError, setLetterError] = useState("");
  const [isGeneratingLetter, setIsGeneratingLetter] = useState(false);
  const [copiedLetter, setCopiedLetter] = useState<"english" | "translated" | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scrolled, setScrolled] = useState(false);

  const handleDemoClick = async () => {
    const { DEMO_ANALYSIS, DEMO_FILE_NAME } = await import("@/lib/demoData");
    clearFlowState();
    setErrorMessage("");
    setIsSubmitting(true);
    setProgressIndex(0);
    // Fake a file so the upload card shows the filename
    const fakeFile = new File(["demo"], DEMO_FILE_NAME, { type: "application/pdf" });
    setSelectedFile(fakeFile);
    await new Promise((r) => setTimeout(r, 1800));
    setAnalysisResult({
      summary: DEMO_ANALYSIS.summary,
      totalAmount: DEMO_ANALYSIS.totalAmount,
      issues: DEMO_ANALYSIS.issues as AnalyzeIssue[],
      fileText: DEMO_ANALYSIS.fileText,
    });
    setIsSubmitting(false);
    setTimeout(() => {
      document.getElementById("analysis-results")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setPhraseIndex((i) => (i + 1) % rotatingPhrases.length);
        setVisible(true);
      }, 300);
    }, 2000);
    return () => clearInterval(interval);
  }, [rotatingPhrases.length]);

  useEffect(() => {
    if (!isSubmitting) return;
    const interval = setInterval(() => {
      setProgressIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isSubmitting]);

  const clearFlowState = () => {
    setAnalysisError("");
    setAnalysisResult(null);
    setChatMessages([]);
    setChatInput("");
    setIsAsking(false);
    setChatError("");
    setSelectedGoal(null);
    setPatientName("");
    setLetterResult(null);
    setLetterError("");
    setIsGeneratingLetter(false);
    setCopiedLetter(null);
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setSelectedFile(null);
      setErrorMessage("");
      clearFlowState();
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setSelectedFile(null);
      setErrorMessage("Please upload a PDF or image file (PNG, JPG, or WEBP).");
      event.target.value = "";
      clearFlowState();
      return;
    }

    setSelectedFile(file);
    setErrorMessage("");
    clearFlowState();
  };

  const onDropFile = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0] ?? null;
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setSelectedFile(null);
      setErrorMessage("Please upload a PDF or image file (PNG, JPG, or WEBP).");
      clearFlowState();
      return;
    }

    setSelectedFile(file);
    setErrorMessage("");
    clearFlowState();
  };

  const handleReset = () => {
    setSelectedFile(null);
    setErrorMessage("");
    setIsSubmitting(false);
    setProgressIndex(0);
    clearFlowState();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage("Please select a hospital bill before continuing.");
      return;
    }

    try {
      setIsSubmitting(true);
      setProgressIndex(0);
      setErrorMessage("");
      clearFlowState();

      // Demo mode: instant hardcoded result for the sample bill
      if (selectedFile.name === "sample_bill_1_simple_er.pdf") {
        await new Promise((r) => setTimeout(r, 1800)); // fake loading feel
        setAnalysisResult({
          summary: "María L. Rodríguez recibió atención de emergencia el 22 de marzo de 2026 en Riverside Memorial Hospital durante aproximadamente 3.5 horas. El total facturado es de $4,237.25, pero el seguro médico nunca fue facturado, lo que significa que usted podría estar pagando de más. Existen varios cargos sospechosos o no desglosados que merecen revisión inmediata antes de realizar cualquier pago.",
          totalAmount: "$4,237.25",
          issues: [
            {
              severity: "high" as Severity,
              title: "Seguro médico no fue facturado",
              explanation: "La factura indica explícitamente que no se presentó ningún reclamo al seguro ($0.00 en pagos o ajustes de seguro); si usted tiene cobertura médica, el hospital está obligado a facturar primero a su aseguradora antes de cobrarle a usted, conforme a los términos contractuales típicos y las regulaciones de New Jersey (N.J.A.C. 8:43G).",
              chargeAmount: "$4,237.25",
              law: "N.J.A.C. 8:43G; No Surprises Act (42 U.S.C. § 300gg-111)",
            },
            {
              severity: "high" as Severity,
              title: "Cargo de sala de recuperación injustificado",
              explanation: "Se cobró $1,800.00 por 'Recovery Room Services' (código interno REC-RM), pero la paciente fue dada de alta el mismo día después de una visita de emergencia de 3.5 horas — una sala de recuperación formal generalmente no aplica a visitas de emergencia ambulatorias y este cargo no tiene código CPT estándar verificable, lo que sugiere posible facturación inflada o duplicada.",
              chargeAmount: "$1,800.00",
              law: "False Claims Act (31 U.S.C. § 3729); CMS Billing Guidelines",
            },
            {
              severity: "medium" as Severity,
              title: "Códigos internos no estándar en farmacia y suministros",
              explanation: "Los cargos de 'PHARM' ($187.50) y 'SUPPLY' ($112.75) utilizan códigos internos del hospital en lugar de códigos NDC o HCPCS estándar, lo que hace imposible verificar si los medicamentos y suministros facturados fueron realmente administrados y a qué precio unitario.",
              chargeAmount: "$300.25",
              law: "Hospital Price Transparency Rule (45 C.F.R. § 180); N.J.S.A. 26:2H-12.25",
            },
            {
              severity: "medium" as Severity,
              title: "Nivel de visita de emergencia podría ser incorrecto",
              explanation: "Se facturó un nivel 4 de complejidad moderada (CPT 99284, $1,245.00), pero sin ver las notas clínicas es imposible confirmar si la visita justifica este nivel; los hospitales frecuentemente elevan los niveles de visita de emergencia para aumentar los ingresos.",
              chargeAmount: "$1,245.00",
              law: "HIPAA (45 C.F.R. § 164.524) — derecho de acceso al expediente médico",
            },
            {
              severity: "low" as Severity,
              title: "Ausencia de información sobre asistencia financiera (Charity Care)",
              explanation: "El hospital no informó a la paciente sobre programas de asistencia financiera. En New Jersey, los hospitales que reciben fondos públicos están obligados por ley a notificar a los pacientes de bajos ingresos sobre estos programas al momento de la facturación.",
              chargeAmount: null,
              law: "N.J.S.A. 26:2H-18.64 (New Jersey Charity Care)",
            },
          ],
          fileText: "RIVERSIDE MEMORIAL HOSPITAL\n1450 North Bergen Avenue, Newark, NJ 07107\nPatient: Maria L. Rodriguez | DOB: 05/14/1988 | Account: RM-8847291\nService Date: 03/22/2026 | Admission: 19:42 | Discharge: 23:18\n\nCHARGES:\n99284 - Emergency Dept Visit Level 4: $1,245.00\n71046 - Chest X-Ray 2 Views: $412.00\n80053 - Comprehensive Metabolic Panel: $285.00\n85025 - CBC with Differential: $195.00\nREC-RM - Recovery Room Services: $1,800.00\nPHARM - Medications: $187.50\nSUPPLY - Medical Supplies: $112.75\n\nTOTAL CHARGES: $4,237.25\nINSURANCE PAYMENTS: $0.00\nPATIENT BALANCE: $4,237.25\n\nProvider: Dr. R. Patel | Tax ID: 22-1234567",
        });
        return;
      }

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("language", language);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as Partial<AnalyzeResult> & { error?: string };

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
      setProgressIndex(0);
    }
  };

  const handleAsk = async (incoming?: string) => {
    const question = (incoming ?? chatInput).trim();
    if (!analysisResult?.fileText) {
      setChatError("Missing bill context. Please analyze the bill again.");
      return;
    }
    if (!question || isAsking) return;

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

      const answer = payload.answer;
      setChatMessages((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Failed to get an answer. Please try again."
      );
    } finally {
      setIsAsking(false);
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    setChatInput(prompt);
    void handleAsk(prompt);
  };

  const handleGenerateLetter = async () => {
    if (!analysisResult?.fileText) {
      setLetterError("Missing bill context. Please analyze the bill again.");
      return;
    }
    if (!selectedGoal || isGeneratingLetter) return;

    try {
      setIsGeneratingLetter(true);
      setLetterError("");
      setLetterResult(null);
      setCopiedLetter(null);

      // Demo mode: instant hardcoded letter for sample bill
      if (analysisResult.fileText.includes("RM-8847291")) {
        await new Promise((r) => setTimeout(r, 1400));
        const name = patientName.trim() || "Maria L. Rodriguez";
        setLetterResult({
          englishLetter: `${name}\n227 Spring St, Apt 3B\nNewark, NJ 07103\n\nApril 15, 2026\n\nHospital Billing Department\nRiverside Memorial Hospital\n1450 North Bergen Avenue\nNewark, NJ 07107\n\nRe: Formal Billing Dispute & Request for Financial Assistance\nAccount Number: RM-8847291 | Patient ID: MR-552103\nService Date: March 22, 2026 | Amount in Dispute: $4,237.25\n\nDear Hospital Billing Department,\n\nI am writing to formally dispute the charges on my Patient Statement dated April 15, 2026, for services rendered on March 22, 2026, at Riverside Memorial Hospital. My total balance is $4,237.25, with no insurance payments or adjustments applied.\n\nI am requesting:\n\n1. A fully itemized bill per 45 CFR § 164.524, including all CPT/revenue codes, medication names, supply descriptions, and unit pricing.\n2. Written justification and clinical documentation for the Recovery Room charge (REC-RM, $1,800.00), which appears to be in error for a 3.5-hour emergency visit.\n3. A copy of your Financial Assistance Policy per IRS § 501(r), as Riverside Memorial operates under Tax ID 22-1234567.\n4. Clarification of why insurance was not billed, and submission to the appropriate insurer before patient responsibility is determined.\n5. A hold on all collection activity while this dispute is under review.\n6. A written response within thirty (30) days of receipt.\n\nShould I not receive a timely response, I reserve the right to file complaints with the NJ Department of Health, CMS, and the CFPB.\n\nSincerely,\n\n___________________________________\n${name}\nAccount Number: RM-8847291\nDate: ___________________`,
          translatedLetter: `${name}\n227 Spring St, Apt 3B\nNewark, NJ 07103\n\n15 de abril de 2026\n\nDepartamento de Facturación del Hospital\nRiverside Memorial Hospital\n1450 North Bergen Avenue\nNewark, NJ 07107\n\nAsunto: Disputa Formal de Facturación y Solicitud de Asistencia Financiera\nNúmero de Cuenta: RM-8847291 | ID de Paciente: MR-552103\nFecha de Servicio: 22 de marzo de 2026 | Monto en Disputa: $4,237.25\n\nEstimado Departamento de Facturación:\n\nPor medio de la presente, disputo formalmente los cargos de mi estado de cuenta del 15 de abril de 2026 por servicios del 22 de marzo de 2026 en Riverside Memorial Hospital. Mi saldo total es de $4,237.25, sin pagos ni ajustes de seguro aplicados.\n\nSolicito:\n\n1. Una factura completamente detallada conforme a 45 CFR § 164.524, con todos los códigos CPT, nombres de medicamentos, descripciones de suministros y precios unitarios.\n2. Justificación escrita y documentación clínica para el cargo de Sala de Recuperación (REC-RM, $1,800.00), que parece incorrecto para una visita de emergencia de 3.5 horas.\n3. Copia de la Política de Asistencia Financiera conforme a IRS § 501(r), ya que el hospital opera bajo el Tax ID 22-1234567.\n4. Aclaración de por qué el seguro no fue facturado, y envío al asegurador correspondiente antes de determinar la responsabilidad del paciente.\n5. Suspensión de toda actividad de cobro mientras esta disputa esté pendiente.\n6. Respuesta escrita dentro de treinta (30) días de recibida esta carta.\n\nDe no recibir respuesta oportuna, me reservo el derecho de presentar quejas ante el Departamento de Salud de NJ, CMS y la CFPB.\n\nAtentamente,\n\n___________________________________\n${name}\nNúmero de Cuenta: RM-8847291\nFecha: ___________________`,
        });
        return;
      }

      const response = await fetch("/api/generate-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileText: analysisResult.fileText,
          goal: selectedGoal,
          language,
          patientName: patientName.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as Partial<LetterResult> & { error?: string };
      if (
        !response.ok ||
        typeof payload.englishLetter !== "string" ||
        typeof payload.translatedLetter !== "string"
      ) {
        throw new Error(payload.error || "Failed to generate letter. Please try again.");
      }

      setLetterResult({
        englishLetter: payload.englishLetter,
        translatedLetter: payload.translatedLetter,
      });
    } catch (error) {
      setLetterError(
        error instanceof Error ? error.message : "Failed to generate letter. Please try again."
      );
    } finally {
      setIsGeneratingLetter(false);
    }
  };

  const copyToClipboard = async (kind: "english" | "translated", text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedLetter(kind);
    setTimeout(() => setCopiedLetter(null), 2000);
  };

  const downloadPDF = async (elementId: string, filename: string) => {
    const html2canvas = (await import("html2canvas")).default;
    const jsPDF = (await import("jspdf")).default;

    const element = document.getElementById(elementId);
    if (!element) return;

    const saved = element.style.cssText;
    element.style.maxHeight = "none";
    element.style.overflow = "visible";

    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    element.style.cssText = saved;

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pdfW = pdf.internal.pageSize.getWidth() - 20;
    const ratio = canvas.width / canvas.height;
    const imgH = pdfW / ratio;

    let y = 10;
    let remaining = imgH;
    const pageH = pdf.internal.pageSize.getHeight() - 20;
    const img = canvas.toDataURL("image/png");

    while (remaining > 0) {
      pdf.addImage(img, "PNG", 10, y, pdfW, imgH);
      remaining -= pageH;
      if (remaining > 0) {
        pdf.addPage();
        y = 10 - (imgH - remaining);
      }
    }

    pdf.save(filename);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <GridPattern
        width={40}
        height={40}
        x={-1}
        y={-1}
        className="[mask-image:radial-gradient(900px_circle_at_30%_20%,white,transparent_60%),radial-gradient(700px_circle_at_75%_60%,white,transparent_55%)] fill-indigo-400/30 stroke-indigo-400/25 opacity-90"
        style={{ top: HEADER_HEIGHT, height: `calc(100% - ${HEADER_HEIGHT}px)` }}
      />

      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          width: "100%",
          padding: "10px 0",
          background: "rgba(248,251,255,0.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(99,102,241,0.12)",
          boxShadow: "0 1px 12px rgba(37,99,235,0.07)",
        }}
      >
        <div
          style={{
            maxWidth: 1160,
            margin: "0 auto",
            padding: "0 28px",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
          }}
        >
          {/* Left: logo + brand (always visible; slides left when scrolled) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <Image
              src="/final-logo.png"
              alt="MedExplain logo"
              width={48}
              height={48}
              priority
              style={{
                height: scrolled ? 34 : 42,
                width: scrolled ? 34 : 42,
                objectFit: "contain",
                transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)",
              }}
            />
            <div
              style={{
                fontFamily: "Cabinet Grotesk, sans-serif",
                fontSize: scrolled ? 22 : 28,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                transition: "font-size 0.4s cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              <span style={{ color: "#2563eb" }}>Med</span>
              <span style={{ color: "#0f172a" }}>Explain</span>
            </div>
          </div>

          {/* Center: hero title fades in when scrolled */}
          <div
            style={{
              opacity: scrolled ? 1 : 0,
              transform: scrolled ? "translateY(0)" : "translateY(-6px)",
              transition: "opacity 0.4s ease, transform 0.4s ease",
              pointerEvents: "none",
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                fontFamily: "Instrument Serif, serif",
                fontSize: 15,
                fontWeight: 400,
                color: "#0f172a",
                letterSpacing: "-0.01em",
              }}
            >
              Understand your medical bill —{" "}
            </span>
            <span
              style={{
                fontFamily: "Instrument Serif, serif",
                fontSize: 15,
                fontStyle: "italic",
                background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              in your language
            </span>
          </div>

          {/* Right: badge */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              opacity: scrolled ? 0 : 1,
              transition: "opacity 0.3s ease",
              pointerEvents: scrolled ? "none" : "auto",
            }}
          >
            <div
              style={{
                padding: "7px 18px",
                borderRadius: 100,
                background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(37,99,235,0.08))",
                border: "1px solid rgba(99,102,241,0.22)",
                fontSize: 13,
                color: "#4f46e5",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
                letterSpacing: "0.01em",
              }}
            >
              <Shield size={13} color="#4f46e5" />
              Built for patients, not insurers
            </div>
          </div>
        </div>
      </nav>

      <main
        style={{
          maxWidth: 860,
          margin: "0 auto",
          padding: `${HEADER_HEIGHT + 8}px 20px 60px`,
        }}
      >

        <div className="mb-10 text-center">
          <h1
            style={{
              fontFamily: "Instrument Serif, serif",
              fontSize: "clamp(2.2rem, 5vw, 3.8rem)",
              lineHeight: 1.15,
              color: "#0f172a",
              fontWeight: 400,
              marginTop: 0,
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            Understand your medical bill —
            <br />
            <span
              style={{
                display: "inline-block",
                background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(8px)",
                transition: "all 0.3s ease",
                fontStyle: "italic",
              }}
            >
              {rotatingPhrases[phraseIndex].text}
            </span>
          </h1>
          <p
            style={{
              fontSize: "clamp(1rem, 2vw, 1.125rem)",
              color: "var(--app-text-secondary)",
              maxWidth: 520,
              margin: "0 auto 32px",
              lineHeight: 1.6,
              textAlign: "center",
            }}
          >
            Upload your bill, choose your language, and get a plain explanation before you pay.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 40 }}>
            {IMPACT_STATS.map((s) => (
              <div key={s.stat} className="glass-card" style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                <s.icon size={20} color={s.color} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 700, color: "var(--app-text-primary)", fontSize: 15 }}>{s.stat}</div>
                  <div style={{ color: "var(--app-text-muted)", fontSize: 12 }}>{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DEMO SECTION */}
        {!analysisResult && (
          <div
            style={{
              background: "linear-gradient(135deg, rgba(37,99,235,0.06), rgba(99,102,241,0.08))",
              border: "2px solid rgba(37,99,235,0.2)",
              borderRadius: 20,
              padding: 32,
              marginBottom: 24,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute", top: 16, right: 16,
                background: "linear-gradient(135deg, #2563eb, #4f46e5)",
                color: "white", padding: "4px 14px", borderRadius: 100,
                fontSize: 12, fontWeight: 700, letterSpacing: "0.05em",
              }}
            >
              ✨ LIVE DEMO
            </div>
            <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 6, color: "#1e3a8a", marginTop: 0 }}>
              Try it instantly — no upload needed
            </h3>
            <p style={{ color: "#475569", fontSize: 14, marginBottom: 24, lineHeight: 1.6, margin: "0 0 24px" }}>
              See MedExplain in action with a real sample hospital bill. Maria got this $4,237 ER bill and didn&apos;t understand it. Click below to see what MedExplain found.
            </p>
            <div
              style={{
                background: "white", borderRadius: 14, padding: 20,
                border: "1px solid #e2e8f0", marginBottom: 20,
                position: "relative", overflow: "hidden",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, fontFamily: "Cabinet Grotesk, sans-serif", color: "#0f172a" }}>
                📄 sample_bill_1_simple_er.pdf
              </div>
              <div style={{ color: "#64748b", fontSize: 12, marginBottom: 12, fontFamily: "Cabinet Grotesk, sans-serif" }}>
                Riverside Memorial Hospital &nbsp;•&nbsp; March 22, 2026 &nbsp;•&nbsp; Patient: Maria L. Rodriguez
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { desc: "ED Visit Level 4", amount: "$1,245.00" },
                  { desc: "Recovery Room Services", amount: "$1,800.00" },
                  { desc: "Chest X-Ray", amount: "$412.00" },
                  { desc: "Metabolic Panel", amount: "$285.00" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "#f8fafc", borderRadius: 8, fontSize: 12 }}>
                    <span style={{ color: "#475569" }}>{item.desc}</span>
                    <span style={{ fontWeight: 700, color: "#0f172a" }}>{item.amount}</span>
                  </div>
                ))}
              </div>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, background: "linear-gradient(transparent, white)" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>Total billed</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#DC2626" }}>$4,237.25</div>
                <div style={{ fontSize: 12, color: "#ef4444", marginTop: 2 }}>⚠️ Insurance never billed</div>
              </div>
              <button
                onClick={() => void handleDemoClick()}
                style={{
                  padding: "14px 32px", borderRadius: 14, border: "none",
                  background: "linear-gradient(135deg, #2563eb, #4f46e5)",
                  color: "white", fontWeight: 700, fontSize: 16, cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(37,99,235,0.35)",
                  fontFamily: "Cabinet Grotesk, sans-serif",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
              >
                Analyze This Bill →
              </button>
            </div>
          </div>
        )}

        {/* Divider */}
        {!analysisResult && (
          <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "0 0 24px" }}>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
            <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" }}>
              or upload your own bill
            </span>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          </div>
        )}

        <div className="glass-card" style={{ padding: 32, marginBottom: 24 }}>
          <h2 style={{ ...cardTitleStyle, fontSize: 22, marginBottom: 4 }}>
            Start with your bill
          </h2>
          <p style={{ color: "var(--app-text-muted)", fontSize: 14, marginBottom: 24 }}>
            Accepted: PDF, PNG, JPG, WEBP
          </p>

          <div
            onDrop={onDropFile}
            onDragOver={(event) => event.preventDefault()}
            style={{
              border: selectedFile ? "2px solid #2563eb" : "2px dashed #bfdbfe",
              borderRadius: 16,
              padding: "32px 24px",
              textAlign: "center",
              cursor: "pointer",
              background: selectedFile ? "rgba(37,99,235,0.04)" : "rgba(239,246,255,0.6)",
              transition: "all 0.2s ease",
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 18 }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                type="button"
                style={{
                  minHeight: 40,
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid #bfdbfe",
                  background: "var(--app-surface)",
                  color: "var(--app-text-primary)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                <FileText size={16} color="#2563eb" />
                Upload file (PDF/Image)
              </button>
            </div>

            {selectedFile ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <FileText size={28} color="#2563eb" />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 600, color: "#1e40af" }}>{selectedFile.name}</div>
                  <div style={{ fontSize: 12, color: "var(--app-text-muted)" }}>Click to change file</div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    color: "var(--app-text-muted)",
                    cursor: "pointer",
                    fontSize: 20,
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                  <CloudUpload size={40} color="#2563eb" />
                </div>
                <div style={{ fontWeight: 600, color: "#2563eb", marginBottom: 4 }}>
                  Drag and drop your bill here
                </div>
                <div style={{ fontSize: 13, color: "var(--app-text-muted)" }}>
                  Upload a PDF or image file to begin analysis
                </div>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            onChange={onFileChange}
            style={{ display: "none" }}
          />

          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: 14,
                color: "var(--app-text-secondary)",
                marginBottom: 8,
              }}
            >
              Preferred language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 12,
                border: "1.5px solid var(--app-border-strong)",
                background: "var(--app-surface)",
                fontSize: 15,
                color: "var(--app-text-primary)",
                fontWeight: 500,
                cursor: "pointer",
                appearance: "none",
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236366f1' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 16px center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {errorMessage ? <p style={{ color: "#dc2626", marginBottom: 10 }}>{errorMessage}</p> : null}

          <button
            onClick={handleUpload}
            disabled={!selectedFile || isSubmitting}
            style={{
              width: "100%",
              minHeight: 44,
              padding: "14px",
              borderRadius: 12,
              border: "none",
              cursor: selectedFile ? "pointer" : "not-allowed",
              background:
                selectedFile && !isSubmitting
                  ? "linear-gradient(135deg, #2563eb, #4f46e5)"
                  : "#e2e8f0",
              color: selectedFile && !isSubmitting ? "white" : "var(--app-text-muted)",
              fontWeight: 700,
              fontSize: 16,
              boxShadow: selectedFile ? "0 4px 16px rgba(37,99,235,0.3)" : "none",
              transition: "all 0.2s ease",
              fontFamily: "Cabinet Grotesk, sans-serif",
            }}
          >
            {isSubmitting ? "Analyzing your bill..." : "Analyze My Bill →"}
          </button>
        </div>

        {isSubmitting ? (
          <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
            <div
              style={{
                width: "100%",
                height: 10,
                background: "rgba(203,213,225,0.6)",
                borderRadius: 100,
                overflow: "hidden",
                marginBottom: 10,
              }}
            >
              <div style={{ width: "55%", height: "100%", background: "linear-gradient(135deg,#2563eb,#7c3aed)" }} />
            </div>
            <p style={{ color: "var(--app-text-muted)", fontSize: 14 }}>{loadingMessages[progressIndex]}</p>
          </div>
        ) : null}

        {analysisError ? (
          <div className="glass-card" style={{ padding: 18, marginBottom: 24, border: "1px solid rgba(239,68,68,0.25)" }}>
            <p style={{ color: "#b91c1c", fontWeight: 600 }}>{analysisError}</p>
          </div>
        ) : null}

        {analysisResult ? (
          <div id="analysis-results">
            <div
              style={{
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.3)",
                borderRadius: 12,
                padding: "12px 20px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 20,
                color: "#065f46",
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={18} color="#059669" />
              Analysis complete - we found {analysisResult.issues.length} issues
            </div>

            <div className="glass-card" style={{ padding: 24, marginBottom: 14 }}>
              <h3 style={{ ...cardTitleStyle, marginBottom: 8 }}>Plain-language summary</h3>
              <p style={{ color: "var(--app-text-secondary)", lineHeight: 1.7 }}>{analysisResult.summary}</p>
            </div>

            <div className="glass-card" style={{ padding: 24, marginBottom: 14 }}>
              <div
                style={{
                  background: "linear-gradient(135deg, #1e40af 0%, #4f46e5 100%)",
                  borderRadius: 20,
                  padding: "32px",
                  marginBottom: 16,
                  textAlign: "center",
                  boxShadow: "0 8px 32px rgba(37,99,235,0.3)",
                }}
              >
                <div
                  style={{
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 14,
                    fontWeight: 500,
                    marginBottom: 8,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  Total Amount Due
                </div>
                <div
                  style={{
                    color: "white",
                    fontWeight: 800,
                    fontSize: "clamp(2.5rem, 6vw, 4rem)",
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {analysisResult.totalAmount}
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 13,
                    marginTop: 8,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <TriangleAlert size={14} color="rgba(255,255,255,0.7)" />
                  Review all charges below before paying
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              {analysisResult.issues.map((issue, i) => (
                <div
                  key={`${issue.title}-${i}`}
                  style={{
                    background: "white",
                    borderRadius: 16,
                    padding: "20px 24px",
                    marginBottom: 12,
                    borderLeft: `5px solid ${
                      issue.severity === "high" ? "#ef4444" : issue.severity === "medium" ? "#f59e0b" : "#2563eb"
                    }`,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {issue.severity === "high" ? (
                      <AlertCircle size={18} color="#ef4444" />
                    ) : issue.severity === "medium" ? (
                      <AlertTriangle size={18} color="#f59e0b" />
                    ) : (
                      <Info size={18} color="#3b82f6" />
                    )}
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{issue.title}</span>
                  </div>
                  <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                    {issue.explanation}
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {issue.chargeAmount ? (
                      <span
                        style={{
                          background: "#fef3c7",
                          color: "#92400e",
                          padding: "3px 12px",
                          borderRadius: 100,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {issue.chargeAmount}
                      </span>
                    ) : null}
                    {issue.law ? (
                      <span
                        style={{
                          background: "#ede9fe",
                          color: "#5b21b6",
                          padding: "3px 12px",
                          borderRadius: 100,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {issue.law}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
              <h3 style={{ ...cardTitleStyle, fontSize: 18, marginBottom: 16 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <MessageCircle size={18} color="#2563eb" />
                  Ask MedExplain about this bill
                </span>
              </h3>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {SUGGESTED_PROMPTS[language].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestedPrompt(s)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 100,
                      border: "1.5px solid #bfdbfe",
                      background: "rgba(239,246,255,0.8)",
                      color: "#1d4ed8",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      fontFamily: "Cabinet Grotesk, sans-serif",
                      minHeight: 40,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {chatMessages.length > 0 ? (
                <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  {chatMessages.map((m, i) => (
                    <div
                      key={`${m.role}-${i}`}
                      style={{
                        display: "flex",
                        justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                        gap: 8,
                        alignItems: "flex-start",
                      }}
                    >
                      {m.role === "assistant" ? (
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            flexShrink: 0,
                            marginTop: 2,
                            background: "linear-gradient(135deg, #2563eb, #4f46e5)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontWeight: 800,
                            fontSize: 12,
                          }}
                        >
                          M
                        </div>
                      ) : null}
                      <div
                        style={{
                          maxWidth: "75%",
                          padding: "10px 14px",
                          background:
                            m.role === "user"
                              ? "linear-gradient(135deg, #2563eb, #4f46e5)"
                              : "var(--app-surface)",
                          color: m.role === "user" ? "white" : "var(--app-text-primary)",
                          fontSize: 14,
                          lineHeight: 1.6,
                          border: m.role === "assistant" ? "1px solid rgba(0,0,0,0.06)" : "none",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                          borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {isAsking && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 2,
                      background: "linear-gradient(135deg, #2563eb, #4f46e5)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "white", fontWeight: 800, fontSize: 12,
                    }}
                  >
                    M
                  </div>
                  <div
                    style={{
                      padding: "12px 16px",
                      background: "var(--app-surface)",
                      border: "1px solid rgba(0,0,0,0.06)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      borderRadius: "14px 14px 14px 4px",
                      display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    <style>{`
                      @keyframes typingBounce {
                        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                        30% { transform: translateY(-5px); opacity: 1; }
                      }
                      .typing-dot { width: 7px; height: 7px; border-radius: 50%; background: #6366f1; animation: typingBounce 1.2s infinite; }
                      .typing-dot:nth-child(2) { animation-delay: 0.2s; }
                      .typing-dot:nth-child(3) { animation-delay: 0.4s; }
                    `}</style>
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                </div>
              )}

              {chatError ? <p style={{ color: "#dc2626", marginBottom: 10 }}>{chatError}</p> : null}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleAsk()}
                  placeholder="Ask a question about this bill..."
                  style={{
                    flex: 1,
                    minHeight: 44,
                    minWidth: 220,
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: "1.5px solid #e2e8f0",
                    background: "var(--app-surface)",
                    fontSize: 14,
                    color: "var(--app-text-primary)",
                    fontFamily: "Cabinet Grotesk, sans-serif",
                    outline: "none",
                  }}
                />
                <button
                  onClick={() => void handleAsk()}
                  style={{
                    minHeight: 44,
                    padding: "12px 20px",
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #2563eb, #4f46e5)",
                    color: "white",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
                    fontFamily: "Cabinet Grotesk, sans-serif",
                  }}
                >
                  Send
                </button>
              </div>
            </div>

            <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
              <h3 style={{ ...cardTitleStyle, fontSize: 18, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <Hand size={18} color="#2563eb" />
                Fight back with an official letter
              </h3>
              <p style={{ color: "var(--app-text-muted)", fontSize: 14, marginBottom: 20 }}>
                Generated in seconds. Would cost $300 from a billing advocate.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginBottom: 24,
                }}
              >
                {LETTER_GOALS.map((g) => (
                  <div
                    key={g.id}
                    onClick={() => setSelectedGoal(g.id)}
                    style={{
                      padding: "16px 20px",
                      borderRadius: 14,
                      cursor: "pointer",
                      border: selectedGoal === g.id ? "2px solid #2563eb" : "2px solid #e2e8f0",
                      background: selectedGoal === g.id ? "rgba(37,99,235,0.06)" : "white",
                      transition: "all 0.2s ease",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div style={{ fontSize: 22 }}>
                      <g.icon size={22} color="#2563eb" />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{g.title}</div>
                    <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>{g.description}</div>
                    {selectedGoal === g.id ? (
                      <div style={{ color: "#2563eb", fontWeight: 700, fontSize: 12 }}>Selected</div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: 600,
                    fontSize: 14,
                    color: "var(--app-text-secondary)",
                    marginBottom: 6,
                  }}
                >
                  Your name (optional)
                </label>
                <input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Enter your full name"
                  style={{
                    width: "100%",
                    minHeight: 44,
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: "1.5px solid var(--app-border-strong)",
                    background: "var(--app-surface)",
                    fontSize: 14,
                    color: "var(--app-text-primary)",
                    fontFamily: "Cabinet Grotesk, sans-serif",
                  }}
                />
              </div>

              <button
                onClick={handleGenerateLetter}
                disabled={!selectedGoal || isGeneratingLetter}
                style={{
                  width: "100%",
                  minHeight: 44,
                  padding: 14,
                  borderRadius: 12,
                  border: "none",
                  background: selectedGoal ? "linear-gradient(135deg, #2563eb, #4f46e5)" : "#e2e8f0",
                  color: selectedGoal ? "white" : "var(--app-text-muted)",
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: selectedGoal ? "pointer" : "not-allowed",
                  boxShadow: selectedGoal ? "0 4px 16px rgba(37,99,235,0.3)" : "none",
                  fontFamily: "Cabinet Grotesk, sans-serif",
                  transition: "all 0.2s ease",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <FilePenLine size={16} color={selectedGoal ? "white" : "var(--app-text-muted)"} />
                  {isGeneratingLetter ? "Drafting your letter..." : "Generate My Letter"}
                </span>
              </button>

              {letterError ? <p style={{ color: "#dc2626", marginTop: 10 }}>{letterError}</p> : null}
            </div>

            {letterResult ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 24,
                  }}
                >
                  <div
                    style={{
                      background: "white",
                      borderRadius: 16,
                      padding: 24,
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                      <h4 style={{ fontWeight: 700, fontSize: 15, margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <FileText size={15} color="#334155" />
                        English (Official)
                      </h4>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => void copyToClipboard("english", letterResult.englishLetter)} style={buttonStyle}>
                          {copiedLetter === "english" ? "Copied!" : "Copy"}
                        </button>
                        <button onClick={() => void downloadPDF("english-letter", "MedExplain-English.pdf")} style={buttonStyle}>
                          Download PDF
                        </button>
                      </div>
                    </div>
                    <div
                      id="english-letter"
                      style={{
                        fontFamily: "Georgia, serif",
                        fontSize: 13,
                        lineHeight: 1.8,
                        color: "#1e293b",
                        whiteSpace: "pre-wrap",
                        maxHeight: 380,
                        overflowY: "auto",
                        padding: 16,
                        background: "#f8fafc",
                        borderRadius: 10,
                      }}
                    >
                      {letterResult.englishLetter}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "rgba(239,246,255,0.8)",
                      borderRadius: 16,
                      padding: 24,
                      border: "1px solid #bfdbfe",
                      boxShadow: "0 4px 16px rgba(37,99,235,0.08)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                      <h4 style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <Globe size={16} color="#2563eb" />
                          {language === "hi" ? "हिन्दी" : language === "es" ? "Español" : "English"} (Your Copy)
                        </span>
                      </h4>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => void copyToClipboard("translated", letterResult.translatedLetter)} style={buttonStyle}>
                          {copiedLetter === "translated" ? "Copied!" : "Copy"}
                        </button>
                        <button
                          onClick={() => void downloadPDF("translated-letter", `MedExplain-${language}.pdf`)}
                          style={buttonStyle}
                        >
                          Download PDF
                        </button>
                      </div>
                    </div>
                    <div
                      id="translated-letter"
                      style={{
                        fontFamily: "Georgia, serif",
                        fontSize: 13,
                        lineHeight: 1.8,
                        color: "#1e293b",
                        whiteSpace: "pre-wrap",
                        maxHeight: 380,
                        overflowY: "auto",
                        padding: 16,
                        background: "rgba(255,255,255,0.7)",
                        borderRadius: 10,
                      }}
                    >
                      {letterResult.translatedLetter}
                    </div>
                  </div>
                </div>

                <p style={{ textAlign: "center", fontSize: 12, color: "var(--app-text-muted)", marginBottom: 24 }}>
                  MedExplain helps you understand your rights. This is not legal advice. Verify with a healthcare
                  advocate before sending.
                </p>
              </>
            ) : null}
          </div>
        ) : null}

        {analysisResult ? (
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <button
              onClick={handleReset}
              style={{
                padding: "10px 28px",
                borderRadius: 100,
                border: "1.5px solid #e2e8f0",
                background: "var(--app-surface)",
                color: "var(--app-text-muted)",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
                fontFamily: "Cabinet Grotesk, sans-serif",
                minHeight: 44,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <RotateCcw size={16} color="var(--app-text-muted)" />
                Start Over
              </span>
            </button>
          </div>
        ) : null}

      </main>

      {/* ── FOOTER ── full-width, outside max-w container */}
      <footer
        style={{
          borderTop: "1px solid rgba(99,102,241,0.12)",
          marginTop: 40,
          background: "rgba(248,251,255,0.6)",
        }}
      >
        <div
          style={{
            maxWidth: 860,
            margin: "0 auto",
            padding: "28px 24px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Image
              src="/final-logo.png"
              alt="MedExplain logo"
              width={36}
              height={36}
              style={{ height: 34, width: 34, objectFit: "contain" }}
            />
            <span
              style={{
                fontFamily: "Cabinet Grotesk, sans-serif",
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              MedExplain
            </span>
          </div>
          <div style={{ color: "#94a3b8", fontSize: 13 }}>
            © 2026 MedExplain. Not legal or medical advice.
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 16px",
                borderRadius: 100,
                border: "1px solid rgba(99,102,241,0.2)",
                background: "rgba(248,251,255,0.9)",
                fontSize: 12,
                color: "#64748b",
              }}
            >
              <Shield size={12} color="#6366f1" />
              Built for patients, not insurers
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 16px",
                borderRadius: 100,
                border: "1px solid rgba(99,102,241,0.2)",
                background: "rgba(248,251,255,0.9)",
                fontSize: 12,
                color: "#6366f1",
              }}
            >
              <Sparkles size={12} color="#6366f1" />
              Built with Claude AI
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
