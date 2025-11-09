import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import * as XLSX from "xlsx";
import pdfParse from "pdf-parse";

export type ComparisonType = "income" | "expenses" | "both";

interface Bank {
  id: string;
  name: string;
}

interface Church {
  id: string;
  name: string;
  address?: string;
  pastor?: string;
  logoUrl?: string;
}

interface BankStatementFile {
  bankId: string;
  fileName: string;
  content?: string;
  type?: string;
}

interface ContributorFile {
  churchId: string;
  fileName: string;
  content?: string;
  type?: string;
}

interface AppContextType {
  user: string | null;
  setUser: (user: string | null) => void;
  loading: boolean;
  setLoading: (value: boolean) => void;
  activeView: string;
  setActiveView: (view: string) => void;

  banks: Bank[];
  addBank: (bank: Bank) => void;

  churches: Church[];
  addChurch: (church: Church) => void;

  bankStatementFile: BankStatementFile | null;
  contributorFiles: ContributorFile[];

  handleStatementUpload: (file: File, bankId: string) => void;
  handleContributorsUpload: (file: File, churchId: string) => void;

  isCompareDisabled: boolean;
  isLoading: boolean;
  handleCompare: () => void;
  showToast: (msg: string, type: "success" | "error") => void;

  similarityLevel: number;
  setSimilarityLevel: (value: number) => void;
  dayTolerance: number;
  setDayTolerance: (value: number) => void;
  comparisonType: ComparisonType;
  setComparisonType: (type: ComparisonType) => void;

  comparisonResults: Record<string, any[]>;
  unidentifiedResults: any[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<string>("dashboard");

  const [banks, setBanks] = useState<Bank[]>(() => {
    const saved = localStorage.getItem("banks");
    return saved ? JSON.parse(saved) : [];
  });

  const [churches, setChurches] = useState<Church[]>(() => {
    const saved = localStorage.getItem("churches");
    return saved ? JSON.parse(saved) : [];
  });

  const [bankStatementFile, setBankStatementFile] = useState<BankStatementFile | null>(null);
  const [contributorFiles, setContributorFiles] = useState<ContributorFile[]>([]);

  const [isCompareDisabled, setIsCompareDisabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [similarityLevel, setSimilarityLevel] = useState<number>(70);
  const [dayTolerance, setDayTolerance] = useState<number>(5);
  const [comparisonType, setComparisonType] = useState<ComparisonType>("both");

  const [comparisonResults, setComparisonResults] = useState<Record<string, any[]>>({});
  const [unidentifiedResults, setUnidentifiedResults] = useState<any[]>([]);

  // persistência
  useEffect(() => {
    localStorage.setItem("banks", JSON.stringify(banks));
  }, [banks]);

  useEffect(() => {
    localStorage.setItem("churches", JSON.stringify(churches));
  }, [churches]);

  const addBank = (bank: Bank) => setBanks((prev) => [...prev, bank]);
  const addChurch = (church: Church) => setChurches((prev) => [...prev, church]);

  // Leitura genérica de arquivos CSV, XLSX ou PDF
  const readFileContent = async (file: File): Promise<string> => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "csv" || extension === "txt") {
      return file.text();
    } else if (extension === "xlsx") {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
      return sheet;
    } else if (extension === "pdf") {
      const arrayBuffer = await file.arrayBuffer();
      const pdfData = await pdfParse(arrayBuffer);
      return pdfData.text;
    } else {
      throw new Error("Tipo de arquivo não suportado");
    }
  };

  const handleStatementUpload = async (file: File, bankId: string) => {
    try {
      const content = await readFileContent(file);
      setBankStatementFile({ bankId, fileName: file.name, content, type: file.type });
      setIsCompareDisabled(false);
    } catch (err) {
      console.error(err);
      showToast("Erro ao ler arquivo do banco", "error");
    }
  };

  const handleContributorsUpload = async (file: File, churchId: string) => {
    try {
      const content = await readFileContent(file);
      setContributorFiles((prev) => [...prev, { churchId, fileName: file.name, content, type: file.type }]);
      setIsCompareDisabled(false);
    } catch (err) {
      console.error(err);
      showToast("Erro ao ler arquivo da igreja", "error");
    }
  };

  // Identifica as colunas data, nome e valor
  const parseFile = (content: string): any[] => {
    const lines = content.split("\n").filter((l) => l.trim());
    if (!lines.length) return [];

    const headers = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase());
    const dataRows = lines.slice(1);

    const guessIndexes = { date: 0, name: 1, value: 2 }; // default

    // Tenta detectar colunas pelo conteúdo
    dataRows.forEach((row) => {
      const cols = row.split(/[,;\t]/);
      cols.forEach((c, i) => {
        const val = c.trim();
        if (!isNaN(Date.parse(val))) guessIndexes.date = i;
        else if (!isNaN(parseFloat(val.replace(",", ".")))) guessIndexes.value = i;
        else guessIndexes.name = i;
      });
    });

    return dataRows.map((row) => {
      const cols = row.split(/[,;\t]/);
      return {
        date: cols[guessIndexes.date]?.trim(),
        name: cols[guessIndexes.name]?.trim(),
        value: parseFloat(cols[guessIndexes.value]?.replace(",", ".") || "0"),
      };
    });
  };

  const normalizeString = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .toLowerCase()
      .trim();

  const handleCompare = async () => {
    if (!bankStatementFile || contributorFiles.length === 0) {
      showToast("Carregue todos os arquivos antes de comparar", "error");
      return;
    }

    setIsLoading(true);

    try {
      const bankDataRaw = parseFile(bankStatementFile.content || "");
      const bankData = bankDataRaw.map((r) => ({
        ...r,
        name: normalizeString(r.name),
      }));

      const results: Record<string, any[]> = {};
      const unidentified: any[] = [];

      for (const file of contributorFiles) {
        const rowsRaw = parseFile(file.content || "");
        const rows = rowsRaw.map((r) => ({
          ...r,
          name: normalizeString(r.name),
        }));

        results[file.churchId] = [];
        for (const contrib of rows) {
          const match = bankData.find(
            (b) =>
              b.name === contrib.name &&
              Math.abs(new Date(b.date).getTime() - new Date(contrib.date).getTime()) <=
                dayTolerance * 24 * 60 * 60 * 1000 &&
              (comparisonType === "both" ||
                (comparisonType === "income" && contrib.value > 0) ||
                (comparisonType === "expenses" && contrib.value < 0))
          );

          if (match) {
            results[file.churchId].push({ ...contrib, matched: true });
          } else {
            results[file.churchId].push({ ...contrib, matched: false });
            unidentified.push({ ...contrib, churchId: file.churchId });
          }
        }
      }

      setComparisonResults(results);
      setUnidentifiedResults(unidentified);

      showToast("Comparação concluída com sucesso!", "success");
    } catch (err) {
      console.error(err);
      showToast("Erro ao comparar arquivos", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (msg: string, type: "success" | "error") => alert(`${type.toUpperCase()}: ${msg}`);

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        loading,
        setLoading,
        activeView,
        setActiveView,
        banks,
        addBank,
        churches,
        addChurch,
        bankStatementFile,
        contributorFiles,
        handleStatementUpload,
        handleContributorsUpload,
        isCompareDisabled,
        isLoading,
        handleCompare,
        showToast,
        similarityLevel,
        setSimilarityLevel,
        dayTolerance,
        setDayTolerance,
        comparisonType,
        setComparisonType,
        comparisonResults,
        unidentifiedResults,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext deve ser usado dentro de um AppProvider");
  return context;
};

console.log("✅ AppContext.tsx final carregado!");

export { AppContext };
