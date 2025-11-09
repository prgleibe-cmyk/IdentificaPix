import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { normalize } from "normalize-text"; // biblioteca fictícia para limpar acentos, etc.

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
  content?: string; // opcional, se quiser guardar conteúdo
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

  // 🔹 Função de comparação completa
  const handleCompare = async () => {
    if (!bankStatementFile || contributorFiles.length === 0) {
      showToast("Você precisa carregar os arquivos antes de comparar.", "error");
      return;
    }

    setIsLoading(true);

    try {
      // 🔹 Parsing fictício de arquivos
      const parseFile = (fileContent: string) => {
        // aqui você implementa parsing real de CSV, XLSX, PDF, etc.
        // para este exemplo, vamos simular dados
        // deve retornar array de objetos { date, name, value }
        return fileContent
          .split("\n")
          .map((line) => {
            const [date, name, value] = line.split(",");
            return { date, name, value };
          })
          .filter((r) => r.date && r.name && r.value);
      };

      const bankData = parseFile(bankStatementFile.content || "");
      const churchDataMap: Record<string, any[]> = {};
      contributorFiles.forEach((file) => {
        churchDataMap[file.churchId] = parseFile(file.content || "");
      });

      // 🔹 Normalização e limpeza
      const normalizeString = (s: string) =>
        s
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9 ]/g, "")
          .toLowerCase()
          .trim();

      const cleanedBankData = bankData.map((row) => ({
        date: row.date,
        name: normalizeString(row.name),
        value: parseFloat(row.value),
      }));

      const cleanedChurchDataMap: Record<string, any[]> = {};
      Object.entries(churchDataMap).forEach(([churchId, rows]) => {
        cleanedChurchDataMap[churchId] = rows.map((row) => ({
          date: row.date,
          name: normalizeString(row.name),
          value: parseFloat(row.value),
        }));
      });

      // 🔹 Comparação
      const results: Record<string, any[]> = {};
      const unidentified: any[] = [];

      Object.entries(cleanedChurchDataMap).forEach(([churchId, rows]) => {
        results[churchId] = [];
        rows.forEach((contrib) => {
          const match = cleanedBankData.find(
            (b) =>
              b.name === contrib.name &&
              Math.abs(new Date(b.date).getTime() - new Date(contrib.date).getTime()) <=
                dayTolerance * 24 * 60 * 60 * 1000 &&
              (comparisonType === "both" ||
                (comparisonType === "income" && contrib.value > 0) ||
                (comparisonType === "expenses" && contrib.value < 0))
          );

          if (match) {
            results[churchId].push({ ...contrib, matched: true });
          } else {
            results[churchId].push({ ...contrib, matched: false });
            unidentified.push({ ...contrib, churchId });
          }
        });
      });

      console.log("✅ Comparação concluída");
      console.log("Resultados por igreja:", results);
      console.log("Não identificados:", unidentified);

      showToast("Comparação concluída com sucesso!", "success");
    } catch (err) {
      console.error(err);
      showToast("Ocorreu um erro ao comparar os arquivos.", "error");
    } finally {
      setIsLoading(false);
    }
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
