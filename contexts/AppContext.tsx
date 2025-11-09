import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import * as XLSX from "xlsx";

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
  content: string; // arquivo carregado
}

interface ContributorFile {
  churchId: string;
  fileName: string;
  content: string; // arquivo carregado
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

  handleStatementUpload: (content: string, fileName: string, bankId: string) => void;
  handleContributorsUpload: (content: string, fileName: string, churchId: string) => void;

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

  // Persistência
  useEffect(() => { localStorage.setItem("banks", JSON.stringify(banks)); }, [banks]);
  useEffect(() => { localStorage.setItem("churches", JSON.stringify(churches)); }, [churches]);

  const addBank = (bank: Bank) => {
    setBanks((prev) => [...prev, bank]);
  };

  const addChurch = (church: Church) => {
    setChurches((prev) => [...prev, church]);
  };

  const handleStatementUpload = (content: string, fileName: string, bankId: string) => {
    setBankStatementFile({ bankId, fileName, content });
    setIsCompareDisabled(false);
  };

  const handleContributorsUpload = (content: string, fileName: string, churchId: string) => {
    setContributorFiles((prev) => [...prev, { churchId, fileName, content }]);
    setIsCompareDisabled(false);
  };

  const cleanName = (name: string) => {
    const forbidden = ["PIX", "DÍZIMO", "DIZIMO"];
    let n = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    forbidden.forEach(f => { n = n.replace(new RegExp(f, "gi"), ""); });
    n = n.replace(/[^A-Z0-9 ]/g, "").trim();
    return n;
  };

  const parseFile = (file: BankStatementFile | ContributorFile) => {
    let rows: any[] = [];
    try {
      if (file.fileName.endsWith(".csv")) {
        const lines = file.content.split(/\r?\n/).filter(l => l.trim() !== "");
        const headers = lines[0].split(",");
        rows = lines.slice(1).map(line => {
          const values = line.split(",");
          const obj: any = {};
          headers.forEach((h, i) => { obj[h] = values[i]; });
          return obj;
        });
      } else if (file.fileName.endsWith(".xlsx") || file.fileName.endsWith(".xls")) {
        const workbook = XLSX.read(file.content, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        rows = sheet as any[];
      } else if (file.fileName.endsWith(".pdf")) {
        // Para simplicidade, tratar PDF como CSV (em produção usar pdf-parse)
        const lines = file.content.split(/\r?\n/).filter(l => l.trim() !== "");
        const headers = lines[0].split(",");
        rows = lines.slice(1).map(line => {
          const values = line.split(",");
          const obj: any = {};
          headers.forEach((h, i) => { obj[h] = values[i]; });
          return obj;
        });
      }
    } catch (err) {
      console.error("Erro ao ler arquivo:", file.fileName, err);
    }
    return rows;
  };

  const identifyColumns = (rows: any[]) => {
    const columns: any = {};
    if (rows.length === 0) return columns;
    const keys = Object.keys(rows[0]);
    keys.forEach(k => {
      const sample = rows.map(r => r[k]).filter(Boolean).slice(0, 10).join(" ");
      if (/\d{2}\/\d{2}\/\d{4}/.test(sample)) columns.date = k;
      else if (/^\d+(\.\d{2})?$/.test(sample) || /^\d+,\d{2}$/.test(sample)) columns.value = k;
      else columns.name = k;
    });
    return columns;
  };

  const handleCompare = () => {
    if (!bankStatementFile || contributorFiles.length === 0) {
      showToast("Carregue os arquivos antes de comparar", "error");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const bankRows = parseFile(bankStatementFile);
      const bankCols = identifyColumns(bankRows);

      const resultsByChurch: Record<string, any[]> = {};
      const unidentified: any[] = [];

      contributorFiles.forEach(cf => {
        const church = churches.find(c => c.id === cf.churchId);
        if (!church) return;

        const churchRows = parseFile(cf);
        const churchCols = identifyColumns(churchRows);

        const matched: any[] = [];

        churchRows.forEach(cr => {
          const crName = cleanName(cr[churchCols.name]);
          const crValue = parseFloat((cr[churchCols.value] || "0").toString().replace(",", "."));
          const crDate = new Date(cr[churchCols.date]);

          const match = bankRows.find(br => {
            const brName = cleanName(br[bankCols.name]);
            const brValue = parseFloat((br[bankCols.value] || "0").toString().replace(",", "."));
            const brDate = new Date(br[bankCols.date]);
            const dateDiff = Math.abs(brDate.getTime() - crDate.getTime()) / (1000 * 3600 * 24);
            return brName === crName && Math.abs(brValue - crValue) < 0.01 && dateDiff <= dayTolerance;
          });

          if (match) matched.push({ ...cr, matched: true });
          else unidentified.push({ ...cr, churchId: cf.churchId });
        });

        resultsByChurch[cf.churchId] = matched;
      });

      console.log("✅ Comparação concluída");
      console.log("Resultados por igreja:", resultsByChurch);
      console.log("Não identificados:", unidentified);

      setIsLoading(false);
    }, 500);
  };

  const showToast = (msg: string, type: "success" | "error") => {
    alert(`${type.toUpperCase()}: ${msg}`);
  };

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

console.log("✅ AppContext.tsx carregado com sucesso!");
export { AppContext };
