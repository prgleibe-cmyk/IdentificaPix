import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

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
  content?: string; // opcional, pode conter o arquivo carregado
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
  comparisonResults: Record<string, any>;
  unidentifiedResults: any[];
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

  const [comparisonResults, setComparisonResults] = useState<Record<string, any>>({});
  const [unidentifiedResults, setUnidentifiedResults] = useState<any[]>([]);

  const [similarityLevel, setSimilarityLevel] = useState<number>(70);
  const [dayTolerance, setDayTolerance] = useState<number>(5);
  const [comparisonType, setComparisonType] = useState<ComparisonType>("both");

  // Persistência no localStorage
  useEffect(() => {
    localStorage.setItem("banks", JSON.stringify(banks));
  }, [banks]);

  useEffect(() => {
    localStorage.setItem("churches", JSON.stringify(churches));
  }, [churches]);

  const addBank = (bank: Bank) => {
    setBanks((prev) => [...prev, bank]);
  };

  const addChurch = (church: Church) => {
    setChurches((prev) => [...prev, church]);
  };

  const handleStatementUpload = (content: string, fileName: string, bankId: string) => {
    setBankStatementFile({ content, fileName, bankId });
    setIsCompareDisabled(false);
  };

  const handleContributorsUpload = (content: string, fileName: string, churchId: string) => {
    setContributorFiles((prev) => [...prev, { content, fileName, churchId }]);
    setIsCompareDisabled(false);
  };

  // 🔹 Normalização
  const normalizeString = (str: string) =>
    str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .toLowerCase();

  const parseDate = (val: string | Date) => {
    if (val instanceof Date) return val;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const parseValue = (val: string | number) => {
    if (typeof val === "number") return val;
    const n = parseFloat(val.replace(",", ".").replace(/[^\d.-]/g, ""));
    return isNaN(n) ? 0 : n;
  };

  // 🔹 Comparação
  const handleCompare = () => {
    if (!bankStatementFile || contributorFiles.length === 0) {
      alert("📌 É necessário enviar os arquivos antes de comparar");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      // Aqui você deve processar e limpar os arquivos reais.
      // No exemplo, vamos simular dados lidos:
      const bankData = [
        { name: "Dízimo João", date: "2025-11-08", value: 100 },
        { name: "PIX Maria", date: "2025-11-08", value: 150 },
      ];

      const contributorsData = contributorFiles.map((f) => ({
        churchId: f.churchId,
        contributors: [
          { name: "João", date: "2025-11-08", value: 100 },
          { name: "Maria", date: "2025-11-08", value: 150 },
          { name: "Pedro", date: "2025-11-08", value: 200 },
        ],
      }));

      const results: Record<string, any[]> = {};
      let unidentified: any[] = [];

      contributorsData.forEach(({ churchId, contributors }) => {
        results[churchId] = [];
        contributors.forEach((contrib) => {
          const match = bankData.find(
            (b) =>
              normalizeString(b.name).includes(normalizeString(contrib.name)) &&
              Math.abs(parseValue(b.value) - parseValue(contrib.value)) < 0.01
          );
          if (match) {
            results[churchId].push({ ...contrib, matchedValue: match.value });
          } else {
            unidentified.push(contrib);
          }
        });
      });

      setComparisonResults(results);
      setUnidentifiedResults(unidentified);
      setIsLoading(false);

      console.log("✅ Comparação concluída");
      console.log("Resultados por igreja:", results);
      console.log("Não identificados:", unidentified);
    }, 1000);
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
        comparisonResults,
        unidentifiedResults,
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
