import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import * as XLSX from "xlsx"; // para leitura de Excel
import Papa from "papaparse"; // para CSV

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
}

interface ContributorFile {
  churchId: string;
  fileName: string;
  content?: string;
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

  useEffect(() => {
    localStorage.setItem("banks", JSON.stringify(banks));
  }, [banks]);

  useEffect(() => {
    localStorage.setItem("churches", JSON.stringify(churches));
  }, [churches]);

  const addBank = (bank: Bank) => {
    console.log("💾 Salvando banco:", bank.name);
    setBanks((prev) => [...prev, bank]);
  };

  const addChurch = (church: Church) => {
    console.log("💾 Salvando igreja:", church);
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

  const parseFileContent = (file: BankStatementFile | ContributorFile) => {
    if (!file.content) return [];
    const lower = file.fileName.toLowerCase();
    try {
      if (lower.endsWith(".csv")) {
        const parsed = Papa.parse(file.content, { header: true, skipEmptyLines: true });
        return parsed.data;
      } else if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) {
        const workbook = XLSX.read(file.content, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        return XLSX.utils.sheet_to_json(sheet);
      } else {
        console.warn("Formato não suportado ainda:", file.fileName);
        return [];
      }
    } catch (err) {
      console.error("Erro ao parsear arquivo:", file.fileName, err);
      return [];
    }
  };

  const handleCompare = () => {
    if (!bankStatementFile || contributorFiles.length === 0) {
      showToast("Carregue os arquivos antes de comparar!", "error");
      return;
    }

    setIsLoading(true);
    console.log("🔹 Iniciando comparação...");

    // 1️⃣ Ler e imprimir dados do banco
    const bankData = parseFileContent(bankStatementFile);
    console.log("✅ Dados do banco:", bankData);

    // 2️⃣ Ler e imprimir dados das igrejas
    contributorFiles.forEach((churchFile) => {
      const data = parseFileContent(churchFile);
      console.log(`✅ Dados da igreja ${churchFile.churchId}:`, data);
    });

    // Aqui paramos para garantir que todos os dados foram carregados corretamente
    // Em próximas etapas podemos adicionar:
    // - Identificação das colunas data/nome/valor
    // - Limpeza dos nomes
    // - Comparação
    // - Relatórios

    setIsLoading(false);
    console.log("✅ Checagem dos arquivos concluída.");
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
